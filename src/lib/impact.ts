import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";

/**
 * 「基準を直したのに、集計し直していない評価」を見つける。
 *
 * これまでの運用では、スプレッドシートの基準表を直しても、
 * 既に出した評価票がそのまま残り、どれが古い基準のままか誰も分からなかった。
 * ここでは判定に使うマスタの最終更新時刻と、評価を計算した時刻を突き合わせ、
 * 「集計し直したほうがよいサイクル」を画面に出す。
 *
 * 確定済みの評価は自動でも手動でも作り直さない（判定当時の基準を据え置く）。
 * 影響があることだけを知らせ、扱いは人が決める。
 */

/**
 * 判定に効くマスタ。ここに載っているものが変わったら再集計の対象になる。
 *
 * ここに載せる表は「更新時刻（updatedAt）を持っていること」が前提。
 * 持たない表を足すと更新時刻を引けないため、`impact.watched.test.ts` で
 * 全件そろっているかを検査している（足した時点で検査が赤くなる）。
 */
export const WATCHED = [
  { table: s.kpiRankCriteria, label: "KPIのランク基準（A〜Eの線引き）" },
  { table: s.schemeItems, label: "評価項目と配点" },
  { table: s.schemeRankRatios, label: "ランクごとの点数の割合" },
  { table: s.promotionThresholds, label: "昇格に必要な点数" },
  { table: s.kpiItems, label: "KPI項目の計算式" },
  { table: s.kgiCoefficients, label: "達成係数" },
];

/* grade_requirements / promotion_requirements / behavior_guidelines / behavior_levels は
   公開時に form_questions と選択肢へ写す。評価もその写しを読むため、あとから
   マスタを直しても既存フォーム・既存評価は変わらない。
   ここへ加えると、集計し直しても結果が変わらないサイクルを stale と誤表示してしまう。 */

/* office_kgi_results（事業所KGIの達成率）はここに載せない。
   達成率を保存した時点で、その事業所・そのサイクルの確認中の評価の
   個人Pt・賞与額をその場で計算し直しているため（src/lib/kgi-apply.ts）、
   あとから「集計し直してください」と促す必要がない。
   ここに足すと、達成率と関係のないサイクルまで再集計が必要と表示されてしまう。 */

export type ChangedMaster = { label: string; updatedAt: Date };

export type StaleCycle = {
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  /** 集計し直せる評価（確認中のもの）の件数 */
  recomputable: number;
  /** 確定済みで据え置く評価の件数 */
  finalized: number;
  /** 最後に集計した時刻 */
  lastComputedAt: Date | null;
  changed: ChangedMaster[];
};

/** 判定に使うマスタが最後に変わった時刻を、種類ごとに調べる。 */
export async function listMasterChanges(companyId: string): Promise<ChangedMaster[]> {
  const db = await getDb();
  const out: ChangedMaster[] = [];
  for (const w of WATCHED) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t: any = w.table;
    const r = await db.select({ t: sql<number | null>`max(${t.updatedAt})` }).from(t).where(eq(t.companyId, companyId));
    const at = r[0]?.t;
    if (at) out.push({ label: w.label, updatedAt: new Date(Number(at)) });
  }
  return out.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * 集計し直したほうがよいサイクルを返す。
 * 「マスタの更新時刻 > その評価を計算した時刻」のものだけを拾う。
 */
export async function detectStaleCycles(companyId: string): Promise<StaleCycle[]> {
  const db = await getDb();
  const changes = await listMasterChanges(companyId);
  if (changes.length === 0) return [];
  const newest = changes[0].updatedAt.getTime();

  const rows = await db
    .select({
      cycleId: s.evaluations.cycleId,
      cycleName: s.evaluationCycles.name,
      cycleStatus: s.evaluationCycles.status,
      status: s.evaluations.status,
      computedAt: s.evaluations.computedAt,
    })
    .from(s.evaluations)
    .leftJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
    .where(eq(s.evaluations.companyId, companyId))
    .orderBy(desc(s.evaluations.computedAt));

  const byCycle = new Map<string, StaleCycle>();
  for (const r of rows) {
    const computed = r.computedAt?.getTime() ?? 0;
    if (computed >= newest) continue; // 最新の基準で計算済み
    const cur =
      byCycle.get(r.cycleId) ??
      ({
        cycleId: r.cycleId,
        cycleName: r.cycleName ?? "（名称なし）",
        cycleStatus: r.cycleStatus ?? "draft",
        recomputable: 0,
        finalized: 0,
        lastComputedAt: null,
        changed: [],
      } satisfies StaleCycle);
    if (r.status === "finalized") cur.finalized++;
    else cur.recomputable++;
    if (r.computedAt && (!cur.lastComputedAt || r.computedAt > cur.lastComputedAt)) cur.lastComputedAt = r.computedAt;
    byCycle.set(r.cycleId, cur);
  }

  // そのサイクルを計算したあとに変わったマスタだけを添える（原因が分かるようにする）
  for (const c of byCycle.values()) {
    const since = c.lastComputedAt?.getTime() ?? 0;
    c.changed = changes.filter((m) => m.updatedAt.getTime() > since);
  }

  return [...byCycle.values()].sort((a, b) => (b.lastComputedAt?.getTime() ?? 0) - (a.lastComputedAt?.getTime() ?? 0));
}

/** 1人ぶんの評価が、いまの基準より古いかどうか。個人ページの再集計ボタンの出し分けに使う。 */
export async function isEvaluationStale(companyId: string, evaluationId: string): Promise<boolean> {
  const db = await getDb();
  const e = (
    await db
      .select({ computedAt: s.evaluations.computedAt, status: s.evaluations.status })
      .from(s.evaluations)
      .where(and(eq(s.evaluations.companyId, companyId), eq(s.evaluations.id, evaluationId)))
      .limit(1)
  )[0];
  if (!e || e.status === "finalized") return false;
  const changes = await listMasterChanges(companyId);
  if (changes.length === 0) return false;
  return changes[0].updatedAt.getTime() > (e.computedAt?.getTime() ?? 0);
}

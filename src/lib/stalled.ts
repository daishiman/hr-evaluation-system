import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import {
  buildStalledRows,
  type StalledRow,
  type StalledSource,
} from "@/lib/domain/stalled-evaluations";

/**
 * 「締め切った期間に置き去りになっている評価」をDBから読む。
 *
 * 判定そのものは持たない（`src/lib/domain/stalled-evaluations.ts` の純関数に任せる）。
 * ここは読む範囲を決めるだけで、**会社の絞り込みは必ずここで行う**。
 * 画面側で隠す作りにすると、URLを直接叩かれたときに他社の評価が出てしまう。
 *
 * 読むだけで、確定も削除も再集計も一切しない。
 */

/** 締め切られた期間だけを見る。進行中の期間の未確定は、既存のホームにすでに出ている。 */
const CLOSED = "closed";

/**
 * 確定されていない評価（確定待ち）。
 *
 * 締め切られた期間に属し、status が finalized でないもの。
 * 確定済みには一切触れない（読み出しの条件から外しているだけ）。
 */
async function readAwaitingFinalize(companyId: string, managerId?: string, cycleId?: string): Promise<StalledSource[]> {
  const db = await getDb();
  const conds = [
    eq(s.evaluations.companyId, companyId),
    ne(s.evaluations.status, "finalized"),
    // 期間を名指しするとき（締め切る直前の確認）は、まだ締め切っていないので状態で絞らない。
    cycleId ? eq(s.evaluations.cycleId, cycleId) : eq(s.evaluationCycles.status, CLOSED),
  ];
  // マネージャーは自分が上長のメンバーだけ。自分で確定できない分を「次の作業」として出さない。
  if (managerId) conds.push(eq(s.users.managerId, managerId));

  const rows = await db
    .select({
      cycleId: s.evaluations.cycleId,
      cycleName: s.evaluationCycles.name,
      periodEnd: s.evaluationCycles.periodEnd,
      evaluationId: s.evaluations.id,
      employeeId: s.evaluations.employeeId,
      employeeName: s.users.name,
      gradeName: s.grades.name,
    })
    .from(s.evaluations)
    .innerJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.evaluations.cycleId))
    .innerJoin(s.users, eq(s.users.id, s.evaluations.employeeId))
    .leftJoin(s.grades, eq(s.grades.id, s.evaluations.gradeId))
    .where(and(...conds));

  return rows.map((r) => ({ ...r, kind: "finalize" as const }));
}

/**
 * 提出済みなのに評価がまだ作られていない分（集計待ち）。
 *
 * 本人から見れば「出したのに何も返ってこない」で確定待ちと同じ状態なので、
 * 別の知らせに分けず、同じ一覧に並べる。
 */
async function readAwaitingBuild(companyId: string, managerId?: string, cycleId?: string): Promise<StalledSource[]> {
  const db = await getDb();
  const conds = [
    eq(s.formResponses.companyId, companyId),
    eq(s.formResponses.status, "submitted"),
    cycleId ? eq(s.formResponses.cycleId, cycleId) : eq(s.evaluationCycles.status, CLOSED),
    // 同じ期・同じ人の評価がまだ無いものだけ
    isNull(s.evaluations.id),
  ];
  if (managerId) conds.push(eq(s.users.managerId, managerId));

  const rows = await db
    .select({
      cycleId: s.formResponses.cycleId,
      cycleName: s.evaluationCycles.name,
      periodEnd: s.evaluationCycles.periodEnd,
      employeeId: s.formResponses.employeeId,
      employeeName: s.users.name,
      gradeName: s.grades.name,
    })
    .from(s.formResponses)
    .innerJoin(s.evaluationCycles, eq(s.evaluationCycles.id, s.formResponses.cycleId))
    .innerJoin(s.users, eq(s.users.id, s.formResponses.employeeId))
    .leftJoin(s.grades, eq(s.grades.id, s.formResponses.gradeId))
    .leftJoin(
      s.evaluations,
      and(
        eq(s.evaluations.cycleId, s.formResponses.cycleId),
        eq(s.evaluations.employeeId, s.formResponses.employeeId),
      ),
    )
    .where(and(...conds));

  return rows.map((r) => ({ ...r, kind: "build" as const, evaluationId: null }));
}

/**
 * 1社ぶんの放置一覧。
 *
 * @param companyId 対象の会社。呼び出し側は必ず `resolveCompanyId` を通した値を渡す
 * @param opts.managerId 指定すると、その人が上長のメンバーだけに絞る
 */
export async function listStalledEvaluations(
  companyId: string,
  opts: { managerId?: string; now?: Date } = {},
): Promise<StalledRow[]> {
  const [finalize, build] = await Promise.all([
    readAwaitingFinalize(companyId, opts.managerId),
    readAwaitingBuild(companyId, opts.managerId),
  ]);
  return buildStalledRows([...finalize, ...build], opts.now ?? new Date());
}

/**
 * ある評価期間に残っている「まだ確定していない分」の名前。締め切る直前の確認に使う。
 *
 * まだ締め切っていない期間を見るので、日数（放置何日）は数えない。
 * 会社の絞り込みはここで行う（画面から渡された cycleId だけを信じない）。
 * 同じ人が2行出ることがある（アンケートを作り直すと回答が版ごとに残る）ため、
 * 人ごとにまとめてから返す。
 */
export async function listUnfinalizedNamesInCycle(companyId: string, cycleId: string): Promise<(string | null)[]> {
  const [finalize, build] = await Promise.all([
    readAwaitingFinalize(companyId, undefined, cycleId),
    readAwaitingBuild(companyId, undefined, cycleId),
  ]);
  const byEmployee = new Map<string, string | null>();
  for (const row of [...finalize, ...build]) {
    if (!byEmployee.has(row.employeeId)) byEmployee.set(row.employeeId, row.employeeName);
  }
  // 名前のある人を先に出す（確認の窓では、まず誰か分かる人を見せる）
  return [...byEmployee.values()].sort((a, b) => {
    if (!a) return b ? 1 : 0;
    if (!b) return -1;
    return a.localeCompare(b, "ja");
  });
}

export type StalledRowWithCompany = StalledRow & { companyId: string; companyName: string };

/**
 * 全社ぶんの放置一覧（システム全体管理者だけが呼ぶ）。
 *
 * 会社をまたぐので、呼び出し側で必ず SUPER_ADMIN を確かめること。
 * 全体管理者のホームでは会社ごとの件数までを出し、個人名は出さない
 * （他社の個人名を、日常的に開く画面へ常時並べない）。
 */
export async function listStalledAcrossCompanies(now: Date = new Date()): Promise<StalledRowWithCompany[]> {
  const db = await getDb();
  const companies = await db
    .select({ id: s.companies.id, name: s.companies.name })
    .from(s.companies)
    .where(and(eq(s.companies.isActive, true), eq(s.companies.isTemplate, false)));

  const out: StalledRowWithCompany[] = [];
  for (const company of companies) {
    const rows = await listStalledEvaluations(company.id, { now });
    for (const row of rows) out.push({ ...row, companyId: company.id, companyName: company.name });
  }
  return out;
}

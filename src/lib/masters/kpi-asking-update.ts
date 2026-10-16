import { and, eq, isNotNull } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import {
  askingReadonlyReason,
  checkAskingFormula,
  deriveQuestionRoles,
  lettersToKeys,
  nextQuestionKeys,
} from "@/lib/domain/kpi-asking";
import { kpiItemCollectingForms } from "@/lib/master-usage";
import type { MasterUpdateBody } from "./body-schema";
import type { MasterStatement } from "./write-batch";

type Db = Awaited<ReturnType<typeof getDb>>;

export type KpiAskingInput = NonNullable<Extract<MasterUpdateBody, { kind: "kpiItemUpdate" }>["asking"]>;

export interface KpiAskingPlan {
  /** 設問のひな形を足す・直す・消す文。項目本体と監査記録の文は呼ぶ側が足す */
  statements: MasterStatement[];
  /** 設問IDで書いた式（kpi_items.formula に書く値） */
  formula: string;
  /** 監査記録に残す、聞くことの並びの要約（前と後） */
  summaryBefore: string;
  summaryAfter: string;
}

type Question = typeof s.kpiQuestions.$inferSelect;

/** 単位の「-」は単位なしと同じ（form-question-text.ts の kpiQuestion も同じに読む） */
const unitOf = (unit: string | null | undefined): string | null => (unit && unit.trim() !== "-" ? unit.trim() : null);

function summarize(rows: readonly { questionKey: string; text: string; unit: string | null; validation: string | null }[]): string {
  return rows.map((q) => `${q.questionKey} ${q.text}（${[unitOf(q.unit), q.validation].filter(Boolean).join("・")}）`).join("／");
}

/**
 * KPI項目の聞き方の保存を組み立てる（DD-016）。書き込みはしない。
 *
 * 断るもの:
 * - 固定枠の項目と、画面で表せない設問を持つ項目（kpi-asking.ts の askingReadonlyReason）
 * - この項目に無い設問ID・同じ設問IDの2回送り（古い画面や他の項目の設問を書き換えさせない）
 * - 使えない式（checkAskingFormula。画面と同じ検査）
 * - 回答を集めたアンケートが使っている項目で、聞くことを足す・消す
 *   （文言・単位・入力の決まり・並び・式は直せる）
 */
export async function planKpiAsking(args: {
  db: Db;
  companyId: string;
  item: { id: string; no: number; isFixedSlot: boolean };
  asking: KpiAskingInput;
}): Promise<KpiAskingPlan> {
  const { db, companyId, item, asking } = args;

  const existing: Question[] = (
    await db
      .select()
      .from(s.kpiQuestions)
      .where(and(eq(s.kpiQuestions.companyId, companyId), eq(s.kpiQuestions.kpiItemId, item.id)))
  ).sort((a, b) => a.displayOrder - b.displayOrder);

  const readonly = askingReadonlyReason(item, existing);
  if (readonly) throw new HttpError(400, readonly);

  const byKey = new Map(existing.map((q) => [q.questionKey, q]));
  const sentKeys = asking.questions.map((q) => q.key).filter((k): k is string => k !== undefined);
  for (const key of sentKeys) {
    if (!byKey.has(key)) {
      throw new HttpError(409, "この項目に無い設問が送られました。再読み込みして、最新の聞き方を確かめてから保存してください。");
    }
  }
  if (new Set(sentKeys).size !== sentKeys.length) {
    throw new HttpError(400, "同じ設問が2回送られました。再読み込みしてから保存してください。");
  }

  const formulaError = checkAskingFormula(asking.formula, asking.questions.length);
  if (formulaError) throw new HttpError(400, formulaError);

  const removed = existing.filter((q) => !sentKeys.includes(q.questionKey));
  const addedCount = asking.questions.length - sentKeys.length;
  if (removed.length > 0 || addedCount > 0) {
    const collecting = (await kpiItemCollectingForms(db, companyId))[item.id];
    if (collecting) {
      throw new HttpError(
        400,
        `${collecting}がこの項目の設問で回答を集めているため、聞くことを足したり消したりはできません。` +
          "文言・単位・入力の決まり・並び・計算式は直せます。別の聞き方が要るときは、新しいKPI項目として作ってください。",
      );
    }
  }

  /* 新しい設問のIDは、作ったアンケートの設問が覚えているIDとも重ならない番号から振る */
  const taken = [
    ...(await db.select({ key: s.kpiQuestions.questionKey }).from(s.kpiQuestions).where(eq(s.kpiQuestions.companyId, companyId))),
    ...(await db
      .select({ key: s.formQuestions.kpiQuestionKey })
      .from(s.formQuestions)
      .where(and(eq(s.formQuestions.companyId, companyId), isNotNull(s.formQuestions.kpiQuestionKey)))),
  ].map((r) => r.key as string);
  const fresh = nextQuestionKeys(item.no, taken, addedCount);
  const keys = asking.questions.map((q) => q.key ?? (fresh.shift() as string));

  const formula = lettersToKeys(asking.formula, keys);
  const roles = deriveQuestionRoles(formula, keys);
  /* 対象等級はアンケートの組み立てが項目ごとにそろっている前提で絞り込むので、項目の最初の設問から引き継ぐ */
  const targetGrades = existing[0]?.targetGrades ?? null;
  /* 並びが効くのは項目の中の前後だけ（form-build.ts は項目ごとに絞ってから並べる）。
     見本の設問は会社全体の通し番号なので、項目のいちばん小さい番号から振り、並べ替えていない保存で書き換えない */
  const firstOrder = existing[0]?.displayOrder ?? item.no * 100 + 1;

  const statements: MasterStatement[] = [];
  const after: { questionKey: string; text: string; unit: string | null; validation: string | null }[] = [];
  asking.questions.forEach((q, i) => {
    const values = {
      text: q.text,
      unit: unitOf(q.unit),
      validation: q.validation,
      role: roles[i],
      displayOrder: firstOrder + i,
    };
    after.push({ questionKey: keys[i], ...values });
    const prev = q.key ? byKey.get(q.key) : undefined;
    if (prev) {
      const same =
        prev.text === values.text &&
        unitOf(prev.unit) === values.unit &&
        prev.validation === values.validation &&
        prev.role === values.role &&
        prev.displayOrder === values.displayOrder;
      if (!same) statements.push(db.update(s.kpiQuestions).set(values).where(eq(s.kpiQuestions.id, prev.id)));
    } else {
      statements.push(
        db.insert(s.kpiQuestions).values({
          id: newId("kq"),
          companyId,
          kpiItemId: item.id,
          questionKey: keys[i],
          inputType: "number",
          required: true,
          targetGrades,
          ...values,
        }),
      );
    }
  });
  for (const q of removed) statements.push(db.delete(s.kpiQuestions).where(eq(s.kpiQuestions.id, q.id)));

  return { statements, formula, summaryBefore: summarize(existing), summaryAfter: summarize(after) };
}

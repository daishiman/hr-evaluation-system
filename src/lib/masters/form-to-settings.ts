import { and, asc, eq } from "drizzle-orm";
import { chunkRowsForD1, schema as s } from "@/lib/db";
import type { getDb } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { newId } from "@/lib/id";
import { schemeIdForCycle } from "@/lib/cycle-scheme";
import { kpiItemCollectingForms } from "@/lib/master-usage";
import { behaviorQuestionRow, kpiQuestionRows, promotionQuestionRow, questionInsertStatements, requirementQuestionRow, type QuestionRowBody } from "@/lib/form-build";
import { constitutionEventStatements, type ConstitutionEntityType } from "@/lib/domain/constitution-events";
import { GRADE_REQUIREMENT_MAX } from "@/lib/domain/grade-requirements";
import { pointGroupLabel } from "@/lib/domain/grade-label";
import type { GradePointRule } from "@/lib/domain/grade-points";
import type { FollowKind } from "@/lib/domain/settings-follow";
import type { QuestionIdPlan, QuestionLinks, SubmittedQuestion } from "@/lib/domain/form-question-links";
import { promotionQuestion, requirementQuestion, settingTextFromTitle } from "@/lib/domain/form-question-text";
import { kpiItemPath, schemeStepPath } from "@/lib/domain/scheme-steps";
import { currentVersionRows, lineageRootId } from "@/lib/domain/versioned-master";
import {
  bracketRefusal,
  checkAddedTwice,
  checkFormulaKeys,
  diffFormSettings,
  GUIDELINE_NAME_MAX,
  KPI_QUESTION_TEXT_MAX,
  kpiRemovals,
  rearrangeSlots,
  requirementTextOf,
  settingLinkOf,
  settingTextRefusal,
  slotEntryOf,
  type FormSettingsRefusal,
  type SettingLink,
  type StoredWithTitle,
} from "@/lib/domain/form-to-settings";
import { followSettings } from "./follow-settings";
import { summarizeAsking } from "./kpi-asking-update";
import { translateWriteError } from "./versioned-requirement-update";
import { writeMasterBatch, type MasterStatement } from "./write-batch";

type Db = Awaited<ReturnType<typeof getDb>>;

/** 要件の文の長さ（等級要件・昇格要件の画面と同じ上限。body-schema.ts） */
const REQUIREMENT_TEXT_MAX = 300;

export interface FormSettingsPlan {
  /** 設定・評価セット・制度の変更の記録を書く文。アンケートの設問と同じ batch に入れる */
  statements: MasterStatement[];
  /** 書いたあとに追従させる設定の種類（followSettings に渡す） */
  kinds: FollowKind[];
  /** 足した設問の位置ごとの、設定から作った設問（KPI は聞くことの数だけ） */
  addedRows: Map<number, QuestionRowBody[]>;
  /** 新しい版に付け替えた要件の設問の位置ごとの、紐づけと文の上書き */
  relinked: Map<number, Partial<QuestionLinks & { title: string }>>;
}

function refuse(r: FormSettingsRefusal, status = 400): never {
  throw new HttpError(status, r.message, undefined, r.fixHref);
}

const STALE_SETTING = "は別の画面ですでに変更されています。画面を更新して、現在の版を確認してください。";

/**
 * 下書きのアンケートの保存を、制度の設定へ写す文を組み立てる（DD-028 の 1〜3）。書き込みはしない。
 *
 * 断るとき（評価セットの決まり・計算式・他社の行・古い版など）は、何も書く前に HttpError を投げる。
 * 呼ぶ側は返った文をアンケートの設問の書き換えと1つの batch で書くので、途中まで反映された状態は残らない。
 */
export async function planFormToSettings(args: {
  db: Db;
  companyId: string;
  actorId: string;
  form: { id: string; gradeId: string; cycleId: string };
  submitted: readonly SubmittedQuestion[];
  ids: readonly QuestionIdPlan[];
  stored: readonly StoredWithTitle[];
}): Promise<FormSettingsPlan> {
  const { db, companyId, actorId, form, submitted, ids, stored } = args;
  const diff = diffFormSettings(submitted, ids, stored);
  const plan: FormSettingsPlan = { statements: [], kinds: [], addedRows: new Map(), relinked: new Map() };
  if (diff.retitled.length === 0 && diff.removed.length === 0 && diff.added.length === 0) return plan;

  const grade = (
    await db.select().from(s.grades).where(and(eq(s.grades.id, form.gradeId), eq(s.grades.companyId, companyId))).limit(1)
  )[0];
  if (!grade) throw new HttpError(404, "等級が見つかりませんでした。");
  const [gradeReqs, promoReqs, guidelines, kpiItems, kpiQuestions] = await Promise.all([
    db.select().from(s.gradeRequirements).where(eq(s.gradeRequirements.companyId, companyId)),
    db.select().from(s.promotionRequirements).where(eq(s.promotionRequirements.companyId, companyId)),
    db.select().from(s.behaviorGuidelines).where(eq(s.behaviorGuidelines.companyId, companyId)),
    db.select().from(s.kpiItems).where(eq(s.kpiItems.companyId, companyId)),
    db.select().from(s.kpiQuestions).where(eq(s.kpiQuestions.companyId, companyId)),
  ]);
  /* 足した行をもう聞いていないか。断りには、打った文ではなく設定の行の名前を出す */
  const keptIds = new Set(submitted.map((q, i) => (ids[i] === "keep" ? q.id : undefined)).filter(Boolean));
  const nameOf = (link: SettingLink): string => {
    if (link.kind === "kpiItem") return kpiItems.find((k) => k.id === link.id)?.name ?? link.id;
    if (link.kind === "behaviorGuideline") return guidelines.find((g) => g.id === link.id)?.aspectName ?? link.id;
    const rows: readonly { id: string; text: string }[] = link.kind === "gradeRequirement" ? gradeReqs : promoReqs;
    return rows.find((r) => r.id === link.id)?.text ?? link.id;
  };
  const twice = checkAddedTwice(diff, stored.filter((q) => keptIds.has(q.id)), nameOf);
  if (twice) refuse(twice);
  const terminalGrade = new Set(currentVersionRows(gradeReqs).map((r) => r.id));
  const terminalPromo = new Set(currentVersionRows(promoReqs).map((r) => r.id));
  const itemQuestions = (itemId: string) =>
    kpiQuestions.filter((q) => q.kpiItemId === itemId).sort((a, b) => a.displayOrder - b.displayOrder);
  /** 版の記録は最初の版の id に付ける（等級要件・昇格要件の画面と同じ） */
  const rootOf = (kind: "gradeRequirement" | "promotionRequirement", id: string) =>
    kind === "gradeRequirement" ? lineageRootId(gradeReqs, id) : lineageRootId(promoReqs, id);

  /* 制度の変更の記録は、同じ行につき1つの batch で1件まで（seq が重なるため）。行ごとに前後をまとめてから文にする */
  const events: { entityType: ConstitutionEntityType; entityId: string; eventType: string; before: object; after: object }[] = [];
  const updates: MasterStatement[] = [];
  const deactivations: MasterStatement[] = [];
  const activations: MasterStatement[] = [];
  const kinds = new Set<FollowKind>();

  /* ---- 文を直した設問: 設定の文を変える ---- */
  const kpiTextChanges = new Map<string, Map<string, string>>();
  for (const r of diff.retitled) {
    const link = settingLinkOf(r.stored) as SettingLink;
    if (link.kind === "gradeRequirement" || link.kind === "promotionRequirement") {
      const isGrade = link.kind === "gradeRequirement";
      const rows = isGrade ? gradeReqs : promoReqs;
      const current = rows.find((x) => x.id === link.id);
      const label = isGrade ? "等級要件" : "昇格要件";
      if (!current || !(isGrade ? terminalGrade : terminalPromo).has(current.id) || !current.isActive) {
        throw new HttpError(409, `${label}${STALE_SETTING}`);
      }
      const canonical = (text: string) =>
        isGrade
          ? requirementQuestion((current as typeof s.gradeRequirements.$inferSelect).category as "support" | "operation", text).title
          : promotionQuestion((current as typeof s.promotionRequirements.$inferSelect).kind as "report" | "test", text).title;
      const text = requirementTextOf(r.title, settingTextFromTitle, canonical);
      if (text === null) refuse(bracketRefusal(r.title));
      const tooLong = settingTextRefusal(text, REQUIREMENT_TEXT_MAX);
      if (tooLong) refuse(tooLong);
      if (text === current.text) continue;
      const id = newId(isGrade ? "greq" : "preq");
      const next = { ...current, id, text, isActive: true, previousVersionId: current.id };
      if (isGrade) {
        const c = current as typeof s.gradeRequirements.$inferSelect;
        updates.push(
          db.insert(s.gradeRequirements).values({
            id, companyId, gradeId: c.gradeId, category: c.category, seq: c.seq, text, isActive: true, previousVersionId: c.id,
          }),
        );
      } else {
        const c = current as typeof s.promotionRequirements.$inferSelect;
        updates.push(
          db.insert(s.promotionRequirements).values({
            id, companyId, gradeId: c.gradeId, kind: c.kind, transitionLabel: c.transitionLabel, seq: c.seq,
            text, isGate: c.isGate, isActive: true, previousVersionId: c.id,
          }),
        );
      }
      events.push({ entityType: link.kind, entityId: rootOf(link.kind, current.id), eventType: "revised", before: current, after: next });
      plan.relinked.set(r.index, {
        [isGrade ? "gradeRequirementId" : "promotionRequirementId"]: id,
        title: canonical(text),
      });
      kinds.add(isGrade ? "gradeRequirementRevise" : "promotionRequirementRevise");
    } else if (link.kind === "behaviorGuideline") {
      const g = guidelines.find((x) => x.id === link.id);
      if (!g) throw new HttpError(409, `行動指針${STALE_SETTING}`);
      const bad = settingTextRefusal(r.title, GUIDELINE_NAME_MAX);
      if (bad) refuse(bad);
      if (g.aspectName === r.title) continue;
      updates.push(db.update(s.behaviorGuidelines).set({ aspectName: r.title }).where(eq(s.behaviorGuidelines.id, g.id)));
      events.push({ entityType: "behaviorGuideline", entityId: g.id, eventType: "updated", before: g, after: { ...g, aspectName: r.title } });
      kinds.add("behaviorGuideline");
    } else if (r.stored.kpiQuestionKey) {
      const bad = settingTextRefusal(r.title, KPI_QUESTION_TEXT_MAX);
      if (bad) refuse(bad);
      const byKey = kpiTextChanges.get(link.id) ?? new Map<string, string>();
      byKey.set(r.stored.kpiQuestionKey, r.title);
      kpiTextChanges.set(link.id, byKey);
    }
  }

  /* ---- 外した設問: 設定を使わない状態にする。KPI は聞くことだけか、項目ごと評価セットから外す ---- */
  const kpiKeyRemovals = new Map<string, Set<string>>();
  const kpi = kpiRemovals(diff.removed, stored);
  if (kpi.keys.length > 0) {
    const formula = checkFormulaKeys(kpi.keys, (itemId) => {
      const item = kpiItems.find((k) => k.id === itemId);
      return item ? { name: item.name, formula: item.formula ?? "" } : undefined;
    });
    if (formula) refuse(formula);
    const collecting = await kpiItemCollectingForms(db, companyId);
    for (const { itemId, key } of kpi.keys) {
      if (collecting[itemId]) {
        refuse({
          message: `${collecting[itemId]}がこの項目の設問で回答を集めているため、聞くことは外せません。`,
          fixHref: kpiItemPath(itemId),
        });
      }
      const set = kpiKeyRemovals.get(itemId) ?? new Set<string>();
      set.add(key);
      kpiKeyRemovals.set(itemId, set);
    }
  }
  for (const q of diff.removed) {
    const link = settingLinkOf(q) as SettingLink;
    if (link.kind === "gradeRequirement" || link.kind === "promotionRequirement") {
      const isGrade = link.kind === "gradeRequirement";
      const rows = isGrade ? gradeReqs : promoReqs;
      const current = rows.find((x) => x.id === link.id);
      if (!current || !current.isActive) continue;
      const table = isGrade ? s.gradeRequirements : s.promotionRequirements;
      deactivations.push(db.update(table).set({ isActive: false }).where(and(eq(table.id, current.id), eq(table.companyId, companyId))));
      events.push({ entityType: link.kind, entityId: rootOf(link.kind, current.id), eventType: "deactivated", before: current, after: { ...current, isActive: false } });
      kinds.add(isGrade ? "gradeRequirementActivation" : "promotionRequirementActivation");
    } else if (link.kind === "behaviorGuideline") {
      const g = guidelines.find((x) => x.id === link.id);
      if (!g || !g.isActive) continue;
      deactivations.push(db.update(s.behaviorGuidelines).set({ isActive: false }).where(eq(s.behaviorGuidelines.id, g.id)));
      events.push({ entityType: "behaviorGuideline", entityId: g.id, eventType: "updated", before: g, after: { ...g, isActive: false } });
      kinds.add("behaviorGuideline");
    }
  }

  /* ---- KPI の聞くことの文の変更と外した聞くことを、項目ごとに1件の記録にまとめる ---- */
  for (const itemId of new Set([...kpiTextChanges.keys(), ...kpiKeyRemovals.keys()])) {
    const item = kpiItems.find((k) => k.id === itemId);
    if (!item) throw new HttpError(409, `KPI項目${STALE_SETTING}`);
    const before = itemQuestions(itemId);
    const texts = kpiTextChanges.get(itemId) ?? new Map<string, string>();
    const gone = kpiKeyRemovals.get(itemId) ?? new Set<string>();
    const after = before.filter((q) => !gone.has(q.questionKey)).map((q) => ({ ...q, text: texts.get(q.questionKey) ?? q.text }));
    for (const q of before) {
      if (gone.has(q.questionKey)) updates.push(db.delete(s.kpiQuestions).where(eq(s.kpiQuestions.id, q.id)));
      else if (texts.has(q.questionKey) && texts.get(q.questionKey) !== q.text) {
        updates.push(db.update(s.kpiQuestions).set({ text: texts.get(q.questionKey) }).where(eq(s.kpiQuestions.id, q.id)));
      }
    }
    if (summarizeAsking(before) === summarizeAsking(after)) continue;
    events.push({
      entityType: "kpiItem",
      entityId: itemId,
      eventType: "updated",
      before: { ...item, asking: summarizeAsking(before) },
      after: { ...item, asking: summarizeAsking(after) },
    });
    kinds.add("kpiItemUpdate");
  }

  /* ---- 足した設問: 設定から作る。使わない状態の行は使う状態に戻す ---- */
  const addedKpi: { id: string; categoryId: string | null }[] = [];
  for (const a of diff.added) {
    const link = a.link;
    if (link.kind === "gradeRequirement" || link.kind === "promotionRequirement") {
      const isGrade = link.kind === "gradeRequirement";
      const rows = isGrade ? gradeReqs : promoReqs;
      const row = rows.find((x) => x.id === link.id);
      const label = isGrade ? "等級要件" : "昇格要件";
      if (!row) throw new HttpError(400, `選んだ${label}が、この会社に見つかりませんでした。`);
      if (!(isGrade ? terminalGrade : terminalPromo).has(row.id)) throw new HttpError(409, `${label}${STALE_SETTING}`);
      if (row.gradeId !== form.gradeId) throw new HttpError(400, `選んだ${label}は、このアンケートの等級のものではありません。`);
      if (!row.isActive) {
        if (isGrade) {
          const c = row as typeof s.gradeRequirements.$inferSelect;
          const active = currentVersionRows(gradeReqs).filter(
            (x) => x.gradeId === c.gradeId && x.category === c.category && x.isActive && !diff.removed.some((q) => q.gradeRequirementId === x.id),
          ).length;
          if (active >= GRADE_REQUIREMENT_MAX) {
            refuse({ message: `この区分は${GRADE_REQUIREMENT_MAX}項目までです。ほかの項目を外してから足してください。` });
          }
        }
        const table = isGrade ? s.gradeRequirements : s.promotionRequirements;
        activations.push(db.update(table).set({ isActive: true }).where(and(eq(table.id, row.id), eq(table.companyId, companyId))));
        events.push({ entityType: link.kind, entityId: rootOf(link.kind, row.id), eventType: "activated", before: row, after: { ...row, isActive: true } });
        kinds.add(isGrade ? "gradeRequirementActivation" : "promotionRequirementActivation");
      }
      plan.addedRows.set(a.index, [
        isGrade
          ? requirementQuestionRow(row, (row as typeof s.gradeRequirements.$inferSelect).category as "support" | "operation")
          : promotionQuestionRow(row as typeof s.promotionRequirements.$inferSelect & { kind: "report" | "test" }),
      ]);
    } else if (link.kind === "behaviorGuideline") {
      const g = guidelines.find((x) => x.id === link.id);
      if (!g) throw new HttpError(400, "選んだ行動指針が、この会社に見つかりませんでした。");
      if (g.band !== grade.behaviorBand) throw new HttpError(400, `「${g.aspectName}」は、このアンケートの等級の行動指針ではありません。`);
      if (!g.isActive) {
        activations.push(db.update(s.behaviorGuidelines).set({ isActive: true }).where(eq(s.behaviorGuidelines.id, g.id)));
        events.push({ entityType: "behaviorGuideline", entityId: g.id, eventType: "updated", before: g, after: { ...g, isActive: true } });
        kinds.add("behaviorGuideline");
      }
      const levels = await db
        .select()
        .from(s.behaviorLevels)
        .where(and(eq(s.behaviorLevels.companyId, companyId), eq(s.behaviorLevels.guidelineId, g.id)))
        .orderBy(asc(s.behaviorLevels.score));
      if (levels.length < 2) {
        refuse({ message: `「${g.aspectName}」には段階が2つ以上ありません。行動指針の画面で段階を足してください。`, fixHref: "/admin/behavior" });
      }
      plan.addedRows.set(a.index, [behaviorQuestionRow(g, levels)]);
    } else {
      const item = kpiItems.find((k) => k.id === link.id);
      if (!item) throw new HttpError(400, "選んだKPI項目が、この会社に見つかりませんでした。");
      const rows = kpiQuestionRows(item.id, itemQuestions(item.id), grade.pointGroup, item.name);
      if (rows.length === 0) {
        refuse({ message: `「${item.name}」には、この等級で聞くことがありません。KPI項目の画面で聞くことを足してください。`, fixHref: kpiItemPath(item.id) });
      }
      plan.addedRows.set(a.index, rows);
      addedKpi.push({ id: item.id, categoryId: item.categoryId });
    }
  }

  /* ---- 評価セット: 項目ごと外した KPI と足した KPI で、この等級区分の枠を組み直す ---- */
  const schemeStatements: MasterStatement[] = [];
  if (kpi.items.length > 0 || addedKpi.length > 0) {
    const cycle = (
      await db.select().from(s.evaluationCycles).where(and(eq(s.evaluationCycles.id, form.cycleId), eq(s.evaluationCycles.companyId, companyId))).limit(1)
    )[0];
    const schemeId = cycle ? await schemeIdForCycle(companyId, cycle) : null;
    if (schemeId) {
      const pg = grade.pointGroup;
      const [ruleRow] = await db
        .select()
        .from(s.gradePointRules)
        .where(and(eq(s.gradePointRules.companyId, companyId), eq(s.gradePointRules.pointGroup, pg)))
        .limit(1);
      if (!ruleRow) refuse({ message: "この等級区分の配点ルールが登録されていません。", fixHref: schemeStepPath(pg, "select") });
      const rule: GradePointRule = {
        pointGroup: ruleRow.pointGroup,
        totalPoints: ruleRow.totalPoints,
        fixedSlotPoints: ruleRow.fixedSlotPoints,
        majorSlotPoints: ruleRow.majorSlotPoints,
        majorSlotCount: ruleRow.majorSlotCount,
        minorSlotPoints: ruleRow.minorSlotPoints,
        minorSlotCount: ruleRow.minorSlotCount,
      };
      const groupGrades = await db
        .select({ name: s.grades.name, pointGroup: s.grades.pointGroup, displayOrder: s.grades.displayOrder })
        .from(s.grades)
        .where(and(eq(s.grades.companyId, companyId), eq(s.grades.pointGroup, pg)));
      const current = await db
        .select()
        .from(s.schemeItems)
        .where(and(eq(s.schemeItems.schemeId, schemeId), eq(s.schemeItems.pointGroup, pg)))
        .orderBy(s.schemeItems.displayOrder);
      const next = rearrangeSlots({
        slots: current.map((x) => ({
          kpiItemId: x.kpiItemId, categoryId: x.categoryId, weight: x.weight, isFixedSlot: x.isFixedSlot,
          isMajorSlot: x.isMajorSlot ?? false, displayOrder: x.displayOrder,
        })),
        removedItemIds: kpi.items,
        addedItems: addedKpi,
        rule,
        fixedSlotItemIds: kpiItems.filter((k) => k.isFixedSlot).map((k) => k.id),
        pointGroup: pg,
        groupLabel: pointGroupLabel(pg, groupGrades),
        itemNameOf: (id) => kpiItems.find((k) => k.id === id)?.name ?? id,
      });
      if (!next.ok) refuse(next);
      if (next.changed) {
        const rows = next.slots.map((x) => ({ id: newId("si"), companyId, schemeId, pointGroup: pg, ...x }));
        schemeStatements.push(
          db.delete(s.schemeItems).where(and(eq(s.schemeItems.schemeId, schemeId), eq(s.schemeItems.pointGroup, pg))),
          ...chunkRowsForD1(rows).map((chunk) => db.insert(s.schemeItems).values(chunk)),
          db.update(s.evaluationSchemes).set({ updatedAt: new Date() }).where(eq(s.evaluationSchemes.id, schemeId)),
        );
        events.push({
          entityType: "evaluationScheme",
          entityId: schemeId,
          eventType: "updated",
          before: { [`items:${pg}`]: JSON.stringify(current.map(slotEntryOf)) },
          after: { [`items:${pg}`]: JSON.stringify(next.slots.map(slotEntryOf)) },
        });
        kinds.add("scheme");
      }
    }
  }

  const eventStatements = (
    await Promise.all(
      events.map((e) =>
        constitutionEventStatements({
          db,
          companyId,
          entityType: e.entityType,
          entityId: e.entityId,
          eventType: e.eventType as Parameters<typeof constitutionEventStatements>[0]["eventType"],
          actorId,
          before: e.before as Record<string, unknown>,
          after: e.after as Record<string, unknown>,
        }),
      ),
    )
  ).flat();
  /* 使わない状態にする文を先に置く（上限の trigger が、入れ替えの途中の件数で止めないように） */
  plan.statements = [...deactivations, ...updates, ...activations, ...schemeStatements, ...eventStatements];
  plan.kinds = [...kinds];
  return plan;
}

/**
 * アンケートの設問の書き換えと設定への反映を1つの batch で書き、ほかの下書きと評価を追従させる。
 * アンケートの保存と、設定とずれた下書きをそろえる処理（DD-028 の6）が同じ経路で書く。
 * 追従の結果の文を返す（設定が変わらなければ空）。
 */
export async function writeFormToSettings(args: {
  db: Db;
  companyId: string;
  actorId: string;
  formId: string;
  plan: FormSettingsPlan;
  rows: (typeof s.formQuestions.$inferInsert)[];
  /** 追従で作り直さない下書き（このアンケートのほかに、後で順に書くもの） */
  skipFormIds?: readonly string[];
}): Promise<string> {
  const { db, companyId, actorId, formId, plan, rows } = args;
  // D1の1query 100 bind上限内に分けつつ、DELETEと全INSERTと設定への反映は1つのbatchで原子的に行う。
  // 設定への反映を設問の INSERT より先に置く（付け替え先の要件の新しい版を、設問が参照する前に作る）
  try {
    await writeMasterBatch(db, [
      db.delete(s.formQuestions).where(eq(s.formQuestions.formId, formId)),
      ...plan.statements,
      ...questionInsertStatements(db, rows),
      db.update(s.forms).set({ updatedAt: new Date() }).where(eq(s.forms.id, formId)),
    ]);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    translateWriteError(error, "設定");
  }
  return plan.kinds.length > 0
    ? followSettings(db, { companyId, actorId, kinds: plan.kinds, skipFormIds: [formId, ...(args.skipFormIds ?? [])] })
    : "";
}

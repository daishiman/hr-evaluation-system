/**
 * 比べる警告の読み出し（DD-012 の3）。
 *
 * 3画面（アンケートの一覧・アンケート1本・使うKPIを選ぶ）は、ここの3つの関数だけを使う。
 * 画面ごとに選んだ項目と聞いている項目を読み比べると、片方の画面だけ数え方が変わるため。
 *
 * 読み出しはすべて会社で絞る。他社の行が自社の評価期間 id・等級 id を持っていても、
 * 自社の警告に混ぜず、他社の大きい版を「より新しい版」と取り違えない。
 */

import {
  listAskableKpiItemIds,
  listBehaviorGuidelines,
  listCycles,
  listFormKpiCoverage,
  listForms,
  listGradeRequirements,
  listGrades,
} from "@/lib/queries";
import { loadSchemeReadiness } from "@/lib/scheme-readiness";
import { schemeIdForCycle } from "@/lib/cycle-scheme";
import type { Role } from "@/lib/roles";
import type { ComparisonGap, ComparisonPageKey } from "@/lib/domain/comparison-gap";
import { guidelineCatalog, requirementSeries } from "@/lib/domain/comparison-items";
import { effectiveAskedItems } from "@/lib/domain/form-sync";
import { pointGroupLabel } from "@/lib/domain/grade-label";
import { isUnaskable } from "@/lib/domain/scheme";
import { schemeStepPath } from "@/lib/domain/scheme-steps";
import { formSyncGaps, type SetupGap } from "@/lib/domain/setup-gaps";

export interface ComparisonLoadOptions {
  role: Role;
  /** いま開いているページ。一覧は null */
  current: ComparisonPageKey | null;
}

type CycleRow = Awaited<ReturnType<typeof listCycles>>[number];
type FormRow = Awaited<ReturnType<typeof listForms>>[number];

/** 使うKPIを選ぶの画面で、直せるアンケートの状態（締め切ったものはもう直さない） */
const OPEN_FORM_STATUSES = new Set(["draft", "published"]);

/** 同じ評価期間・等級で、版がより大きいもののうち最大。forms は会社で絞った行だけを渡す */
function newerOf(form: FormRow, forms: readonly FormRow[]): FormRow | null {
  return forms
    .filter((f) => f.cycleId === form.cycleId && f.gradeId === form.gradeId && f.version > form.version)
    .reduce<FormRow | null>((max, f) => (max && max.version >= f.version ? max : f), null);
}

/** 評価セットの準備の残り。その区分の手順を優先し、無ければ先頭（区分によらない不足）を使う */
function schemeGapOf(gaps: readonly SetupGap[], pointGroup: string): { href: string; linkLabel: string } | null {
  const base = schemeStepPath(pointGroup, "select");
  const gap = gaps.find((g) => g.href === base || g.href.startsWith(`${base}/`)) ?? gaps[0];
  return gap ? { href: gap.href, linkLabel: gap.linkLabel } : null;
}

/**
 * 1つの評価期間の、アンケートごとの警告（ズレが無いアンケートは入れない）。
 * keep で比べるアンケートを絞る。新しい版の判定には、絞る前の全部の版を使う。
 */
async function gapsOfCycle(
  companyId: string,
  cycle: CycleRow,
  opts: ComparisonLoadOptions,
  keep: (form: FormRow, pointGroup: string) => boolean = () => true,
): Promise<Map<string, ComparisonGap>> {
  const [forms, grades, coverage, readiness, askableIds, requirementRows, guidelineRows] = await Promise.all([
    listForms(companyId, cycle.id),
    listGrades(companyId),
    // 比べる評価セットは、アンケートの作成・点数の計算と同じ選び方（DD-024。期間に付いた評価セット → 使用中）
    listFormKpiCoverage(companyId, cycle),
    schemeIdForCycle(companyId, cycle).then((schemeId) => loadSchemeReadiness(companyId, schemeId)),
    listAskableKpiItemIds(companyId),
    listGradeRequirements(companyId),
    listBehaviorGuidelines(companyId),
  ]);
  const gaps = new Map<string, ComparisonGap>();
  // 評価セットが無ければ比べる相手が無い（無いことを警告にしない）
  if (!coverage) return gaps;
  // 等級要件・行動指針は、いまのマスタで作り直したら聞くはずの項目と比べる（form-build.ts と同じ選び方）
  const series = requirementSeries(requirementRows);
  const catalog = guidelineCatalog(guidelineRows);
  const askedRequirementsOf = (formId: string) => series.rootsOf(coverage.askedRequirementsByForm.get(formId) ?? []);
  const askedBehaviorsOf = (formId: string) => coverage.askedBehaviorsByForm.get(formId) ?? [];

  // 聞いている項目の数え方は、比べる版と新しい版で同じにする（片方だけ固定枠を足すと、一致を取り違える）
  const askedOf = (formId: string) =>
    effectiveAskedItems(coverage.askedByForm.get(formId) ?? [], {
      fixedSlotItemIds: coverage.fixedSlotItemIds,
      hasRequirementQuestions: coverage.hasRequirementQuestions(formId),
    });
  // 設問のひな形が無い（聞き方が決まっていない）項目は、作り直しても新しい版でも聞けない。固定枠は等級要件の設問から数えるので除く
  // （評価セットの保存時の警告と同じ線引き。判定は domain/scheme.ts の isUnaskable）
  const askable = new Set(askableIds);
  const fixedSlot = new Set(coverage.fixedSlotItemIds);
  const unaskableOf = (selected: readonly string[]) =>
    selected.filter((kpiItemId) => isUnaskable({ kpiItemId, isFixedSlot: fixedSlot.has(kpiItemId) }, askable));

  for (const form of forms) {
    const grade = grades.find((g) => g.id === form.gradeId);
    const pointGroup = grade?.pointGroup;
    const band = grade?.behaviorBand ?? null;
    const selected = pointGroup ? coverage.selectedByGroup.get(pointGroup) : undefined;
    // 使うKPIをまだ選んでいない区分は、比べる相手が無い
    if (!pointGroup || !selected || !keep(form, pointGroup)) continue;
    const newer = newerOf(form, forms);
    const gap = formSyncGaps({
      form: {
        id: form.id,
        title: form.title,
        cycleName: form.cycleName,
        gradeName: form.gradeName,
        cycleId: form.cycleId,
        gradeId: form.gradeId,
        status: form.status,
        version: form.version,
        responseCount: Number(form.responseCount),
        cycleStatus: form.cycleStatus,
      },
      pointGroup,
      groupLabel: pointGroupLabel(pointGroup, grades),
      selected,
      asked: askedOf(form.id),
      unaskable: unaskableOf(selected),
      nameOf: coverage.nameOf,
      requirements: {
        expected: series.expectedOf(form.gradeId),
        asked: askedRequirementsOf(form.id),
        nameOf: series.nameOf,
      },
      behaviors: {
        expected: catalog.expectedOf(band),
        asked: askedBehaviorsOf(form.id),
        nameOf: catalog.nameOf,
        bandOf: catalog.bandOf,
        band,
      },
      newer: newer && {
        id: newer.id,
        version: newer.version,
        status: newer.status,
        asked: askedOf(newer.id),
        askedRequirements: askedRequirementsOf(newer.id),
        askedBehaviors: askedBehaviorsOf(newer.id),
      },
      schemeGap: schemeGapOf(readiness.schemeGaps, pointGroup),
      current: opts.current,
      role: opts.role,
    });
    if (gap) gaps.set(form.id, gap);
  }
  return gaps;
}

/** アンケートの一覧：評価期間1つ分。他社の評価期間 id なら空 */
export async function loadCycleComparisonGaps(
  companyId: string,
  cycleId: string,
  opts: ComparisonLoadOptions,
): Promise<Map<string, ComparisonGap>> {
  const cycle = (await listCycles(companyId)).find((c) => c.id === cycleId);
  return cycle ? gapsOfCycle(companyId, cycle, opts) : new Map();
}

/** アンケート1本。自社の評価期間に無いアンケートなら null */
export async function loadFormComparisonGap(
  companyId: string,
  form: { id: string; cycleId: string },
  opts: ComparisonLoadOptions,
): Promise<ComparisonGap | null> {
  return (await loadCycleComparisonGaps(companyId, form.cycleId, opts)).get(form.id) ?? null;
}

/** 使うKPIを選ぶ：その区分の、締め切っていない評価期間の、下書きか公開中のアンケート */
export async function loadGroupComparisonGaps(
  companyId: string,
  pointGroup: string,
  opts: ComparisonLoadOptions,
): Promise<ComparisonGap[]> {
  const cycles = (await listCycles(companyId)).filter((c) => c.status !== "closed");
  const keep = (form: FormRow, group: string) => group === pointGroup && OPEN_FORM_STATUSES.has(form.status);
  const perCycle = await Promise.all(cycles.map((cycle) => gapsOfCycle(companyId, cycle, opts, keep)));
  return perCycle.flatMap((gaps) => [...gaps.values()]);
}

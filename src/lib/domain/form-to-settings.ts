/**
 * 下書きのアンケートの保存を、制度の設定へ写すときの判定（DD-028 の 1〜3）。書き込みはしない。
 *
 * 紐づいた設問の文を直すと設定の文が変わり、外すと設定で使わない状態になり、
 * 設定の行を1つ選んで足すと設定から設問を作る。ここはその「何が変わるか」と「通してよいか」だけを決め、
 * 書く文は src/lib/masters/form-to-settings.ts が組み立てる。
 *
 * 断るときは、アンケートも設定も変えずに、直す画面の場所（fixHref）を添えて返す。
 * 評価セットの決まり（項目数・枠・配点）と計算式は、ここで通さないと評価が作れなくなるため。
 */
import { extractVariables } from "./formula";
import { isLinkedQuestion, type QuestionIdPlan, type StoredQuestion, type SubmittedQuestion } from "./form-question-links";
import { pointsForSlot, slotKindOf, type GradePointRule, type SlotKind } from "./grade-points";
import { validateScheme, type SchemeSelection } from "./scheme";
import { kpiItemPath, schemeStepPath } from "./scheme-steps";

export interface FormSettingsRefusal {
  message: string;
  /** 直す画面の場所。無ければアンケートの画面で直せる */
  fixHref?: string;
}

/** 設問が指す設定の行。KPI は項目を指す（聞くことの key は項目の中の1つ） */
export type SettingLink =
  | { kind: "gradeRequirement"; id: string }
  | { kind: "promotionRequirement"; id: string }
  | { kind: "behaviorGuideline"; id: string }
  | { kind: "kpiItem"; id: string };

export type StoredWithTitle = StoredQuestion & { title: string };

export interface FormSettingsDiff {
  /** 保存済みのまま残り、文が変わった紐づいた設問 */
  retitled: { index: number; stored: StoredWithTitle; title: string }[];
  /** 送られなかった紐づいた設問（足し直した設定の行のものは除く） */
  removed: StoredWithTitle[];
  /** 設定の行を1つ選んで足した設問 */
  added: { index: number; title: string; link: SettingLink }[];
}

/** 設問が指す設定の行。設定の行を指さない設問（自由設問・印だけの設問）は null */
export function settingLinkOf(q: SubmittedQuestion | StoredQuestion): SettingLink | null {
  if (q.gradeRequirementId) return { kind: "gradeRequirement", id: q.gradeRequirementId };
  if (q.promotionRequirementId) return { kind: "promotionRequirement", id: q.promotionRequirementId };
  if (q.behaviorGuidelineId) return { kind: "behaviorGuideline", id: q.behaviorGuidelineId };
  if (q.kpiItemId) return { kind: "kpiItem", id: q.kpiItemId };
  return null;
}

const linkKey = (link: SettingLink) => `${link.kind}:${link.id}`;

/**
 * 送られた設問の並び（checkQuestionLinks を通ったもの）と保存済みの設問を比べ、設定に写す変化を取り出す。
 * ids は checkQuestionLinks が返した設問ごとの扱い。
 */
export function diffFormSettings(
  submitted: readonly SubmittedQuestion[],
  ids: readonly QuestionIdPlan[],
  stored: readonly StoredWithTitle[],
): FormSettingsDiff {
  const byId = new Map(stored.map((q) => [q.id, q]));
  const kept = new Set<string>();
  const retitled: FormSettingsDiff["retitled"] = [];
  const added: FormSettingsDiff["added"] = [];
  submitted.forEach((q, index) => {
    if (ids[index] === "add") {
      added.push({ index, title: q.title.trim(), link: settingLinkOf(q) as SettingLink });
      return;
    }
    const prev = ids[index] === "keep" && q.id !== undefined ? byId.get(q.id) : undefined;
    if (!prev) return;
    kept.add(prev.id);
    if (settingLinkOf(prev) && q.title.trim() !== prev.title.trim()) retitled.push({ index, stored: prev, title: q.title.trim() });
  });
  // 外してから同じ行を足し直したときは、使わない状態にしない（設問は設定から作り直す）
  const readded = new Set(added.map((a) => linkKey(a.link)));
  const removed = stored.filter((q) => {
    if (kept.has(q.id) || !isLinkedQuestion(q)) return false;
    const link = settingLinkOf(q);
    return link !== null && !readded.has(linkKey(link));
  });
  return { retitled, removed, added };
}

/**
 * 足した行を、このアンケートがもう聞いていないか。同じ行の設問が2つあると、同じ要件が2回数えられる。
 * keptStored は保存のあとも残る保存済みの設問。
 */
export function checkAddedTwice(
  diff: FormSettingsDiff,
  keptStored: readonly StoredQuestion[],
  nameOf: (link: SettingLink) => string,
): FormSettingsRefusal | null {
  const asked = new Set(keptStored.map(settingLinkOf).filter((l): l is SettingLink => l !== null).map(linkKey));
  for (const a of diff.added) {
    const key = linkKey(a.link);
    if (asked.has(key)) return { message: `「${nameOf(a.link)}」は、このアンケートがもう聞いています。同じ項目を2回は足せません。` };
    asked.add(key);
  }
  return null;
}

/** KPI の設問の外し方。項目の設問を全部外したら項目ごと、一部だけなら聞くことだけを外す */
export interface KpiRemovals {
  /** 設問を全部外した項目（最初に出てきた順） */
  items: string[];
  /** 一部の聞くことだけを外した項目と key */
  keys: { itemId: string; key: string }[];
}

export function kpiRemovals(removed: readonly StoredQuestion[], stored: readonly StoredQuestion[]): KpiRemovals {
  const gone = new Set(removed.map((q) => q.id));
  const items: string[] = [];
  const keys: KpiRemovals["keys"] = [];
  for (const q of removed) {
    if (!q.kpiItemId) continue;
    const itemId = q.kpiItemId;
    const whole = stored.every((s) => s.kpiItemId !== itemId || gone.has(s.id));
    if (whole) {
      if (!items.includes(itemId)) items.push(itemId);
    } else if (q.kpiQuestionKey) {
      keys.push({ itemId, key: q.kpiQuestionKey });
    }
  }
  return { items, keys };
}

/** 計算式が使う聞くことを外させない。外すと項目の値が出せず、評価が作れなくなる */
export function checkFormulaKeys(
  keys: KpiRemovals["keys"],
  itemOf: (itemId: string) => { name: string; formula: string } | undefined,
): FormSettingsRefusal | null {
  for (const { itemId, key } of keys) {
    const item = itemOf(itemId);
    if (item && extractVariables(item.formula).includes(key)) {
      return {
        message: `「${item.name}」の計算式が「${key}」を使っているため、この設問は外せません。計算式を直してから外してください。`,
        fixHref: kpiItemPath(itemId),
      };
    }
  }
  return null;
}

/** 評価セットのこの等級区分の1枠 */
export type SchemeSlot = SchemeSelection & { displayOrder: number };

export type SlotRearrangement = { ok: true; changed: boolean; slots: SchemeSlot[] } | ({ ok: false } & FormSettingsRefusal);

/**
 * 外した KPI 項目と足した KPI 項目で、評価セットのこの等級区分の枠を組み直す。
 *
 * 外した項目の枠は、足した項目が順に引き継ぐ（並び・固定枠・20点枠の印はそのまま）。
 * 引き継ぐ先の無い足した項目は、末尾に10点枠として足し、引き継ぐ項目の無い外した枠は消す。
 * 評価セットに無い外した項目と、もう評価セットにある足した項目は、設問だけの変化なので枠は変えない。
 * 配点は送られた値でも前の値でもなく、等級区分の型から決め直す。
 * 組み直した枠が評価セットの決まりに合わなければ、評価セットの画面の場所を添えて断る。
 */
export function rearrangeSlots(args: {
  slots: readonly SchemeSlot[];
  removedItemIds: readonly string[];
  addedItems: readonly { id: string; categoryId: string | null }[];
  rule: GradePointRule;
  fixedSlotItemIds: Iterable<string>;
  pointGroup: string;
  groupLabel?: string;
  itemNameOf?: (id: string) => string;
}): SlotRearrangement {
  const inScheme = new Set(args.slots.map((s) => s.kpiItemId));
  const addedIds = new Set(args.addedItems.map((a) => a.id));
  const removedIds = new Set(args.removedItemIds);
  const leaving = new Set(args.removedItemIds.filter((id) => inScheme.has(id) && !addedIds.has(id)));
  const coming = args.addedItems.filter((a) => !inScheme.has(a.id) && !removedIds.has(a.id));
  if (leaving.size === 0 && coming.length === 0) return { ok: true, changed: false, slots: [...args.slots] };

  const queue = [...coming];
  const next: SchemeSelection[] = [];
  for (const slot of args.slots) {
    if (!leaving.has(slot.kpiItemId)) {
      next.push(slot);
      continue;
    }
    const heir = queue.shift();
    if (heir) next.push({ ...slot, kpiItemId: heir.id, categoryId: heir.categoryId });
  }
  for (const a of queue) next.push({ kpiItemId: a.id, categoryId: a.categoryId, weight: 0, isFixedSlot: false, isMajorSlot: false });

  const slots: SchemeSlot[] = next.map((s, i) => ({
    kpiItemId: s.kpiItemId,
    categoryId: s.categoryId,
    isFixedSlot: s.isFixedSlot,
    isMajorSlot: s.isMajorSlot,
    weight: pointsForSlot(args.rule, slotKindOf(s)),
    displayOrder: i + 1,
  }));
  const v = validateScheme(slots, {
    rule: args.rule,
    fixedSlotItemIds: args.fixedSlotItemIds,
    itemNameOf: args.itemNameOf,
    groupLabel: args.groupLabel,
  });
  if (!v.ok) return { ok: false, message: v.errors.join(" "), fixHref: schemeStepPath(args.pointGroup, "select") };
  return { ok: true, changed: true, slots };
}

/** 制度の変更の記録に残す「項目 id と枠」の1組（actions/scheme.ts の評価セットの保存と同じ形） */
export function slotEntryOf(slot: { kpiItemId: string; isFixedSlot: boolean; isMajorSlot?: boolean | null }): [string, SlotKind] {
  return [slot.kpiItemId, slotKindOf({ isFixedSlot: slot.isFixedSlot, isMajorSlot: slot.isMajorSlot ?? false })];
}

/** 要件の設問の型を崩したときの断り */
export function bracketRefusal(title: string): FormSettingsRefusal {
  return { message: `「${title}」は、設定の文をかぎかっこ「」の中に書く形のまま直してください。かぎかっこの外は変えられません。` };
}

/**
 * 直した要件の設問の文から、設定の新しい文を取り出す。
 * 型（canonical が作る文）のかぎかっこの中だけを変えた文なら新しい文を返し、型を崩していれば null。
 */
export function requirementTextOf(
  title: string,
  textInBrackets: (title: string) => string | null,
  canonical: (text: string) => string,
): string | null {
  const text = textInBrackets(title);
  if (text === null) return null;
  return canonical(text) === title.trim() ? text : null;
}

/** 行動指針の観点の名前の長さ（行動指針の画面と同じ上限。body-schema.ts） */
export const GUIDELINE_NAME_MAX = 60;
/** KPI の聞くことの文の長さ（KPI項目の画面と同じ上限。body-schema.ts） */
export const KPI_QUESTION_TEXT_MAX = 200;

/** 設問の文を設定の文として使えるか。使えなければ断りの文を返す */
export function settingTextRefusal(title: string, max: number): FormSettingsRefusal | null {
  if (title.trim().length === 0) return { message: "紐づいた設問の文を空にはできません。外すときは設問ごと消してください。" };
  if (title.trim().length > max) return { message: `「${title.trim()}」は${max}文字までにしてください（設定の文の上限です）。` };
  return null;
}

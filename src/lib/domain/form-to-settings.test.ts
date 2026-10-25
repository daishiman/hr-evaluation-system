import { describe, expect, it } from "vitest";
import type { GradePointRule } from "./grade-points";
import type { SubmittedQuestion } from "./form-question-links";
import { requirementQuestion, settingTextFromTitle } from "./form-question-text";
import { kpiItemPath, schemeStepPath } from "./scheme-steps";
import {
  bracketRefusal,
  checkAddedTwice,
  checkFormulaKeys,
  diffFormSettings,
  kpiRemovals,
  rearrangeSlots,
  requirementTextOf,
  settingLinkOf,
  settingTextRefusal,
  slotEntryOf,
  type SchemeSlot,
  type StoredWithTitle,
} from "./form-to-settings";

const none = {
  gradeRequirementId: null,
  promotionRequirementId: null,
  behaviorGuidelineId: null,
  kpiItemId: null,
  kpiQuestionKey: null,
  isGate: false,
};

const req: StoredWithTitle = { ...none, id: "fq_req", section: "support", questionType: "yesno", title: "「要件A」を行いましたか？", gradeRequirementId: "greq_a" };
const promo: StoredWithTitle = { ...none, id: "fq_promo", section: "report", questionType: "yesno", title: "昇格要件", promotionRequirementId: "preq_a" };
const behavior: StoredWithTitle = { ...none, id: "fq_bg", section: "behavior", questionType: "single", title: "工夫について", behaviorGuidelineId: "bg_a" };
const kpi1: StoredWithTitle = { ...none, id: "fq_k1", section: "kpi", questionType: "number", title: "稼働時間", kpiItemId: "kpi_a", kpiQuestionKey: "q1" };
const kpi2: StoredWithTitle = { ...none, id: "fq_k2", section: "kpi", questionType: "number", title: "所定時間", kpiItemId: "kpi_a", kpiQuestionKey: "q2" };
const free: StoredWithTitle = { ...none, id: "fq_free", section: "free", questionType: "text", title: "ひとこと" };
const gateOnly: StoredWithTitle = { ...none, id: "fq_gate", section: "test", questionType: "yesno", title: "印だけ", isGate: true };

const asSent = (q: StoredWithTitle, title = q.title): SubmittedQuestion => ({ ...q, title });

describe("settingLinkOf", () => {
  it("設問が指す設定の行を1つ返し、指さなければ null", () => {
    expect(settingLinkOf(req)).toEqual({ kind: "gradeRequirement", id: "greq_a" });
    expect(settingLinkOf(promo)).toEqual({ kind: "promotionRequirement", id: "preq_a" });
    expect(settingLinkOf(behavior)).toEqual({ kind: "behaviorGuideline", id: "bg_a" });
    expect(settingLinkOf(kpi1)).toEqual({ kind: "kpiItem", id: "kpi_a" });
    expect(settingLinkOf(free)).toBeNull();
    expect(settingLinkOf(gateOnly)).toBeNull();
  });
});

describe("diffFormSettings", () => {
  const stored = [req, behavior, kpi1, kpi2, free, gateOnly];

  it("何も変えなければ、写す変化は無い", () => {
    expect(diffFormSettings(stored.map((q) => asSent(q)), stored.map(() => "keep"), stored)).toEqual({ retitled: [], removed: [], added: [] });
  });

  it("紐づいた設問の文の直しだけを拾い、自由設問の直しと前後の空白だけの違いは拾わない", () => {
    const submitted = [asSent(req, " 「要件B」を行いましたか？ "), asSent(behavior, " 工夫について "), asSent(free, "別のひとこと"), asSent(kpi1), asSent(kpi2), asSent(gateOnly)];
    const diff = diffFormSettings(submitted, submitted.map(() => "keep"), stored);
    expect(diff.retitled).toEqual([{ index: 0, stored: req, title: "「要件B」を行いましたか？" }]);
    expect(diff.removed).toEqual([]);
  });

  it("送られなかった紐づいた設問を外したものとし、自由設問と印だけの設問は外したものにしない", () => {
    const diff = diffFormSettings([asSent(kpi1)], ["keep"], stored);
    expect(diff.removed.map((q) => q.id)).toEqual(["fq_req", "fq_bg", "fq_k2"]);
  });

  it("新しい id を振る設問は、保存済みの設問を残したことにならない", () => {
    const diff = diffFormSettings([{ ...asSent(kpi1), id: undefined }, asSent(kpi2)], ["fresh", "keep"], [kpi1, kpi2]);
    expect(diff.removed.map((q) => q.id)).toEqual(["fq_k1"]);
    expect(diff.retitled).toEqual([]);
  });

  it("設定の行を選んで足した設問を拾い、外してから足し直した行は外したものにしない", () => {
    const readd: SubmittedQuestion = { title: " （選んだだけ） ", section: "behavior", questionType: "single", behaviorGuidelineId: "bg_a" };
    const fresh: SubmittedQuestion = { title: "研修", section: "kpi", questionType: "number", kpiItemId: "kpi_new" };
    const diff = diffFormSettings([asSent(kpi1), asSent(kpi2), readd, fresh], ["keep", "keep", "add", "add"], [behavior, kpi1, kpi2]);
    expect(diff.added).toEqual([
      { index: 2, title: "（選んだだけ）", link: { kind: "behaviorGuideline", id: "bg_a" } },
      { index: 3, title: "研修", link: { kind: "kpiItem", id: "kpi_new" } },
    ]);
    expect(diff.removed).toEqual([]);
  });
});

describe("checkAddedTwice", () => {
  const nameOf = (link: { id: string }) => `名前:${link.id}`;
  const addedKpi = { index: 3, title: "打った文", link: { kind: "kpiItem" as const, id: "kpi_a" } };

  it("残る設問がもう聞いている行を足すと、設定の名前で断る", () => {
    const refusal = checkAddedTwice({ retitled: [], removed: [], added: [addedKpi] }, [kpi1, free], nameOf);
    expect(refusal).toEqual({ message: "「名前:kpi_a」は、このアンケートがもう聞いています。同じ項目を2回は足せません。" });
  });

  it("同じ行を2回足しても断る", () => {
    const refusal = checkAddedTwice({ retitled: [], removed: [], added: [addedKpi, { ...addedKpi, index: 4 }] }, [free], nameOf);
    expect(refusal?.message).toContain("名前:kpi_a");
  });

  it("まだ聞いていない行なら通す", () => {
    expect(checkAddedTwice({ retitled: [], removed: [], added: [addedKpi] }, [req, free], nameOf)).toBeNull();
  });
});

describe("kpiRemovals", () => {
  const other: StoredWithTitle = { ...kpi1, id: "fq_b1", kpiItemId: "kpi_b", kpiQuestionKey: "q9" };

  it("項目の設問を全部外したら項目ごと、一部だけなら聞くことだけを外す", () => {
    expect(kpiRemovals([kpi1, kpi2, req], [kpi1, kpi2, other, req])).toEqual({ items: ["kpi_a"], keys: [] });
    expect(kpiRemovals([kpi2], [kpi1, kpi2, other])).toEqual({ items: [], keys: [{ itemId: "kpi_a", key: "q2" }] });
  });

  it("key の無い設問を一部だけ外しても、聞くことの外しにはしない", () => {
    const keyless: StoredWithTitle = { ...kpi2, id: "fq_k3", kpiQuestionKey: null };
    expect(kpiRemovals([keyless], [kpi1, keyless])).toEqual({ items: [], keys: [] });
  });
});

describe("checkFormulaKeys", () => {
  const itemOf = (id: string) => (id === "kpi_a" ? { name: "稼働率", formula: "q1 / q2 * 100" } : undefined);

  it("計算式が使う聞くことを外すと、項目の画面の場所を添えて断る", () => {
    expect(checkFormulaKeys([{ itemId: "kpi_a", key: "q2" }], itemOf)).toEqual({
      message: "「稼働率」の計算式が「q2」を使っているため、この設問は外せません。計算式を直してから外してください。",
      fixHref: kpiItemPath("kpi_a"),
    });
  });

  it("計算式が使わない聞くことと、見つからない項目は通す", () => {
    expect(checkFormulaKeys([{ itemId: "kpi_a", key: "q3" }, { itemId: "kpi_x", key: "q1" }], itemOf)).toBeNull();
  });
});

describe("rearrangeSlots", () => {
  const rule: GradePointRule = {
    pointGroup: "Regular",
    totalPoints: 100,
    fixedSlotPoints: 80,
    majorSlotPoints: 0,
    majorSlotCount: 0,
    minorSlotPoints: 10,
    minorSlotCount: 2,
  };
  const slot = (kpiItemId: string, displayOrder: number, fixed = false): SchemeSlot => ({
    kpiItemId,
    categoryId: "cat_a",
    weight: fixed ? 80 : 10,
    isFixedSlot: fixed,
    isMajorSlot: false,
    displayOrder,
  });
  const slots = [slot("kpi_fixed", 1, true), slot("kpi_a", 2), slot("kpi_b", 3)];
  const base = { slots, rule, fixedSlotItemIds: ["kpi_fixed"], pointGroup: "Regular" };

  it("評価セットに無い項目を外し、もう評価セットにある項目を足すだけなら、枠は変えない", () => {
    const r = rearrangeSlots({ ...base, removedItemIds: ["kpi_out"], addedItems: [{ id: "kpi_a", categoryId: "cat_a" }] });
    expect(r).toEqual({ ok: true, changed: false, slots });
  });

  it("外して足し直した同じ項目は、枠を変えない", () => {
    const r = rearrangeSlots({ ...base, removedItemIds: ["kpi_b"], addedItems: [{ id: "kpi_b", categoryId: "cat_a" }] });
    expect(r).toMatchObject({ ok: true, changed: false });
  });

  it("外した項目の枠を足した項目が引き継ぎ、配点は型から決め直す", () => {
    const r = rearrangeSlots({
      ...base,
      slots: [slot("kpi_fixed", 1, true), { ...slot("kpi_a", 2), weight: 99 }, slot("kpi_b", 3)],
      removedItemIds: ["kpi_a"],
      addedItems: [{ id: "kpi_new", categoryId: "cat_new" }],
    });
    expect(r).toEqual({
      ok: true,
      changed: true,
      slots: [
        slot("kpi_fixed", 1, true),
        { kpiItemId: "kpi_new", categoryId: "cat_new", weight: 10, isFixedSlot: false, isMajorSlot: false, displayOrder: 2 },
        slot("kpi_b", 3),
      ],
    });
  });

  it("引き継ぐ先の無い足した項目は末尾に足し、決まりに合わなければ評価セットの画面の場所を添えて断る", () => {
    const r = rearrangeSlots({
      ...base,
      groupLabel: "Regular",
      removedItemIds: [],
      addedItems: [{ id: "kpi_new", categoryId: "cat_a" }],
      itemNameOf: (id) => id,
    });
    expect(r).toMatchObject({ ok: false, fixHref: schemeStepPath("Regular", "select") });
    expect(r.ok === false && r.message).toContain("Regularで選ぶ項目は3件です");
  });

  it("引き継ぐ項目の無い外した枠は消し、足りなければ断る", () => {
    const r = rearrangeSlots({ ...base, removedItemIds: ["kpi_b"], addedItems: [] });
    expect(r).toMatchObject({ ok: false, fixHref: schemeStepPath("Regular", "select") });
    expect(r.ok === false && r.message).toContain("あと1件選んでください");
  });
});

describe("slotEntryOf", () => {
  it("項目 id と枠の種類の組にする", () => {
    expect(slotEntryOf({ kpiItemId: "kpi_f", isFixedSlot: true, isMajorSlot: false })).toEqual(["kpi_f", "fixed"]);
    expect(slotEntryOf({ kpiItemId: "kpi_m", isFixedSlot: false, isMajorSlot: true })).toEqual(["kpi_m", "major"]);
    expect(slotEntryOf({ kpiItemId: "kpi_n", isFixedSlot: false, isMajorSlot: null })).toEqual(["kpi_n", "minor"]);
    expect(slotEntryOf({ kpiItemId: "kpi_o", isFixedSlot: false })).toEqual(["kpi_o", "minor"]);
  });
});

describe("要件の設問の文", () => {
  const canonical = (text: string) => requirementQuestion("support", text).title;

  it("型のかぎかっこの中だけを変えた文から、新しい設定の文を取り出す", () => {
    expect(requirementTextOf("「要件B」を、この半期に自分の担当として行いましたか？", settingTextFromTitle, canonical)).toBe("要件B");
  });

  it("かぎかっこが無い文と、かぎかっこの外を変えた文は null", () => {
    expect(requirementTextOf("要件を行ったか", settingTextFromTitle, canonical)).toBeNull();
    expect(requirementTextOf("「要件B」を行いましたか？", () => "要件B", canonical)).toBeNull();
  });

  it("型を崩したときの断りは、かぎかっこの中を直すよう伝える", () => {
    expect(bracketRefusal("要件を行ったか").message).toBe(
      "「要件を行ったか」は、設定の文をかぎかっこ「」の中に書く形のまま直してください。かぎかっこの外は変えられません。",
    );
  });
});

describe("settingTextRefusal", () => {
  it("空の文と上限を超える文は断り、それ以外は通す", () => {
    expect(settingTextRefusal("  ", 10)?.message).toBe("紐づいた設問の文を空にはできません。外すときは設問ごと消してください。");
    expect(settingTextRefusal("あ".repeat(11), 10)?.message).toBe(`「${"あ".repeat(11)}」は10文字までにしてください（設定の文の上限です）。`);
    expect(settingTextRefusal(` ${"あ".repeat(10)} `, 10)).toBeNull();
  });
});

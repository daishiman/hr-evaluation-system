import { describe, expect, it } from "vitest";
import { checkQuestionLinks, isLinkedQuestion, type StoredQuestion } from "./form-question-links";

const none = {
  gradeRequirementId: null,
  promotionRequirementId: null,
  behaviorGuidelineId: null,
  kpiItemId: null,
  kpiQuestionKey: null,
  isGate: false,
};

const kpi: StoredQuestion = { ...none, id: "fq_kpi", section: "kpi", questionType: "number", kpiItemId: "kpi_a", kpiQuestionKey: "q1_1" };
const gate: StoredQuestion = { ...none, id: "fq_gate", section: "test", questionType: "yesno", promotionRequirementId: "pr_1", isGate: true };
const free: StoredQuestion = { ...none, id: "fq_free", section: "free", questionType: "text" };
const stored = [kpi, gate, free];

const asSent = (q: StoredQuestion) => ({ ...q, title: q.id });

describe("isLinkedQuestion", () => {
  it("紐づけか昇格の必須要件の印が1つでもあれば集計に使う設問", () => {
    expect(isLinkedQuestion(kpi)).toBe(true);
    expect(isLinkedQuestion({ ...free, isGate: true })).toBe(true);
    expect(isLinkedQuestion(free)).toBe(false);
    // 画面は紐づけの欄を省いて送ることがある（undefined は無いのと同じ）
    expect(isLinkedQuestion({ title: "x", section: "free", questionType: "text" })).toBe(false);
  });
});

describe("checkQuestionLinks", () => {
  it("保存済みの値をそのまま送れば通り、id をそのまま使う", () => {
    expect(checkQuestionLinks(stored.map(asSent), stored)).toEqual({ ok: true, ids: ["keep", "keep", "keep"] });
  });

  it("新しい設問と、この版に無い id には新しい id を振る", () => {
    const result = checkQuestionLinks(
      [{ title: "新", section: "free", questionType: "text" }, { id: "fq_elsewhere", title: "他", section: "free", questionType: "text" }],
      stored,
    );
    expect(result).toEqual({ ok: true, ids: ["fresh", "fresh"] });
  });

  it("新しい設問に紐づけがあれば、読み込み直しを促して断る", () => {
    const result = checkQuestionLinks([{ title: "新", section: "kpi", questionType: "number", kpiQuestionKey: "q1_1" }], stored);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.message).toContain("画面を読み込み直してから");
  });

  it("新しい設問に設定の行を1つだけ選んでいれば、設定から作る設問として足す", () => {
    const result = checkQuestionLinks(
      [
        { title: "項目", section: "kpi", questionType: "number", kpiItemId: "kpi_b" },
        { title: "指針", section: "behavior", questionType: "single", behaviorGuidelineId: "bg_2", kpiQuestionKey: null, isGate: false },
        { title: "要件", section: "support", questionType: "yesno", gradeRequirementId: "greq_2" },
        { title: "昇格", section: "report", questionType: "yesno", promotionRequirementId: "pr_2" },
      ],
      stored,
    );
    expect(result).toEqual({ ok: true, ids: ["add", "add", "add", "add"] });
  });

  it("新しい設問に設定の行と一緒に key か印を付けたり、行を2つ選んだりすると断る", () => {
    const message = "「新」に付けられる紐づけは、設定の項目1つだけです。KPI は項目だけを選んでください。";
    const sentNew = { title: "新", section: "kpi", questionType: "number" };
    expect(checkQuestionLinks([{ ...sentNew, kpiItemId: "kpi_b", kpiQuestionKey: "q2_1" }], stored)).toEqual({ ok: false, message });
    expect(checkQuestionLinks([{ ...sentNew, promotionRequirementId: "pr_2", isGate: true }], stored)).toEqual({ ok: false, message });
    expect(checkQuestionLinks([{ ...sentNew, kpiItemId: "kpi_b", behaviorGuidelineId: "bg_2" }], stored)).toEqual({ ok: false, message });
  });

  it("作り直しで消えた id の紐づけ付きの設問（古い画面からの保存）も断る", () => {
    expect(checkQuestionLinks([asSent({ ...kpi, id: "fq_before_rebuild" })], stored)).toMatchObject({ ok: false });
  });

  it("保存済みの設問の紐づけ・昇格の必須要件の印を変えると断る", () => {
    expect(checkQuestionLinks([asSent({ ...kpi, kpiQuestionKey: "q1_2" })], stored)).toMatchObject({ ok: false });
    expect(checkQuestionLinks([asSent({ ...gate, isGate: false })], stored)).toMatchObject({ ok: false });
    expect(checkQuestionLinks([asSent({ ...free, isGate: true })], stored)).toMatchObject({ ok: false });
  });

  it("集計に使う設問のまとまり・答え方を変えると断り、自由設問は変えられる", () => {
    expect(checkQuestionLinks([asSent({ ...kpi, questionType: "text" })], stored)).toMatchObject({ ok: false });
    expect(checkQuestionLinks([asSent({ ...gate, section: "free" })], stored)).toMatchObject({ ok: false });
    expect(checkQuestionLinks([asSent({ ...free, section: "support", questionType: "yesno" })], stored)).toEqual({ ok: true, ids: ["keep"] });
  });

  it("同じ id を2回送ると断る（紐づけが写されて同じ要件が2回数えられるため）", () => {
    const result = checkQuestionLinks([asSent(kpi), asSent(kpi)], stored);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.message).toContain("同じ設問が2回送られています");
  });
});

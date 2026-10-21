import { describe, expect, it } from "vitest";
import {
  commentProblem,
  conclusionText,
  conclusionValue,
  conclusionWord,
  DECISION_PENDING_TEXT,
  DECISION_REASON_MAX,
  DECISION_UNRECORDED_TEXT,
  decisionCsvCells,
  decisionKindText,
  finalDecision,
  finalDecisionOf,
  findCriteriaLeakWords,
  overrideConclusionVerb,
  scopeDecisionColumns,
  scoreJudgementText,
  shortJudgementReason,
  validateDecisionInput,
} from "@/lib/domain/final-decision";

describe("finalDecision（点数の判定 × 上司の判断の5通り）", () => {
  it("判定どおり・点数の判定が可 → 認める", () => {
    expect(finalDecision(true, "follow")).toEqual({
      approved: true,
      scoreJudgement: true,
      decision: "follow",
      overridden: false,
      unrecorded: false,
    });
  });

  it("判定どおり・点数の判定が否 → 見送る", () => {
    expect(finalDecision(false, "follow")).toMatchObject({ approved: false, overridden: false, unrecorded: false });
  });

  it("変える・点数の判定が可 → 見送る（上司の判断）", () => {
    expect(finalDecision(true, "override")).toEqual({
      approved: false,
      scoreJudgement: true,
      decision: "override",
      overridden: true,
      unrecorded: false,
    });
  });

  it("変える・点数の判定が否 → 認める（上司の判断）", () => {
    expect(finalDecision(false, "override")).toMatchObject({ approved: true, overridden: true });
  });

  it("記録なし（null・undefined）→ 点数の判定を結論にし、記録なしの印を付ける", () => {
    const expected = { approved: true, scoreJudgement: true, decision: null, overridden: false, unrecorded: true };
    expect(finalDecision(true, null)).toEqual(expected);
    expect(finalDecision(true, undefined)).toEqual(expected);
    expect(finalDecision(false, null)).toMatchObject({ approved: false, unrecorded: true });
  });
});

describe("文言", () => {
  it("結論の1行は、変えたときだけ「上司の判断」の印を付ける（色だけで区別しない）", () => {
    expect(conclusionText("raise", finalDecision(true, "override"))).toBe("昇給：見送り（上司の判断）");
    expect(conclusionText("promotion", finalDecision(false, "override"))).toBe("昇格：あり（上司の判断）");
    expect(conclusionText("raise", finalDecision(true, "follow"))).toBe("昇給：あり");
    expect(conclusionText("promotion", finalDecision(false, null))).toBe("昇格：見送り");
  });

  it("項目名を除いた結論は、表の列の値に使う", () => {
    expect(conclusionValue(finalDecision(true, "override"))).toBe("見送り（上司の判断）");
    expect(conclusionValue(finalDecision(true, "follow"))).toBe("あり");
  });

  it("評価1件の行から、昇給と昇格それぞれの列を組んで結論を出す", () => {
    const row = { raiseEligible: true, raiseDecision: "override", promotionEligible: false, promotionDecision: null } as const;
    expect(finalDecisionOf("raise", row)).toEqual(finalDecision(true, "override"));
    expect(finalDecisionOf("promotion", row)).toEqual(finalDecision(false, null));
  });

  it("CSV の4列（結論・点数の判定・上司の判断・判断の理由）", () => {
    const reasons = { scoreReason: "昇格要件が未達です。", decisionReason: "引き継ぎが終わっていないため。" };
    expect(decisionCsvCells(finalDecision(true, "override"), { finalized: true, ...reasons })).toEqual([
      "見送り（上司の判断）",
      "可",
      "変える",
      "引き継ぎが終わっていないため。",
    ]);
    // 判定どおりのときは、保存されていない理由を出さない。否には点数の判定の理由を添える
    expect(decisionCsvCells(finalDecision(false, "follow"), { finalized: true, ...reasons })).toEqual([
      "見送り",
      "否（昇格要件が未達です。）",
      "点数の判定どおり",
      "",
    ]);
    // 理由の文が無い・空白だけの否は「否」だけ。変えたのに理由が無い古い行は空にする
    expect(
      decisionCsvCells(finalDecision(false, "override"), { finalized: true, scoreReason: "  ", decisionReason: null }),
    ).toEqual(["あり（上司の判断）", "否", "変える", ""]);
    expect(decisionCsvCells(finalDecision(false, null), { finalized: false, scoreReason: null, decisionReason: null })).toEqual([
      "見送り",
      "否",
      DECISION_PENDING_TEXT,
      "",
    ]);
  });

  it("点数の判定・結論の語・変えたときの動詞", () => {
    expect(scoreJudgementText(true)).toBe("点数の判定では可");
    expect(scoreJudgementText(false)).toBe("点数の判定では否");
    expect(conclusionWord(true)).toBe("あり");
    expect(conclusionWord(false)).toBe("見送り");
    expect(overrideConclusionVerb(true)).toBe("見送る");
    expect(overrideConclusionVerb(false)).toBe("認める");
  });

  it("上司の判断の語は、記録なしを確定済みと確認中で言い分ける", () => {
    expect(decisionKindText(finalDecision(true, "follow"), { finalized: true })).toBe("点数の判定どおり");
    expect(decisionKindText(finalDecision(true, "override"), { finalized: true })).toBe("変える");
    expect(decisionKindText(finalDecision(true, null), { finalized: true })).toBe(DECISION_UNRECORDED_TEXT);
    expect(decisionKindText(finalDecision(true, null), { finalized: false })).toBe(DECISION_PENDING_TEXT);
    expect(DECISION_UNRECORDED_TEXT).toBe("上司の判断の記録なし（この仕組みより前に確定）");
  });

  it("点数の判定の短い理由は、理由文の最初の見出しだけを取り、無ければ定型の文", () => {
    expect(shortJudgementReason("raise", false, "次の項目がA未満のため、昇給は見送りです。\n- 稼働率\n- 残業率")).toBe(
      "次の項目がA未満のため、昇給は見送りです。",
    );
    // 見出しの無い並びだけの文は飛ばして、次の見出しを取る
    expect(shortJudgementReason("promotion", false, "- 稼働率\n次の昇格要件が未達です。")).toBe("次の昇格要件が未達です。");
    expect(shortJudgementReason("promotion", true, null)).toBe("昇格の要件をすべて満たしています。");
    expect(shortJudgementReason("promotion", false, "- 稼働率")).toBe("昇格の要件を満たしていません。");
    expect(shortJudgementReason("raise", true, "")).toBe("昇給の要件を満たしています。");
    expect(shortJudgementReason("raise", false, undefined)).toBe("昇給の要件を満たしていません。");
  });
});

describe("findCriteriaLeakWords（本人向けの網に触れた語の名指し）", () => {
  it("空・網に触れない文は空配列", () => {
    expect(findCriteriaLeakWords(null)).toEqual([]);
    expect(findCriteriaLeakWords("")).toEqual([]);
    expect(findCriteriaLeakWords("新人の育成に毎週時間を取り、相談に乗っていた")).toEqual([]);
  });

  it("触れた語を重ねずに返す", () => {
    expect(findCriteriaLeakWords("80点で、必要点数に届かない。80点だった")).toEqual(["80点", "必要点数"]);
    expect(findCriteriaLeakWords("達成率 90%以上 を保った")).toEqual(["90%以上"]);
  });
});

describe("commentProblem（上長からのコメントの保存前検査）", () => {
  it("問題が無ければ null、あれば語を名指しした1行", () => {
    expect(commentProblem(null)).toBeNull();
    expect(commentProblem("よく頑張りました")).toBeNull();
    expect(commentProblem("配点の高い項目を伸ばしましょう")).toBe(
      "上長からのコメントに、本人に見せられない語があります（「配点」）。点数や配点ではなく、行動や事実で書き直してください。",
    );
  });
});

describe("validateDecisionInput（確定のときの判断の検査）", () => {
  it("両方を判定どおりにすれば通り、理由は保存しない", () => {
    expect(
      validateDecisionInput({
        raiseDecision: "follow",
        raiseDecisionReason: "書いても残らない",
        promotionDecision: "follow",
      }),
    ).toEqual({
      ok: true,
      value: {
        raiseDecision: "follow",
        raiseDecisionReason: null,
        promotionDecision: "follow",
        promotionDecisionReason: null,
      },
    });
  });

  it("変えるときは前後の空白を落とした理由を保存する", () => {
    expect(
      validateDecisionInput({
        raiseDecision: "override",
        raiseDecisionReason: "  期の後半に顧客対応の引き継ぎを放置した  ",
        promotionDecision: "override",
        promotionDecisionReason: "後輩3人の指導を任せられる状態になった",
      }),
    ).toEqual({
      ok: true,
      value: {
        raiseDecision: "override",
        raiseDecisionReason: "期の後半に顧客対応の引き継ぎを放置した",
        promotionDecision: "override",
        promotionDecisionReason: "後輩3人の指導を任せられる状態になった",
      },
    });
  });

  it("選んでいない判断は、昇給・昇格それぞれ1行ずつ返す", () => {
    expect(validateDecisionInput({})).toEqual({
      ok: false,
      problems: [
        "昇給について「点数の判定どおりにする」か「変える」かを選んでください。",
        "昇格について「点数の判定どおりにする」か「変える」かを選んでください。",
      ],
    });
  });

  it("変えるのに理由が空白だけ・無い", () => {
    const result = validateDecisionInput({
      raiseDecision: "override",
      raiseDecisionReason: " 　\n",
      promotionDecision: "override",
      promotionDecisionReason: null,
    });
    expect(result).toEqual({
      ok: false,
      problems: ["昇給を変える理由を書いてください。", "昇格を変える理由を書いてください。"],
    });
  });

  it("理由が2000字を超える", () => {
    const result = validateDecisionInput({
      raiseDecision: "follow",
      promotionDecision: "override",
      promotionDecisionReason: "あ".repeat(DECISION_REASON_MAX + 1),
    });
    expect(result).toEqual({ ok: false, problems: ["昇格を変える理由は2000字までです（いま2001字）。"] });
    expect(
      validateDecisionInput({
        raiseDecision: "follow",
        promotionDecision: "override",
        promotionDecisionReason: "あ".repeat(DECISION_REASON_MAX),
      }).ok,
    ).toBe(true);
  });

  it("理由に本人に見せられない語があれば、語を名指しして返す（DD-023）", () => {
    const result = validateDecisionInput({
      raiseDecision: "override",
      raiseDecisionReason: "KPIが75点で昇格に必要な水準に届かない",
      promotionDecision: "follow",
    });
    expect(result).toEqual({
      ok: false,
      problems: [
        "昇給を変える理由に、本人に見せられない語があります（「75点」・「昇格に必要」）。点数や配点ではなく、行動や事実で書き直してください。",
      ],
    });
  });
});

describe("scopeDecisionColumns（本人には確定した評価の判断だけ）", () => {
  const row = {
    raiseEligible: true,
    promotionEligible: false,
    raiseDecision: "override" as const,
    raiseDecisionReason: "引き継ぎを放置した",
    promotionDecision: "follow" as const,
    promotionDecisionReason: null,
    decisionRecordedBy: "mgr",
    decisionRecordedAt: new Date(0),
    status: "draft",
  };

  it("評価者には確認中でもそのまま返す", () => {
    expect(scopeDecisionColumns(row, true)).toBe(row);
  });

  it("本人には確定していれば同じ文で返す", () => {
    const finalized = { ...row, status: "finalized" };
    expect(scopeDecisionColumns(finalized, false)).toBe(finalized);
  });

  it("本人には、確定を戻した評価の判断を返さない", () => {
    expect(scopeDecisionColumns(row, false)).toEqual({
      ...row,
      raiseDecision: null,
      raiseDecisionReason: null,
      promotionDecision: null,
      promotionDecisionReason: null,
      decisionRecordedBy: null,
      decisionRecordedAt: null,
    });
  });
});

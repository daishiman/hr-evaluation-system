import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  askingPresets,
  askingReadonlyReason,
  askingRoles,
  askingView,
  checkAskingFormula,
  denominatorZeroHint,
  deriveQuestionRoles,
  gradeFormulaValues,
  keysToLetters,
  lettersToKeys,
  nextQuestionKeys,
  remapAskingLetters,
  roleLabel,
  type KpiQuestionLike,
} from "./kpi-asking";
import * as formulaModule from "./formula";
import { computeActualValue } from "./formula";

type Row = Record<string, string>;
const readData = (file: string): Row[] => JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf8"));
const master = readData("kpi-master.json");
const questions = readData("kpi-questions.json").filter((q) => q["項目No"] !== "共通");

/** scripts/seed-data.mjs と同じ写し方 */
function seedRole(raw: string): string {
  if (raw.includes("控除")) return "denominator_subtract";
  if (raw.includes("自動決定") || raw.includes("識別")) return "identify";
  if (raw.includes("分子")) return "numerator";
  if (raw.includes("分母")) return "denominator";
  if (raw.includes("直接")) return "direct";
  return "identify";
}

function sampleItem(no: number) {
  const item = master.find((m) => Number(m["No"]) === no)!;
  const qs = questions.filter((q) => Number(q["項目No"]) === no);
  return {
    formula: item["実績値の計算式（設問IDで表記）"],
    keys: qs.map((q) => q["設問ID"]),
    roles: qs.map((q) => seedRole(q["計算での役割"])),
    rows: qs.map(
      (q, i): KpiQuestionLike => ({
        id: `kq_${q["設問ID"]}`,
        questionKey: q["設問ID"],
        text: q["フォーム設問文"],
        inputType: q["回答形式"].includes("プルダウン") ? "select" : "number",
        unit: q["単位"],
        validation: q["入力チェック"],
        role: seedRole(q["計算での役割"]),
        targetGrades: q["対象等級"],
        displayOrder: i + 1,
      }),
    ),
  };
}

const sampleNos = master.map((m) => Number(m["No"]));

describe("見本の33項目", () => {
  it("33項目ある", () => {
    expect(sampleNos).toHaveLength(33);
  });

  it.each(sampleNos)("No.%i の役割を式から導くと、見本の役割と一致する", (no) => {
    const { formula, keys, roles } = sampleItem(no);
    expect(deriveQuestionRoles(formula, keys)).toEqual(roles);
  });

  it.each(sampleNos)("No.%i の式は、文字にして検査を通り、設問IDに戻すと元の式になる", (no) => {
    const { formula, keys } = sampleItem(no);
    const letters = keysToLetters(formula, keys);
    expect(letters).not.toMatch(/q\d+_\d+/);
    expect(checkAskingFormula(letters, keys.length)).toBeNull();
    expect(lettersToKeys(letters, keys)).toBe(formula);
  });

  it("画面から変えられないのは、選ぶ設問を持つ No.26 だけ", () => {
    const readonly = sampleNos.filter((no) => askingReadonlyReason({ isFixedSlot: false }, sampleItem(no).rows) !== null);
    expect(readonly).toEqual([26]);
    expect(askingReadonlyReason({ isFixedSlot: false }, sampleItem(26).rows)).toContain("決まった値から選ぶ設問のため");
  });
});

describe("文字と設問IDの置き換え", () => {
  const keys = ["q5_1", "q5_2"];

  it("【】の中と末尾の注釈には触れない", () => {
    expect(lettersToKeys("A ÷ ( B × 【等級別の1人あたり必要回数】 ) × 100 ※A は件数", keys)).toBe(
      "q5_1 ÷ ( q5_2 × 【等級別の1人あたり必要回数】 ) × 100 ※A は件数",
    );
    expect(lettersToKeys("A + B（Aは前期の値）", keys)).toBe("q5_1 + q5_2（Aは前期の値）");
  });

  it("全角や小文字の文字も設問として読む", () => {
    expect(lettersToKeys("Ａ÷ｂ×１００", keys)).toBe("q5_1÷q5_2×１００");
    expect(checkAskingFormula("Ａ÷ｂ×１００", 2)).toBeNull();
  });

  it("この項目の設問でない名前は、文字にしない", () => {
    expect(keysToLetters("q5_1 ÷ q9_1", keys)).toBe("A ÷ q9_1");
  });

  it("設問の数より後ろの文字と、2文字以上の名前は、設問IDにしない（式の検査が断る）", () => {
    expect(lettersToKeys("A + C + q9_1", keys)).toBe("q5_1 + C + q9_1");
  });

  it("閉じていない【は、そこから末尾までを触らずに残す（式の検査が断る）", () => {
    expect(lettersToKeys("A ÷ 【等級別の B", keys)).toBe("q5_1 ÷ 【等級別の B");
  });

  it("置き換えた式は、そのまま計算できる", () => {
    expect(computeActualValue(lettersToKeys("A ÷ B × 100", keys), { q5_1: 3, q5_2: 4 })).toBe(75);
  });
});

describe("remapAskingLetters", () => {
  it("並べ替えても、文字は同じ設問を指し続ける", () => {
    expect(remapAskingLetters("A ÷ B × 100", ["x", "y"], ["y", "x"])).toBe("B ÷ A × 100");
  });

  it("消した設問の文字は「？」になり、後ろの文字は詰まる", () => {
    const out = remapAskingLetters("A ÷ ( B + C )", ["x", "y", "z"], ["x", "z"]);
    expect(out).toBe("A ÷ ( ？ + B )");
    expect(checkAskingFormula(out, 2)).toBe("計算式の「？」は、消した設問のあった場所です。式を直してください。");
  });

  it("足しただけなら、式は変わらない", () => {
    expect(remapAskingLetters("a × 2 ※Aは件数", ["x"], ["x", "new"])).toBe("A × 2 ※Aは件数");
  });

  it("【】の中と、並びに無い文字には触れない", () => {
    expect(remapAskingLetters("A ÷ 【等級別の半期目標設定上限数】 + D", ["x", "y"], ["y", "x"])).toBe(
      "B ÷ 【等級別の半期目標設定上限数】 + D",
    );
  });
});

describe("checkAskingFormula", () => {
  it.each([
    ["", 1, "計算式を入れてください。"],
    ["（説明だけ）", 1, "計算式を入れてください。"],
    ["A ÷ C", 2, "計算式の「C」は使えません。設問はA〜Bの文字で指してください。"],
    ["A ÷ q5_1", 1, "計算式の「q5_1」は使えません。設問はAの文字で指してください。"],
    ["A ÷ 【目標】", 1, "【目標】は使えません。"],
    ["A × 100", 2, "設問Bが計算式に入っていません。使わない設問は消してください。"],
    ["A ÷", 1, "計算式が途中で終わっています"],
    ["A B", 2, "計算式に余分な記述があります"],
    ["A", 0, "聞くことを1つ以上足してください。"],
    ["A", 7, "聞くことは6つまでです。"],
  ])("「%s」（%i問）を断る", (formula, count, message) => {
    expect(checkAskingFormula(formula, count)).toContain(message);
  });

  it("等級から決まる値は使える", () => {
    expect(checkAskingFormula("A ÷ 【等級別の半期目標設定上限数】 × 100", 1)).toBeNull();
  });

  it("式の読み取りが FormulaError 以外で止まったら、断りの文にせず投げ直す", () => {
    // 文にすると、読む人が直せない内部の止まり方を「式の誤り」として見せてしまう（evaluate.failure-paths.test.ts と同じ通し方）
    const spy = vi.spyOn(formulaModule, "variablePlacements").mockImplementation(() => {
      throw new TypeError("説明のつかない止まり方");
    });
    try {
      expect(() => checkAskingFormula("A", 1)).toThrow(TypeError);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("deriveQuestionRoles", () => {
  it("分母から引かれる設問を分母から引くにする", () => {
    expect(deriveQuestionRoles("q1 ÷ ( q2 − q3 ) × 100", ["q1", "q2", "q3"])).toEqual([
      "numerator",
      "denominator",
      "denominator_subtract",
    ]);
  });

  it("分母が等級の値だけなら、設問は分子", () => {
    expect(deriveQuestionRoles("q1 ÷ 【等級別の半期目標設定上限数】", ["q1"])).toEqual(["numerator"]);
  });

  it("分母のない式は、1問ならそのまま実績値、2問以上なら分子", () => {
    expect(deriveQuestionRoles("q1 × 2", ["q1"])).toEqual(["direct"]);
    expect(deriveQuestionRoles("q1 - q2", ["q1", "q2"])).toEqual(["numerator", "numerator"]);
  });

  it("文字の式からも、画面の並び順で役割を出せる。使えない式なら出さない", () => {
    expect(askingRoles("ａ ÷ b × 100", 2)).toEqual(["numerator", "denominator"]);
    expect(askingRoles("A ÷ ？", 2)).toBeNull();
    expect(askingRoles("A ÷", 1)).toBeNull();
  });

  it("表示名は分母から引くを含めて引ける", () => {
    expect(roleLabel("denominator_subtract")).toBe("分母から引く");
    expect(roleLabel("unknown")).toBe("unknown");
  });
});

describe("nextQuestionKeys", () => {
  it("会社の中で使われたことのあるIDより大きい番号から振る", () => {
    expect(nextQuestionKeys(5, ["q5_1", "q5_2", "q5_3", "q50_9", "c_1"], 2)).toEqual(["q5_4", "q5_5"]);
  });

  it("設問の無い項目は1から振る", () => {
    expect(nextQuestionKeys(34, [], 1)).toEqual(["q34_1"]);
  });
});

describe("画面の補助", () => {
  it("式の型は、聞く数に合うものだけ出す", () => {
    expect(askingPresets(1).map((p) => p.formula)).toEqual(["A"]);
    expect(askingPresets(2).map((p) => p.formula)).toEqual(["A ÷ B × 100", "A + B"]);
    expect(askingPresets(3).map((p) => p.formula)).toEqual(["A + B + C"]);
  });

  it("出した型は、どれも検査を通る", () => {
    for (let n = 1; n <= 6; n++) {
      for (const p of askingPresets(n)) expect(checkAskingFormula(p.formula, n)).toBeNull();
    }
  });

  it("0を受け付ける分母には一言添える", () => {
    expect(denominatorZeroHint("denominator", "0以上の整数")).toContain("1以上の整数");
    expect(denominatorZeroHint("denominator", "1以上の整数")).toBeNull();
    expect(denominatorZeroHint("numerator", "0以上の整数")).toBeNull();
  });

  it("等級から決まる値は、点の計算と同じ値", () => {
    expect(gradeFormulaValues({ targetCap: 5, pointGroup: "AM" })).toEqual({
      等級別の半期目標設定上限数: 5,
      等級別の1人あたり必要回数: 3,
    });
    expect(gradeFormulaValues({ targetCap: 3, pointGroup: "Regular" })["等級別の1人あたり必要回数"]).toBe(2);
  });
});

describe("askingReadonlyReason と askingView", () => {
  const base: KpiQuestionLike = {
    id: "kq1",
    questionKey: "q40_1",
    text: "件数",
    inputType: "number",
    unit: "件",
    validation: "0以上の整数",
    role: "direct",
    targetGrades: null,
    displayOrder: 1,
  };

  it.each([
    [{ isFixedSlot: true }, [base], "固定枠"],
    [{ isFixedSlot: false }, [{ ...base, inputType: "text" }], "数で答える設問ではないため"],
    [{ isFixedSlot: false }, [{ ...base, role: "identify" }], "見分けるための設問のため"],
    [{ isFixedSlot: false }, [{ ...base, validation: "100以下" }], "入力の決まり「100以下」が画面で選べないため"],
    [{ isFixedSlot: false }, Array.from({ length: 7 }, (_, i) => ({ ...base, id: `kq${i}` })), "6つより多い"],
  ])("変えられない理由を返す（%#）", (item, qs, reason) => {
    expect(askingReadonlyReason(item, qs)).toContain(reason);
  });

  it("入力の決まりが空なら、変えられる（既定の決まりを見せる）", () => {
    const view = askingView({ formula: "q40_1", isFixedSlot: false }, [{ ...base, validation: "-", unit: "-" }]);
    expect(view.readonlyReason).toBeNull();
    expect(view.questions[0]).toMatchObject({ validation: "0以上の整数", unit: "" });
    expect(view.formula).toBe("A");
  });

  it("入力の決まりも式も無い（null）項目は、既定の決まりと空の式で見せる", () => {
    const view = askingView({ formula: null, isFixedSlot: false }, [{ ...base, validation: null }]);
    expect(view.readonlyReason).toBeNull();
    expect(view.questions[0].validation).toBe("0以上の整数");
    expect(view.formula).toBe("");
  });

  it("並びは displayOrder の順で、式の文字もその順", () => {
    const view = askingView({ formula: "q40_2 ÷ q40_1", isFixedSlot: false }, [
      { ...base, id: "b", questionKey: "q40_1", displayOrder: 2 },
      { ...base, id: "a", questionKey: "q40_2", displayOrder: 1 },
    ]);
    expect(view.questions.map((q) => q.key)).toEqual(["q40_2", "q40_1"]);
    expect(view.formula).toBe("A ÷ B");
  });
});

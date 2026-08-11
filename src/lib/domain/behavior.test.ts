import { describe, expect, it } from "vitest";
import { behaviorBandForGrade, behaviorBandLabel, behaviorBandPayloadValue, BAND_LABEL, BEHAVIOR_BANDS } from "./behavior";

describe("行動指針の等級適用", () => {
  const grades = [
    { id: "beginner", behaviorBand: "g1_2" },
    { id: "manager", behaviorBand: null },
  ];

  it("選んだ等級の現在値を返し、別等級の値を持ち越さない", () => {
    expect(behaviorBandForGrade(grades, "beginner")).toBe("g1_2");
    expect(behaviorBandForGrade(grades, "manager")).toBeNull();
    expect(behaviorBandForGrade(grades, "unknown")).toBeNull();
  });

  it("適用しない選択肢はDB契約の null にそろえる", () => {
    expect(behaviorBandPayloadValue("")).toBeNull();
    expect(behaviorBandPayloadValue("g3_4")).toBe("g3_4");
  });

  it("等級帯の呼び名はサーバー・ブラウザ共通の正本にある", () => {
    expect(BEHAVIOR_BANDS).toEqual(["g1_2", "g3_4"]);
    expect(BAND_LABEL).toEqual({ g1_2: "等級1〜2の基準", g3_4: "等級3〜4の基準" });
    expect(behaviorBandLabel("g1_2")).toBe("等級1〜2の基準");
    expect(behaviorBandLabel("future_band")).toBe("future_band");
    expect(behaviorBandLabel(null)).toBe("");
  });
});

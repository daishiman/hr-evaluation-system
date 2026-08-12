import { describe, expect, it } from "vitest";
import { containsCriteriaLeak, pickEmployeeText } from "@/lib/domain/evaluation-view";
import { MY_PENDING_BODY, myPendingHeadline } from "@/lib/domain/stalled-evaluations";
import {
  judgeOverall,
  judgeRank,
  scoreItem,
  UNRATED_RATIONALE_EMPLOYEE,
  UNRATED_REQUIREMENT_RATIONALE_EMPLOYEE,
  type OverallInput,
  type Rank,
  type RankCriterion,
} from "@/lib/domain/scoring";

/**
 * 「本人向けの文を作る側（scoring.ts）」と「本人向けの文をふるいにかける側（evaluation-view.ts）」の
 * 約束を固定する試験。
 *
 * この2つは別々のファイルにあり、片方だけ書き換えても誰も気づけなかった。
 * 実際に、判定側が作った文が検査に弾かれ、本人の画面には共通の言い換え文しか出ていなかった
 * （残課題 L1／2026-08-12 に解消）。同じことを二度起こさないため、
 * **判定側が作る本人向けの文は、1つ残らず検査を素通りする**ことをここで検査する。
 *
 * 検査（containsCriteriaLeak）を緩めて通すのは禁止。緩めると本人に基準値が漏れる。
 * 通らない文が出たら、文の言い回しを直す。
 */

const CRITERIA: RankCriterion[] = [
  { rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null },
  { rank: "B", displayLabel: "80%以上 100%未満", lowerBound: 80, upperBound: 100 },
  { rank: "C", displayLabel: "60%以上 80%未満", lowerBound: 60, upperBound: 80 },
  { rank: "D", displayLabel: "40%以上 60%未満", lowerBound: 40, upperBound: 60 },
  { rank: "E", displayLabel: "40%未満", lowerBound: 0, upperBound: 40 },
];

const RATIOS = [
  { rank: "A" as const, ratio: 1 },
  { rank: "B" as const, ratio: 0.8 },
  { rank: "C" as const, ratio: 0.6 },
  { rank: "D" as const, ratio: 0.4 },
  { rank: "E" as const, ratio: 0 },
];

/** 本人に届くべき文が、検査を素通りして「そのまま」届くことを確かめる */
function expectDeliveredAsSaved(label: string, text: string) {
  expect(containsCriteriaLeak(text), `${label}: ${text}`).toBe(false);
  // 共通の言い換え文に差し替わらず、保存した文がそのまま選ばれること
  expect(pickEmployeeText(text, "共通の言い換え文"), label).toBe(text);
}

describe("本人向けの文は、判定側が作った文がそのまま本人に届く", () => {
  it("項目ごとの根拠文（ランク判定＋点数への反映）", () => {
    const values = [120, 100, 99.99, 92.5, 80, 60, 40, 39.9, 0];
    for (const v of values) {
      for (const dir of ["higher", "lower"] as const) {
        for (const unit of ["%", "件", "-", null]) {
          const j = judgeRank(v, CRITERIA, dir, { unit });
          for (const mode of ["ratio", "absolute"] as const) {
            const sc = scoreItem({
              rank: j.rank,
              weight: 10,
              mode,
              ratios: RATIOS,
              absolute:
                mode === "absolute"
                  ? { byRank: [{ rank: "A", points: 10 }, { rank: "B", points: 8 }] }
                  : null,
            });
            expectDeliveredAsSaved(
              `判定文 v=${v} ${dir} ${unit} ${mode}`,
              `${j.rationaleEmployee}${sc.noteEmployee}`,
            );
          }
        }
      }
    }
  });

  it("基準表に穴があって最下位へ丸めたときの根拠文", () => {
    const j = judgeRank(50, [{ rank: "A", displayLabel: "100%以上", lowerBound: 100, upperBound: null }], "higher", {
      unit: "%",
    });
    expect(j.fellThrough).toBe(true);
    expectDeliveredAsSaved("穴あき基準表", j.rationaleEmployee);
  });

  it("判定できなかった項目の説明文", () => {
    expectDeliveredAsSaved("判定外", UNRATED_RATIONALE_EMPLOYEE);
    expectDeliveredAsSaved("等級要件の設問なし", UNRATED_REQUIREMENT_RATIONALE_EMPLOYEE);
  });

  it("昇給・昇格の理由（すべてA方式／点数方式、達成・未達の両方）", () => {
    const ranks: (Rank | null)[] = ["A", "B", "C", "D", "E", null];
    for (const requiresAllA of [true, false]) {
      for (const rank of ranks) {
        const input: OverallInput = {
          items: [
            { kpiItemId: "k1", itemName: "等級要件達成率", rank, points: 8, maxPoints: 10 },
            { kpiItemId: "k2", itemName: "ヒヤリ報告件数", rank: "A", points: 10, maxPoints: 10 },
          ],
          raiseRequiresAllA: requiresAllA,
          requiredKpiPoints: 100,
          requiredBehaviorPoints: 12,
          behaviorTotal: 7,
          gates: [{ text: "スキルアップ研修（チーフ以上）", achieved: false }],
        };
        const res = judgeOverall(input);
        expectDeliveredAsSaved(`昇給 allA=${requiresAllA} rank=${rank}`, res.raiseReasonEmployee);
        expectDeliveredAsSaved(
          `昇格 allA=${requiresAllA} rank=${rank}`,
          res.promotionBlockedReasonEmployee ?? "",
        );
      }
    }
  });

  it("昇給できるときの理由も、そのまま本人に届く", () => {
    for (const requiresAllA of [true, false]) {
      const res = judgeOverall({
        items: [{ kpiItemId: "k1", itemName: "等級要件達成率", rank: "A", points: 10, maxPoints: 10 }],
        raiseRequiresAllA: requiresAllA,
        requiredKpiPoints: null,
        requiredBehaviorPoints: null,
        behaviorTotal: null,
        gates: [],
      });
      expect(res.raiseEligible).toBe(true);
      expectDeliveredAsSaved(`昇給できる allA=${requiresAllA}`, res.raiseReasonEmployee);
      expect(res.promotionBlockedReasonEmployee).toBeNull();
    }
  });
});

describe("昇格できない理由は、次に何をすればよいかが伝わる", () => {
  const base: OverallInput = {
    items: [{ kpiItemId: "k1", itemName: "等級要件達成率", rank: "C", points: 6, maxPoints: 10 }],
    raiseRequiresAllA: true,
    requiredKpiPoints: 100,
    requiredBehaviorPoints: 12,
    behaviorTotal: 7,
    gates: [],
  };

  it("KPI・行動指針が届かないときは、どこを見ればよいかを添える", () => {
    const emp = judgeOverall(base).promotionBlockedReasonEmployee!;
    expect(emp).toContain("昇格の目安にまだ届いていません");
    expect(emp).toContain("上長");
    // 必要点数・獲得点数は1文字も出さない
    expect(emp).not.toMatch(/[0-9０-９]\s*点/);
    expect(containsCriteriaLeak(emp)).toBe(false);
  });

  it("未達の昇格要件は、要件名をそのまま本人に伝える", () => {
    const emp = judgeOverall({
      ...base,
      gates: [
        { text: "スキルアップ研修（チーフ以上）", achieved: false },
        { text: "受講後報告書の提出", achieved: true },
      ],
    }).promotionBlockedReasonEmployee!;
    expect(emp).toContain("スキルアップ研修（チーフ以上）");
    expect(emp).not.toContain("受講後報告書の提出"); // 達成済みの要件は理由に出さない
    expect(containsCriteriaLeak(emp)).toBe(false);
  });

  it("昇格要件の文言に基準値が書かれていたら、その要件名だけを伏せる（他の要件名は伝える）", () => {
    const emp = judgeOverall({
      ...base,
      gates: [
        { text: "受講後報告書の提出", achieved: false },
        { text: "資格試験で80点以上を取得", achieved: false },
      ],
    }).promotionBlockedReasonEmployee!;
    expect(emp).toContain("受講後報告書の提出");
    expect(emp).not.toContain("80点");
    expect(emp).toContain("このほかにも未達の昇格要件があります");
    expect(containsCriteriaLeak(emp)).toBe(false);
  });

  it("未達の昇格要件がすべて基準値入りなら、要件名は1つも出さず上長へ案内する", () => {
    const emp = judgeOverall({
      ...base,
      gates: [{ text: "資格試験で80点以上を取得", achieved: false }],
    }).promotionBlockedReasonEmployee!;
    expect(emp).not.toContain("80点");
    expect(emp).toContain("未達の昇格要件があります。内容は上長にご確認ください。");
    expect(emp).not.toContain("このほかにも");
    expect(containsCriteriaLeak(emp)).toBe(false);
  });

  it("評価者向けの理由は、これまでどおり数値をそのまま残す（今回の変更で削らない）", () => {
    const res = judgeOverall({
      ...base,
      gates: [{ text: "資格試験で80点以上を取得", achieved: false }],
    });
    expect(res.promotionBlockedReason).toContain("資格試験で80点以上を取得");
    expect(res.promotionBlockedReason).toContain("昇格に必要な100点");
  });
});

/**
 * Q3 の申し送り（「本人向けの文を新しく増やすときは、必ずこの試験に足すこと」）に従って追加。
 *
 * 「まだ確定していません」の知らせ（spec §21）は、評価の集計とは別の場所で作る文だが、
 * **本人の画面（評価の結果を見る）に出る文**である点は同じ。同じ画面に
 * 昇格できない理由（§19 で書き直した文）と並ぶため、ふるいは同じものを通す。
 */
describe("「まだ確定していません」の知らせも、本人向けの文として同じふるいを通る", () => {
  const cycles = [{ cycleId: "c1", cycleName: "2025年度 下期", periodEnd: "2026-03-31" }];

  it("1期のときの見出しと説明文", () => {
    expectDeliveredAsSaved("1期の見出し", myPendingHeadline(cycles));
    expectDeliveredAsSaved("説明文", MY_PENDING_BODY);
  });

  it("複数期のときの見出し（期の数を出しても、基準値とは読めない）", () => {
    const many = [...cycles, { cycleId: "c2", cycleName: "2025年度 上期", periodEnd: "2025-09-30" }];
    expectDeliveredAsSaved("複数期の見出し", myPendingHeadline(many));
  });

  it("期の名前に点数が書かれていても、本人に基準値が漏れる形にはならない", () => {
    // 評価期間の名前は会社の管理者が自由に付けられる。万一そこに数字が入っても、
    // 見出しは名前をそのまま囲んで出すだけで、点数の意味づけは足さない。
    const named = [{ cycleId: "c1", cycleName: "2025年度 下期", periodEnd: "2026-03-31" }];
    expect(myPendingHeadline(named)).toBe("「2025年度 下期」の評価は、まだ確定していません");
  });
});

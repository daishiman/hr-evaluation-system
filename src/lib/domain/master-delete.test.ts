import { describe, expect, it } from "vitest";
import {
  bandSetBlockedReason,
  blockedMark,
  deleteBlockedReason,
  deleteConfirmText,
  kpiCategoryBlockedReason,
  kpiCategoryDeleteConfirmText,
  kpiItemBlockedReason,
  kpiItemDeleteConfirmText,
  placesText,
} from "./master-delete";

/**
 * 消せないときに画面へ出す文章の決まり。
 * 「消せません」だけで終えず、必ず「どこで使っているか」と「代わりに何をするか」を含める。
 */

describe("消せない理由の文章", () => {
  it("一度も使っていなければ理由は無い（＝消せる）", () => {
    expect(deleteBlockedReason([])).toBeNull();
  });

  it("使っている場所を名指しし、代わりの操作を示す", () => {
    const reason = deleteBlockedReason(["アンケート「2026年上期」"]);
    expect(reason).toContain("アンケート「2026年上期」");
    expect(reason).toContain("「使わない」にすると、次のアンケートから外せます");
    /* 1文に3つのことを詰めない（2026-08-12 の指摘）。
       句点で切った1文ずつが40文字以内であること。差し込まれる名前は数えない。 */
    for (const s of reason!.replace(/アンケート「[^」]*」/g, "").split("。")) {
      expect(s.length).toBeLessThanOrEqual(40);
    }
  });

  it("画面では畳む「使っている場所」も、API の返事には残す（情報を減らさない）", () => {
    // 画面は行に「使用中（◯件）」だけ出し、場所は押して開く形にした。
    expect(blockedMark(["A", "B"])).toBe("使用中（2件）");
    expect(blockedMark([])).toBeNull();
    // ただし API を直に叩いて断られたときの手がかりは消さない。
    expect(deleteBlockedReason(["A", "B", "C", "D"])).toContain("A・B ほか2件");
  });

  it("使っている場所が多いときは2件だけ挙げて残りは件数にする", () => {
    expect(placesText(["A", "B"])).toBe("A・B");
    expect(placesText(["A", "B", "C", "D"])).toBe("A・B ほか2件");
  });

  it("基準セットは、まず等級から外す順番を先に示す", () => {
    const reason = bandSetBlockedReason(["等級５：Manager Ⅰ"], []);
    expect(reason).toContain("等級５：Manager Ⅰ");
    expect(reason).toContain("先に「どの等級に出すか」");
  });

  it("等級から外れていれば、基準セットも使用実績で判断する", () => {
    expect(bandSetBlockedReason([], [])).toBeNull();
    expect(bandSetBlockedReason([], ["確定済みの評価"])).toContain("完全には消せません");
  });
});

describe("消す前の確認の文章", () => {
  it("何が消えるかと、戻せないことを書く", () => {
    const text = deleteConfirmText("創造性について", "5段階の文章5件も一緒に消えます。");
    expect(text).toContain("「創造性について」");
    expect(text).toContain("元に戻せません");
    expect(text).toContain("5段階の文章5件も一緒に消えます。");
    // 消しても過去に影響しないことを、その場で言い切る（不安で手が止まらないように）
    expect(text).toContain("公開したアンケートと確定済みの評価は変わりません");
  });
});

describe("KPIカテゴリの消せない理由・確認文", () => {
  it("一度も使っていなければ理由は無い（＝消せる）", () => {
    expect(kpiCategoryBlockedReason([])).toBeNull();
  });

  it("使っている場所を名指しする", () => {
    const reason = kpiCategoryBlockedReason(["KPI項目「売上」"]);
    expect(reason).toContain("完全には消せません");
    expect(reason).toContain("KPI項目「売上」");
  });

  it("消す前の確認文に、名前と戻せないことを含める", () => {
    const text = kpiCategoryDeleteConfirmText("品質");
    expect(text).toContain("「品質」");
    expect(text).toContain("元に戻せません");
  });
});

describe("KPI項目の消せない理由・確認文", () => {
  it("一度も使っていなければ理由は無い（＝消せる）", () => {
    expect(kpiItemBlockedReason([])).toBeNull();
  });

  it("使っている場所を名指しする", () => {
    const reason = kpiItemBlockedReason(["アンケート「2026年上期」"]);
    expect(reason).toContain("完全には消せません");
    expect(reason).toContain("アンケート「2026年上期」");
  });

  it("消す前の確認文に、名前と戻せないことを含める", () => {
    const text = kpiItemDeleteConfirmText("解約率");
    expect(text).toContain("「解約率」");
    expect(text).toContain("元に戻せません");
  });
});

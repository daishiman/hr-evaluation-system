import { describe, expect, it } from "vitest";
import { bandSetBlockedReason, deleteBlockedReason, deleteConfirmText, placesText } from "./master-delete";

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
    expect(reason).toContain("公開したアンケートと確定済みの評価をそのまま残すためです");
    expect(reason).toContain("「使わない」を押してください");
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

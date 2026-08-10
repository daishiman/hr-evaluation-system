import { describe, expect, it } from "vitest";
import { normalizeKey } from "./import";

/**
 * 見出しの突き合わせは、外れても「列が見つかりません」としか出ないため原因が見えにくい。
 * 実際に、正規表現の文字クラスに置いたハイフンが「\ から ー まで」の範囲と解釈され、
 * 「メールアドレス」が空文字になって名簿の取り込みが丸ごと失敗した。
 * カタカナ・英数字が消えないことをここで固定しておく。
 */
describe("normalizeKey", () => {
  it("カタカナの見出しが消えない", () => {
    expect(normalizeKey("メールアドレス")).not.toBe("");
    expect(normalizeKey("マネージャー")).not.toBe("");
    expect(normalizeKey("ログインID")).toBe("ログインid");
  });

  it("英数字が消えない", () => {
    expect(normalizeKey("email")).toBe("email");
    expect(normalizeKey("等級１：Beginner")).toBe("等級1beginner");
  });

  it("空白・記号・全角半角の違いを吸収する", () => {
    expect(normalizeKey("氏名（回答者）")).toBe(normalizeKey("氏名 (回答者)"));
    expect(normalizeKey("【模 範】")).toBe("模範");
    expect(normalizeKey("ヒヤリ・ハット報告")).toBe("ヒヤリハット報告");
  });

  it("表記ゆれのある見出し同士が同じキーになる", () => {
    expect(normalizeKey("メールアドレス")).toBe(normalizeKey("メール アドレス"));
    expect(normalizeKey("社員番号")).toBe(normalizeKey("社員 番号"));
  });
});

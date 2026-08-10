import { describe, expect, it } from "vitest";
import { formatPercent, parseCsv, toCsv } from "./csv";

/**
 * CSVの読み書きは、壊れても画面上は静かに間違うだけなので、
 * 「Excelで開ける形」と「引用符つきの値を正しく戻せること」を固定しておく。
 */

describe("toCsv", () => {
  it("Excelで文字化けしないよう、BOMとCRLFを付ける", () => {
    const csv = toCsv(["氏名", "点数"], [["田中", 80]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("カンマ・改行・引用符を含む値は引用符で囲んで内側をエスケープする", () => {
    const csv = toCsv(["根拠"], [['A：1,2\n"補足"']]);
    expect(csv).toContain('"A：1,2\n""補足"""');
  });
});

describe("parseCsv", () => {
  it("引用符の中のカンマと改行を1つの値として読む", () => {
    const rows = parseCsv('氏名,根拠\r\n田中,"1,2\n3"\r\n');
    expect(rows).toEqual([
      ["氏名", "根拠"],
      ["田中", "1,2\n3"],
    ]);
  });

  it("二重引用符のエスケープを戻す", () => {
    expect(parseCsv('a\r\n"言""葉"')).toEqual([["a"], ['言"葉']]);
  });

  it("BOM付きのファイルでも先頭の見出しを壊さない", () => {
    expect(parseCsv("﻿氏名,点数\r\n田中,80")[0]).toEqual(["氏名", "点数"]);
  });

  it("空行は読み飛ばす（末尾の改行で空の回答者を作らない）", () => {
    expect(parseCsv("氏名\r\n田中\r\n\r\n")).toEqual([["氏名"], ["田中"]]);
  });

  it("書き出したものをそのまま読み戻せる", () => {
    const rows = [
      ["田中 陽子", "A：80点\n（基準：90%以上）", 80],
      ["佐藤,健太", '"引用"', 0],
    ];
    const back = parseCsv(toCsv(["氏名", "根拠", "点数"], rows));
    expect(back[1]).toEqual(["田中 陽子", "A：80点\n（基準：90%以上）", "80"]);
    expect(back[2]).toEqual(["佐藤,健太", '"引用"', "0"]);
  });
});

describe("formatPercent", () => {
  it("小数第1位まで出す", () => {
    expect(formatPercent(87.65)).toBe("87.7%");
  });

  it("未計算はハイフンではなく空にする（表計算で0と間違えないため）", () => {
    expect(formatPercent(null)).toBe("");
  });
});

/**
 * スプレッドシートの範囲をコピーして貼り付けるとタブ区切りになる。
 * 「ファイルを選ぶ」でも「貼り付ける」でも同じように読めることを固定しておく
 * （区切りを取り違えると、1行が丸ごと1つの値になって静かに全滅する）。
 */
describe("parseCsv（貼り付け＝タブ区切り）", () => {
  it("見出し行にタブが多ければタブ区切りとして読む", () => {
    const rows = parseCsv("氏名\tメールアドレス\t等級\n田中 陽子\ta@example.com\t等級１：Beginner");
    expect(rows[0]).toEqual(["氏名", "メールアドレス", "等級"]);
    expect(rows[1]).toEqual(["田中 陽子", "a@example.com", "等級１：Beginner"]);
  });

  it("タブ区切りでも、値の中のカンマはそのまま残す", () => {
    expect(parseCsv("氏名\t備考\n佐藤\t1,2,3")[1]).toEqual(["佐藤", "1,2,3"]);
  });

  it("カンマ区切りの見出しはこれまでどおりカンマで読む（設問文にタブは入らない）", () => {
    expect(parseCsv("氏名,【支援】１）インテークやアセスメント\n田中,基準を満たす")[1]).toEqual(["田中", "基準を満たす"]);
  });
});

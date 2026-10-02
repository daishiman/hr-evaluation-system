import { describe, expect, it } from "vitest";
import { splitSource, stripComments } from "./source-code";

/**
 * 字面の検査の下ごしらえ（注釈を除く・文字列を取り出す）が、取り違えないこと。
 * ここが崩れると、検査は「書き方しだいで通る」か「関係ない行で落ちる」になる。
 */

describe("stripComments（注釈だけを除く）", () => {
  it("行の注釈と囲みの注釈を空白にし、長さと改行の位置は変えない", () => {
    const src = "a(); // 説明\n/* 複数\n行 */ b();";
    const out = stripComments(src);
    expect(out).toHaveLength(src.length);
    expect(out.split("\n")).toHaveLength(3);
    expect(out).not.toContain("説明");
    expect(out).not.toContain("複数");
    expect(out).toContain("a();");
    expect(out).toContain("b();");
  });

  it("使い方を注釈に書いただけのファイルは、呼んだことにならない", () => {
    const src = [
      "/**",
      " * 部品は `const { save } = useSaveAction(masterRequest)` で受ける。",
      " */",
      "// useReadAction( もここでは呼ばない",
      "export const masterRequest = dispatch();",
    ].join("\n");
    expect(stripComments(src)).not.toMatch(/use(?:Save|Read)Action\(/);
  });

  it("文字列の中の // と /* は注釈ではない（URL・パスを壊さない）", () => {
    const src = 'const u = "https://example.com/a"; const g = \'x/*y\'; next(); // 注釈';
    const out = stripComments(src);
    expect(out).toContain('"https://example.com/a"');
    expect(out).toContain("'x/*y'");
    expect(out).toContain("next();");
    expect(out).not.toContain("注釈");
  });

  it("テンプレートの中の // と、${…} の入れ子を読み切る", () => {
    const src = "const u = `https://${host}/p?q=${a ? `x//${b}` : \"//\"}`; after(); // 注釈";
    const out = stripComments(src);
    expect(out).toContain("`https://${host}/p?q=${a ? `x//${b}` : \"//\"}`");
    expect(out).toContain("after();");
    expect(out).not.toContain("注釈");
  });

  it("正規表現の中の // と引用符は、注釈・文字列の始まりと取り違えない", () => {
    const src = [
      "const external = /^[a-z]+:\\/\\//i.test(url) && fetch(url);",
      "const quotes = s.replace(/[\"']/g, \"\"); send(); // 注釈",
      "const ok = list.filter((p) => /\\/\\//.test(p)); done();",
    ].join("\n");
    const out = stripComments(src);
    expect(out).toContain("fetch(url);");
    expect(out).toContain("send();");
    expect(out).toContain("done();");
    expect(out).not.toContain("注釈");
  });

  it("割り算の / は正規表現と取り違えない（後ろの注釈を除ける）", () => {
    const out = stripComments("const r = a / b / 2; // 注釈 / c\nnext();");
    expect(out).toContain("const r = a / b / 2;");
    expect(out).not.toContain("注釈");
    expect(out).toContain("next();");
  });

  it("注釈の中の引用符は、文字列を始めない", () => {
    const out = stripComments("// it's done\nuseSaveAction(save);\n/* \"open */ call();");
    expect(out).toContain("useSaveAction(save);");
    expect(out).toContain("call();");
  });

  it("JSX の {/* … */} も注釈として除く", () => {
    const out = stripComments("<div>{/* useSaveAction( */}<span>本文</span></div>");
    expect(out).not.toContain("useSaveAction(");
    expect(out).toContain("<span>本文</span>");
  });
});

describe("splitSource（文字列の中身とコードに分ける）", () => {
  it("文字列の中身を取り出し、コードからは注釈と文字列を空白にする", () => {
    const { literals, code } = splitSource('const a = "保存しました"; // 注釈\ncall(\'x\');');
    expect(literals).toEqual(["保存しました", "x"]);
    expect(code).not.toContain("保存しました");
    expect(code).not.toContain("注釈");
    expect(code).toContain("call(");
  });

  it("${…} の中に書いた文字列も、画面に出る文として取り出す", () => {
    const { literals } = splitSource('const t = `残り${n}件${late ? "（期限経過）" : `（あと${d}日）`}`;');
    expect(literals[0]).toBe('残り${n}件${late ? "（期限経過）" : `（あと${d}日）`}');
    expect(literals).toContain("（期限経過）");
    expect(literals).toContain("（あと${d}日）");
  });

  it("閉じ忘れた ' と \" は行末で切り、次の行を飲み込まない", () => {
    const { literals, code } = splitSource("const a = 'open\nnext();");
    expect(literals).toEqual(["open"]);
    expect(code).toContain("next();");
  });
});

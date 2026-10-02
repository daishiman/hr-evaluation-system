/**
 * テストがソースコードの字面を調べるときの下ごしらえ。
 *
 * 「この関数を通しているか」「書き込む通信を持っていないか」を字面で調べる検査は、
 * 注釈（コメント）に書いた使い方の例まで数えると、書いただけで通ってしまう
 * （実際に、使い方を説明する注釈だけで検査を通っていたファイルがあった）。
 * 逆に正規表現で雑に消すと、"https://" の // や "/*" を注釈と取り違える。
 * そのため、文字列・テンプレート・正規表現リテラルを見分けながら端から読む。
 *
 * 見分けられないもの: JSX の地の文に書いた // や引用符（構文を知らないと区別できない）。
 */

/** string の body は引用符の中身。inner は `${…}` の中に書かれた文字列の中身（入れ子も含む）。 */
type Part = { kind: "code" | "comment" | "string"; text: string; body?: string; inner?: string[] };

/** 直前がこの形なら、次の / は割り算ではなく正規表現の始まり（式が始まる位置）。 */
const REGEX_CAN_START =
  /(?:^|[(,=:[!&|?{};+\-*%~^]|=>|\b(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await))$/;

const blank = (s: string) => s.replace(/[^\n]/g, " ");

/** 正規表現リテラルの終わり（フラグの次）。同じ行で閉じなければ正規表現ではない（-1）。 */
function regexEnd(src: string, start: number): number {
  let inClass = false;
  for (let j = start + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "\n") return -1;
    if (c === "\\") j++;
    else if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) {
      let e = j + 1;
      while (/[a-z]/i.test(src[e] ?? "")) e++;
      return e;
    }
  }
  return -1;
}

/**
 * `${` の中（コード）を読み、対応する } の次を返す。中の文字列の } は数えない。
 * 中に書かれた文字列（`${x ? "…" : ""}` の "…"）も画面に出る文なので、inner に集める。
 */
function placeholderEnd(src: string, start: number, inner: string[]): number {
  let depth = 1;
  let j = start;
  while (j < src.length) {
    const c = src[j];
    if (c === '"' || c === "'" || c === "`") {
      const literal = quoted(src, j, inner);
      inner.push(literal.body);
      j = literal.end;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return j + 1;
    j++;
  }
  return src.length;
}

/**
 * 文字列の終わりと中身。' と " は改行で切る（閉じ忘れで後ろ全部を飲み込まない）。
 * テンプレートは `${…}` の入れ子（中のテンプレートを含む）ごと1つの文字列にする。
 */
function quoted(src: string, start: number, inner: string[]): { end: number; body: string } {
  const q = src[start];
  let j = start + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === q) return { end: j + 1, body: src.slice(start + 1, j) };
    if (q !== "`" && c === "\n") break;
    j = q === "`" && c === "$" && src[j + 1] === "{" ? placeholderEnd(src, j + 2, inner) : j + 1;
  }
  const end = Math.min(j, src.length);
  return { end, body: src.slice(start + 1, end) };
}

/** コード・注釈・文字列に切り分ける。正規表現リテラルはコードに含める。 */
function partsOf(src: string): Part[] {
  const parts: Part[] = [];
  let code = "";
  // 直前のコード（文字列は値として "0" に置き換える）。次の / が割り算か正規表現かを決める
  let recent = "";
  let i = 0;
  const take = (part: Part, end: number) => {
    if (code) parts.push({ kind: "code", text: code });
    parts.push(part);
    code = "";
    recent += part.kind === "string" ? "0" : " ";
    i = end;
  };
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && (d === "/" || d === "*")) {
      const close = d === "/" ? src.indexOf("\n", i) : src.indexOf("*/", i + 2);
      const end = close < 0 ? src.length : d === "/" ? close : close + 2;
      take({ kind: "comment", text: src.slice(i, end) }, end);
    } else if (c === '"' || c === "'" || c === "`") {
      const inner: string[] = [];
      const { end, body } = quoted(src, i, inner);
      take({ kind: "string", text: src.slice(i, end), body, inner }, end);
    } else {
      const regex = c === "/" && REGEX_CAN_START.test(recent.trimEnd()) ? regexEnd(src, i) : -1;
      const end = regex > i ? regex : i + 1;
      code += src.slice(i, end);
      recent = (recent + src.slice(i, end)).slice(-64);
      i = end;
    }
  }
  if (code) parts.push({ kind: "code", text: code });
  return parts;
}

/** 注釈だけを空白に置き換える（改行は残すので行番号は元のまま）。文字列と正規表現はそのまま残す。 */
export function stripComments(src: string): string {
  return partsOf(src)
    .map((p) => (p.kind === "comment" ? blank(p.text) : p.text))
    .join("");
}

/** 文字列リテラルの中身の一覧と、注釈・文字列を空白にしたコードに分ける。 */
export function splitSource(src: string): { literals: string[]; code: string } {
  const parts = partsOf(src);
  return {
    literals: parts.flatMap((p) => (p.kind === "string" ? [p.body ?? "", ...(p.inner ?? [])] : [])),
    code: parts.map((p) => (p.kind === "code" ? p.text : blank(p.text))).join(""),
  };
}

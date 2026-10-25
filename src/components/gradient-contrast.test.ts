import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, EXPLICIT_PALETTES } from "@/lib/palette";

/*
 * 部品クラスの勾配と比（DD-030・O29-2）。
 *
 * 共通部品の ui- の規則が塗る勾配・混ぜた色の上で、文字が読めることを全ての系統と明暗で確かめる。
 * 文字は 4.5:1、大きな文字と部品の縁（枠・フォーカスの印・現在地の帯）は 3:1（WCAG AA）。
 * あわせて、動きを減らす設定・印刷・コントラストを強くする設定・使えない状態で平らな面へ戻すこと、
 * キーボードで選んだときの印があること、指で押す端末で 44px 以上になることを規則の字面で見る。
 *
 * 色の測り方（ブラウザと同じ考え方を、ここで決めた手順で再現する）:
 *  - トークンの値は palette-contract.test.ts と同じく、既定の系統（:root / html[data-theme="dark"]）に
 *    系統の宣言を重ねたものを「実際に当たる色」とする。
 *  - color-mix(in srgb, A p%, B q%) は、0〜255 の sRGB の各チャンネルを割合で線形に混ぜる。
 *    アルファは premultiplied（チャンネルにアルファを掛けてから混ぜ、混ぜたアルファで割り戻す）。
 *    割合の合計が 100% に満たないときは、足りないぶんだけアルファを下げる（CSS Color 5 と同じ）。
 *  - transparent は rgba(0,0,0,0)。currentColor はその部品の文字の色。
 *  - 勾配は端から端までを 11 点（0%, 10%, … 100%）で標本にとり、各点を premultiplied で補間する。
 *  - 半透明の色は、下の面（backdrop）へ重ねて（source-over）から比を測る。
 *  - 比は WCAG 2 の相対輝度（各チャンネルを線形化して 0.2126R + 0.7152G + 0.0722B）から求める。
 *
 * `GRADIENT_CONTRAST_TABLE=1` を付けて流すと、系統×明暗ごとの最小値の表を出す（報告用）。
 */

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

/* ───────────────────── 系統×明暗の色 ───────────────────── */

function blockAfter(source: string, marker: string): string {
  const markerAt = source.indexOf(marker);
  expect(markerAt, `${marker} が見つからない`).toBeGreaterThanOrEqual(0);
  const openAt = source.indexOf("{", markerAt);
  let depth = 0;
  for (let i = openAt; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(openAt + 1, i);
  }
  throw new Error(`${marker} の終了括弧が見つからない`);
}

function declarations(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  );
}

const baseLight = declarations(blockAfter(css, ":root"));
const baseDark = declarations(blockAfter(css, 'html[data-theme="dark"]'));
const THEMES: [string, Map<string, string>][] = [
  [`${DEFAULT_PALETTE}/light`, baseLight],
  [`${DEFAULT_PALETTE}/dark`, baseDark],
  ...EXPLICIT_PALETTES.flatMap((palette): [string, Map<string, string>][] => [
    [`${palette}/light`, new Map([...baseLight, ...declarations(blockAfter(css, `html[data-palette="${palette}"]`))])],
    [
      `${palette}/dark`,
      new Map([...baseDark, ...declarations(blockAfter(css, `html[data-palette="${palette}"][data-theme="dark"]`))]),
    ],
  ]),
];

/* ───────────────────── 色の計算 ───────────────────── */

/** r・g・b は 0〜255、a は 0〜1。 */
interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

/** 括弧の外にあるカンマで区切る。 */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth -= 1;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(text.slice(from).trim());
  return parts;
}

/** color-mix の1つの引数を「色」と「割合（%）」に分ける。 */
function mixArgument(text: string): { color: string; percent?: number } {
  const m = /^([\s\S]*?)\s+(\d+(?:\.\d+)?)%$/.exec(text.trim());
  return m ? { color: m[1], percent: Number(m[2]) } : { color: text.trim() };
}

/** premultiplied で2色を混ぜる（割合は 0〜100）。 */
function mix(a: Rgba, pa: number | undefined, b: Rgba, pb: number | undefined): Rgba {
  let wa = pa ?? (pb === undefined ? 50 : 100 - pb);
  let wb = pb ?? 100 - wa;
  const sum = wa + wb;
  const alphaScale = sum < 100 ? sum / 100 : 1;
  wa /= sum;
  wb /= sum;
  const alpha = a.a * wa + b.a * wb;
  if (alpha === 0) return TRANSPARENT;
  const channel = (k: "r" | "g" | "b") => (a[k] * a.a * wa + b[k] * b.a * wb) / alpha;
  return { r: channel("r"), g: channel("g"), b: channel("b"), a: alpha * alphaScale };
}

function evalColor(expression: string, colors: Map<string, string>, current: Rgba): Rgba {
  const text = expression.trim();
  if (text === "transparent") return TRANSPARENT;
  if (/^currentcolor$/i.test(text)) return current;
  const variable = /^var\(--([a-z0-9-]+)\)$/.exec(text);
  if (variable) {
    const value = colors.get(variable[1]);
    expect(value, `--${variable[1]} が無い`).toBeTruthy();
    return evalColor(value as string, colors, current);
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const [r, g, b] = [0, 2, 4].map((at) => Number.parseInt(hex[1].slice(at, at + 2), 16));
    return { r, g, b, a: 1 };
  }
  const colorMix = /^color-mix\(\s*in srgb\s*,([\s\S]*)\)$/.exec(text);
  if (colorMix) {
    const args = splitTop(colorMix[1]);
    expect(args, text).toHaveLength(2);
    const [first, second] = args.map(mixArgument);
    return mix(evalColor(first.color, colors, current), first.percent, evalColor(second.color, colors, current), second.percent);
  }
  throw new Error(`この試験では測れない色の書き方: ${text}（var() と color-mix(in srgb) だけを使う）`);
}

/** 上の色を下の不透明な面へ重ねる（source-over）。 */
function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return TRANSPARENT;
  const channel = (k: "r" | "g" | "b") => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a;
  return { r: channel("r"), g: channel("g"), b: channel("b"), a };
}

function luminance(color: Rgba): number {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgba, b: Rgba): number {
  expect(a.a, "比は不透明な色どうしで測る").toBeCloseTo(1, 6);
  expect(b.a, "比は不透明な色どうしで測る").toBeCloseTo(1, 6);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/* ───────────────────── 勾配の標本 ───────────────────── */

/** 値の中の linear-gradient( … ) の中身を全て取り出す。 */
function gradientsIn(value: string): string[] {
  const found: string[] = [];
  let at = value.indexOf("linear-gradient(");
  while (at >= 0) {
    const open = at + "linear-gradient".length;
    let depth = 0;
    let close = open;
    for (; close < value.length; close += 1) {
      if (value[close] === "(") depth += 1;
      else if (value[close] === ")" && --depth === 0) break;
    }
    found.push(value.slice(open + 1, close));
    at = value.indexOf("linear-gradient(", close);
  }
  return found;
}

/** 勾配の色の止め（向きは捨て、位置は 0〜1 に直す。書いていない位置は隣から等分する）。 */
function stopsOf(args: string): { color: string; at: number }[] {
  const parts = splitTop(args);
  if (/^(?:-?\d+(?:\.\d+)?(?:deg|turn|rad|grad)|to\s)/.test(parts[0])) parts.shift();
  const stops = parts.map((part) => {
    const m = /^([\s\S]*?)\s+(-?\d+(?:\.\d+)?)%$/.exec(part);
    return m ? { color: m[1], at: Number(m[2]) / 100 as number | undefined } : { color: part, at: undefined };
  });
  if (stops[0].at === undefined) stops[0].at = 0;
  if (stops[stops.length - 1].at === undefined) stops[stops.length - 1].at = 1;
  for (let i = 1; i < stops.length - 1; i += 1) {
    if (stops[i].at !== undefined) continue;
    let j = i;
    while (stops[j].at === undefined) j += 1;
    const from = stops[i - 1].at as number;
    stops[i].at = from + ((stops[j].at as number) - from) / (j - i + 1);
  }
  return stops.map((s) => ({ color: s.color, at: s.at as number }));
}

/** 勾配を 11 点で標本にとり、下の面へ重ねた色を返す。 */
function sampleGradient(args: string, colors: Map<string, string>, current: Rgba, backdrop: Rgba): Rgba[] {
  const stops = stopsOf(args).map((s) => ({ color: evalColor(s.color, colors, current), at: s.at }));
  return Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    let color: Rgba;
    if (t <= stops[0].at) color = stops[0].color;
    else if (t >= stops[stops.length - 1].at) color = stops[stops.length - 1].color;
    else {
      const k = stops.findIndex((s) => s.at >= t);
      const [a, b] = [stops[k - 1], stops[k]];
      const f = b.at === a.at ? 1 : (t - a.at) / (b.at - a.at);
      color = mix(a.color, (1 - f) * 100, b.color, f * 100);
    }
    return over(color, backdrop);
  });
}

/* ───────────────────── 規則の読み取り ───────────────────── */

interface Rule {
  selector: string;
  body: string;
  /** 外側の @media などを外から順に */
  at: string[];
  /** 出てきた順番（同じ強さの規則は後ろが勝つ） */
  order: number;
}

/** globals.css の規則を、入れ子の @media ごとに平らに並べる（注釈は除く）。 */
function rulesOf(source: string): Rule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  const walk = (chunk: string, at: string[]) => {
    let i = 0;
    while (i < chunk.length) {
      const open = chunk.indexOf("{", i);
      if (open < 0) return;
      const head = chunk.slice(i, open);
      const selector = head.slice(head.lastIndexOf(";") + 1).trim().replace(/\s+/g, " ");
      let depth = 0;
      let close = open;
      for (; close < chunk.length; close += 1) {
        if (chunk[close] === "{") depth += 1;
        else if (chunk[close] === "}" && --depth === 0) break;
      }
      const body = chunk.slice(open + 1, close);
      if (selector.startsWith("@")) walk(body, [...at, selector]);
      else out.push({ selector, body, at, order: out.length });
      i = close + 1;
    }
  };
  walk(text, []);
  return out;
}

const RULES = rulesOf(css);
const UI_RULES = RULES.filter((r) => /\.ui-[a-z]/.test(r.selector));
/** @media の外（ふだんの画面）にある ui- の規則 */
const PLAIN_UI_RULES = UI_RULES.filter((r) => r.at.length === 0);

/** 宣言の値（同じ名前が2回あれば後ろ）。 */
function prop(rule: Rule, name: string): string | undefined {
  const all = [...rule.body.matchAll(new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;]+);?`, "g"))];
  return all.at(-1)?.[1].trim();
}

function findRule(label: string, match: (r: Rule) => boolean, rules: Rule[] = PLAIN_UI_RULES): Rule {
  const found = rules.find(match);
  expect(found, `${label} の規則が無い`).toBeDefined();
  return found as Rule;
}

/** 塗りで出うる色（背景色と、勾配の 11 点）を、下の面へ重ねて返す。 */
function fillsOf(rule: Rule, colors: Map<string, string>, text: Rgba, backdrop: Rgba): Rgba[] {
  const fills: Rgba[] = [];
  const bgColor = prop(rule, "background-color");
  const base = bgColor ? over(evalColor(bgColor, colors, text), backdrop) : backdrop;
  const image = prop(rule, "background-image") ?? "";
  for (const args of gradientsIn(image)) fills.push(...sampleGradient(args, colors, text, base));
  if (fills.length === 0) fills.push(base);
  return fills;
}

/* ───────────────────── 測るもの ───────────────────── */

/**
 * 勾配・混ぜた色の上の文字。[文字の色, その部品の下の面]。
 * 下の面は、今のクラス（btn-primary・chip・badge-active など）が塗る背景。
 */
const TEXT_ON_FILLS: { name: string; match: (r: Rule) => boolean; pairs: [string, string][] }[] = [
  { name: "主の操作", match: (r) => r.selector === ".ui-press-main", pairs: [["cta-fg", "cta-bg"]] },
  {
    name: "主の操作（指を乗せた）",
    match: (r) => r.selector.startsWith(".ui-press-main:hover") && !r.selector.includes("::after"),
    pairs: [["cta-fg", "cta-bg"]],
  },
  {
    name: "主の操作（押した・押してある）",
    match: (r) => r.selector.includes('.ui-press-main[aria-pressed="true"]'),
    pairs: [["cta-fg", "cta-bg"]],
  },
  {
    name: "副の操作（secondary・tertiary・danger-outline）",
    match: (r) => r.selector === ".ui-press-sub",
    pairs: [["brand-deep", "surface"], ["ink", "surface"], ["danger", "surface"]],
  },
  {
    name: "選んだ札・切り替え・選択肢",
    match: (r) =>
      r.selector.includes(".ui-pick") &&
      r.selector.includes('[aria-pressed="true"]') &&
      !r.selector.includes(".ui-pick-card") &&
      prop(r, "background-image") !== undefined,
    pairs: [["brand-deep", "brand-soft"], ["ink", "brand-soft"], ["ink-muted", "brand-soft"]],
  },
  {
    name: "強める印（進行中・要対応・ランクA）",
    match: (r) => r.selector === ".ui-mark-strong",
    pairs: [["brand-deep", "brand-soft"], ["danger", "danger-soft"]],
  },
  { name: "段の印", match: (r) => r.selector === ".ui-step-mark", pairs: [["brand-deep", "brand-soft"]] },
  {
    name: "左のメニューの現在地",
    match: (r) => r.selector.includes(".sidebar-link.ui-here") && prop(r, "background-image") !== undefined,
    pairs: [["brand-deep", "brand-soft"]],
  },
  { name: "表の見出しの行", match: (r) => r.selector === ".ui-table thead th", pairs: [["ink", "surface"]] },
  {
    name: "開いた見せ隠しのボタン",
    match: (r) => r.selector.startsWith("button.ui-reveal:is(") && prop(r, "background-color") !== undefined,
    pairs: [["brand-deep", "surface"]],
  },
  {
    name: "開いた行の中の補足の札",
    match: (r) => r.selector.startsWith("details.inline-detail.ui-reveal[open]"),
    pairs: [["brand-deep", "surface"]],
  },
];

/** 部品クラスが文字に当てる色と、その下の面（塗りを足さないもの）。 */
const PLAIN_TEXT_PAIRS: [string, string, string][] = [
  ["注意の枠の文字", "ink", "caution-soft"],
  ["注意の枠の補足", "ink-muted", "caution-soft"],
  ["注意の枠のリンク", "brand-deep", "caution-soft"],
  ["注記のリンク", "brand-deep", "surface"],
  ["表の選んだ行", "ink", "brand-soft"],
  ["保存の結果の文", "brand-deep", "surface"],
  ["保存の結果の文（画面の地）", "brand-deep", "page-bg"],
  ["印の補足", "ink-muted", "surface"],
  ["印の補足（中の強い文）", "ink", "surface"],
];

/** 部品の縁（枠・フォーカスの印・選んだ印の内側の線・現在地の帯）。[名前, 縁, 隣の面] */
const BOUNDARY_PAIRS: [string, string, string][] = [
  ["フォーカスの印（面）", "brand", "surface"],
  ["フォーカスの印（画面の地）", "brand", "page-bg"],
  ["選んだ印の線", "brand", "surface"],
  ["現在地の帯", "brand", "brand-soft"],
  ["主の操作の面（端）", "cta-bg", "surface"],
  ["主の操作の面（端・画面の地）", "cta-bg", "page-bg"],
  ["主の操作の面（指を乗せた端）", "cta-bg-hover", "surface"],
  ["主の操作の面（指を乗せた端・画面の地）", "cta-bg-hover", "page-bg"],
  ["注意の枠", "caution-border", "caution-soft"],
  ["部品の枠", "line", "surface"],
];

/**
 * 勾配で塗る図の面（文字ではないもの）。勾配のどの点も、隣の面に 3:1 以上（WCAG 1.4.11）。
 * [名前, 規則, 隣の面]。メーターの塗りは、溝（.bar-track の subtle）の上に乗る。
 */
const FILL_EDGES: { name: string; match: (r: Rule) => boolean; back: string }[] = [
  { name: "メーターの塗り", match: (r) => r.selector === ".ui-meter .bar-fill", back: "subtle" },
];

function tokenColor(colors: Map<string, string>, token: string): Rgba {
  return evalColor(`var(--${token})`, colors, TRANSPARENT);
}

/** 系統×明暗ごとに、測ったもの全ての最小値を集める（報告の表と、失格の文の両方に使う）。 */
function measure(colors: Map<string, string>) {
  const results: { name: string; ratio: number; minimum: number }[] = [];
  for (const c of TEXT_ON_FILLS) {
    const rule = findRule(c.name, c.match);
    for (const [textToken, backdropToken] of c.pairs) {
      const text = tokenColor(colors, textToken);
      const fills = fillsOf(rule, colors, text, tokenColor(colors, backdropToken));
      const ratio = Math.min(...fills.map((fill) => contrast(text, fill)));
      results.push({ name: `${c.name}: ${textToken} / ${backdropToken}`, ratio, minimum: 4.5 });
    }
  }
  for (const [name, text, back] of PLAIN_TEXT_PAIRS) {
    results.push({ name: `${name}: ${text} / ${back}`, ratio: contrast(tokenColor(colors, text), tokenColor(colors, back)), minimum: 4.5 });
  }
  for (const [name, edge, back] of BOUNDARY_PAIRS) {
    results.push({ name: `${name}: ${edge} / ${back}`, ratio: contrast(tokenColor(colors, edge), tokenColor(colors, back)), minimum: 3 });
  }
  for (const f of FILL_EDGES) {
    const back = tokenColor(colors, f.back);
    const fills = fillsOf(findRule(f.name, f.match), colors, TRANSPARENT, back);
    results.push({ name: `${f.name}: 勾配 / ${f.back}`, ratio: Math.min(...fills.map((fill) => contrast(fill, back))), minimum: 3 });
  }
  return results;
}

/* ───────────────────── 試験 ───────────────────── */

describe("部品クラスの勾配と比: 全ての系統と明暗", () => {
  it("系統×明暗は 12 通り（既定の系統と、明示する系統それぞれの明暗）", () => {
    expect(THEMES).toHaveLength(2 + EXPLICIT_PALETTES.length * 2);
  });

  it("色の計算の手順そのものが正しい（混ぜる・重ねる・比）", () => {
    const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
    const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };
    expect(contrast(white, black)).toBeCloseTo(21, 5);
    const colors = new Map([["a", "#ffffff"], ["b", "#000000"]]);
    // 50% ずつ混ぜると各チャンネルの中間
    expect(evalColor("color-mix(in srgb, var(--a) 50%, var(--b))", colors, TRANSPARENT)).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
    // 透明と混ぜても色は薄まらず、アルファだけが下がる（premultiplied）
    expect(evalColor("color-mix(in srgb, var(--b) 25%, transparent)", colors, TRANSPARENT)).toEqual({ r: 0, g: 0, b: 0, a: 0.25 });
    // 半透明の黒を白へ重ねる
    expect(over({ r: 0, g: 0, b: 0, a: 0.25 }, white)).toEqual({ r: 191.25, g: 191.25, b: 191.25, a: 1 });
    // 勾配は 11 点で、端は止めの色そのもの
    const samples = sampleGradient("180deg, var(--a), var(--b)", colors, TRANSPARENT, white);
    expect(samples).toHaveLength(11);
    expect(samples[0]).toEqual(white);
    expect(samples[10]).toEqual(black);
    // 位置を書いた止めは、その位置から先が止めの色のまま
    expect(stopsOf("180deg, var(--a), transparent 70%").map((s) => s.at)).toEqual([0, 0.7]);
  });

  it("主の操作は --cta-bg から --cta-bg-hover への勾配で、--cta-fg は両端に 4.5:1 以上", () => {
    const main = findRule("主の操作", (r) => r.selector === ".ui-press-main");
    const image = prop(main, "background-image") ?? "";
    const [args] = gradientsIn(image);
    expect(args, ".ui-press-main は勾配で塗る").toBeDefined();
    const stops = stopsOf(args).map((s) => s.color);
    expect(stops[0]).toBe("var(--cta-bg)");
    expect(stops.at(-1)).toBe("var(--cta-bg-hover)");
    for (const [name, colors] of THEMES) {
      const fg = tokenColor(colors, "cta-fg");
      for (const end of ["cta-bg", "cta-bg-hover"]) {
        expect(contrast(fg, tokenColor(colors, end)), `${name}: cta-fg / ${end}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("勾配・混ぜた色の上の文字は 4.5:1、部品の縁は 3:1 以上（12 通り全て）", () => {
    const failures: string[] = [];
    const table: Record<string, Record<string, string>> = {};
    for (const [theme, colors] of THEMES) {
      const results = measure(colors);
      for (const r of results) {
        if (r.ratio < r.minimum) failures.push(`${theme} ${r.name} = ${r.ratio.toFixed(2)}（${r.minimum} 未満）`);
      }
      const text = results.filter((r) => r.minimum === 4.5);
      const edge = results.filter((r) => r.minimum === 3);
      const lowest = (list: typeof results) => list.reduce((a, b) => (b.ratio < a.ratio ? b : a));
      table[theme] = {
        文字の最小: `${lowest(text).ratio.toFixed(2)}（${lowest(text).name}）`,
        縁の最小: `${lowest(edge).ratio.toFixed(2)}（${lowest(edge).name}）`,
      };
    }
    if (process.env.GRADIENT_CONTRAST_TABLE) console.table(table);
    expect(failures).toEqual([]);
  });

  it("大きな文字（画面の見出し・節の見出し）は、画面の地と面の両方に 3:1 以上", () => {
    const heading = findRule("見出し", (r) => /\.ui-(?:title|heading)\b/.test(r.selector) && prop(r, "color") !== undefined);
    const color = prop(heading, "color") as string;
    for (const [theme, colors] of THEMES) {
      const text = evalColor(color, colors, TRANSPARENT);
      for (const back of ["page-bg", "surface"]) {
        expect(contrast(text, tokenColor(colors, back)), `${theme}: 見出し / ${back}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("見出しには勾配を付けない（見出しの面の微グラデ hero-tint は1画面1箇所のまま）", () => {
    const headings = PLAIN_UI_RULES.filter((r) => /\.ui-(?:title|heading)\b/.test(r.selector));
    expect(headings.filter((r) => /gradient/.test(r.body)).map((r) => r.selector)).toEqual([]);
    expect(UI_RULES.filter((r) => r.body.includes("hero-tint")).map((r) => r.selector)).toEqual([]);
  });
});

/* ───────────────────── 状態と、平らに戻す場面 ───────────────────── */

/** ふだんの画面で勾配・影を付ける ui- の規則の、元になる部品クラス（.ui-press など）。 */
function decoratedClasses(property: "background-image" | "box-shadow"): string[] {
  const classes = new Set<string>();
  for (const r of PLAIN_UI_RULES) {
    const value = prop(r, property);
    if (!value || value === "none") continue;
    const base = /\.(ui-[a-z][a-z-]*)/.exec(r.selector);
    if (base) classes.add(base[1]);
  }
  return [...classes].sort();
}

function flatRulesIn(atMatch: (at: string) => boolean): Rule[] {
  return UI_RULES.filter((r) => r.at.some(atMatch));
}

function expectFlat(label: string, rules: Rule[]) {
  for (const property of ["background-image", "box-shadow"] as const) {
    const flat = rules.filter((r) => new RegExp(`${property}\\s*:\\s*none\\s*!important`).test(r.body));
    expect(flat.length, `${label}: ${property} を none !important にする規則`).toBeGreaterThan(0);
    const covered = decoratedClasses(property).filter((c) => !flat.some((r) => new RegExp(`\\.${c}(?![\\w-])`).test(r.selector)));
    expect(covered, `${label}: ${property} を平らに戻していない部品クラス`).toEqual([]);
  }
  // 光（::after）も止める
  expect(
    rules.some((r) => r.selector.includes(".ui-press-main::after") && /content\s*:\s*none\s*!important/.test(r.body)),
    `${label}: 主の操作の光を消す`,
  ).toBe(true);
}

describe("状態の見た目と、平らな面へ戻す場面", () => {
  it("勾配を付ける部品クラスがある（無いと下の検査が素通りになる）", () => {
    expect(decoratedClasses("background-image")).toEqual(expect.arrayContaining(["ui-press-main", "ui-press-sub", "ui-pick"]));
  });

  it("選んだ・押した・開いた・現在地の状態を、それぞれ規則で示す", () => {
    const selectors = PLAIN_UI_RULES.map((r) => r.selector).join("\n");
    for (const state of ['[aria-pressed="true"]', '[aria-checked="true"]', ":checked", '[aria-expanded="true"]', "[open]", ":hover", ":active", '[aria-current="page"]']) {
      expect(selectors, state).toContain(state);
    }
  });

  it("キーボードで選んだときの印（:focus-visible）を、押す・選ぶ・開く・現在地の部品クラスに付ける", () => {
    const focus = PLAIN_UI_RULES.filter((r) => r.selector.includes(":focus-visible") && /outline\s*:\s*2px solid var\(--brand\)/.test(r.body));
    expect(focus.length).toBeGreaterThan(0);
    const selectors = focus.map((r) => r.selector).join(", ");
    for (const target of [".ui-press", ".ui-pick", ".segmented-btn", "button.ui-reveal", "details.ui-reveal > summary", ".ui-here"]) {
      expect(selectors, target).toContain(target);
    }
  });

  it("光は主の操作の ::after の短い帯で、文字に重ねず、指を乗せたとき・選んだときだけ1回走る", () => {
    const after = findRule("主の操作の光", (r) => r.selector === ".ui-press-main::after");
    expect(prop(after, "pointer-events")).toBe("none");
    expect(Number.parseFloat(prop(after, "height") ?? "99")).toBeLessThanOrEqual(2);
    expect(prop(after, "animation")).toBeUndefined();
    const run = findRule("光を走らせる規則", (r) => r.selector.includes(".ui-press-main") && r.selector.endsWith("::after") && prop(r, "animation") !== undefined);
    expect(run.selector).toMatch(/:hover|:focus-visible/);
    expect(run.selector).toMatch(/:not\([^)]*:disabled/);
    const animation = prop(run, "animation") as string;
    expect(animation).not.toMatch(/infinite/);
    const ms = /(\d+)ms/.exec(animation);
    expect(ms, "長さは ms で書く").not.toBeNull();
    expect(Number(ms![1])).toBeLessThanOrEqual(800);
    const name = animation.split(/\s+/)[0];
    expect(css).toContain(`@keyframes ${name}`);
  });

  it("動きを減らす設定（prefers-reduced-motion: reduce）では、光と動きを止める", () => {
    const reduce = flatRulesIn((at) => at.includes("prefers-reduced-motion: reduce"));
    expect(
      reduce.some((r) => r.selector.includes(".ui-press-main::after") && /animation\s*:\s*none/.test(r.body) && /content\s*:\s*none/.test(r.body)),
      "光を止める",
    ).toBe(true);
    expect(reduce.some((r) => r.selector.includes(".ui-press") && /transition\s*:\s*none/.test(r.body)), "移り変わりを止める").toBe(true);
    expect(reduce.some((r) => r.selector.includes(".ui-press:active") && /transform\s*:\s*none/.test(r.body)), "押したときの沈みを止める").toBe(true);
  });

  it("印刷では平らな面に戻す", () => {
    expectFlat("印刷", flatRulesIn((at) => /^@media print\b/.test(at)));
  });

  it("コントラストを強くする設定（prefers-contrast: more）では平らな面に戻す", () => {
    expectFlat("prefers-contrast: more", flatRulesIn((at) => at === "@media (prefers-contrast: more)"));
  });

  it("使えない状態（:disabled・[aria-disabled=\"true\"]）は平らな面で、光も出さない", () => {
    const disabled = (r: Rule) => r.selector.includes(":disabled") && r.selector.includes('[aria-disabled="true"]') && !r.selector.includes(":not(");
    const press = findRule("押すものの使えない状態", (r) => disabled(r) && r.selector.includes(".ui-press") && !r.selector.includes("::after"));
    expect(prop(press, "background-image")).toBe("none");
    expect(prop(press, "box-shadow")).toBe("none");
    const glint = findRule("使えない状態の光", (r) => disabled(r) && r.selector.includes(".ui-press") && r.selector.endsWith("::after"));
    expect(prop(glint, "content")).toBe("none");
    const pick = findRule("選ぶものの使えない状態", (r) => disabled(r) && r.selector.includes(".ui-pick"));
    expect(prop(pick, "background-image")).toBe("none");
    expect(prop(pick, "box-shadow")).toBe("none");
    // 同じ強さの「押してある」の勾配より後ろに置く（後ろが勝つ）
    const pressedMain = findRule("主の操作（押してある）", (r) => r.selector.includes('.ui-press-main[aria-pressed="true"]'));
    expect(press.order).toBeGreaterThan(pressedMain.order);
    // 選んだ状態の勾配は、使えないものを :not() で除く
    const selected = findRule("選んだ状態", TEXT_ON_FILLS[4].match);
    expect(selected.selector).toMatch(/:not\([^)]*:disabled/);
    expect(selected.selector).toMatch(/:not\([^)]*\[aria-disabled="true"\]/);
  });

  it("指で押す端末（pointer: coarse）では、部品クラスの押せるものを 44px 以上にする", () => {
    const coarse = flatRulesIn((at) => at === "@media (pointer: coarse)").filter((r) => /min-height\s*:\s*44px/.test(r.body));
    const selectors = coarse.map((r) => r.selector).join(", ");
    for (const target of [".ui-press", ".ui-pick", "button.ui-reveal", "details.ui-reveal > summary"]) {
      expect(selectors, target).toContain(target);
    }
  });
});

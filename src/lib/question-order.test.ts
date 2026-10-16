import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inScreenOrder, SCREEN_SECTIONS, sectionLabel } from "./question-order";
import { orderedQuestionSections } from "@/components/question-sections";
import { SECTION_LABEL } from "@/lib/view";

const q = (id: string, section: string, displayOrder: number) => ({ id, section, displayOrder });

describe("設問を回答画面の上から下の順に並べる", () => {
  const saved = [q("free1", "free", 1), q("kpi2", "kpi", 2), q("odd", "unknown", 0), q("kpi1", "kpi", 1), q("sup", "support", 9)];

  it("節は制度の区分順（自由記入は最後）、節の中は保存した順。知らない節は落とさず最後に置く", () => {
    expect(inScreenOrder(saved).map((x) => x.id)).toEqual(["sup", "kpi1", "kpi2", "free1", "odd"]);
  });

  it("元の配列は並べ替えない", () => {
    const before = saved.map((x) => x.id);
    inScreenOrder(saved);
    expect(saved.map((x) => x.id)).toEqual(before);
  });

  it("画面に描く節ごとのまとまりを順につなぐと、同じ並びになる（知らない節は画面に描かない）", () => {
    const drawn = orderedQuestionSections(saved).flatMap((g) => g.rows.map((x) => x.id));
    expect(drawn).toEqual(inScreenOrder(saved).map((x) => x.id).filter((id) => id !== "odd"));
  });
});

describe("画面に描く節の順は SCREEN_SECTIONS の1か所で決める", () => {
  it("SECTION_ORDER を参照するのは、定義の view.ts と、節の順を作る question-order.ts だけ", () => {
    // 回答の読み返しや組み立て画面が SECTION_ORDER から自前で節の順を作ると（継ぎ足し・indexOf・map のどれでも）、
    // 節を足したときに画面ごとに順がずれる。書き方を問わず、参照そのものを数える。コメントの中の言及は数えない
    const root = path.join(process.cwd(), "src");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
      (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
    );
    const code = (f: string) =>
      readFileSync(path.join(root, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    const users = files.filter((f) => /\bSECTION_ORDER\b/.test(code(f))).sort();
    expect(users).toEqual([path.join("lib", "question-order.ts"), path.join("lib", "view.ts")]);
  });

  it("設問の保存の受け口は、受け付ける節を SCREEN_SECTIONS から作る（手で写さない）", () => {
    // 写しだと、節を足したときに画面には出るのに保存だけ断る（またはその逆）
    const actions = readFileSync(path.join(process.cwd(), "src", "actions", "forms.ts"), "utf8");
    expect(actions).toContain("section: z.enum(SCREEN_SECTIONS),");
    expect(actions).not.toMatch(/z\.enum\(\[\s*"support"/);
    // 受け付ける値と並びは、手で写していたころの組と同じ（並びは断るときの文に出る）
    expect(SCREEN_SECTIONS).toEqual(["support", "operation", "training", "test", "behavior", "kpi", "free"]);
  });
});

describe("節の見出しの名前は sectionLabel の1か所で決める", () => {
  it("制度の区分は SECTION_LABEL の名前、自由記入（free）は「自由記入」、知らない節は値のまま", () => {
    for (const [section, label] of Object.entries(SECTION_LABEL)) expect(sectionLabel(section)).toBe(label);
    expect(sectionLabel("free")).toBe("自由記入");
    expect(sectionLabel("その他")).toBe("その他");
  });

  it("画面に描く節は、どれも英字の値のまま出ない（組み立て画面の選び欄も同じ名前を使う）", () => {
    for (const section of SCREEN_SECTIONS) expect(sectionLabel(section), section).not.toMatch(/[A-Za-z]/);
  });

  it("SECTION_LABEL を参照するのは、定義の view.ts と、見出しの名前を作る question-order.ts だけ", () => {
    // 画面ごとに `SECTION_LABEL[x] ?? …` を書くと、自由記入の扱いが画面でずれる（組み立て画面だけ "free" と出ていた）
    const root = path.join(process.cwd(), "src");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
      (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
    );
    const code = (f: string) =>
      readFileSync(path.join(root, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    const users = files.filter((f) => /\bSECTION_LABEL\b/.test(code(f))).sort();
    expect(users).toEqual([path.join("lib", "question-order.ts"), path.join("lib", "view.ts")]);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// 回答画面は保存の Server Action を読み込む。描くだけの試験なので、保存先は空にしておく
vi.mock("@/actions/responses", () => ({ saveResponse: vi.fn() }));

import { QuestionField, type AnswerQuestion, type AnswerValue } from "@/components/FormAnswer";
import { isAnswered, isOptionSelected, optionAnswer, optionScore } from "@/lib/domain/answer-snapshot";

/*
 * 選択肢（S12・A11）。
 *
 * 「押しても選べない」の原因は3つ重なっていた。
 *  1. 組み立て画面で選択肢を消してから足すと、値が `String(件数+1)` で作られ既存の値と重なる。
 *     値が重なった選択肢は一緒に光り、押した方が選ばれたように見えない。
 *  2. 複数選択の答えは画面では valueChoices に入るが、「答えた」の判定は valueJson しか見ず、
 *     押しても回答数が増えない（必須なら提出もできない）。
 *  3. 値が数字でない選択肢は Number(value) が NaN になり、選択中にならない。
 * 加えて、設問名の <label for> が選択肢の束（div）を指しており、名前が支援技術に届かない。
 */

const BASE: AnswerQuestion = {
  id: "q1",
  section: "kpi",
  questionType: "single",
  title: "今期の取り組み",
  helpText: null,
  unit: null,
  required: true,
  validationMin: null,
  validationMax: null,
  validationInteger: false,
  optionsJson: null,
  displayOrder: 1,
};

function render(q: Partial<AnswerQuestion>, value?: Partial<AnswerValue>): string {
  return renderToStaticMarkup(
    createElement(QuestionField, {
      q: { ...BASE, ...q },
      value: value ? { questionId: "q1", valueNumber: null, valueText: null, valueChoices: null, ...value } : undefined,
      onChange: () => {},
      onEnter: () => {},
    }),
  );
}

/** label の for が、ラベルを付けられる要素（input・textarea・select）を指しているか */
function labelTargetsAreLabelable(html: string): void {
  for (const m of html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) {
    expect(html, `label for="${m[1]}" が入力欄を指していない`).toMatch(
      new RegExp(`<(input|textarea|select)[^>]*\\sid="${m[1]}"`),
    );
  }
}

/** 選択肢の束（role="group" か "radiogroup"）に、設問名で名前が付いているか */
function groupIsNamedByTitle(html: string, title: string): void {
  const tag = html.match(/<[a-z]+[^>]*role="(?:group|radiogroup)"[^>]*>/)?.[0];
  expect(tag, "選択肢の束に role が無い").toBeDefined();
  const labelledBy = tag!.match(/aria-labelledby="([^"]+)"/)?.[1];
  expect(labelledBy, "選択肢の束に aria-labelledby が無い").toBeDefined();
  expect(html).toMatch(new RegExp(`id="${labelledBy}"[^>]*>${title}`));
}

const OPTIONS = JSON.stringify([
  { value: "1", label: "まだ" },
  { value: "2", label: "半分" },
  { value: "3", label: "できた" },
]);

describe("選択肢の束の名前", () => {
  it.each(["number", "text"])("%sは古い選択肢が残っても入力欄と設問ラベルを優先する", (questionType) => {
    const html = render({ questionType, optionsJson: OPTIONS });
    expect(html).toMatch(/<label[^>]*\sfor="f_q1"/);
    labelTargetsAreLabelable(html);
    expect(html).not.toMatch(/aria-pressed=/);
  });
  it.each([
    ["yesno", null],
    ["single", OPTIONS],
    ["multi", OPTIONS],
    ["scale", null],
  ])("%s: 設問名の label を選択肢の束へ向けず、束に設問名で名前を付ける", (questionType, optionsJson) => {
    const html = render({ questionType, optionsJson, validationMin: 1, validationMax: 3 });
    labelTargetsAreLabelable(html);
    groupIsNamedByTitle(html, BASE.title);
  });

  it("文章・数値の設問は、これまでどおり設問名の label が入力欄を指す", () => {
    for (const questionType of ["text", "number"]) {
      const html = render({ questionType });
      expect(html).toMatch(/<label[^>]*\sfor="f_q1"/);
      labelTargetsAreLabelable(html);
    }
  });
});

describe("「最初の未入力の欄へ移る」の飛び先", () => {
  // 回答画面のボタンは f_<設問id> の要素へ focus する。飛び先が無いと、押しても何も起きない
  it.each([
    ["yesno", null],
    ["single", OPTIONS],
    ["multi", OPTIONS],
    ["scale", null],
    ["text", null],
    ["number", null],
    // 選択肢が登録されていない設問は答えられない。案内の文へ移り、なぜ提出できないかを見せる
    ["single", null],
    ["multi", null],
  ])("%s（選択肢 %s）: f_ の id を持ち、focus できる要素がある", (questionType, optionsJson) => {
    const html = render({ questionType, optionsJson, validationMin: 1, validationMax: 3 });
    const tag = html.match(/<([a-z]+)[^>]*\sid="f_q1"[^>]*>/);
    expect(tag, "f_q1 の要素が無い").not.toBeNull();
    expect(["input", "textarea", "select"].includes(tag![1]) || /tabindex="-1"/.test(tag![0])).toBe(true);
  });
});

describe("行のどこを押しても選べる", () => {
  it("1つ選ぶ: 選択肢の文は全部ボタンの中にあり、選択中を aria-pressed で示す", () => {
    const html = render({ optionsJson: OPTIONS }, { valueNumber: 2, valueText: "半分" });
    const buttons = [...html.matchAll(/<button type="button"[^>]*aria-pressed="(true|false)"[^>]*>(.*?)<\/button>/g)];
    expect(buttons.map((b) => b[2].replace(/<[^>]+>/g, ""))).toEqual(["まだ", "半分", "できた"]);
    expect(buttons.filter((b) => b[1] === "true").map((b) => b[2].replace(/<[^>]+>/g, ""))).toEqual(["半分"]);
  });

  it("いくつでも選ぶ: 選択肢の文はチェックボックスを包む label の中にある", () => {
    const html = render({ questionType: "multi", optionsJson: OPTIONS }, { valueChoices: ["3"] });
    const labels = [...html.matchAll(/<label[^>]*>\s*<input type="checkbox"([^>]*)\/?>(.*?)<\/label>/g)];
    expect(labels.map((l) => l[2])).toEqual(["まだ", "半分", "できた"]);
    expect(labels.filter((l) => /checked/.test(l[1])).map((l) => l[2])).toEqual(["できた"]);
  });
});

describe("値が重なった・数字でない選択肢", () => {
  it("値が重なった古いデータでも、選んだ1つだけが選択中になる", () => {
    const dup = JSON.stringify([
      { value: "1", label: "まだ" },
      { value: "3", label: "半分" },
      { value: "3", label: "できた" },
    ]);
    const html = render({ optionsJson: dup }, { valueNumber: 3, valueText: "できた" });
    const pressed = [...html.matchAll(/aria-pressed="true"[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
    expect(pressed).toEqual(["できた"]);
  });

  it("値が数字でない選択肢も選べ、回答として数えられる", () => {
    const opt = { value: "b", label: "乙" };
    expect(optionScore(opt)).toBeNull();
    const patch = optionAnswer(opt);
    expect(patch).toEqual({ valueNumber: null, valueText: "乙", valueChoices: ["b"] });
    expect(isAnswered("single", patch)).toBe(true);
    expect(isOptionSelected(opt, patch)).toBe(true);
    expect(isOptionSelected({ value: "a", label: "甲" }, patch)).toBe(false);
    const html = render({ optionsJson: JSON.stringify([{ value: "a", label: "甲" }, opt]) }, patch);
    expect(html).toMatch(/aria-pressed="true"[^>]*>(<[^>]+>)*乙/);
  });

  it("点数は score を優先し、無ければ数字の値を使う", () => {
    expect(optionScore({ value: "2", label: "x", score: 5 })).toBe(5);
    expect(optionScore({ value: "2", label: "x" })).toBe(2);
    expect(optionScore({ value: " ", label: "x" })).toBeNull();
    // 編集用の答えには配点を写さず、公開値と明示選択だけを持つ
    expect(optionAnswer({ value: "2", label: "x", score: 5 })).toEqual({ valueNumber: 2, valueText: "x", valueChoices: ["2"] });
  });
});

describe("回答として数える", () => {
  it("複数選択は画面の形（valueChoices）で選んだ数を数える", () => {
    expect(isAnswered("multi", { valueNumber: null, valueText: "できた", valueChoices: ["3"] })).toBe(true);
    expect(isAnswered("multi", { valueNumber: null, valueText: null, valueChoices: [] })).toBe(false);
    // 保存済みの形（valueJson）もこれまでどおり数える
    expect(isAnswered("multi", { valueNumber: null, valueText: null, valueJson: '["3"]' })).toBe(true);
  });
});

describe("読み取り専用の札は押せる見た目にしない", () => {
  const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

  it(".chip の基本の決まりに cursor: pointer を置かず、押せる札（button・a）にだけ置く", () => {
    const base = css.match(/\n\.chip\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(base).not.toMatch(/cursor:\s*pointer/);
    expect(css).toMatch(/\.chip:is\(button, a\)\s*\{[^}]*cursor:\s*pointer/);
  });
});

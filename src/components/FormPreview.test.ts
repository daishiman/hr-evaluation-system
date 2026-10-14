import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormPreview, type PreviewQuestion } from "./FormPreview";

const base: PreviewQuestion = {
  id: "q-base",
  section: "kpi",
  questionType: "number",
  title: "基準の設問",
  helpText: null,
  unit: null,
  required: true,
  validationMin: null,
  validationMax: null,
  optionsJson: null,
  displayOrder: 1,
};

function render(questions: PreviewQuestion[], reason?: string): string {
  return renderToStaticMarkup(createElement(FormPreview, { questions, reason }));
}

describe("FormPreview", () => {
  it("設問が0件なら空のプレビューであることを明示する", () => {
    expect(render([])).toContain("保存済みの設問はありません。");
  });

  it("全回答形式の答え方・選択肢・単位・範囲・必須/任意・補足を表示する", () => {
    const html = render([
      {
        ...base,
        id: "yesno",
        section: "support",
        questionType: "yesno",
        title: "支援を行いましたか",
        helpText: "この半期について答えてください。",
        optionsJson: JSON.stringify([
          { value: "1", label: "はい（行った）", score: 1 },
          { value: "0", label: "いいえ（まだ行っていない）", score: 0 },
        ]),
      },
      {
        ...base,
        id: "single",
        questionType: "single",
        title: "もっとも近い行動",
        optionsJson: JSON.stringify([
          { value: "a", label: "自分から行った" },
          { value: "b", label: "助言を受けて行った" },
        ]),
      },
      {
        ...base,
        id: "multi",
        questionType: "multi",
        title: "受講した研修",
        optionsJson: JSON.stringify([
          { value: "a", label: "研修A" },
          { value: "b", label: "研修B" },
        ]),
      },
      {
        ...base,
        id: "number",
        questionType: "number",
        title: "対応件数",
        unit: "件",
        validationMin: 0,
        validationMax: 100,
      },
      { ...base, id: "text", section: "free", questionType: "text", title: "補足事項", required: false },
      {
        ...base,
        id: "scale",
        questionType: "scale",
        title: "自己評価",
        validationMin: 2,
        validationMax: 4,
      },
    ]);

    expect(html).toContain("はい（行った）");
    expect(html).toContain("いいえ（まだ行っていない）");
    expect(html).toContain("自分から行った");
    expect(html).toContain("助言を受けて行った");
    expect(html).toContain("研修A");
    expect(html).toContain("研修B");
    expect(html).toContain("当てはまるものをいくつでも選びます");
    expect(html).toContain("単位：件");
    expect(html).toContain("0以上100以下");
    expect(html).toContain("文章で記入します");
    expect(html).toContain("（必須）");
    expect(html).toContain("（任意）");
    expect(html).toContain("この半期について答えてください。");
    // 段階は回答画面と同じ押せる札（ChoiceChip）で出す（S12: 以前は押せない札で、押しても何も起きなかった）
    expect(html).toMatch(/>2<\/button>/);
    expect(html).toMatch(/>3<\/button>/);
    expect(html).toMatch(/>4<\/button>/);
  });

  it("空・壊れた選択肢を安全に扱い、yesnoだけは回答画面と同じ既定値を出す", () => {
    const html = render([
      { ...base, id: "yesno-empty", questionType: "yesno", title: "確認しましたか" },
      { ...base, id: "single-empty", questionType: "single", title: "単一選択", optionsJson: "{壊れ" },
      { ...base, id: "multi-empty", questionType: "multi", title: "複数選択", optionsJson: "[]" },
    ]);

    expect(html).toContain(">はい<");
    expect(html).toContain(">いいえ<");
    expect(html.match(/選択肢が登録されていません。/g)).toHaveLength(2);
  });

  it("セクション順とセクション内のdisplayOrder順で並べる", () => {
    const html = render([
      { ...base, id: "kpi", section: "kpi", title: "最後の設問", displayOrder: 1 },
      { ...base, id: "support-2", section: "support", title: "支援の2問目", displayOrder: 2 },
      { ...base, id: "support-1", section: "support", title: "支援の1問目", displayOrder: 1 },
    ]);

    expect(html.indexOf("支援の1問目")).toBeLessThan(html.indexOf("支援の2問目"));
    expect(html.indexOf("支援の2問目")).toBeLessThan(html.indexOf("最後の設問"));
  });

  it("選択肢は試しに選べるが、回答や自動保存につながる操作要素は描画しない", () => {
    const html = render([
      { ...base, id: "yesno", questionType: "yesno", optionsJson: null },
      {
        ...base,
        id: "multi",
        questionType: "multi",
        optionsJson: JSON.stringify([{ value: "a", label: "研修A" }]),
      },
      { ...base, id: "text", questionType: "text" },
      { ...base, id: "number", questionType: "number", unit: "件" },
    ]);

    // 送る・保存する操作と、文字・数を打つ欄は作らない
    expect(html).not.toMatch(/<(?:form|select|textarea)\b/i);
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("/api/responses/");
    expect(html).not.toContain("昇格の必須要件");
    // 押せるのは選ぶ札だけ（どれも選択中かどうかを aria-pressed で持つ）
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b).toMatch(/aria-pressed="(?:true|false)"/);
    // 入力欄はいくつでも選ぶ設問のチェックボックスだけ
    const inputs = html.match(/<input\b[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain('type="checkbox"');
  });

  it("見本であること・選んだ内容が保存されないこと・回答できない理由を先頭に出す", () => {
    const html = render([{ ...base, id: "yesno", questionType: "yesno", title: "確認しましたか" }]);

    expect(html).toContain("見本です。");
    expect(html).toContain("保存も提出もされません。");
    expect(html).toContain("ここからは回答できません。");
    expect(html.indexOf("見本です。")).toBeLessThan(html.indexOf("確認しましたか"));
  });

  it("回答できない理由は呼び出し側から渡せる", () => {
    const html = render(
      [{ ...base, id: "yesno", questionType: "yesno" }],
      "このアンケートは別の等級向けのため、あなたは回答できません。",
    );

    expect(html).toContain("このアンケートは別の等級向けのため、あなたは回答できません。");
    expect(html).not.toContain("ここからは回答できません。");
  });

  it("設問が0件なら見本の説明は出さない", () => {
    expect(render([])).not.toContain("見本です。");
  });

  it("選択肢の束に設問名で名前を付ける（label for で束を指さない）", () => {
    const html = render([
      {
        ...base,
        id: "single",
        questionType: "single",
        title: "もっとも近い行動",
        optionsJson: JSON.stringify([
          { value: "a", label: "自分から行った" },
          { value: "b", label: "助言を受けて行った" },
        ]),
      },
    ]);

    expect(html).toContain('id="preview_t_single"');
    expect(html).toMatch(/role="group"[^>]*aria-labelledby="preview_t_single"/);
    expect(html).not.toMatch(/<label\b[^>]*\bfor=/);
  });
});

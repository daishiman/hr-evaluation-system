import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormPreview, type PreviewQuestion } from "./FormPreview";
import { RespondentGuide } from "./RespondentGuide";
import { toAnswerQuestions } from "./answer-questions";
import { PREVIEW_MARK_NOTE, PREVIEW_NO_SAVE_NOTE } from "./form-preview-notes";
import { answerBlockLabel, type AnswerBlock } from "@/lib/domain/form-entry";
import { SECTION_HELP } from "@/lib/view";

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

function render(questions: PreviewQuestion[], reason?: string, blockedLabel?: string): string {
  return renderToStaticMarkup(createElement(FormPreview, { questions, reason, blockedLabel }));
}

/** 画面に見える文字だけにする。タグの境目は改行にする（scripts/scan-rendered-text.mjs と同じ読み方） */
function linesOf(html: string): string[] {
  return html
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** タグを外して1本の文にする（札と引用のように、要素をまたいで続けて読む文を確かめる） */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, "");
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
    // 見本には打つ欄が無いので、回答画面でどんな欄が出るかを言う（「入力します」と言わない）
    expect(html).toContain("回答画面では数値を入れる欄が出ます（単位：件）。0以上100以下の数を入れます。");
    expect(html).toContain("回答画面では文章を書く欄が出ます。");
    expect(html).not.toContain("数値で入力します");
    expect(html).not.toContain("文章で記入します");
    // 印は回答画面と同じく「（任意）」だけ。必須の設問には印を付けない
    expect(html).not.toContain("（必須）");
    expect(html.match(/（任意）/g)).toHaveLength(1);
    expect(html).toMatch(/id="preview_t_text"[^>]*>補足事項<span class="footnote"> （任意）<\/span><\/p>/);
    expect(html).toMatch(/id="preview_t_number"[^>]*>対応件数<\/p>/);
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
    expect(render([])).not.toContain("見本のため送信できません");
  });

  it("数値の答え方は、単位の有無と範囲・整数の決まりに応じて文を組み立てる", () => {
    const html = render([
      { ...base, id: "n1", title: "件数", unit: "件", validationMin: 0 },
      { ...base, id: "n2", title: "割合", validationMax: 100 },
      { ...base, id: "n3", title: "回数", validationInteger: true },
      { ...base, id: "n4", title: "金額" },
    ]);

    expect(html).toContain("回答画面では数値を入れる欄が出ます（単位：件）。0以上の数を入れます。");
    expect(html).toContain("回答画面では数値を入れる欄が出ます。100以下の数を入れます。");
    expect(html).toContain("回答画面では数値を入れる欄が出ます。整数だけを入れます。");
    expect(html).toMatch(/>回答画面では数値を入れる欄が出ます。<\/p>/);
  });

  it("送信できない理由を、節ごとに見出しの直下へ流れの中で出す", () => {
    const html = render(
      [
        { ...base, id: "s1", section: "support", questionType: "yesno", title: "支援の設問" },
        { ...base, id: "k1", section: "kpi", title: "実績の設問" },
        { ...base, id: "f1", section: "free", questionType: "text", title: "自由の設問", required: false },
      ],
      undefined,
      "回答期限を過ぎたため",
    );

    // 先頭の注記は残したうえで、下の節まで送っても理由が見えるよう節ごとに繰り返す
    expect(html).toContain("見本です。");
    const sections = html.split("<section").slice(1);
    expect(sections).toHaveLength(3);
    for (const [i, title] of ["支援の設問", "実績の設問", "自由の設問"].entries()) {
      const s = sections[i];
      expect(s.match(/見本のため送信できません（回答期限を過ぎたため）/g)).toHaveLength(1);
      // 見出しの後・設問の前
      expect(s.indexOf("</h2>")).toBeLessThan(s.indexOf("見本のため送信できません"));
      expect(s.indexOf("見本のため送信できません")).toBeLessThan(s.indexOf(title));
    }
    // 画面に貼り付けない（流れの中に置く）
    expect(html).not.toMatch(/sticky|data-narrow/);
  });

  it("理由を渡さない画面（管理画面の見本）では、確認専用の見本であることを理由にする", () => {
    const html = render([{ ...base, id: "k1", title: "実績の設問" }]);
    expect(html).toContain("見本のため送信できません（確認専用の見本のため）");
  });

  it("回答できない理由の短い文は、どれを渡しても1文40文字以内に収まる", () => {
    const blocks: AnswerBlock[] = [
      { kind: "can-answer" },
      { kind: "draft" },
      { kind: "no-grade" },
      { kind: "other-grade" },
      { kind: "deadline", state: "closed_by_admin" },
      { kind: "deadline", state: "past_deadline" },
      { kind: "deadline", state: "before_open" },
      { kind: "deadline", state: "cycle_not_open" },
      { kind: "deadline", state: "open" },
    ];
    for (const block of blocks) {
      const label = answerBlockLabel(block);
      const line = linesOf(render([{ ...base, id: "k1" }], undefined, label)).find((l) => l.startsWith("見本のため送信できません"));
      expect(line).toBe(`見本のため送信できません（${label}）`);
      expect([...(line ?? "")].length).toBeLessThanOrEqual(40);
    }
  });

  it("節の説明は、回答者への案内として引用の形で出す（文は回答画面と同じ1つ）", () => {
    const html = render([
      { ...base, id: "s1", section: "support", questionType: "yesno", title: "支援の設問" },
      { ...base, id: "b1", section: "behavior", questionType: "scale", title: "行動の設問", validationMin: 1, validationMax: 3 },
      { ...base, id: "k1", section: "kpi", title: "実績の設問" },
      { ...base, id: "f1", section: "free", questionType: "text", title: "自由の設問" },
    ]);
    const text = textOf(html);

    for (const section of ["support", "behavior", "kpi"]) {
      expect(text).toContain(`回答者への案内：「${SECTION_HELP[section]}」`);
    }
    // 引用の外に、見ている人への指示として説明が裸で出ていない
    expect(text.split(SECTION_HELP.kpi)).toHaveLength(2);
    // 説明の無い節（自由記入）には札だけを出さない
    expect(text.match(/回答者への案内/g)).toHaveLength(3);
    // 実績の節の案内は、必須の決まりと食い違う「空のまま」を言わない
    expect(SECTION_HELP.kpi).not.toContain("空のまま");
    // 入れられる数は設問ごとに違う（「1以上の整数」の設問もある）。節の案内では特定の数を指示せず、欄ごとの説明に任せる
    expect(SECTION_HELP.kpi).not.toMatch(/\d\s*[をと]\s*(入れ|入力)/);
    expect(text).toContain("入れられる数は、欄ごとの説明に従ってください。");
  });

  it("アンケートの説明文も、見本を出す画面では節の説明と同じ引用の形で出す", () => {
    // 説明文（「半期の実績を入力してください。」など）も回答者への指示。見本の画面で裸で出すと、見ている人への指示と読める
    const quoted = textOf(renderToStaticMarkup(createElement(RespondentGuide, null, "半期の実績を入力してください。")));
    expect(quoted).toBe("回答者への案内：「半期の実績を入力してください。」");
    const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
    for (const file of ["src/app/forms/[id]/page.tsx", "src/app/admin/forms/[id]/page.tsx"]) {
      expect(read(file)).toContain("<RespondentGuide>{form.description}</RespondentGuide>");
    }
    // 見本の画面では、引用の外に説明文を裸で出さない（管理画面の「タイトルと説明」は設定値の確認なので対象外）。
    // 書き方（改行や空白）を問わず、説明文を出す箇所の数と、引用で包んだ箇所の数が同じかで見る
    const preview = read("src/app/forms/[id]/page.tsx");
    const shown = preview.match(/\{\s*form\.description\s*\}/g) ?? [];
    const guided = preview.match(/<RespondentGuide>\s*\{\s*form\.description\s*\}\s*<\/RespondentGuide>/g) ?? [];
    expect(guided.length).toBeGreaterThan(0);
    expect(shown.length).toBe(guided.length);
    // 節の説明も同じ部品で引用する（引用の形を2か所で持たない）
    expect(read("src/components/FormPreview.tsx")).toContain("<RespondentGuide>{guide}</RespondentGuide>");
    // 回答画面の読み手は回答者本人なので引用にしない。ただし改行は見本と同じく残す
    const answer = read("src/app/me/forms/[id]/page.tsx");
    expect(answer).not.toContain("RespondentGuide");
    expect(answer).toMatch(/<p className="[^"]*\bwhitespace-pre-wrap\b[^"]*">\{form\.description\}<\/p>/);
  });

  it("/forms/[id] は回答できない理由を上の注記で言うので、見本の先頭の注記で言い直さない", () => {
    // 既定の理由（「ここからは回答できません。」）に任せると、上の注記と同じ理由が2つ並ぶ
    const page = readFileSync(path.join(process.cwd(), "src/app/forms/[id]/page.tsx"), "utf8");
    // reason= があるだけでは足りない。右側の式で、回答できないときに空の文を渡しているかまで見る
    // （undefined を渡すと既定の理由が出て、上の注記と同じ理由がまた2つ並ぶ。回答できる人に出す文は次の試験で見る）
    const reasonExpr = page.match(/<FormPreview\b[^>]*?\breason=\{([^}]*)\}/)?.[1] ?? "";
    expect(reasonExpr).toContain('"can-answer"');
    expect(reasonExpr).toMatch(/:\s*""\s*$/);
    const blocked = render([{ ...base, id: "k1" }], "");
    expect(textOf(blocked)).toContain("見本です。選択肢は試しに選べますが、選んだ内容は保存も提出もされません。");
    expect(textOf(blocked)).not.toContain("回答できません");
  });

  it("/forms/[id] で回答できる人には、見本の先頭の注記で上の回答ボタンへ案内する（別の入口を三人称で言わない）", () => {
    // 既定の理由は管理画面向けで「対象の等級の方が『実績を報告する』から…」と言う。回答できる本人に出すと、
    // 上のボタン・節ごとの「回答は『このアンケートに回答する』から」と入口の名前が食い違う
    const page = readFileSync(path.join(process.cwd(), "src/app/forms/[id]/page.tsx"), "utf8");
    expect(page).toMatch(/>\s*このアンケートに回答する\s*<\/LinkButton>/);
    const reasonExpr = page.match(/<FormPreview\b[^>]*?\breason=\{([^}]*)\}/)?.[1] ?? "";
    expect(reasonExpr).not.toContain("undefined");
    const name = reasonExpr.match(/\?\s*([A-Z_]+)\s*:/)?.[1] ?? "";
    const value = page.match(new RegExp(`const ${name || "\\0"} =\\s*"([^"]+)"`))?.[1] ?? "";
    const text = textOf(render([{ ...base, id: "k1" }], value));
    expect(text).toContain("回答は上の「このアンケートに回答する」から");
    expect(text).not.toContain("対象の等級の方");
    expect(text).not.toContain("「実績を報告する」");
  });

  it("札は引用の文と分けて置き、引用の中の1文も40文字以内に収まる", () => {
    // 札を文に混ぜると、いちばん長い節の説明（行動指針）で1文が40文字を超える
    const sections = Object.keys(SECTION_HELP);
    const html = render(sections.map((section, i) => ({ ...base, id: `q${i}`, section, title: `設問${i}` })));
    const long = linesOf(html)
      .flatMap((l) => l.split("。"))
      .map((s) => s.trim())
      .filter((s) => [...s].length > 40);
    expect(long).toEqual([]);
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

describe("見本の画面からの試しの回答（?try=1）", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const page = read("src/app/forms/[id]/page.tsx");
  const start = page.indexOf('if (sp.try === "1" && canTry)');
  // 試しの回答の分岐（通常の見本の return の手前まで）
  const trialBranch = start < 0 ? "" : page.slice(start, page.indexOf("\n  return (", start));

  it("設定できる人だけが、回答者と同じ入力欄（FormAnswer の trial）を開ける", () => {
    // 見本（FormPreview）には入力欄も送信ボタンも無い。数を入れて提出の検査まで試す画面は別に要る
    expect(page).toContain("const canTry = canEditForm(viewer.role);");
    expect(start).toBeGreaterThan(0);
    expect(trialBranch).toContain("<FormAnswer");
    // 保存しない部品として出す（下書きも提出も送らない）。何も入っていない状態から始める
    expect(trialBranch).toMatch(/<FormAnswer\b[^>]*\btrial\s*\/>/);
    expect(trialBranch).toMatch(/<FormAnswer\b[^>]*\binitial=\{\[\]\}/);
    expect(trialBranch).toContain("見本に戻る");
    // 通常の見本は入力欄の無いまま（回答者でない人の操作で、回答や下書きを作らない）
    expect(page.replace(trialBranch, "")).not.toContain("<FormAnswer");
  });

  it("試しの回答と本物の回答画面は、設問を同じ1つの関数で渡す（片方だけ項目が欠けない）", () => {
    expect(trialBranch).toContain("questions={toAnswerQuestions(questions)}");
    expect(read("src/app/me/forms/[id]/page.tsx")).toContain("questions={toAnswerQuestions(questions)}");
    // 回答画面に要る項目だけを渡す（配点や昇格の要件は、行に入っていても渡さない）
    const row = { id: "q1", section: "kpi", questionType: "number", title: "件数", helpText: null, unit: "件",
      required: true, validationMin: 0, validationMax: null, validationInteger: true, optionsJson: null,
      displayOrder: 1, isGate: true, weight: 3 };
    const [passed] = toAnswerQuestions([row]);
    expect(Object.keys(passed).sort()).toEqual(["displayOrder", "helpText", "id", "optionsJson", "questionType",
      "required", "section", "title", "unit", "validationInteger", "validationMax", "validationMin"].sort());
    expect(passed).toMatchObject({ validationInteger: true, validationMin: 0, unit: "件" });
  });

  it("見本の上の操作と、管理画面の「回答者に見える内容」から、設定できる人だけに入口を出す", () => {
    expect(page).toContain("{canTry && <LinkButton href={`/forms/${form.id}?try=1`}>試しに回答する</LinkButton>}");
    const admin = read("src/app/admin/forms/[id]/page.tsx");
    const link = admin.indexOf("href={`/forms/${form.id}?try=1`}");
    expect(link).toBeGreaterThan(0);
    // 入口は設定できる人の条件の中に置く
    const gate = admin.lastIndexOf("{canEditForm(viewer.role) && (", link);
    expect(gate).toBeGreaterThan(0);
    expect(admin.slice(gate, link)).not.toContain(")}");
  });
});

describe("見本の見方の文（2つの画面で同じ文）", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const pages = ["src/app/forms/[id]/page.tsx", "src/app/admin/forms/[id]/page.tsx"];

  it("印の読み方と保存されないことは、両方の画面が form-preview-notes の同じ文を出す（画面ごとに書き写さない）", () => {
    // 写しだと、片方だけ直したときに同じ見本の説明が画面ごとに食い違う
    for (const file of pages) {
      const page = read(file);
      expect(page, file).toContain('from "@/components/form-preview-notes"');
      expect(page, file).toContain("{PREVIEW_MARK_NOTE}");
      expect(page, file).toContain("{PREVIEW_NO_SAVE_NOTE}");
      expect(page, file).not.toContain(PREVIEW_MARK_NOTE);
      expect(page, file).not.toContain(PREVIEW_NO_SAVE_NOTE);
    }
  });

  it("文の中身は、見本が出す印と保存しない作りに合う", () => {
    // 見本の印は「（任意）」だけ（必須の設問には印を付けない）
    expect(PREVIEW_MARK_NOTE).toBe("印の無い設問は必須、「（任意）」の設問は空欄でも提出できます。");
    expect(PREVIEW_NO_SAVE_NOTE).toBe(
      "文字や数値を打つ欄はなく、選択肢を試しに選んでも保存されません。開いても回答や下書きは作られません。",
    );
  });
});

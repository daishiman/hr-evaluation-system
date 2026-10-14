"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Card, ReasonNote, SectionHeading, SplitRow } from "@/components/ui";
import { QuestionInput, type AnswerValue } from "@/components/QuestionField";
import { SECTION_HELP, SECTION_LABEL } from "@/lib/view";
import { orderedQuestionSections } from "@/components/question-sections";
import { parseOptions } from "@/lib/domain/answer-snapshot";

export interface PreviewQuestion {
  id: string;
  section: string;
  questionType: string;
  title: string;
  helpText: string | null;
  unit: string | null;
  required: boolean;
  validationMin: number | null;
  validationInteger?: boolean | null;
  validationMax: number | null;
  optionsJson: string | null;
  displayOrder: number;
}

/** 回答できない理由の既定の文（見本を出す画面が理由を渡さないとき） */
const DEFAULT_REASON =
  "この画面は中身を確かめるためのもので、ここからは回答できません。回答は、対象の等級の方が「実績を報告する」から開く回答画面で行います。";

/**
 * アンケートの中身を「答えずに読む」ための表示（見本）。
 *
 * 管理画面で、配る前・公開中・締め切り後のどの時点でも、回答者に何をどう
 * 答えてもらうかを確かめる。回答者用URLや回答者の等級には依存しない。
 *
 * 選択肢は回答画面と同じ部品（QuestionInput）で試しに選べる。以前は押せない札を並べており、
 * 押しても何も起きない理由が分からず「選択肢が押せない」不具合に見えていた。
 * そのため見本であることと回答できない理由を先頭に出す。
 * 回答画面をそのまま出さないのは、入力すると自動保存が走り、確認しただけの人の回答行が
 * できてしまうため。試しに選んだ内容はこの部品の中だけに持ち、保存・提出の処理には繋がない。
 * 文章・数値の設問は欄を作らず、「どう答えることになるか」（単位・入力できる値）を文で見せる。
 * 配点や昇格ゲートなど、回答者に見せない内部情報も混ぜない。
 */
export function FormPreview({ questions, reason = DEFAULT_REASON }: { questions: PreviewQuestion[]; reason?: string }) {
  // 試しに選んだ答え。この画面の中だけで持ち、どこへも送らない
  const [tried, setTried] = useState<Record<string, AnswerValue>>({});
  const ordered = orderedQuestionSections(questions);

  if (ordered.length === 0) {
    return (
      <Card className="card-pad">
        <p className="footnote m-0">保存済みの設問はありません。</p>
      </Card>
    );
  }

  const tryAnswer = (questionId: string, patch: Partial<AnswerValue>) =>
    setTried((prev) => {
      const before = prev[questionId] ?? { questionId, valueNumber: null, valueText: null, valueChoices: null };
      return { ...prev, [questionId]: { ...before, ...patch } };
    });

  return (
    <>
      <div className="mb-4">
        <ReasonNote>
          見本です。選択肢は試しに選べますが、選んだ内容は保存も提出もされません。{reason}
        </ReasonNote>
      </div>
      {ordered.map((g) => (
        <section key={g.section} className="mb-6">
          <SectionHeading help={SECTION_HELP[g.section]}>
            {SECTION_LABEL[g.section] ?? (g.section === "free" ? "自由記入" : g.section)}
          </SectionHeading>
          <Card className="card-pad">
            <div className="space-y-5">
              {g.rows.map((q) => {
                // 選択肢の束の名前（aria-labelledby）にする設問名。回答画面の id と重ねない
                const titleId = `preview_t_${q.id}`;
                const shape = answerShape(q, titleId, tried[q.id], (patch) => tryAnswer(q.id, patch));
                // 答え方は行の右端に寄せる。文の長い選択肢だけは幅いっぱいに使うので下へ回す
                return (
                  <SplitRow key={q.id} aside={shape.aside} below={shape.below}>
                    <p id={titleId} className="m-0 text-sub font-bold">
                      {q.title}
                      <span className="footnote"> {q.required ? "（必須）" : "（任意）"}</span>
                    </p>
                    {q.helpText && <p className="footnote m-0 mt-0.5">{q.helpText}</p>}
                  </SplitRow>
                );
              })}
            </div>
          </Card>
        </section>
      ))}
    </>
  );
}

/**
 * その設問が「どう答えるものか」を見せる。選ぶ設問は回答画面と同じ部品で試しに選べ、文章・数値は文で伝える。
 * aside は行の右端に置く短いもの（はい／いいえ・段階の数字・答え方の一文）、
 * below は幅いっぱいに使うもの（文の長い選択肢の並び）。
 */
function answerShape(
  q: PreviewQuestion,
  titleId: string,
  value: AnswerValue | undefined,
  onChange: (patch: Partial<AnswerValue>) => void,
): { aside: ReactNode; below?: ReactNode } {
  const options = parseOptions(q.optionsJson);
  const note = (text: string) => <p className="footnote m-0 mt-1">{text}</p>;

  if ((q.questionType === "single" || q.questionType === "multi") && options.length === 0) {
    return { aside: note("選択肢が登録されていません。") };
  }

  if (q.questionType === "yesno" || q.questionType === "single" || q.questionType === "multi" || q.questionType === "scale") {
    const input = (
      <QuestionInput
        q={{ ...q, validationInteger: q.validationInteger ?? false }}
        value={value}
        onChange={onChange}
        onEnter={() => {}}
        titleId={titleId}
      />
    );
    const how = note(q.questionType === "multi" ? "当てはまるものをいくつでも選びます。" : "1つ選びます。");
    // はい／いいえと段階の数字は短いので右端に並べる。文の選択肢（カード・チェック）は下に幅いっぱいで並べる
    const short = q.questionType === "yesno" || (q.questionType === "scale" && options.length === 0);
    return short ? { aside: <>{input}{how}</> } : { aside: how, below: input };
  }

  if (q.questionType === "text") return { aside: note("文章で記入します。") };

  if (q.questionType === "number") {
    const rule =
      q.validationMin !== null && q.validationMax !== null
        ? `${q.validationMin}以上${q.validationMax}以下`
        : q.validationMin !== null
          ? `${q.validationMin}以上`
          : q.validationMax !== null
            ? `${q.validationMax}以下`
            : null;
    return {
      aside: note(
        `数値で入力します${q.unit ? `（単位：${q.unit}）` : ""}` +
          (rule ? `。${rule}${q.validationInteger ? "の整数" : "の数"}を入れます` : q.validationInteger ? "。整数だけを入れます" : "") +
          "。",
      ),
    };
  }

  return { aside: note("回答方法を確認できません。設問の種類を見直してください。") };
}

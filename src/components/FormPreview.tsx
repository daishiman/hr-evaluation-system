"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Card, ReasonNote, SectionHeading, SplitRow } from "@/components/ui";
import { QuestionInput, type AnswerValue } from "@/components/QuestionField";
import { RespondentGuide } from "@/components/RespondentGuide";
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

/** 節ごとに添える「送信できない理由」の既定の短い文（見本を出す画面が渡さないとき） */
const DEFAULT_BLOCKED_LABEL = "確認専用の見本のため";

/**
 * アンケートの中身を「答えずに読む」ための表示（見本）。
 *
 * 管理画面で、配る前・公開中・締め切り後のどの時点でも、回答者に何をどう
 * 答えてもらうかを確かめる。回答者用URLや回答者の等級には依存しない。
 *
 * 選択肢は回答画面と同じ部品（QuestionInput）で試しに選べる。以前は押せない札を並べており、
 * 押しても何も起きない理由が分からず「選択肢が押せない」不具合に見えていた。
 * そのため見本であることと回答できない理由を先頭に出し、節ごとにも短く繰り返す。
 * 回答画面をそのまま出さないのは、入力すると自動保存が走り、確認しただけの人の回答行が
 * できてしまうため。試しに選んだ内容はこの部品の中だけに持ち、保存・提出の処理には繋がない。
 * 文章・数値の設問は欄を作らず、回答画面でどんな欄が出るか（単位・入力できる値）を文で見せる。
 * 配点や昇格ゲートなど、回答者に見せない内部情報も混ぜない。
 */
export function FormPreview({
  questions,
  reason = DEFAULT_REASON,
  blockedLabel = DEFAULT_BLOCKED_LABEL,
}: {
  questions: PreviewQuestion[];
  reason?: string;
  /** 節ごとの「見本のため送信できません（…）」の括弧の中。/forms/[id] は回答できない理由の短い文を渡す */
  blockedLabel?: string;
}) {
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
          <SectionHeading help={sectionNote(blockedLabel, SECTION_HELP[g.section])}>
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
                    {/* 印は回答画面（QuestionField）と同じく「（任意）」だけ。印の無い設問が必須 */}
                    <p id={titleId} className="m-0 text-sub font-bold">
                      {q.title}
                      {!q.required && <span className="footnote"> （任意）</span>}
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
 * 見本の節の見出しの直下に添える文。1行目に送信できない理由、2行目に節の説明を回答者への案内として引用する。
 *
 * 先頭の注記だけでは、下の節まで送ったときに理由が画面の外へ出る（spec §28-8「見える場所に理由」）。
 * 画面に貼り付けず、節ごとに流れの中で繰り返す。
 * 節の説明は回答者への指示（「入力してください」）なので、見本では引用の形にして、
 * 見ている人への指示と読ませない。文の正本は SECTION_HELP の1つのまま（回答画面と同じ文）。
 * 引用の形は RespondentGuide の1つで持つ（アンケートの説明文も同じ形で出す）。
 */
function sectionNote(blockedLabel: string, guide: string | undefined): ReactNode {
  return (
    <>
      <span className="block">見本のため送信できません（{blockedLabel}）</span>
      {guide && (
        <span className="mt-0.5 block">
          <RespondentGuide>{guide}</RespondentGuide>
        </span>
      )}
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

  // 見本には打つ欄が無いので、「入力します」ではなく回答画面で何が出るかを言う
  if (q.questionType === "text") return { aside: note("回答画面では文章を書く欄が出ます。") };

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
        `回答画面では数値を入れる欄が出ます${q.unit ? `（単位：${q.unit}）` : ""}` +
          (rule ? `。${rule}${q.validationInteger ? "の整数" : "の数"}を入れます` : q.validationInteger ? "。整数だけを入れます" : "") +
          "。",
      ),
    };
  }

  return { aside: note("回答方法を確認できません。設問の種類を見直してください。") };
}

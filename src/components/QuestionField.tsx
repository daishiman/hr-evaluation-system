"use client";

import type { ReactNode } from "react";
import { ChoiceChip, OptionCard, OptionCheck } from "@/components/ui";
import { NumberField } from "@/components/NumberField";
import { numberInputHint, questionNumberPolicy } from "@/lib/domain/number-input";
import { isOptionSelected, optionAnswer, parseOptions, scaleSteps, yesNoOptions, type OptionLike } from "@/lib/domain/answer-snapshot";

export interface AnswerQuestion {
  id: string;
  section: string;
  questionType: string;
  title: string;
  helpText: string | null;
  unit: string | null;
  required: boolean;
  validationMin: number | null;
  validationMax: number | null;
  /** 小数を受け付けない設問か（「件」「人」のように数え上げるもの） */
  validationInteger: boolean;
  optionsJson: string | null;
  displayOrder: number;
}

export interface AnswerValue {
  questionId: string;
  valueNumber: number | null;
  valueText: string | null;
  /** 選んだ選択肢の value（単一選択は1つ、複数選択はいくつでも） */
  valueChoices: string[] | null;
}

/** 1問分（設問名・補足・答える欄）。 */
export function QuestionField({
  q,
  value,
  onChange,
  onEnter,
}: {
  q: AnswerQuestion;
  value: AnswerValue | undefined;
  onChange: (patch: Partial<AnswerValue>) => void;
  onEnter: () => void;
}) {
  const titleId = `t_${q.id}`;
  const title = (
    <>
      {q.title}
      {!q.required && <span className="footnote"> （任意）</span>}
    </>
  );
  return (
    <div>
      {/* label の for で名前を付けられるのは入力欄（文章・数値）だけ。選択肢の束（div）を指しても
          支援技術に設問名が届かないので、束には aria-labelledby でこの見出しを名前として付ける。 */}
      {answersWithChoices(q) ? (
        <p id={titleId} className="m-0 block text-sub font-bold">
          {title}
        </p>
      ) : (
        <label className="m-0 block text-sub font-bold" htmlFor={`f_${q.id}`}>
          {title}
        </label>
      )}
      {q.helpText && <p className="footnote m-0 mt-0.5">{q.helpText}</p>}
      <QuestionInput q={q} value={value} onChange={onChange} onEnter={onEnter} titleId={titleId} />
    </div>
  );
}

/** 選択肢の束で答える設問か（設問名を label ではなく、束の名前として付ける） */
function answersWithChoices(q: Pick<AnswerQuestion, "questionType" | "optionsJson">): boolean {
  return ["yesno", "single", "multi", "scale"].includes(q.questionType);
}

/**
 * 設問の答える欄だけ（設問名は呼ぶ側が titleId の要素で出す）。
 * 見本（FormPreview）でも、回答画面と同じ見た目・同じ押し心地で試せるようにこれを使う。
 *
 * 選択肢は束（role="group"）にまとめ、titleId の要素（設問名）で束に名前を付ける。
 * 1つ選ぶものは選択肢の文を丸ごと入れたボタン（選択中は aria-pressed）、
 * いくつでも選ぶものはチェックボックスを包む label にして、文のどこを押しても選べるようにする。
 */
export function QuestionInput({
  q,
  value,
  onChange,
  onEnter,
  titleId,
}: {
  q: AnswerQuestion;
  value: AnswerValue | undefined;
  onChange: (patch: Partial<AnswerValue>) => void;
  onEnter: () => void;
  titleId: string;
}) {
  const options: OptionLike[] = parseOptions(q.optionsJson);
  const current = value?.valueNumber ?? null;
  const chosen = value?.valueChoices ?? [];
  // 次の設問へ送るときのフォーカス先（f_ の id）は束に持たせる
  const group = (className: string, children: ReactNode) => (
    <div className={className} id={`f_${q.id}`} tabIndex={-1} role="group" aria-labelledby={titleId}>
      {children}
    </div>
  );

  if (q.questionType === "yesno") {
    /* 「はい」がどちらの意味かは設問ごとに違う（提出した／行った／合格した）。
       設問と一緒に作られた選択肢の文言があればそれを使い、無いときだけ素の はい／いいえ にする（採点と同じ選択肢） */
    const yesNo = yesNoOptions(options);
    return group(
      "mt-2 flex flex-wrap gap-2",
      yesNo.map((o, index) => (
        <ChoiceChip
          key={`${index}:${o.value}`}
          selected={isOptionSelected(o, value, yesNo)}
          onClick={() => onChange(optionAnswer(o))}
        >
          {o.label}
        </ChoiceChip>
      )),
    );
  }

  if ((q.questionType === "single" || q.questionType === "multi") && options.length === 0) {
    // 答えられない必須の設問でも「最初の未入力の欄へ移る」の飛び先になるよう、案内の文に f_ の id を持たせる
    return (
      <p className="footnote m-0 mt-2" id={`f_${q.id}`} tabIndex={-1}>
        選択肢が登録されていません。会社の管理者にご連絡ください。
      </p>
    );
  }

  if (q.questionType === "multi") {
    // いくつでも選ぶ。選んだ選択肢は value_json に入れる（点数には使わない）
    return group(
      "mt-2 space-y-1",
      options.map((o, index) => (
        <OptionCheck
          key={`${index}:${o.value}`}
          label={o.label}
          checked={chosen.includes(o.value)}
          onToggle={(checked) => {
            const next = checked ? [...chosen, o.value] : chosen.filter((v) => v !== o.value);
            onChange({
              valueChoices: next,
              valueNumber: null,
              valueText: next.map((v) => options.find((x) => x.value === v)?.label ?? v).join("、") || null,
            });
          }}
        />
      )),
    );
  }

  if (q.questionType === "text") {
    // 自由記述。文字は value_text に入れる（数値欄にしない）
    return (
      <textarea
        id={`f_${q.id}`}
        className="input mt-2 min-h-[80px] w-full"
        defaultValue={value?.valueText ?? ""}
        onChange={(e) => onChange({ valueText: e.target.value, valueNumber: null, valueChoices: null })}
        placeholder="そのまま文章で書いてください。"
      />
    );
  }

  if (q.questionType === "scale" && options.length === 0) {
    return group(
      "mt-2 flex flex-wrap gap-2",
      scaleSteps(q).map((n) => (
        <ChoiceChip
          key={n}
          selected={current === n}
          onClick={() => onChange({ valueNumber: n, valueText: String(n), valueChoices: null })}
        >
          {n}
        </ChoiceChip>
      )),
    );
  }

  if ((q.questionType === "single" || q.questionType === "scale") && options.length > 0) {
    /* 選択中かどうかは明示したvalueを先に見る（isOptionSelected）。値が重なった古いデータは
       言葉も合わせる。key も値に頼らない（重なると描き分けが崩れる）。 */
    return group(
      "mt-2 space-y-1",
      options.map((o, index) => (
        <OptionCard
          key={`${index}:${o.value}`}
          title={o.label}
          selected={isOptionSelected(o, value, options)}
          onClick={() => onChange(optionAnswer(o))}
        />
      )),
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {/* 管理画面の数値欄と同じ部品を使う。回答する人によって作法が変わらないようにするため。
          打っている最中も親へ値を渡す（reportWhileTyping）。この画面は下書きを自動で保存しており、
          欄から離れるまで保存されないと、打ったところで閉じた人の入力が消えてしまう。 */}
      <NumberField
        id={`f_${q.id}`}
        name={`f_${q.id}`}
        className="input input-num w-40"
        defaultValue={current ?? null}
        policy={questionNumberPolicy(q)}
        unit={q.unit}
        reportWhileTyping
        onValueChange={(value) => onChange({ valueNumber: value, valueText: null, valueChoices: null })}
        onEnter={onEnter}
      />
      {/* 押す前に伝える。整数だけの設問では、そのことも先に出す（あとから叱らない） */}
      {numberInputHint(q) !== "" && <span className="footnote">{numberInputHint(q)}</span>}
    </div>
  );
}


import { Card, SectionHeading } from "@/components/ui";
import { SECTION_HELP, SECTION_LABEL, SECTION_ORDER } from "@/lib/view";
import { parseOptions, scaleSteps } from "@/lib/domain/answer-snapshot";

export interface PreviewQuestion {
  id: string;
  section: string;
  questionType: string;
  title: string;
  helpText: string | null;
  unit: string | null;
  required: boolean;
  validationMin: number | null;
  validationMax: number | null;
  optionsJson: string | null;
  displayOrder: number;
}

/**
 * アンケートの中身を「答えずに読む」ための表示。
 *
 * 管理画面で、配る前・公開中・締め切り後のどの時点でも、回答者に何をどう
 * 答えてもらうかを確かめる。回答者用URLや回答者の等級には依存しない。
 *
 * 回答画面をそのまま出さないのは、入力すると自動保存が走り、
 * 確認しただけの人の回答行ができてしまうため。ここでは入力欄を作らず、
 * 「どう答えることになるか」（選択肢の文言・単位・入力できる値）だけを見せる。
 * 配点や昇格ゲートなど、回答者に見せない内部情報も混ぜない。
 */
export function FormPreview({ questions }: { questions: PreviewQuestion[] }) {
  const ordered = SECTION_ORDER.concat("free")
    .map((sec) => ({
      section: sec,
      rows: questions.filter((q) => q.section === sec).sort((a, b) => a.displayOrder - b.displayOrder),
    }))
    .filter((g) => g.rows.length > 0);

  if (ordered.length === 0) {
    return (
      <Card className="card-pad">
        <p className="footnote m-0">保存済みの設問はありません。</p>
      </Card>
    );
  }

  return (
    <>
      {ordered.map((g) => (
        <section key={g.section} className="mb-6">
          <SectionHeading help={SECTION_HELP[g.section]}>
            {SECTION_LABEL[g.section] ?? (g.section === "free" ? "自由記入" : g.section)}
          </SectionHeading>
          <Card className="card-pad">
            <div className="space-y-5">
              {g.rows.map((q) => (
                <div key={q.id}>
                  <p className="m-0 text-[13px] font-bold">
                    {q.title}
                    <span className="footnote"> {q.required ? "（必須）" : "（任意）"}</span>
                  </p>
                  {q.helpText && <p className="footnote m-0 mt-0.5">{q.helpText}</p>}
                  <div className="mt-2">{answerShape(q)}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      ))}
    </>
  );
}

/** その設問が「どう答えるものか」を、入力欄を作らずに見せる。 */
function answerShape(q: PreviewQuestion) {
  const options = parseOptions(q.optionsJson);

  if (q.questionType === "yesno") {
    const labels = options.length >= 2 ? options.map((o) => o.label) : ["はい", "いいえ"];
    return (
      <div className="flex flex-wrap gap-2">
        {labels.map((label, index) => (
          <span key={`${index}:${label}`} className="chip">
            {label}
          </span>
        ))}
        <span className="footnote self-center">から1つ選びます</span>
      </div>
    );
  }

  if (q.questionType === "single" || q.questionType === "multi") {
    if (options.length === 0) return <p className="footnote m-0">選択肢が登録されていません。</p>;
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => (
          <span key={`${index}:${option.value}`} className="chip">
            {option.label}
          </span>
        ))}
        <span className="footnote self-center">
          {q.questionType === "multi" ? "から、当てはまるものをいくつでも選びます" : "から1つ選びます"}
        </span>
      </div>
    );
  }

  if (q.questionType === "text") return <p className="footnote m-0">文章で記入します。</p>;

  if (q.questionType === "scale") {
    if (options.length > 0) {
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((option, index) => (
            <span key={`${index}:${option.value}`} className="chip">
              {option.label}
            </span>
          ))}
          <span className="footnote self-center">から1つ選びます</span>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {scaleSteps(q).map((step) => (
          <span key={step} className="chip">
            {step}
          </span>
        ))}
        <span className="footnote self-center">から1つ選びます</span>
      </div>
    );
  }

  if (q.questionType === "number") {
    const rule =
      q.validationMin !== null && q.validationMax !== null
        ? `${q.validationMin}以上${q.validationMax}以下`
        : q.validationMin !== null
          ? `${q.validationMin}以上`
          : q.validationMax !== null
            ? `${q.validationMax}以下`
            : null;
    return (
      <p className="footnote m-0">
        数値で入力します{q.unit ? `（単位：${q.unit}）` : ""}
        {rule ? `。${rule}の数を入れます` : ""}。
      </p>
    );
  }

  return <p className="footnote m-0">回答方法を確認できません。設問の種類を見直してください。</p>;
}

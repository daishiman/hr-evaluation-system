import { Badge, Card, DefList, ReasonNote, SectionHeading } from "@/components/ui";
import { SECTION_LABEL, SECTION_ORDER } from "@/lib/view";
import { formatAnswer, type AnswerReadRow } from "@/lib/domain/answer-snapshot";

/**
 * 提出済みの回答を「回答したときの姿」で読む部品。
 *
 * 描く材料は form_questions（いまの設問）ではなく form_answers に写し取った
 * 当時の設問文・種別・単位・選択肢・並び順を正とする。
 * 設問が入れ替わっても、何年後でも同じ文面で読み返せるようにするため。
 * 写しが無い古い行は、いまの設問で補ったことを画面に断る（黙って別の文面を出さない）。
 */
export function ResponseSnapshot({ rows }: { rows: AnswerReadRow[] }) {
  if (rows.length === 0) {
    return <ReasonNote>この回答には保存された項目がありません。</ReasonNote>;
  }

  const sections = SECTION_ORDER.concat("free")
    .map((sec) => ({ section: sec, rows: rows.filter((r) => r.section === sec) }))
    .filter((g) => g.rows.length > 0);
  // 見出しに当てはまらないまとまりが残っても取りこぼさない
  const known = new Set(sections.flatMap((g) => g.rows.map((r) => r.questionId)));
  const others = rows.filter((r) => !known.has(r.questionId));
  if (others.length > 0) sections.push({ section: "その他", rows: others });

  const patched = rows.filter((r) => r.fromCurrentQuestion).length;

  return (
    <>
      {patched > 0 && (
        <div className="mb-4">
          <ReasonNote>
            この回答のうち{patched}件は、回答したときの設問文が保存される前のものです。いまの設問文を当てて表示しています。
          </ReasonNote>
        </div>
      )}

      {sections.map((g) => (
        <section key={g.section} className="mb-6">
          <SectionHeading>{SECTION_LABEL[g.section] ?? (g.section === "free" ? "自由記入" : g.section)}</SectionHeading>
          {/* 設問と回答は「ラベルと値の対」なので定義リストで出す（§5-5）。
              右端に寄せると、長い自由記入が細い列に押し込まれて読めなくなる。 */}
          <Card className="card-pad">
            <DefList
              rows={g.rows.map((r) => {
                const shown = formatAnswer(r);
                return {
                  key: r.questionId,
                  label: r.title,
                  value:
                    shown === null ? (
                      <span className="footnote">未回答</span>
                    ) : r.questionType === "number" ? (
                      <span className="num font-bold">{shown}</span>
                    ) : r.questionType === "text" ? (
                      <span className="text-[13px] whitespace-pre-wrap">{shown}</span>
                    ) : (
                      <Badge tone="done">{shown}</Badge>
                    ),
                };
              })}
            />
          </Card>
        </section>
      ))}
    </>
  );
}

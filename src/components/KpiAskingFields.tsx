"use client";

import { useId } from "react";
import { Button, Card, Code, FieldGroup } from "@/components/ui";
import { ListAddRow, ListRowBody } from "@/components/ListRow";
import { ReorderList } from "@/components/reorder/ReorderList";
import {
  ASKING_LETTERS,
  ASKING_LIMIT,
  ASKING_VALIDATIONS,
  DEFAULT_ASKING_VALIDATION,
  askingPresets,
  askingRoles,
  checkAskingFormula,
  denominatorZeroHint,
  isAskingValidation,
  remapAskingLetters,
  roleLabel,
  type AskingValidation,
  type AskingView,
} from "@/lib/domain/kpi-asking";

/** 画面で組んでいる聞くこと1つ。 */
export interface AskingQuestionDraft {
  /** 画面の行の目印。並べ替え・削除のときに式の文字を付け替える手がかりで、保存はしない */
  id: string;
  /** すでにある設問のID。新しく足した行には無い */
  key?: string;
  text: string;
  unit: string;
  validation: AskingValidation;
}

/** 画面で組んでいる実績の聞き方（聞くことの並びと、文字で書いた計算式）。 */
export interface AskingDraft {
  questions: AskingQuestionDraft[];
  formula: string;
}

export const emptyAsking = (): AskingDraft => ({ questions: [], formula: "" });

/* 新しく足した行の目印。保存されたIDと重ならない形にする */
let addedRows = 0;
const newRowId = () => `new-${++addedRows}`;

/** 保存されている聞き方を、画面で直せる形にする。 */
export function askingDraftFromView(view: AskingView): AskingDraft {
  return {
    questions: view.questions.map((q) => ({
      id: q.key,
      key: q.key,
      text: q.text,
      unit: q.unit,
      validation: isAskingValidation(q.validation) ? q.validation : DEFAULT_ASKING_VALIDATION,
    })),
    formula: view.formula,
  };
}

/** 送る形（body-schema.ts の KPI_ASKING）。 */
export function askingPayload(draft: AskingDraft) {
  return {
    questions: draft.questions.map((q) => ({
      ...(q.key ? { key: q.key } : {}),
      text: q.text.trim(),
      unit: q.unit.trim(),
      validation: q.validation,
    })),
    formula: draft.formula.trim(),
  };
}

/** 送ると変わるか。並び・文言・単位・入力の決まり・式のどれかが違えば変わる。 */
export function sameAsking(a: AskingDraft, b: AskingDraft): boolean {
  return JSON.stringify(askingPayload(a)) === JSON.stringify(askingPayload(b));
}

/** 保存できない理由。保存できれば null。サーバーと同じ検査（checkAskingFormula）を先に当てる。 */
export function askingProblem(draft: AskingDraft): string | null {
  const blank = draft.questions.findIndex((q) => q.text.trim() === "");
  if (blank >= 0) return `${ASKING_LETTERS[blank]}の聞くことの文言を入れてください。`;
  return checkAskingFormula(draft.formula, draft.questions.length);
}

/**
 * 保存のときに聞き方を送るかと、送れない理由。聞き方は変えたときだけ送る
 * （画面から変えられない項目では送らない。変えていない古い式を、ほかの欄を直すたびに検査し直さない）。
 * 作るとき（saved が null）は、聞くことを1つでも足したときだけ送る。
 */
export function askingToSend(draft: AskingDraft, saved: AskingView | null): { send: boolean; problem: string | null } {
  if (saved === null) {
    if (draft.questions.length === 0) return { send: false, problem: null };
  } else if (saved.readonlyReason !== null || sameAsking(draft, askingDraftFromView(saved))) {
    return { send: false, problem: null };
  }
  return { send: true, problem: askingProblem(draft) };
}

const COLLECTING_NOTE = "がこの項目の設問で回答を集めているため、聞くことを足したり消したりはできません。";

/**
 * KPI項目の「実績の聞き方」を組む欄（DD-016）。
 *
 * 聞くことは A・B… の文字で並べ、計算式も文字で書く。文字は並びの位置で決まるので、
 * 並べ替え・削除のたびに式の文字を付け替えて、式がいつも同じ設問を指すようにする。
 * 消した設問を指していた文字は「？」にして、直すまで保存させない（詰めた文字のままだと、
 * 式が黙って別の設問を指す）。
 * 役割（分子・分母など）は式から決まるので選ばせず、決まった役割を各行に添える。
 */
export function KpiAskingFields({
  draft,
  onChange,
  keySetLockedBy,
  busy,
  problem,
  problemId,
}: {
  draft: AskingDraft;
  onChange: (draft: AskingDraft) => void;
  /** 回答を集めたアンケートの呼び名。あれば聞くことを足す・消すを出さない */
  keySetLockedBy: string | null;
  busy: boolean;
  /** 保存できない理由（呼ぶ側が、送るときだけ askingProblem で出す）。保存ボタンの説明にも同じ id で結ぶ */
  problem: string | null;
  problemId: string;
}) {
  const formulaId = useId();
  const { questions, formula } = draft;
  const roles = askingRoles(formula, questions.length);
  const ids = questions.map((q) => q.id);

  /* 並びが変わったら、式の文字を同じ設問へ付け替える */
  const reshape = (next: AskingQuestionDraft[]) =>
    onChange({
      questions: next,
      formula: remapAskingLetters(
        formula,
        ids,
        next.map((q) => q.id),
      ),
    });
  const patch = (id: string, change: Partial<AskingQuestionDraft>) =>
    onChange({ ...draft, questions: questions.map((q) => (q.id === id ? { ...q, ...change } : q)) });

  const full = questions.length >= ASKING_LIMIT;
  const addNote = keySetLockedBy
    ? `${keySetLockedBy}${COLLECTING_NOTE}別の聞き方が要るときは、新しいKPI項目として作ってください。`
    : full
      ? `聞けるのは${ASKING_LIMIT}つまでです。`
      : "アンケートで答えてもらう数を1つ増やします。文言はそのまま設問になります。";

  return (
    <FieldGroup legend="実績の聞き方" className="mt-4">
      <p className="footnote m-0 mt-1">
        アンケートで聞く数を並べ、その答えから実績値を出す計算式を決めます。計算式では、聞くことを左の文字（A・B…）で指します。
      </p>

      {/* 1行が文言・単位・入力の決まりの3段になるので、設問や要件の一覧と同じく、カードの中に区切り線で並べる */}
      <Card className="mt-2">
        {questions.length > 0 && (
          <ReorderList
            items={questions.map((q, i) => ({ id: q.id, label: q.text.trim() || `${ASKING_LETTERS[i]}（文言なし）` }))}
            label="聞くことの並び"
            className="reorder-in-card"
            busy={busy}
            onCommit={(order) => reshape(order.map((id) => questions.find((q) => q.id === id)!))}
            renderItem={(item, at) => {
              const q = questions.find((x) => x.id === item.id);
              if (!q) return null;
              const letter = ASKING_LETTERS[at];
              const role = roles?.[at];
              const hint = role ? denominatorZeroHint(role, q.validation) : null;
              return (
                <ListRowBody number={letter}>
                  <input
                    className="input w-full"
                    aria-label={`${letter}の聞くこと（アンケートの設問の文言）`}
                    placeholder="例：今期に契約した件数"
                    maxLength={200}
                    value={q.text}
                    onChange={(e) => patch(q.id, { text: e.target.value })}
                  />
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label>
                      <span className="block text-note text-ink-muted">単位（任意）</span>
                      <input
                        className="input mt-1 w-28"
                        maxLength={10}
                        placeholder="例：件"
                        value={q.unit}
                        onChange={(e) => patch(q.id, { unit: e.target.value })}
                      />
                    </label>
                    <label>
                      <span className="block text-note text-ink-muted">入力の決まり</span>
                      <select
                        className="input mt-1"
                        value={q.validation}
                        onChange={(e) =>
                          patch(q.id, { validation: isAskingValidation(e.target.value) ? e.target.value : DEFAULT_ASKING_VALIDATION })
                        }
                      >
                        {ASKING_VALIDATIONS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {role && (
                    <p className="footnote m-0 mt-1">
                      計算式での役割：{roleLabel(role)}
                      {hint && `。${hint}`}
                    </p>
                  )}
                </ListRowBody>
              );
            }}
            renderActions={
              keySetLockedBy
                ? undefined
                : (item) => (
                    <Button
                      variant="tertiary"
                      aria-label={`聞くこと「${item.label}」を削除`}
                      onClick={() => reshape(questions.filter((q) => q.id !== item.id))}
                    >
                      削除
                    </Button>
                  )
            }
          />
        )}
        <div className={questions.length > 0 ? "card-pad border-t border-line" : "card-pad"}>
          <ListAddRow
            empty={questions.length === 0 && "聞くことはまだありません。このままでは、アンケートに出ず、点も付きません。"}
            note={addNote}
          >
            <Button
              variant="secondary"
              disabled={busy || full || keySetLockedBy !== null}
              onClick={() =>
                reshape([...questions, { id: newRowId(), text: "", unit: "", validation: DEFAULT_ASKING_VALIDATION }])
              }
            >
              ＋ 聞くことを追加
            </Button>
          </ListAddRow>
        </div>
      </Card>

      {questions.length > 0 && (
        <div className="mt-3">
          <label htmlFor={formulaId} className="block text-note text-ink-muted">
            計算式（例：A ÷ B × 100）
          </label>
          <input
            id={formulaId}
            className="input mt-1 w-full"
            maxLength={300}
            value={formula}
            aria-describedby={problem ? problemId : undefined}
            onChange={(e) => onChange({ ...draft, formula: e.target.value })}
          />
          {askingPresets(questions.length).length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-note text-ink-muted">型から入れる：</span>
              {askingPresets(questions.length).map((p) => (
                <Button key={p.formula} variant="tertiary" onClick={() => onChange({ ...draft, formula: p.formula })}>
                  {p.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      {problem && (
        <p id={problemId} className="footnote m-0 mt-2">
          保存の前に：{problem}
        </p>
      )}
    </FieldGroup>
  );
}

/** 画面から変えられない聞き方を、読むだけの形で見せる。 */
export function KpiAskingSummary({ view }: { view: AskingView }) {
  return (
    <section className="mt-4" aria-label="実績の聞き方">
      <p className="m-0 text-sub font-bold">実績の聞き方</p>
      {view.questions.length > 0 && (
        <ol className="m-0 mt-1 list-none p-0">
          {view.questions.map((q, i) => (
            <li key={q.key} className="text-sub">
              {ASKING_LETTERS[i] ?? "・"} {q.text}
              <span className="footnote">
                {"（"}
                {[q.unit, q.validation, roleLabel(q.role)].filter(Boolean).join("・")}
                {"）"}
              </span>
            </li>
          ))}
        </ol>
      )}
      {view.formula && (
        <p className="m-0 mt-1 text-sub">
          計算式 <Code>{view.formula}</Code>
        </p>
      )}
      {view.readonlyReason && <p className="footnote m-0 mt-1">{view.readonlyReason}</p>}
    </section>
  );
}

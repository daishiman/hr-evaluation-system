"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, ProvisionalMark, ReasonNote } from "@/components/ui";
import { SECTION_HELP, SECTION_LABEL, SECTION_ORDER } from "@/lib/view";
import { normalizeNumeric } from "@/lib/ux-patterns";

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
  optionsJson: string | null;
  displayOrder: number;
}

export interface AnswerValue {
  questionId: string;
  valueNumber: number | null;
  valueText: string | null;
}

type Option = { value: string; label: string; score: number };

/**
 * アンケート回答画面。
 *
 * ここには昇格に必要な点数・配点・ランク基準を一切出さない（要件の明示事項）。
 * サーバー側でも評価される方には返していないため、この画面には届かない。
 *
 * 入力の作法はアプリ全体で1組に揃える:
 *  - 入力のたびに自動保存（1秒後）。保存できたら「保存済み HH:MM」を出す
 *  - Enter は次の欄へ移る（提出はボタンだけ）。日本語変換中の Enter は無視する
 *  - 未入力は赤くせず、提出時にまとめて知らせる
 */
export function FormAnswer({
  formId,
  questions,
  initial,
  submitted,
  closed,
  note,
}: {
  formId: string;
  questions: AnswerQuestion[];
  initial: AnswerValue[];
  submitted: boolean;
  closed: boolean;
  note: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(initial.map((a) => [a.questionId, a])),
  );
  const [memo, setMemo] = useState(note ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const readOnly = submitted || closed;

  const ordered = useMemo(
    () =>
      SECTION_ORDER.map((sec) => ({
        section: sec,
        rows: questions.filter((q) => q.section === sec).sort((a, b) => a.displayOrder - b.displayOrder),
      })).filter((g) => g.rows.length > 0),
    [questions],
  );
  const fieldOrder = useMemo(() => ordered.flatMap((g) => g.rows.map((r) => r.id)), [ordered]);

  const answeredCount = questions.filter((q) => values[q.id]?.valueNumber !== null && values[q.id] !== undefined).length;

  const save = useCallback(
    async (status: "draft" | "submitted", nextValues: Record<string, AnswerValue>, nextMemo: string) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/responses/${formId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status,
            note: nextMemo || null,
            answers: Object.values(nextValues).filter((a) => a.valueNumber !== null || a.valueText),
          }),
        });
        const json = (await res.json()) as { ok: boolean; message?: string };
        if (!res.ok || !json.ok) {
          setError(json.message ?? "保存できませんでした。");
          return false;
        }
        setSavedAt(new Date());
        if (status === "submitted") router.refresh();
        return true;
      } catch {
        setError("通信できませんでした。電波の状況を確認して、もう一度お試しください。入力内容はこの画面に残っています。");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [formId, router],
  );

  const update = useCallback(
    (questionId: string, patch: Partial<AnswerValue>) => {
      setValues((prev) => {
        const next = {
          ...prev,
          [questionId]: {
            ...{ questionId, valueNumber: null, valueText: null },
            ...prev[questionId],
            ...patch,
          },
        };
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void save("draft", next, memo), 1000);
        return next;
      });
    },
    [memo, save],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const focusNext = (id: string) => {
    const i = fieldOrder.indexOf(id);
    const nextId = fieldOrder[i + 1];
    if (!nextId) return;
    document.getElementById(`f_${nextId}`)?.focus();
  };

  const missing = questions.filter((q) => q.required && (values[q.id]?.valueNumber ?? null) === null);

  if (readOnly) {
    return (
      <>
        <ReasonNote>
          {submitted
            ? "提出済みのため編集できません。内容の修正が必要な場合は、上長にご連絡ください。"
            : "このアンケートは締め切られているため入力できません。"}
        </ReasonNote>
        <div className="mt-4">
          <AnswerReadOnly ordered={ordered} values={values} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sticky top-[56px] z-10 -mx-4 mb-4 border-b border-[var(--line)] bg-white/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[13px]">
            入力できた項目 <span className="num font-bold">{answeredCount}</span>
            <span className="unit"> / {questions.length}</span>
          </p>
          <p className="m-0 text-[12px] text-[var(--ink-muted)]">
            {saving
              ? "保存しています…"
              : savedAt
                ? `保存済み ${savedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
                : "入力すると自動で保存されます"}
          </p>
        </div>
      </div>

      {error && <ReasonNote>{error}</ReasonNote>}

      {ordered.map((g) => (
        <section key={g.section} className="mb-6">
          <h2 className="section-heading mb-1">{SECTION_LABEL[g.section] ?? g.section}</h2>
          <p className="footnote m-0 mb-2">{SECTION_HELP[g.section]}</p>
          <Card className="card-pad">
            <div className="space-y-5">
              {g.rows.map((q) => (
                <QuestionField
                  key={q.id}
                  q={q}
                  value={values[q.id]}
                  onChange={(patch) => update(q.id, patch)}
                  onEnter={() => focusNext(q.id)}
                />
              ))}
            </div>
          </Card>
        </section>
      ))}

      <section className="mb-6">
        <h2 className="section-heading mb-1">補足（任意）</h2>
        <p className="footnote m-0 mb-2">数字だけでは伝わらない事情があれば書いてください。上長が読みます。</p>
        <Card className="card-pad">
          <textarea
            className="input min-h-[96px] w-full"
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value);
              clearTimeout(timer.current);
              const v = e.target.value;
              timer.current = setTimeout(() => void save("draft", values, v), 1000);
            }}
            placeholder="例：4月に担当が交代したため、前半の実績が少なくなっています。"
          />
        </Card>
      </section>

      {confirming ? (
        <Card className="card-pad">
          <p className="todo-row-title m-0">この内容で提出します</p>
          <p className="todo-row-sub m-0 mt-1">
            提出すると自分では変更できなくなります。修正が必要になったときは上長にご連絡ください。
          </p>
          {missing.length > 0 && (
            <div className="mt-3">
              <ReasonNote>
                未入力の項目が{missing.length}件あります（例：{missing[0].title}）。入力してから提出してください。
              </ReasonNote>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={saving}
              onClick={async () => {
                const ok = await save("submitted", values, memo);
                if (ok) setConfirming(false);
              }}
            >
              提出する
            </Button>
            <Button onClick={() => setConfirming(false)}>入力に戻る</Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setConfirming(true)}>
            内容を確認して提出する
          </Button>
          <span className="footnote">
            途中でやめても入力内容は残ります。あとから続きを入力できます。
          </span>
        </div>
      )}
    </>
  );
}

function QuestionField({
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
  const options: Option[] = q.optionsJson ? (JSON.parse(q.optionsJson) as Option[]) : [];
  const current = value?.valueNumber ?? null;

  return (
    <div>
      <label className="m-0 block text-[13px] font-bold" htmlFor={`f_${q.id}`}>
        {q.title}
        {!q.required && <span className="footnote"> （任意）</span>}
      </label>
      {q.helpText && <p className="footnote m-0 mt-0.5">{q.helpText}</p>}

      {q.questionType === "yesno" ? (
        <div className="mt-2 flex gap-2" id={`f_${q.id}`} tabIndex={-1}>
          {[
            { v: 1, label: "はい" },
            { v: 0, label: "いいえ" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              className="chip"
              aria-pressed={current === o.v}
              onClick={() => onChange({ valueNumber: o.v, valueText: o.label })}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : options.length > 0 ? (
        <div className="mt-2 space-y-1" id={`f_${q.id}`} tabIndex={-1}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={
                current === o.score
                  ? "block w-full rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-left text-[13px]"
                  : "block w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-[13px] hover:border-[var(--brand)]"
              }
              aria-pressed={current === o.score}
              onClick={() => onChange({ valueNumber: o.score, valueText: o.label })}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <input
            id={`f_${q.id}`}
            className="input input-num w-40"
            inputMode="decimal"
            enterKeyHint="next"
            defaultValue={current ?? ""}
            onChange={(e) => onChange({ valueNumber: normalizeNumeric(e.target.value), valueText: null })}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (e.nativeEvent.isComposing) return; // 日本語変換の確定Enterでは動かさない
              e.preventDefault();
              onEnter();
            }}
          />
          {q.unit && <span className="unit">{q.unit}</span>}
          {q.validationMin !== null && (
            <span className="footnote">{q.validationMin}以上の数字を入力してください</span>
          )}
        </div>
      )}
    </div>
  );
}

function AnswerReadOnly({
  ordered,
  values,
}: {
  ordered: { section: string; rows: AnswerQuestion[] }[];
  values: Record<string, AnswerValue>;
}) {
  return (
    <>
      {ordered.map((g) => (
        <section key={g.section} className="mb-6">
          <h2 className="section-heading mb-1">{SECTION_LABEL[g.section] ?? g.section}</h2>
          <Card>
            {g.rows.map((q) => (
              <div key={q.id} className="card-row items-start">
                <div className="row-main">
                  <p className="todo-row-title m-0">{q.title}</p>
                </div>
                <div className="shrink-0 text-right">
                  {values[q.id]?.valueText ? (
                    <Badge tone="done">{values[q.id].valueText}</Badge>
                  ) : values[q.id]?.valueNumber !== null && values[q.id]?.valueNumber !== undefined ? (
                    <span className="num font-bold">
                      {values[q.id].valueNumber}
                      {q.unit && <span className="unit">{q.unit}</span>}
                    </span>
                  ) : (
                    <span className="footnote">未回答 </span>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </section>
      ))}
    </>
  );
}

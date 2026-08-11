"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ReasonNote, SectionHeading } from "@/components/ui";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { SECTION_HELP, SECTION_LABEL, SECTION_ORDER } from "@/lib/view";
import { normalizeNumeric } from "@/lib/ux-patterns";
import { isAnswered, parseOptions, scaleSteps, type OptionLike } from "@/lib/domain/answer-snapshot";

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
  /** 複数選択で選んだ選択肢の value。ほかの形式では使わない */
  valueChoices: string[] | null;
}

/**
 * アンケート回答画面。
 *
 * ここには昇格に必要な点数・配点・ランク基準を一切出さない（要件の明示事項）。
 * サーバー側でも一般の方には返していないため、この画面には届かない。
 *
 * 入力の作法はアプリ全体で1組に揃える:
 *  - 入力のたびに自動保存（1秒後）。保存できたら「保存済み HH:MM」を出す
 *  - Enter は次の欄へ移る（提出はボタンだけ）。日本語変換中の Enter は無視する
 *  - 未入力は赤くせず、提出時にまとめて知らせる
 *
 * 設問の形式は、管理画面で作れるもの（はい/いいえ・1つ選ぶ・いくつでも選ぶ・数値・文章・段階）を
 * すべて答えられるようにしてある。以前は数値と選択肢しか描いておらず、
 * 選択肢の無い「文章で書く」設問が数値入力欄になって回答できなかった。
 */
export function FormAnswer({
  formId,
  questions,
  initial,
  submitted,
  lockedReason,
  deadlineNote,
  note,
}: {
  formId: string;
  questions: AnswerQuestion[];
  initial: AnswerValue[];
  submitted: boolean;
  /** 回答できない理由（締切・締め切り済みなど）。null なら回答できる */
  lockedReason: string | null;
  /** 回答できるときに上部へ常時出す期限の案内 */
  deadlineNote: string | null;
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
  const readOnly = submitted || lockedReason !== null;

  const ordered = useMemo(
    () =>
      SECTION_ORDER.concat("free")
        .map((sec) => ({
          section: sec,
          rows: questions.filter((q) => q.section === sec).sort((a, b) => a.displayOrder - b.displayOrder),
        }))
        .filter((g) => g.rows.length > 0),
    [questions],
  );
  const fieldOrder = useMemo(() => ordered.flatMap((g) => g.rows.map((r) => r.id)), [ordered]);

  // 「答えた」の数え方は設問の形式ごとに変える（自由記述は文字、複数選択は選んだ数）
  const answeredCount = questions.filter((q) => isAnswered(q.questionType, values[q.id])).length;

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
            answers: Object.values(nextValues).filter(
              (a) => a.valueNumber !== null || a.valueText || (a.valueChoices?.length ?? 0) > 0,
            ),
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
            ...{ questionId, valueNumber: null, valueText: null, valueChoices: null },
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

  const missing = questions.filter((q) => q.required && !isAnswered(q.questionType, values[q.id]));

  if (readOnly) {
    return (
      <>
        <ReasonNote>
          {submitted
            ? "提出済みのため編集できません。内容の修正が必要な場合は、上長にご連絡ください。"
            : lockedReason}
        </ReasonNote>
        <div className="mt-4">
          <AnswerReadOnly ordered={ordered} values={values} />
        </div>
      </>
    );
  }

  return (
    <>
      {error && <ReasonNote>{error}</ReasonNote>}

      {ordered.map((g) => (
        <section key={g.section} className="mb-6">
          <SectionHeading help={SECTION_HELP[g.section]}>{SECTION_LABEL[g.section] ?? (g.section === "free" ? "自由記入" : g.section)}</SectionHeading>
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
        <SectionHeading help="数字だけでは伝わらない事情があれば書いてください。上長が読みます。">補足（任意）</SectionHeading>
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

      {confirming && (
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
        </Card>
      )}

      {/* 進み具合・保存状態・締切と、次に押すものを画面下に固定する。
          同じボタンを本文と帯の両方には置かない（押す場所を1つにする）。 */}
      <StickyActionBar
        status={
          <>
            <span className="text-[13px] text-[var(--ink)]">
              入力できた項目 <span className="num font-bold">{answeredCount}</span>
              <span className="unit"> / {questions.length}</span>
            </span>
            <span className="mx-2 text-[var(--line)]">|</span>
            {saving
              ? "保存しています…"
              : savedAt
                ? `保存済み ${savedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
                : "入力すると自動で保存されます"}
            {/* 締切は常に見えるところに置く（気づかないまま入力し続けるのを防ぐ） */}
            {deadlineNote && <span className="ml-2">／ {deadlineNote}</span>}
          </>
        }
      >
        {confirming ? (
          <>
            <Button onClick={() => setConfirming(false)}>入力に戻る</Button>
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
          </>
        ) : (
          <Button variant="primary" onClick={() => setConfirming(true)}>
            内容を確認して提出する
          </Button>
        )}
      </StickyActionBar>
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
  const options: OptionLike[] = parseOptions(q.optionsJson);
  const current = value?.valueNumber ?? null;
  const chosen = value?.valueChoices ?? [];

  const body = () => {
    if (q.questionType === "yesno") {
      /* 「はい」がどちらの意味かは設問ごとに違う（提出した／行った／合格した）。
         設問と一緒に作られた選択肢の文言があればそれを使い、無いときだけ素の はい／いいえ にする。 */
      const yesNo =
        options.length >= 2
          ? options.map((o) => ({ v: o.score ?? Number(o.value), label: o.label }))
          : [
              { v: 1, label: "はい" },
              { v: 0, label: "いいえ" },
            ];
      return (
        <div className="mt-2 flex flex-wrap gap-2" id={`f_${q.id}`} tabIndex={-1}>
          {yesNo.map((o) => (
            <button
              key={o.v}
              type="button"
              className="chip"
              aria-pressed={current === o.v}
              onClick={() => onChange({ valueNumber: o.v, valueText: o.label, valueChoices: null })}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    }

    if (q.questionType === "multi") {
      // いくつでも選ぶ。選んだ選択肢は value_json に入れる（点数には使わない）
      return (
        <div className="mt-2 space-y-1" id={`f_${q.id}`} tabIndex={-1}>
          {options.length === 0 ? (
            <p className="footnote m-0">選択肢が登録されていません。会社の管理者にご連絡ください。</p>
          ) : (
            options.map((o) => {
              const on = chosen.includes(o.value);
              return (
                <label
                  key={o.value}
                  className={
                    on
                      ? "flex w-full items-center gap-2 rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-[13px]"
                      : "flex w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] hover:border-[var(--brand)]"
                  }
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const next = e.target.checked ? [...chosen, o.value] : chosen.filter((v) => v !== o.value);
                      onChange({
                        valueChoices: next,
                        valueNumber: null,
                        valueText: next.map((v) => options.find((x) => x.value === v)?.label ?? v).join("、") || null,
                      });
                    }}
                  />
                  {o.label}
                </label>
              );
            })
          )}
        </div>
      );
    }

    if (q.questionType === "single" && options.length === 0) {
      return <p className="footnote m-0 mt-2">選択肢が登録されていません。会社の管理者にご連絡ください。</p>;
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
      return (
        <div className="mt-2 flex flex-wrap gap-2" id={`f_${q.id}`} tabIndex={-1}>
          {scaleSteps(q).map((n) => (
            <button
              key={n}
              type="button"
              className="chip"
              aria-pressed={current === n}
              onClick={() => onChange({ valueNumber: n, valueText: String(n), valueChoices: null })}
            >
              {n}
            </button>
          ))}
        </div>
      );
    }

    if (options.length > 0) {
      return (
        <div className="mt-2 space-y-1" id={`f_${q.id}`} tabIndex={-1}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={
                current === (o.score ?? Number(o.value))
                  ? "block w-full rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-left text-[13px]"
                  : "block w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-[13px] hover:border-[var(--brand)]"
              }
              aria-pressed={current === (o.score ?? Number(o.value))}
              onClick={() => onChange({ valueNumber: o.score ?? Number(o.value), valueText: o.label, valueChoices: null })}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          id={`f_${q.id}`}
          className="input input-num w-40"
          inputMode="decimal"
          enterKeyHint="next"
          defaultValue={current ?? ""}
          onChange={(e) => onChange({ valueNumber: normalizeNumeric(e.target.value), valueText: null, valueChoices: null })}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (e.nativeEvent.isComposing) return; // 日本語変換の確定Enterでは動かさない
            e.preventDefault();
            onEnter();
          }}
        />
        {q.unit && <span className="unit">{q.unit}</span>}
        {q.validationMin !== null && <span className="footnote">{q.validationMin}以上の数字を入力してください</span>}
      </div>
    );
  };

  return (
    <div>
      <label className="m-0 block text-[13px] font-bold" htmlFor={`f_${q.id}`}>
        {q.title}
        {!q.required && <span className="footnote"> （任意）</span>}
      </label>
      {q.helpText && <p className="footnote m-0 mt-0.5">{q.helpText}</p>}
      {body()}
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
          <SectionHeading>{SECTION_LABEL[g.section] ?? (g.section === "free" ? "自由記入" : g.section)}</SectionHeading>
          <Card>
            {g.rows.map((q) => {
              const v = values[q.id];
              const shown = v?.valueText?.trim()
                ? v.valueText
                : v?.valueNumber !== null && v?.valueNumber !== undefined
                  ? `${v.valueNumber}${q.unit ?? ""}`
                  : null;
              return (
                <div key={q.id} className="card-row items-start">
                  <div className="row-main">
                    <p className="todo-row-title m-0">{q.title}</p>
                  </div>
                  {/* 回答は選択肢の文がそのまま入る（行動指針の選択肢は1行では収まらない）。
                      幅を固定すると設問名のほうが潰れるので、ここは縮む側にする。 */}
                  <div className="min-w-0 text-right">
                    {shown === null ? (
                      <span className="footnote">未回答</span>
                    ) : q.questionType === "number" ? (
                      <span className="num font-bold">{shown}</span>
                    ) : (
                      /* 札（Badge）は折り返さない決まりなので、選んだ選択肢の文には使わない。
                         行動指針のように1行で収まらない選択肢がある。 */
                      <span className="text-[13px] font-semibold">{shown}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      ))}
    </>
  );
}

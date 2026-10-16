"use client";

import { useSaveAction } from "@/lib/use-refresh";
import { saveResponse } from "@/actions/responses";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardHead, FieldGroup, ReasonNote, SectionHeading } from "@/components/ui";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { SECTION_HELP } from "@/lib/view";
import { isAnswered } from "@/lib/domain/answer-snapshot";
import { formatJstTime } from "@/lib/domain/jst";
import { QuestionField, type AnswerQuestion, type AnswerValue } from "@/components/QuestionField";
import { orderedQuestionSections } from "@/components/question-sections";
import { sectionLabel } from "@/lib/question-order";
import { checkSubmission, missingAnswersMessage, missingRequired, normalizeAnswers } from "@/lib/submission-check";
export { QuestionField, QuestionInput, type AnswerQuestion, type AnswerValue } from "@/components/QuestionField";
import { RefreshStatus } from "@/components/RefreshStatus";

/** 答えの1項目が同じか。選んだ選択肢（配列）は、数と並びで比べる */
function sameAnswerValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  return Object.is(a ?? null, b ?? null);
}

/** 送る答え。何も入れていない欄は送らない（下書き・提出・試しの提出で同じものを使う） */
function answersToSend(values: Record<string, AnswerValue>): AnswerValue[] {
  return Object.values(values).filter(
    (a) => a.valueNumber !== null || a.valueText || (a.valueChoices?.length ?? 0) > 0,
  );
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
 *
 * trial は管理者の試しの回答（/forms/[id]?try=1）。同じ画面で数を入れ、選び、確認を開いて
 * 提出までを試せる。下書きも提出も送らず、提出は保存の受け口と同じ検査（checkSubmission）に
 * 当てて結果だけを出す。管理者には等級が無く、本物の回答画面は開けないため。
 */
export function FormAnswer({
  formId,
  questions,
  initial,
  submitted,
  lockedReason,
  deadlineNote,
  note,
  trial = false,
}: {
  formId: string;
  questions: AnswerQuestion[];
  initial: AnswerValue[];
  submitted: boolean;
  /** 回答できない理由（answerLockedReason の文）。null なら回答できる */
  lockedReason: string | null;
  /** 回答できるときに上部へ常時出す期限の案内 */
  deadlineNote: string | null;
  note: string | null;
  /** 試しの回答。何も保存しない（下書きも提出も送らない） */
  trial?: boolean;
}) {
  /* 提出と下書きの自動保存は同じ書き込みだが、待っている間の扱いを分けるため2つに受ける。
     提出中は入力欄ごと止める。下書きの保存中は止めない（打っている欄から focus が外れるため）。 */
  const { save, saving } = useSaveAction(saveResponse, { resource: "responses" });
  const { save: saveDraft, saving: savingDraft } = useSaveAction(saveResponse, { resource: "responses" });
  const [values, setValues] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(initial.map((a) => [a.questionId, a])),
  );
  const [memo, setMemo] = useState(note ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /* 断られた理由は、提出と下書きで分けて持つ。1つにまとめていると、提出を断られたあとの
     下書きの保存し直しが成功した時点で、提出の断りまで消えていた（下書きは範囲を問わずに通る）。
     提出の断りを消すのは、次に答えを変えたときと、次に提出するときだけ。 */
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  // いちばん新しい入力の下書きが断られたか（提出を断られたこととは分ける）
  const [draftFailed, setDraftFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /* 「提出する」を押してから返事が来るまで。saving は送り始めてから立つので、
     前の下書きの保存を待っている間（並んでいる間）も押したことが分かるように別に持つ */
  const [submitting, setSubmitting] = useState(false);
  // この画面を開いてから、答えを1つでも変えたか。変える前は保存の状態を何も書かない
  const [touched, setTouched] = useState(false);
  // 試しの提出が検査を通ったか。答えを変えたら消す
  const [trialPassed, setTrialPassed] = useState(false);
  const confirmBox = useRef<HTMLDivElement>(null);
  const confirmHeading = useRef<HTMLParagraphElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const readOnly = submitted || lockedReason !== null;
  const canSaveDraft = useRef(!readOnly && !trial);
  const queuedSave = useRef<Promise<unknown>>(Promise.resolve());
  const editVersion = useRef(0);
  // 保存できた入力の版。editVersion と違えば、まだ保存していない変更がある
  const savedVersion = useRef(0);
  // 描き直しを待たずに2回目の「提出する」を止めるための印（state は次の描画まで変わらない）
  const submitLock = useRef(false);
  const latestInput = useRef({ values, memo });

  const ordered = useMemo(() => orderedQuestionSections(questions), [questions]);
  const fieldOrder = useMemo(() => ordered.flatMap((g) => g.rows.map((r) => r.id)), [ordered]);

  /* 「答えた」の数え方は設問の形式ごとに変える（自由記述は文字、複数選択は選んだ数）。
     帯の「入力できた項目」と、確認の欄の未入力の知らせ（missingRequired）が同じ見方を使う */
  const answeredQuestion = (q: AnswerQuestion) => isAnswered(q.questionType, values[q.id]);
  const answeredCount = questions.filter(answeredQuestion).length;

  const persist = useCallback(
    (status: "draft" | "submitted", nextValues: Record<string, AnswerValue>, nextMemo: string, version = editVersion.current) => {
      // 保存中も入力を受け付けるが、送信は順番に行う。古い下書きが後から上書きしない。
      const task = queuedSave.current.then(async () => {
        if (status === "draft" && !canSaveDraft.current) return false;
        if (status === "draft") setDraftError(null);
        const payload = {
          formId,
          status,
          note: nextMemo || null,
          answers: answersToSend(nextValues),
        };
        // 提出の応答には、提出後の画面（提出済みの表示）が同梱される（サーバー側の refresh()）
        const result = status === "submitted" ? await save(payload) : await saveDraft(payload);
        // 失敗しても入力内容は消さない（この画面に残したまま直してもらう）
        if (!result.ok) {
          if (status === "submitted") {
            setSubmitError(result.message);
          } else {
            setDraftError(result.message);
            if (version === editVersion.current) setDraftFailed(true);
          }
          return false;
        }
        savedVersion.current = version;
        if (version === editVersion.current) setSavedAt(new Date());
        if (status === "submitted") setMessage(result.message);
        return true;
      });
      // 失敗した保存が、次の送信を止めないようにする。
      queuedSave.current = task.then(() => {}, () => {});
      return task;
    },
    [formId, save, saveDraft],
  );

  /** 1秒後に、いちばん新しい入力を下書きとして送る（待っている予約は差し替える） */
  const queueDraft = useCallback(() => {
    clearTimeout(timer.current);
    const version = editVersion.current;
    timer.current = setTimeout(() => {
      const { values: nextValues, memo: nextMemo } = latestInput.current;
      void persist("draft", nextValues, nextMemo, version);
    }, 1000);
  }, [persist]);

  const scheduleDraft = useCallback((nextValues: Record<string, AnswerValue>, nextMemo: string) => {
    latestInput.current = { values: nextValues, memo: nextMemo };
    ++editVersion.current;
    setSavedAt(null);
    setDraftFailed(false);
    setSubmitError(null);
    setTouched(true);
    setTrialPassed(false);
    // 試しの回答は下書きを送らない
    if (!trial) queueDraft();
  }, [queueDraft, trial]);

  const submit = async (event: { detail: number }) => {
    /* 「内容を確認して提出する」を2回続けて押すと、2回目がこのボタンに当たる（帯の同じ場所に出るため）。
       続けて押した2回目以降（detail が 2 以上）では提出しない。キーボードで押したときの detail は 0。 */
    if (event.detail > 1 || submitLock.current) return;
    if (trial) {
      // 送らずに、保存の受け口と同じ検査だけに当てる（試しで通った答えが、本物の提出で断られないように）
      const check = checkSubmission(questions, normalizeAnswers(questions, answersToSend(latestInput.current.values)));
      setSubmitError(check.ok ? null : check.message);
      setTrialPassed(check.ok);
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    // 待っている下書きの予約は取り消す（提出のあとに届くと「提出済み」で断られるため）
    clearTimeout(timer.current);
    let ok = false;
    try {
      // 押した時点の描画ではなく、いちばん新しい入力を送る（欄を離れた知らせが描き直しより先に届く場合がある）
      const { values: nextValues, memo: nextMemo } = latestInput.current;
      ok = await persist("submitted", nextValues, nextMemo);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
    if (ok) {
      setConfirming(false);
      return;
    }
    // 断られた提出は何も保存していない。取り消した予約の変更が残っていれば、下書きとして保存し直す
    if (savedVersion.current !== editVersion.current) queueDraft();
  };

  const update = useCallback(
    (questionId: string, patch: Partial<AnswerValue>) => {
      const prev = latestInput.current.values;
      const current: AnswerValue = prev[questionId] ?? { questionId, valueNumber: null, valueText: null, valueChoices: null };
      /* 値が変わらない知らせ（同じ数のまま欄を離れた・同じ選択肢を押し直した）では何もしない。
         下書きを予約すると「保存済み」が消え、押そうとしていた提出ボタンが動いていた。 */
      const keys = Object.keys(patch) as (keyof AnswerValue)[];
      if (keys.every((key) => sameAnswerValue(current[key], patch[key]))) return;
      const next = { ...prev, [questionId]: { ...current, ...patch } };
      setValues(next);
      scheduleDraft(next, latestInput.current.memo);
    },
    [scheduleDraft],
  );

  useEffect(() => {
    canSaveDraft.current = !readOnly && !trial;
    if (readOnly) clearTimeout(timer.current);
    return () => {
      canSaveDraft.current = false;
      clearTimeout(timer.current);
    };
  }, [readOnly, trial]);

  /* 確認の欄は画面の下に開く。押した人の目と、読み上げの位置をそこへ移す
     （開いたことに気づかず、もう一度押そうとして帯を探さないように）。 */
  useEffect(() => {
    if (!confirming) return;
    confirmBox.current?.scrollIntoView({ block: "nearest" });
    confirmHeading.current?.focus({ preventScroll: true });
  }, [confirming]);

  const focusNext = (id: string) => {
    const i = fieldOrder.indexOf(id);
    const nextId = fieldOrder[i + 1];
    if (!nextId) return;
    document.getElementById(`f_${nextId}`)?.focus();
  };

  /* 画面の上から下の順に拾う。「例：」には画面で最初に見える未入力の欄を挙げる
     （受け口の断り（checkSubmission）も同じ missingRequired で拾うので、件数も例も同じになる） */
  const missing = missingRequired(questions, answeredQuestion);
  const missingNote = missing.length > 0 ? missingAnswersMessage(missing) : null;

  /* 最初の、未入力の欄へ移る。選ぶ設問は選択肢のまとまり（role=group）に移る */
  const focusFirstMissing = () => {
    const field = missing.length > 0 ? document.getElementById(`f_${missing[0].id}`) : null;
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ block: "center" });
  };

  if (readOnly) {
    return (
      <>
        <ReasonNote>
          {submitted
            ? "提出済みのため編集できません。内容の修正が必要な場合は、上長にご連絡ください。"
            : lockedReason}
        </ReasonNote>
        <div className="mt-4">
          {/* 編集中の値は保持し、提出済み・締切後の表示は最新の保存値を使う。 */}
          <AnswerReadOnly ordered={ordered} values={Object.fromEntries(initial.map((a) => [a.questionId, a]))} />
        </div>
      </>
    );
  }

  /* 帯の状態は事実だけを書く（案内は本文の先頭へ）。
     文の長さが変わっても押す場所は動かない（globals.css の .action-bar-status）。 */
  const saveState = trial
    ? "試しの回答（保存されません）"
    : saving || submitting
    ? "提出しています…"
    : savingDraft
      ? "保存しています…"
      : savedAt
        ? `保存済み ${formatJstTime(savedAt)}`
        : draftFailed
          ? "保存できていません"
          : touched
            ? "保存待ち"
            : null;

  return (
    <FieldGroup disabled={saving || submitting} aria-busy={saving || submitting}>
      {/* 提出の断りは、確認の欄を開いている間はその欄の中に出す（同じ文を2か所に出さない）。
          下書きの失敗は提出の断りではないので、確認の欄には入れず、ここと帯の「保存できていません」に出す */}
      {submitError && !confirming && <ReasonNote>{submitError}</ReasonNote>}
      {draftError && draftError !== submitError && <ReasonNote>{draftError}</ReasonNote>}
      <RefreshStatus
        message={message}
        refreshing={saving}
        target="画面"
        className="m-0 mb-3 text-sub text-brand-deep"
      />
      <p className="footnote m-0 mb-4">
        {trial
          ? "回答者と同じ画面で、数値の入力・選択・提出前の確認を試せます。入力した内容は保存されず、試しに提出しても回答一覧には出ません。"
          : "入力した内容は、1秒ほどで自動で下書きに保存されます。すべて入れたら、画面下の「内容を確認して提出する」から提出します。"}
      </p>

      {ordered.map((g) => (
        <section key={g.section} className="mb-6">
          {/* まとまり（節）ごとに1枚のカード。設問が多い節は縦に長くなるので、頭は固定表示にする。
              帯に載せるのは「いまどの節を答えているか」と「その節の答え方の決まり」の2つだけ。
              後者は一度読めば済む説明ではなく、1問ごとに当てはめて判断する物差しにあたる
              （「自分の担当として行ったものだけ はい」「受講しただけは いいえ」）。
              これが画面の外に出ると、下のほうの設問だけ違う基準で答えてしまう。
              説明文をこれ以上足さないこと（帯が厚くなると回答欄が画面から押し出される）。 */}
          <Card className="card-pad">
            {/* スマートフォンで答える人がいるため、狭い画面でも固定する（narrow）。
                そのとき帯は名前だけの1行に縮み、答え方の決まりは本文の先頭へ回る。 */}
            <CardHead
              pinned
              narrow
              heading
              title={sectionLabel(g.section)}
              sub={SECTION_HELP[g.section]}
            />
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
        {/* ここだけは欄が1つで、書きながら見返す決まりが無い。
            案内文は帯ではなく本文に置く（帯に載せるのは判断の物差しだけ）。 */}
        <Card className="card-pad">
          <CardHead pinned heading title="補足（任意）" />
          <p className="footnote m-0 mb-3">数字だけでは伝わらない事情があれば書いてください。上長が読みます。</p>
          <textarea
            className="input min-h-[96px] w-full"
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value);
              scheduleDraft(latestInput.current.values, e.target.value);
            }}
            placeholder="例：4月に担当が交代したため、前半の実績が少なくなっています。"
          />
        </Card>
      </section>

      {confirming && (
        <div ref={confirmBox}>
          <Card className="card-pad">
            <p ref={confirmHeading} tabIndex={-1} className="todo-row-title m-0">
              {trial ? "この内容で試しに提出します" : "この内容で提出します"}
            </p>
            <p className="todo-row-sub m-0 mt-1">
              {trial
                ? "本物の提出と同じ検査（未入力の欄・数値の範囲）だけを行います。内容は保存しません。"
                : "提出すると自分では変更できなくなります。修正が必要になったときは上長にご連絡ください。"}
            </p>
            {trialPassed && (
              <RefreshStatus
                message="試しの提出は通りました。本物の回答画面では、ここで提出が終わり、回答一覧に「提出済み」で出ます。この内容は保存していません。"
                refreshing={false}
                className="m-0 mt-3 text-sub text-brand-deep"
              />
            )}
            {/* 未入力で断られたときは、下の知らせと同じ文になるので1つだけ出す
                （どちらも missingRequired と missingAnswersMessage から作る） */}
            {submitError && submitError !== missingNote && (
              <div className="mt-3">
                <ReasonNote>{submitError}</ReasonNote>
              </div>
            )}
            {missingNote && (
              <div className="mt-3">
                <ReasonNote
                  action={
                    <Button type="button" onClick={focusFirstMissing}>
                      最初の未入力の欄へ移る
                    </Button>
                  }
                >
                  {missingNote}
                </ReasonNote>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 進み具合・保存状態・締切と、次に押すものを画面下に固定する。
          同じボタンを本文と帯の両方には置かない（押す場所を1つにする）。 */}
      <StickyActionBar
        status={
          <>
            <span className="text-sub text-ink">
              入力できた項目 <span className="num font-bold">{answeredCount}</span>
              <span className="unit"> / {questions.length}</span>
            </span>
            {(saveState || deadlineNote) && <span className="mx-2 text-line">|</span>}
            {saveState}
            {/* 締切は常に見えるところに置く（気づかないまま入力し続けるのを防ぐ） */}
            {deadlineNote && <span className={saveState ? "ml-2" : undefined}>{saveState && "／ "}{deadlineNote}</span>}
          </>
        }
      >
        {confirming ? (
          <>
            <Button disabled={saving || submitting} onClick={() => setConfirming(false)}>入力に戻る</Button>
            {/* 下書きの保存中も押せる（提出は保存の後ろに並び、前の保存を追い越さない。persist） */}
            <Button variant="primary" disabled={saving || submitting} onClick={submit}>
              {trial ? "試しに提出する" : saving || submitting ? "提出しています…" : "提出する"}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            disabled={saving || submitting}
            onClick={() => {
              // 前に開いたときの試しの結果は、押し直すまで出さない
              setTrialPassed(false);
              setConfirming(true);
            }}
          >
            内容を確認して提出する
          </Button>
        )}
      </StickyActionBar>
    </FieldGroup>
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
          <SectionHeading>{sectionLabel(g.section)}</SectionHeading>
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
                      <span className="text-sub font-semibold">{shown}</span>
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

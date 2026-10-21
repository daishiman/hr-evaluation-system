"use client";

import { useState } from "react";
import { updateEvaluation } from "@/actions/evaluations";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button, Card, FieldGroup, OptionCard, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";
import { useSaveAction } from "@/lib/use-refresh";
import {
  commentProblem,
  conclusionText,
  conclusionWord,
  DECISION_REASON_MAX,
  DECISION_SUBJECT_LABEL,
  DECISION_SUBJECTS,
  finalDecision,
  overrideConclusionVerb,
  scoreJudgementText,
  validateDecisionInput,
  type DecisionKind,
  type DecisionSubject,
} from "@/lib/domain/final-decision";

/** 昇給・昇格それぞれの、点数の判定と保存済みの判断 */
export interface DecisionSubjectProps {
  /** 点数の判定（true ＝ 可） */
  scoreJudgement: boolean;
  /** 点数の判定の短い理由（shortJudgementReason） */
  shortReason: string;
  /** 確定を戻した評価に残っている判断。初めて確定する評価では null（どちらも選ばれていない） */
  saved: DecisionKind | null;
  savedReason: string | null;
}

const FINALIZE_BLOCKED_ID = "ev_finalize_blocked";

/**
 * 上長のコメント、昇給・昇格への上司の判断、確定／確認中に戻す操作。
 * 確定は本人に公開される不可逆に近い操作なので確認を1回挟む。ただし戻せる（差し戻し）。
 *
 * 上司の判断（DD-024・qa-y10 (20)）は確定のボタンの前に置く。
 * 押せるかどうかはサーバーと同じ validateDecisionInput・commentProblem で決め、
 * 押せないあいだは最初の問題を1行で出す（サーバーだけで断ると、押してから理由を知ることになる）。
 */
export function EvaluatorPanel({
  evaluationId,
  status,
  comment,
  employeeName,
  decisions,
  behaviorAspects,
  blockedReason = null,
}: {
  evaluationId: string;
  status: string;
  comment: string;
  employeeName: string;
  decisions: Record<DecisionSubject, DecisionSubjectProps>;
  /** 理由の入力欄の上に添える、行動指針の観点の名前 */
  behaviorAspects: string[];
  /** 手を入れられない理由。渡されたら操作は出さず、理由だけを出す（自分自身の評価など）。 */
  blockedReason?: string | null;
}) {
  /* 保存の応答に保存後の画面が同梱されるので、別に取り直しを頼まない。
     saving は「保存して画面に出し終えるまで」の間ずっと true。 */
  const { save, saving } = useSaveAction(updateEvaluation, { resource: "evaluations" });
  const [text, setText] = useState(comment);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<DecisionSubject, DecisionKind | null>>({
    raise: decisions.raise.saved,
    promotion: decisions.promotion.saved,
  });
  const [reasons, setReasons] = useState<Record<DecisionSubject, string>>({
    raise: decisions.raise.savedReason ?? "",
    promotion: decisions.promotion.savedReason ?? "",
  });
  const finalized = status === "finalized";

  const decisionInput = {
    raiseDecision: choice.raise,
    raiseDecisionReason: reasons.raise,
    promotionDecision: choice.promotion,
    promotionDecisionReason: reasons.promotion,
  };
  const check = validateDecisionInput(decisionInput);
  // 押せない理由は1行だけ。ボタンのすぐ上にある判断の欄を先に、その上のコメントを後に見る
  const finalizeBlocked = (check.ok ? null : check.problems[0]) ?? commentProblem(text);

  const saveComment = async () => {
    setError(null);
    setSaved(null);
    const result = await save({ evaluationId, action: "comment", comment: text });
    if (!result.ok) {
      // 入力欄はそのまま残す（直して押し直せるように）
      setError(result.message);
      return;
    }
    setSaved(result.message);
  };

  const finalize = async () => {
    setError(null);
    setSaved(null);
    const result = await save({ evaluationId, action: "finalize", comment: text, ...decisionInput });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSaved(result.message);
  };

  if (blockedReason) {
    return (
      <Card className="card-pad">
        <ReasonNote>{blockedReason}</ReasonNote>
        <p className="footnote m-0 mt-2">
          {status === "finalized"
            ? "この評価は確定済みです。内容は上の欄でそのまま確認できます。"
            : "この評価はまだ確認中です。確定されると、あなたの「自分の評価」の画面に結果が出ます。"}
        </p>
      </Card>
    );
  }

  const conclusions = DECISION_SUBJECTS.map((subject) =>
    conclusionText(subject, finalDecision(decisions[subject].scoreJudgement, choice[subject])),
  ).join("／");

  return (
    <Card className="card-pad">
      {error && (
        <ReasonNote>
          {/* サーバーは問題を1件1行で返す */}
          <span className="whitespace-pre-line">{error}</span>
        </ReasonNote>
      )}

      <label className="m-0 block text-sub font-bold" htmlFor="ev_comment">
        本人に伝えるコメント
      </label>
      <p className="footnote m-0 mb-2">確定すると、この文章が本人の結果画面に表示されます。</p>
      <textarea
        id="ev_comment"
        className="input min-h-[88px] w-full"
        value={text}
        disabled={saving}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(null);
        }}
        placeholder="例：未達の項目について、期首に分母と行動計画をすり合わせましょう。"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button onClick={() => void saveComment()} disabled={saving}>
          {saving ? "保存しています…" : "コメントを保存する"}
        </Button>
        <RefreshStatus message={saved} refreshing={saving} target="画面" className="footnote" />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {finalized ? (
          <>
            <p className="m-0 mb-2 text-sub">
              この評価は確定済みです。{employeeName} さんの画面に結果が表示されています。
            </p>
            <ActionButton
              action={updateEvaluation}
              resource="evaluations"
              input={{ evaluationId, action: "reopen" }}
              label="確認中に戻す"
              variant="secondary"
              confirm={`確認中に戻すと、${employeeName} さんの画面から結果が見えなくなります。上司の判断は残ります。よろしいですか？`}
            />
          </>
        ) : (
          <>
            <FieldGroup legend="上司の判断" bodyClassName="grid gap-4">
              <p className="footnote m-0 -mb-1">
                昇給と昇格のそれぞれについて、点数の判定どおりにするか、変えるかを選んでください。
              </p>
              {DECISION_SUBJECTS.map((subject) => (
                <DecisionField
                  key={subject}
                  subject={subject}
                  facts={decisions[subject]}
                  choice={choice[subject]}
                  reason={reasons[subject]}
                  behaviorAspects={behaviorAspects}
                  disabled={saving}
                  onChoose={(kind) => setChoice((c) => ({ ...c, [subject]: kind }))}
                  onReason={(value) => setReasons((r) => ({ ...r, [subject]: value }))}
                />
              ))}
            </FieldGroup>

            <p className="m-0 mb-2 mt-5 text-sub">
              内容を確認したら確定してください。確定すると {employeeName} さんの画面に結果が表示されます。
            </p>
            <ConfirmButton
              label="確定して本人に公開する"
              busy={saving}
              busyLabel="確定しています…"
              disabled={finalizeBlocked !== null}
              describedBy={finalizeBlocked ? FINALIZE_BLOCKED_ID : undefined}
              confirm={`${employeeName} さんの評価を確定し、本人に公開します（${conclusions}）。あとから「確認中に戻す」で取り消せます。`}
              onConfirm={() => void finalize()}
            />
            {finalizeBlocked && (
              <p id={FINALIZE_BLOCKED_ID} className="footnote m-0 mt-1 text-danger">
                {finalizeBlocked}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/** 昇給・昇格の片方の判断の欄 */
function DecisionField({
  subject,
  facts,
  choice,
  reason,
  behaviorAspects,
  disabled,
  onChoose,
  onReason,
}: {
  subject: DecisionSubject;
  facts: DecisionSubjectProps;
  choice: DecisionKind | null;
  reason: string;
  behaviorAspects: string[];
  disabled: boolean;
  onChoose: (kind: DecisionKind) => void;
  onReason: (value: string) => void;
}) {
  const label = DECISION_SUBJECT_LABEL[subject];
  const verb = overrideConclusionVerb(facts.scoreJudgement);
  const reasonId = `ev_decision_reason_${subject}`;
  const noticeId = `${reasonId}_notice`;
  const length = reason.trim().length;
  return (
    <FieldGroup legend={label}>
      <p className="m-0 text-sub">
        {scoreJudgementText(facts.scoreJudgement)}
        <span className="text-ink-muted">（{facts.shortReason}）</span>
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <OptionCard
          title="点数の判定どおりにする"
          sub={`${label}：${conclusionWord(facts.scoreJudgement)}`}
          selected={choice === "follow"}
          disabled={disabled}
          onClick={() => onChoose("follow")}
        />
        <OptionCard
          title="変える"
          sub={`${label}を${verb}`}
          selected={choice === "override"}
          disabled={disabled}
          onClick={() => onChoose("override")}
        />
      </div>
      {choice === "override" && (
        <div className="mt-3">
          <p className="m-0 text-sub font-bold">
            結論：{label}を{verb}（上司の判断）
          </p>
          <label className="mt-2 block text-sub" htmlFor={reasonId}>
            {label}を変える理由
          </label>
          <p id={noticeId} className="footnote m-0 mb-1">
            この文は本人にもそのまま見えます。性格ではなく、行動や事実で書いてください。
            {behaviorAspects.length > 0 && <>行動指針の観点：{behaviorAspects.join("・")}</>}
          </p>
          <textarea
            id={reasonId}
            className="input min-h-[88px] w-full"
            value={reason}
            disabled={disabled}
            aria-describedby={noticeId}
            onChange={(e) => onReason(e.target.value)}
            placeholder="例：期の後半に、担当顧客の引き継ぎを期限までに終えられなかった。"
          />
          <p className="footnote m-0 text-right">
            {length}／{DECISION_REASON_MAX}字
          </p>
        </div>
      )}
    </FieldGroup>
  );
}

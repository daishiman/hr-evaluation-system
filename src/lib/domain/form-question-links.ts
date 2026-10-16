/**
 * アンケートの設問の「集計との紐づけ」を、保存のときにサーバーが確かめる（DD-015）。
 *
 * 紐づけ（等級要件・昇格要件・行動指針・KPI 項目と設問の key）と昇格の必須要件の印は、
 * 設問を作り直すときにサーバーが制度の設定から書く値で、組み立て画面は引き継ぐだけで作らない。
 * 点数の計算（evaluate.ts）はこの値をそのまま読むので、保存の要求に入っていた値を信じると、
 * 自由設問が昇格の必須要件になったり、別の会社の要件の id が入ったりする。
 * そこで、保存済みの同じ設問（同じ id）の値と同じものだけを受け付け、新しい設問には紐づけを許さない。
 *
 * 紐づけのある設問は、まとまりと答え方も変えさせない。
 * 点数の計算は答え方で値の読み方を決め（はい/いいえ・数値・選択肢の点数）、
 * 昇格の必須要件の種類をまとまりで決めるため、変えると集計から黙って外れる。
 */

export type QuestionLinks = {
  gradeRequirementId: string | null;
  promotionRequirementId: string | null;
  behaviorGuidelineId: string | null;
  kpiItemId: string | null;
  kpiQuestionKey: string | null;
  isGate: boolean;
};

export type StoredQuestion = QuestionLinks & { id: string; section: string; questionType: string };

export type SubmittedQuestion = {
  [K in keyof QuestionLinks]?: QuestionLinks[K] | null;
} & { id?: string; title: string; section: string; questionType: string };

/** keep: 送られた id で保存する ／ fresh: この版に無い id なので新しい id を振る */
export type QuestionIdPlan = "keep" | "fresh";

export type QuestionLinkCheck = { ok: true; ids: QuestionIdPlan[] } | { ok: false; message: string };

const RELOAD = "画面を読み込み直してから、もう一度保存してください。";

function linksOf(q: SubmittedQuestion | StoredQuestion): QuestionLinks {
  return {
    gradeRequirementId: q.gradeRequirementId ?? null,
    promotionRequirementId: q.promotionRequirementId ?? null,
    behaviorGuidelineId: q.behaviorGuidelineId ?? null,
    kpiItemId: q.kpiItemId ?? null,
    kpiQuestionKey: q.kpiQuestionKey ?? null,
    isGate: q.isGate ?? false,
  };
}

/** 集計に使う設問か（紐づけか昇格の必須要件の印が1つでもある） */
export function isLinkedQuestion(q: SubmittedQuestion | StoredQuestion): boolean {
  const l = linksOf(q);
  return (
    l.isGate ||
    [l.gradeRequirementId, l.promotionRequirementId, l.behaviorGuidelineId, l.kpiItemId, l.kpiQuestionKey].some(
      (v) => v !== null,
    )
  );
}

function sameLinks(a: QuestionLinks, b: QuestionLinks): boolean {
  return (Object.keys(a) as (keyof QuestionLinks)[]).every((k) => a[k] === b[k]);
}

/**
 * 送られた設問の並びを、保存済みの設問（この版のもの）と突き合わせる。
 * 通れば、設問ごとに id をそのまま使うか新しく振るかを返す。
 */
export function checkQuestionLinks(
  submitted: readonly SubmittedQuestion[],
  stored: readonly StoredQuestion[],
): QuestionLinkCheck {
  const byId = new Map(stored.map((q) => [q.id, q]));
  const seen = new Set<string>();
  const ids: QuestionIdPlan[] = [];
  for (const q of submitted) {
    // 同じ id が2つあると、紐づけが写されて同じ要件が2回数えられる。画面はこう送らない
    if (q.id !== undefined) {
      if (seen.has(q.id)) return { ok: false, message: `同じ設問が2回送られています（「${q.title}」）。${RELOAD}` };
      seen.add(q.id);
    }
    const prev = q.id === undefined ? undefined : byId.get(q.id);
    if (!prev) {
      if (isLinkedQuestion(q)) {
        return {
          ok: false,
          message: `「${q.title}」の集計との紐づけが、いまのアンケートの設問と合いません。別の画面で設問が作り直された可能性があります。${RELOAD}`,
        };
      }
      // 新しい設問と、この版に無い id（別の版や別の会社の設問の id。主キーがぶつかる）には新しい id を振る
      ids.push("fresh");
      continue;
    }
    if (!sameLinks(linksOf(q), linksOf(prev))) {
      return { ok: false, message: `「${q.title}」の集計との紐づけは、この画面では変えられません。${RELOAD}` };
    }
    if (isLinkedQuestion(prev) && (q.section !== prev.section || q.questionType !== prev.questionType)) {
      return {
        ok: false,
        message: `「${q.title}」は集計に使う設問なので、まとまりと答え方は変えられません。変えるときは、制度の設定を直してから設問を作り直してください。`,
      };
    }
    ids.push("keep");
  }
  return { ok: true, ids };
}

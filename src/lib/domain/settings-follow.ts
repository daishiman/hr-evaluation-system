/**
 * 設定を保存したあと、アンケートと評価のどちらを追従させるか（DD-028 の4）と、結果の文。
 *
 * アンケートは設定の写し（form-build.ts）なので、設問の元になる設定を直したら写し直す。
 * 評価は回答といまの設定から計算する（evaluate.ts）ので、判定に効く設定を直したら集計し直す。
 * 「判定に効く設定」は、集計し直しの警告（impact.ts の WATCHED）と同じ5つにそろえる。
 * 等級要件・昇格要件・行動指針は、評価もアンケートの写しを読むので、評価は集計し直さない。
 *
 * 実際に DB を読み書きするのは src/lib/masters/follow-settings.ts。ここは決め事と文だけを持つ。
 */

/** 保存の種類。制度マスタの kind（body-schema.ts）と、評価セットの保存 */
export const FOLLOW_KINDS = [
  "grade",
  "threshold",
  "raise",
  "raisePolicy",
  "office",
  "gradeRequirementCreate",
  "gradeRequirementRevise",
  "gradeRequirementActivation",
  "gradeRequirementRestoreContent",
  "gradeRequirementOrder",
  "promotionRequirementCreate",
  "promotionRequirementRevise",
  "promotionRequirementActivation",
  "promotionRequirementRestoreContent",
  "promotionRequirementOrder",
  "behaviorBandSet",
  "behaviorGuideline",
  "behaviorLevel",
  "rankCriteria",
  "rankCriteriaSet",
  "kpiCategoryCreate",
  "kpiItemCreate",
  "kpiItemUpdate",
  "scheme",
] as const;

export type FollowKind = (typeof FOLLOW_KINDS)[number];

export interface FollowTargets {
  /** 締め切っていないアンケートを、いまの設定に追従させる */
  forms: boolean;
  /** 確定前の評価を集計し直す */
  evaluations: boolean;
}

const FORMS: FollowTargets = { forms: true, evaluations: false };
const EVALUATIONS: FollowTargets = { forms: false, evaluations: true };
const BOTH: FollowTargets = { forms: true, evaluations: true };
const NONE: FollowTargets = { forms: false, evaluations: false };

/**
 * 種類ごとの追従先。
 * - 等級は、行動指針の基準セットの割り当てで設問が変わる。点の区分（pointGroup）はこの保存では変わらない
 * - 新しい KPI 項目は、評価セットで選ぶまで設問にも点にも出ない
 * - 昇給・賞与の方針と事業所は、設問にも評価の計算にも使わない（賞与の1点あたりの金額はこの保存では変わらない）
 */
export const FOLLOW_TARGETS: Record<FollowKind, FollowTargets> = {
  grade: FORMS,
  threshold: EVALUATIONS,
  raise: NONE,
  raisePolicy: NONE,
  office: NONE,
  gradeRequirementCreate: FORMS,
  gradeRequirementRevise: FORMS,
  gradeRequirementActivation: FORMS,
  gradeRequirementRestoreContent: FORMS,
  gradeRequirementOrder: FORMS,
  promotionRequirementCreate: FORMS,
  promotionRequirementRevise: FORMS,
  promotionRequirementActivation: FORMS,
  promotionRequirementRestoreContent: FORMS,
  promotionRequirementOrder: FORMS,
  behaviorBandSet: FORMS,
  behaviorGuideline: FORMS,
  behaviorLevel: FORMS,
  rankCriteria: EVALUATIONS,
  rankCriteriaSet: EVALUATIONS,
  kpiCategoryCreate: NONE,
  kpiItemCreate: NONE,
  kpiItemUpdate: BOTH,
  scheme: BOTH,
};

/** 1回の保存で触った種類の追従先を合わせる（アンケートからの反映は、行動指針と KPI を同時に直すことがある） */
export function followTargetsOf(kinds: readonly FollowKind[]): FollowTargets {
  return {
    forms: kinds.some((kind) => FOLLOW_TARGETS[kind].forms),
    evaluations: kinds.some((kind) => FOLLOW_TARGETS[kind].evaluations),
  };
}

/** 追従できなかったもの。name が null のときは、どれか1つでなく追従そのものが止まった */
export interface FollowFailure {
  name: string | null;
  reason: string;
}

export interface FollowOutcome {
  /** 作り直した回答の無い下書き（題名） */
  rebuilt: readonly string[];
  /** 回答のある公開中のアンケートから作った次の版（題名） */
  nextVersions: readonly string[];
  /** 集計し直した確定前の評価（社員の名前） */
  evaluations: readonly string[];
  formFailures: readonly FollowFailure[];
  evaluationFailures: readonly FollowFailure[];
}

/** 一覧で見分けるための題名。2版目からは版を添える（同じ期・等級の版は題名が同じになるため） */
export function followFormName(title: string, version: number): string {
  return version >= 2 ? `${title} 第${version}版` : title;
}

const list = (names: readonly string[]) => `${names.length}件: ${names.join("、")}`;

const failures = (items: readonly FollowFailure[]) =>
  `${items.length}件: ${items.map((f) => (f.name ? `${f.name}（${f.reason}）` : f.reason)).join("、")}`;

/**
 * 保存の結果の文に続ける、追従の文。何も追従しなかったときは空。
 * 件数と名前を省かずに出す。名前が無いと、どのアンケートを確かめればよいか分からないため。
 * 追従が失敗しても設定の保存は戻さないので、失敗は「できなかった」と直し方を添えて出す。
 */
export function followMessage(outcome: FollowOutcome): string {
  const parts: string[] = [];
  if (outcome.rebuilt.length > 0) {
    parts.push(`回答の無い下書きのアンケートを作り直しました（${list(outcome.rebuilt)}）。`);
  }
  if (outcome.nextVersions.length > 0) {
    parts.push(`回答のあるアンケートに次の版の下書きを作りました（${list(outcome.nextVersions)}）。公開は内容を確かめてから行ってください。`);
  }
  if (outcome.formFailures.length > 0) {
    parts.push(
      `アンケートをいまの設定に合わせられませんでした（${failures(outcome.formFailures)}）。アンケートの画面で設問を作り直すか、新しい版を作ってください。`,
    );
  }
  if (outcome.evaluations.length > 0) {
    parts.push(`確定前の評価を集計し直しました（${list(outcome.evaluations)}）。上司のコメントと判断はそのまま残しています。`);
  }
  if (outcome.evaluationFailures.length > 0) {
    parts.push(
      `評価を集計し直せませんでした（${failures(outcome.evaluationFailures)}）。評価期間の画面の「いまの基準で集計し直す」から集計し直してください。`,
    );
  }
  return parts.join("");
}

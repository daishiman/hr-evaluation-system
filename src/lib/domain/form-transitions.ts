/**
 * アンケートの状態ごとに、許す操作を1か所で決める（qa-y10-y16 の16）。
 *
 * これまでは、公開・締め切り（updateForm）・本人ごとの期限の延長（form-extensions）・
 * 催促の文面（回答一覧）・一覧と1本の画面のボタンが、それぞれ forms.status を見て別々に決めていた。
 * そのため「締め切ったアンケートを公開中に戻す」「下書きを締め切る」が API では通り、
 * 延長の断りの文は、画面に無い操作（公開中に戻す）を案内していた。
 * 画面（どのボタンを出すか）と API（どの変更を受けるか）が同じ答えを使うよう、ここに集める。
 *
 * 状態の流れは一方向: 下書き → 公開中 → 締め切り済み。戻す向きと、飛ばす向きは無い。
 *  - 締め切ったあとにもう一度回答を集めるときは、新しい版を作って公開する。
 *  - 締切日を過ぎても受け付けたい人がいるときは、締め切らずに（公開中のまま）本人ごとに期限を延ばす。
 * 画面は、ここが false を返した操作のボタンを出さない。API は同じ答えで断り、断る文はここが返す。
 * 断る文は、画面にある操作だけを案内する（無い操作へ誘うと、読んだ人が行き止まりになる）。
 */

import { jstDateKey } from "./jst";

export type FormStatus = "draft" | "published" | "closed";

const FORM_STATUSES: readonly string[] = ["draft", "published", "closed"];

function isFormStatus(state: string): state is FormStatus {
  return FORM_STATUSES.includes(state);
}

/** 締切まわりの前提（判定の基準時刻を含む） */
export interface FormDeadline {
  /** forms.closes_at（YYYY-MM-DD）。null は期限なし。その日いっぱいまで回答できる（form-deadline.ts と同じ読み方） */
  closesAt: string | null;
  /** 判定の基準時刻。日付は日本時間で読む */
  now: Date;
  /** evaluation_cycles.status。closed（評価期間の終了）なら、回答を集め直す操作を出さない。省略は終了していない扱い */
  cycleStatus?: string | null;
}

/** その状態で許す操作。true の操作だけを画面に出し、API も受ける */
export interface FormTransitions {
  /** 公開する（下書き → 公開中） */
  publish: boolean;
  /** 締め切る（公開中 → 締め切り済み） */
  close: boolean;
  /** 本人ごとに回答期限を延ばす */
  extend: boolean;
  /** 未回答の人へ送る催促の文面を出す */
  remind: boolean;
  /** 配布用のURLを出す */
  share: boolean;
  /** 回答期間（受付の開始日・締切日）を直す */
  editPeriod: boolean;
  /** タイトル・説明文・設問を直す、いまの制度から作り直す */
  editContent: boolean;
  /** 同じ等級の新しい版を下書きで作る */
  newVersion: boolean;
}

const NONE: FormTransitions = {
  publish: false,
  close: false,
  extend: false,
  remind: false,
  share: false,
  editPeriod: false,
  editContent: false,
  newVersion: false,
};

/** 全体の締切（延長を含まない）を過ぎたか。期限なしは過ぎない */
export function isPastDeadline(deadline: FormDeadline): boolean {
  return deadline.closesAt !== null && jstDateKey(deadline.now) > deadline.closesAt;
}

/**
 * その状態で許す操作を返す。
 *
 * | 状態 | 許す操作 |
 * |---|---|
 * | 下書き（回答なし） | 公開する・回答期間・内容を直す（作り直す） |
 * | 下書き（回答あり） | 公開する・回答期間・新しい版 |
 * | 公開中（締切前） | 締め切る・延長・催促・配布URL・回答期間・新しい版 |
 * | 公開中（締切後） | 締め切る・延長・配布URL・回答期間・新しい版（催促は期限が過去になるので出さない） |
 * | 締め切り済み | 新しい版だけ |
 *
 * 評価期間が終了しているときは、延長・催促・新しい版も出さない（回答を保存できず、版も作れないため）。
 * 知らない状態は何も許さない（fail-closed）。
 */
export function formTransitions(state: string, deadline: FormDeadline, hasResponses: boolean): FormTransitions {
  const cycleOpen = deadline.cycleStatus !== "closed";
  switch (state) {
    case "draft":
      // 回答の無い下書きは、その場で直せる（新しい版を重ねない）。回答のある下書き（取り込みなど）は内容を守る
      return { ...NONE, publish: true, editPeriod: true, editContent: !hasResponses, newVersion: hasResponses && cycleOpen };
    case "published":
      return {
        ...NONE,
        close: true,
        extend: cycleOpen,
        remind: cycleOpen && !isPastDeadline(deadline),
        share: true,
        editPeriod: true,
        newVersion: cycleOpen,
      };
    case "closed":
      return { ...NONE, newVersion: cycleOpen };
    default:
      return { ...NONE };
  }
}

/** 新しい版を作るボタンの札（一覧と1本の画面で同じ札にする） */
export const NEW_VERSION_LABEL = "新しい版を作る";

/** 評価期間の終了後は、記録を残して案内を止める。 */
const CYCLE_ENDED = "この評価期間は終了しているため、新しい版は作れません。提出済みの回答はそのまま残っています。";

/** 締め切ったあとに回答を集め直す道。画面の「新しい版を作る」に当たる */
const COLLECT_AGAIN = "もう一度回答を集めるときは、新しい版を作って公開してください。";

/** 状態の変更を断る文。行き先ごと（今の状態 → 行き先） */
const STATUS_CHANGE_REFUSALS: Record<FormStatus, Partial<Record<FormStatus, string>>> = {
  draft: {
    draft: "このアンケートはすでに下書きです。",
    closed: "まだ公開していないアンケートは締め切れません。配らないときは、下書きのまま置いておけます。",
  },
  published: {
    draft: "公開済みのアンケートは下書きに戻せません。",
    published: "このアンケートはすでに公開中です。",
  },
  closed: {
    draft: "締め切ったアンケートは下書きに戻せません。",
    published: "締め切ったアンケートは公開中に戻せません。",
    closed: "このアンケートはすでに締め切っています。",
  },
};

function unknownStateRefusal(state: string): string {
  return `このアンケートの状態（${state}）では、この操作はできません。画面を読み込み直してください。`;
}

/**
 * 状態の変更（公開する・締め切る）を断る文。通すときは null。
 * 通すかどうかは formTransitions の publish・close だけで決める（画面のボタンと同じ答え）。
 */
export function statusChangeRefusal(from: string, to: FormStatus, allowed: FormTransitions): string | null {
  if ((to === "published" && allowed.publish) || (to === "closed" && allowed.close)) return null;
  if (!isFormStatus(from)) return unknownStateRefusal(from);
  const reason = STATUS_CHANGE_REFUSALS[from][to];
  if (!reason) return unknownStateRefusal(from);
  if (to === "draft" && from !== "draft") {
    return reason + (allowed.newVersion ? "内容を変えるときは、新しい版を作って公開してください。" : CYCLE_ENDED);
  }
  if (from === "closed" && to === "published") {
    return reason + (allowed.newVersion
      ? COLLECT_AGAIN + "締切を過ぎた方にだけ答えてもらうこともできます。締め切らずに回答一覧から本人ごとに期限を延ばします。"
      : CYCLE_ENDED);
  }
  return reason;
}

/** 状態の変更のほかに、断る理由を返す操作 */
export type GatedFormOperation = "extend" | "remind" | "editPeriod";

/** 状態で断る文。どの締切・評価期間でも断る組だけを持つ */
const STATE_REFUSALS: Record<GatedFormOperation, Partial<Record<FormStatus, string>>> = {
  extend: {
    draft: "このアンケートはまだ公開されていません。公開してから期限を延ばしてください。",
    closed: "締め切ったアンケートは期限を延ばせません。",
  },
  remind: {
    draft: "まだ公開していないため、催促の文面は出しません。公開すると、ここに出ます。",
    closed: "締め切ったため、催促の文面は出しません。提出済みの回答はそのまま残っています。",
  },
  editPeriod: {
    closed: "締め切ったアンケートは回答期間を変えられません。",
  },
};

/** 評価期間の終了で断る文（公開中のアンケートでも断る） */
const CYCLE_CLOSED_REFUSALS: Record<GatedFormOperation, string> = {
  extend: "この評価期間は終了しているため、期限を延ばせません。",
  remind: "この評価期間は終了しているため、催促の文面は出しません。",
  editPeriod: "この評価期間は終了しているため、回答期間を変えられません。",
};

/** 公開中で締切を過ぎたときの催促（ほかの操作は締切で断らない） */
const REMIND_PAST_DEADLINE =
  "回答期限を過ぎたため、催促の文面は出しません。間に合わなかった方には、下の「回答期限の延長」で本人ごとに期限を延ばせます。";

/**
 * 延長・催促・回答期間の変更を断る文。許すときは null。
 * 許すかどうかは formTransitions と同じ答え。画面では、出さない操作の代わりにこの1行を出す。
 */
export function operationRefusal(
  operation: GatedFormOperation,
  state: string,
  deadline: FormDeadline,
  hasResponses: boolean,
): string | null {
  const allowed = formTransitions(state, deadline, hasResponses);
  if (allowed[operation]) return null;
  if (!isFormStatus(state)) return unknownStateRefusal(state);
  const byState = STATE_REFUSALS[operation][state];
  if (byState) {
    if (state === "closed" && operation !== "remind") {
      return byState + (allowed.newVersion ? COLLECT_AGAIN : CYCLE_ENDED);
    }
    return byState;
  }
  if (deadline.cycleStatus === "closed") return CYCLE_CLOSED_REFUSALS[operation];
  // ここに来るのは、公開中で締切を過ぎた催促だけ（延長と回答期間は、公開中なら締切で断らない）
  return REMIND_PAST_DEADLINE;
}

/** 内容を変える3つの操作は許可判定を共有し、操作に合った理由・案内を返す。 */
export type FormContentOperation = "text" | "questions" | "rebuild";

const CONTENT_RESPONSE_REFUSALS: Record<FormContentOperation, string> = {
  text: "このアンケートにはすでに回答があるため、タイトルと説明文を変更できません。",
  questions: "このアンケートにはすでに回答があるため、設問を変更できません。",
  rebuild: "このアンケートにはすでに回答があるため、設問を作り直せません。",
};

export function contentEditRefusal(
  operation: FormContentOperation,
  form: { status: string; title: string },
  allowed: FormTransitions,
): string | null {
  if (allowed.editContent) return null;
  if (!isFormStatus(form.status)) return unknownStateRefusal(form.status);
  if (form.status === "draft") {
    const guidance = operation === "rebuild"
      ? "いまの評価項目に合わせるときは、新しい版を作って公開してください。"
      : "内容を変えるときは新しい版を作ってください。";
    return CONTENT_RESPONSE_REFUSALS[operation] + (allowed.newVersion ? guidance : CYCLE_ENDED);
  }
  const subject = form.title.trim() ? `「${form.title.trim()}」` : "このアンケート";
  const state = form.status === "published" ? "公開中" : "締め切り済み";
  return `${subject}は${state}のため、内容を変更できません。` + (allowed.newVersion
    ? "いまの評価項目で聞き直すときは、新しい版を作ってください。このアンケートの画面の「新しい版を作る」から作れます。"
    : CYCLE_ENDED);
}

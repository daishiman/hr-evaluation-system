/**
 * アンケートの「いま回答できるか」の判定。
 *
 * これまで opens_at / closes_at は保存され、画面に「回答期間」と出ていたのに、
 * どこでも判定に使っていなかった（締切後でも保存できていた）。
 * 判定をここ1箇所の純関数に集め、画面（ボタンを出すか）とAPI（保存を受けるか）の
 * 両方が同じ答えを使うようにする。ボタンを消すだけの対策は、URLを直接叩かれると効かない。
 *
 * 決めたこと（境界の扱い）:
 *  - closes_at は「その日いっぱい」。2026-09-30 が期限なら 9月30日の23:59まで回答できる。
 *    非エンジニアが「9月30日まで」と読んだときの受け取り方に合わせる。
 *    「9月30日 0:00 で締切」にすると、期限日に回答した人が弾かれて問い合わせになる。
 *  - opens_at も同じく「その日から」。2026-04-01 なら 4月1日の0:00から回答できる。
 *  - どちらも日付だけの文字列（YYYY-MM-DD）で、時刻を持たない。
 *
 * 決めたこと（時間帯）:
 *  - Cloudflare Workers の実行環境は UTC で動く。new Date() をそのまま
 *    toISOString().slice(0,10) すると、日本時間の朝9時までは「前日」と判定され、
 *    締切日の朝に回答した人が1日早く締め出される／1日多く回答できてしまう。
 *  - 利用者も期限も日本国内なので、判定は日本時間（UTC+9）の「今日の日付」で行う。
 *    サーバーの時間帯設定に依存しないよう、UTCのミリ秒に +9時間して日付を取り出す。
 */

/** 日本時間の時差（分）。夏時間が無いので固定値でよい。 */
const JST_OFFSET_MINUTES = 9 * 60;

/** ある瞬間の「日本時間での日付」を YYYY-MM-DD で返す。 */
export function jstDateString(now: Date): string {
  const shifted = new Date(now.getTime() + JST_OFFSET_MINUTES * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 「2026-09-30」を「2026年9月30日」にする（画面文言用）。読めない値はそのまま返す。 */
export function formatJpDate(v: string | null | undefined): string {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return v;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

export type DeadlineState =
  /** まだ公開されていない（下書き） */
  | "not_published"
  /** 管理者が締め切った（forms.status = closed） */
  | "closed_by_admin"
  /** 回答期間の開始前 */
  | "before_open"
  /** 回答期間内 */
  | "open"
  /** 全体の期限は過ぎているが、この人だけ延長されている */
  | "extended"
  /** 期限を過ぎた */
  | "past_deadline";

export interface DeadlineInput {
  /** forms.status（draft | published | closed） */
  status: string;
  /** forms.opens_at（YYYY-MM-DD）。null なら開始日の制限なし */
  opensAt: string | null;
  /** forms.closes_at（YYYY-MM-DD）。null なら期限なし */
  closesAt: string | null;
  /**
   * この人に与えられている延長期限（YYYY-MM-DD）のうち、取り消されていないもの。
   * 複数あれば一番遅い日を使う（延長の取り消しは行を消さずに revoked_at を立てるため、
   * 呼び出し側で revoked_at が入っていない行だけを渡すこと）。
   */
  extensions?: (string | null | undefined)[];
  /** 判定の基準時刻 */
  now: Date;
}

export interface DeadlineJudgement {
  /** 新しく回答・修正を保存してよいか */
  canAnswer: boolean;
  state: DeadlineState;
  /** 実際に効いている期限（延長込み）。null なら期限なし */
  effectiveUntil: string | null;
  /** 延長によって回答できている状態か */
  extended: boolean;
  /** 画面にもAPIのエラーにもそのまま出せる日本語。「何が起きたか＋どうすればよいか」を書く */
  message: string;
}

/** 取り消されていない延長のうち、一番遅い日付を返す。 */
function latestExtension(extensions: (string | null | undefined)[] | undefined): string | null {
  const days = (extensions ?? []).filter((x): x is string => typeof x === "string" && x.trim() !== "");
  if (days.length === 0) return null;
  // YYYY-MM-DD は文字列のまま比較しても日付順になる
  return days.reduce((max, d) => (d > max ? d : max));
}

/**
 * いま回答できるかを判定する。
 * 画面（回答フォームを出すか）とAPI（保存を受けるか）で必ず同じものを使う。
 */
export function judgeFormDeadline(input: DeadlineInput): DeadlineJudgement {
  const today = jstDateString(input.now);
  const extension = latestExtension(input.extensions);
  // 延長は「全体の期限より後ろ」にだけ効く。全体の期限より前の延長日を渡されても期限を縮めない
  const effectiveUntil =
    input.closesAt && extension ? (extension > input.closesAt ? extension : input.closesAt) : (extension ?? input.closesAt ?? null);
  const extendedBeyondClose = Boolean(input.closesAt && extension && extension > input.closesAt);

  if (input.status === "draft") {
    return {
      canAnswer: false,
      state: "not_published",
      effectiveUntil,
      extended: false,
      message: "このアンケートはまだ準備中です。公開されるとこの画面から回答できます。開始時期は会社からお知らせがあります。",
    };
  }

  if (input.status === "closed") {
    return {
      canAnswer: false,
      state: "closed_by_admin",
      effectiveUntil,
      extended: false,
      message:
        "このアンケートは締め切られました。提出済みの回答はそのまま残っています。事情があって回答できなかった場合は、上長または会社の管理者にご連絡ください。本人ごとに期限を延ばすことができます。",
    };
  }

  if (input.opensAt && today < input.opensAt) {
    return {
      canAnswer: false,
      state: "before_open",
      effectiveUntil,
      extended: false,
      message: `このアンケートは${formatJpDate(input.opensAt)}から回答できます。その日になったら、この画面から入力してください。`,
    };
  }

  // 期限は「その日いっぱい」。today === effectiveUntil はまだ回答できる
  if (effectiveUntil && today > effectiveUntil) {
    return {
      canAnswer: false,
      state: "past_deadline",
      effectiveUntil,
      extended: false,
      message: `回答期限（${formatJpDate(effectiveUntil)}）を過ぎたため、保存できません。事情があって間に合わなかった場合は、上長または会社の管理者にご連絡ください。本人ごとに期限を延ばすことができます。`,
    };
  }

  if (extendedBeyondClose) {
    return {
      canAnswer: true,
      state: "extended",
      effectiveUntil,
      extended: true,
      message: `あなたの回答期限は${formatJpDate(effectiveUntil)}まで延長されています。その日のうちに提出してください。`,
    };
  }

  return {
    canAnswer: true,
    state: "open",
    effectiveUntil,
    extended: false,
    message: effectiveUntil
      ? `${formatJpDate(effectiveUntil)}まで回答できます。`
      : "いつでも回答できます（期限は決まっていません）。",
  };
}

/**
 * 「あと何日で締切か」。急かすためではなく、一覧で目立たせる判断に使う。
 * 期限なし・期限切れは null を返す。
 */
export function daysUntilDeadline(effectiveUntil: string | null, now: Date): number | null {
  if (!effectiveUntil) return null;
  const today = jstDateString(now);
  if (today > effectiveUntil) return null;
  const toUtcDay = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((toUtcDay(effectiveUntil) - toUtcDay(today)) / 86_400_000);
}

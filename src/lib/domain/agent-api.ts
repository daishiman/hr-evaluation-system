/**
 * 作業指示文を払い出す読み取りAPIの、入口の決まりごと。
 *
 * ここは計算だけを持つ（DBも通信も触らない）。判断は4つ。
 *  1. 鍵が設定されているか
 *  2. 受け取った鍵が正しいか
 *  3. どの形式（Markdown か JSON か）で返すか
 *  4. どの要望を、何件まで返すか
 *
 * 要望には利用者の生の声と、自動で集めた技術情報が入る。だから
 * 「鍵が無ければ中身を返さない」をこの1箇所で決め、画面側の都合で緩めない。
 * 断り方は、鍵の取り違えと未設定で言い分けない（在り処の手がかりを与えない）。
 */

import { AGENT_KEY_ENV_FILE, AGENT_KEY_PAGE_PATH } from "@/lib/domain/agent-keys";

/** 鍵を置く場所の名前。画面・手順書・エラー文で同じ名前を出す。 */
export const AGENT_KEY_NAME = "AGENT_API_KEY";

/** 登録に使うコマンド。画面と手順書で同じ文字列を出す。 */
export const AGENT_KEY_PUT_COMMAND = `wrangler secret put ${AGENT_KEY_NAME}`;

/** 鍵の最低の長さ。短い鍵は総当たりで通る。 */
export const AGENT_KEY_MIN_LENGTH = 32;

/**
 * 鍵が未設定のときに出す案内。1行1手順にして、上から順にやれば終わる形にする。
 * 「設定が足りません」だけだと、受け取った人が調べ直すことになる。
 */
export function agentKeySetupLines(origin?: string | null): string[] {
  const page = origin ? `${origin}${AGENT_KEY_PAGE_PATH}` : AGENT_KEY_PAGE_PATH;
  return [
    `画面から発行できます：${page}`,
    "システム全体管理者でログインし、「鍵を発行する」を押します。",
    "出てきた鍵はその場で1回だけ表示します。控えてから閉じてください。",
    "ターミナルで設定したい場合は、次の手順でも登録できます。",
    "作り方：openssl rand -base64 32 を実行します。",
    `登録：${AGENT_KEY_PUT_COMMAND} を実行します。`,
    "聞かれたら、作った文字列を貼り付けます。",
    "どちらで設定した鍵でも、この API は同じように通ります。",
  ];
}

export function agentKeyMissingMessage(origin?: string | null): string {
  return ["この API の鍵がまだ設定されていません。", ...agentKeySetupLines(origin)].join("\n");
}

/**
 * 鍵が違うときの断り文。
 *
 * 「鍵が違います」と「鍵が未設定です」を出し分けない。出し分けると、
 * 総当たりをする側は当たりの近さを測れてしまう。ここでは同じ文を返す。
 */
export const AGENT_UNAUTHORIZED_MESSAGE = "この API は鍵が要ります。\nAuthorization ヘッダーに鍵を入れてください。";

export type AgentAuthResult =
  | { ok: true; via: "screen" | "env"; keyHash: string | null }
  | { ok: false; status: 401 | 503; message: string };

/** `Authorization: Bearer xxx` から鍵だけを取り出す。形が違えば null。 */
export function readBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

/**
 * 鍵を突き合わせる。長さが同じ場合は最後まで見てから答えを返す。
 *
 * 先頭が違った時点で戻ると、返るまでの時間差から1文字ずつ当てられる。
 * 実際に測れるかはさておき、比べ方を安全側にしておく手間はほぼ無い。
 */
export function keysMatch(expected: string, given: string): boolean {
  if (expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 鍵の在り処は2つある。どちらで設定した鍵でも通る。
 *  ・envKey          サーバーの設定値（ターミナルから登録したもの）
 *  ・envKeyEnabled   その設定値での受け取りを画面から止めていないか
 *  ・activeKeyHashes 画面から発行した、まだ止めていない鍵のハッシュ（複数本）
 *
 * 見る順番は「画面で発行した鍵 → サーバーの設定値」。画面で入れ替えたのに
 * 古い設定値が優先されて通り続ける、という取り違えを作らないため。
 *
 * 画面の鍵は複数本ある。1本止めても他は動き続けるのが正しい形なので、
 * 「1本でも合えば通す」を配列で表す。
 */
export interface AgentKeySource {
  envKey: string | null | undefined;
  envKeyEnabled: boolean;
  activeKeyHashes: readonly string[];
}

function usableEnvKey(source: AgentKeySource): string {
  if (!source.envKeyEnabled) return "";
  const env = source.envKey?.trim() ?? "";
  return env.length >= AGENT_KEY_MIN_LENGTH ? env : "";
}

function usableHashes(source: AgentKeySource): string[] {
  return source.activeKeyHashes.map((h) => h.trim()).filter((h) => h.length > 0);
}

/** 鍵がどこかに設定されているか。1本も無ければ 503 で設定手順を返す。 */
export function agentKeyConfigured(source: AgentKeySource): boolean {
  return usableEnvKey(source).length > 0 || usableHashes(source).length > 0;
}

/**
 * 通してよいかを決める。
 *
 * givenHash は、受け取った鍵をハッシュ化したもの（呼び出し側で作る）。
 * 保存してあるのはハッシュだけなので、突き合わせもハッシュどうしで行う。
 * 合った鍵のハッシュを返すのは、どの鍵で受け取ったかを記録するため。
 */
export function agentAuth(
  source: AgentKeySource,
  authorization: string | null,
  givenHash: string | null,
  origin?: string | null,
): AgentAuthResult {
  // どこにも鍵が無いときだけ、設定手順を返す。運営者にだけ理由が届く。
  if (!agentKeyConfigured(source)) {
    return { ok: false, status: 503, message: agentKeyMissingMessage(origin) };
  }
  const given = readBearer(authorization);
  if (!given) return { ok: false, status: 401, message: AGENT_UNAUTHORIZED_MESSAGE };

  if (givenHash) {
    for (const hash of usableHashes(source)) {
      if (keysMatch(hash, givenHash)) return { ok: true, via: "screen", keyHash: hash };
    }
  }

  const env = usableEnvKey(source);
  if (env.length > 0 && keysMatch(env, given)) return { ok: true, via: "env", keyHash: null };

  return { ok: false, status: 401, message: AGENT_UNAUTHORIZED_MESSAGE };
}

/* ───────────────────────── 返し方 ───────────────────────── */

export type AgentFormat = "markdown" | "json";

/**
 * どの形式で返すか。既定は Markdown。
 *
 * この API を読むのは人ではなく作業する側だが、そのまま読ませる文が本体なので
 * 既定を Markdown にする。機械で数える用途だけ JSON を選べるようにする。
 */
export function agentFormat(formatParam: string | null, accept: string | null): AgentFormat {
  if (formatParam === "json") return "json";
  if (formatParam === "markdown") return "markdown";
  return (accept ?? "").toLowerCase().includes("application/json") ? "json" : "markdown";
}

/** 一覧で返す最大件数。多く返しても読み切れない。 */
export const AGENT_LIST_MAX = 50;

/** まとめて指示文にできる最大件数。 */
export const AGENT_BULK_MAX = 10;

/**
 * `?ids=a,b,c` を読む。重複は落とし、上限で切る。
 * 上限を超えた分を黙って捨てると、渡したはずの要望が消える。切ったことは呼び側が伝える。
 */
export function parseAgentIds(raw: string | null): { ids: string[]; dropped: number } {
  const all = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const unique = [...new Set(all)];
  return { ids: unique.slice(0, AGENT_BULK_MAX), dropped: Math.max(0, unique.length - AGENT_BULK_MAX) };
}

/* ───────────────────────── 渡し方の文面 ───────────────────────── */

/** 鍵を入れておく環境変数の名前。画面に出すのはこの名前だけで、鍵そのものは出さない。 */
export const AGENT_KEY_SHELL_VAR = "HR_AGENT_KEY";

/**
 * 取得コマンド。画面の「取得コマンドをコピー」で配る1行。
 *
 * 鍵は必ず環境変数の形で書く。画面に本物の鍵を描くと、背後から見られる・
 * 画面の写しに写る・そのまま貼った先に残る、の3つが同時に起きる。
 */
export function agentFetchCommand(origin: string, query: string): string {
  return `curl -sS -H "Authorization: Bearer $${AGENT_KEY_SHELL_VAR}" "${origin}/api/improvements${query}"`;
}

/**
 * 作業する側のリポジトリで打つコマンド。主たる案内はこちらにする。
 *
 * curl は宛先・ヘッダー・鍵の3つを毎回間違えずに書く必要があり、
 * 打ち間違いが「鍵が違う」に見えてしまう。台本に寄せると、間違いは
 * 「要望IDが無い」だけに減る。
 */
export function agentCliCommand(query: string): string {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const single = params.get("id");
  const many = (params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ids = single ? [single] : many;
  return ids.length > 0 ? `pnpm improvements get ${ids.join(" ")}` : "pnpm improvements list";
}

/**
 * 作業する側へ貼る文。取得から作業までを1つにまとめる。
 * これだけを貼れば、あとは返ってきた指示文の中に手順が入っている。
 */
/**
 * 環境変数の名前の代わりに、鍵そのものを埋めた文面。
 *
 * 使ってよいのは、発行した直後に1回だけ出す場所に限る。手元に環境変数を
 * 用意しなくてもそのまま動く形が要る、という理由があるときだけ。
 * 一覧や詳細画面はこれを使わない（画面に鍵が残り続けるため）。
 */
export function withInlineKey(text: string, raw: string): string {
  return text.replaceAll(`$${AGENT_KEY_SHELL_VAR}`, raw);
}

/**
 * 発行した直後にだけ渡す、鍵を埋め込んだ文面。
 * これ1つを貼れば、手元に何も用意しなくても受け取れる。
 * 代わりに鍵が文中に入るので、人に見える場所へ貼らないことを最後に書く。
 */
export function agentPromptTextWithKey(origin: string, query: string, raw: string): string {
  return [
    `アプリのリポジトリで、次の1行を ${AGENT_KEY_ENV_FILE} に書いてください。`,
    "",
    `${AGENT_KEY_SHELL_VAR}=${raw}`,
    "",
    "そのうえで、次のコマンドで作業指示を受け取ってください。",
    "",
    agentCliCommand(query),
    "",
    "受け取った指示文の中身に従って直してください。",
    "指示文の中に、進め方と受け入れ条件が入っています。",
    "この文には鍵が入っています。人の目に触れる場所へ貼らないでください。",
    "",
    `別の場所から取りにいくときは、鍵を環境変数 ${AGENT_KEY_SHELL_VAR} に入れて次を実行します。`,
    withInlineKey(agentFetchCommand(origin, query), raw),
  ].join("\n");
}

export function agentPromptText(origin: string, query: string): string {
  return [
    "次のコマンドで作業指示を受け取ってください。",
    "",
    agentCliCommand(query),
    "",
    "受け取った指示文の中身に従って直してください。",
    "指示文の中に、進め方と受け入れ条件が入っています。",
    `鍵はアプリのリポジトリ直下の ${AGENT_KEY_ENV_FILE} に、${AGENT_KEY_SHELL_VAR}= の形で入れておいてください。`,
    `鍵は ${origin}${AGENT_KEY_PAGE_PATH} で発行できます。`,
    "",
    `リポジトリの外から取りにいくときは、鍵を環境変数 ${AGENT_KEY_SHELL_VAR} に入れて次を実行します。`,
    agentFetchCommand(origin, query),
  ].join("\n");
}

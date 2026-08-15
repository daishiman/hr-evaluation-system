/**
 * GitHub へ記録票（Issue）を出す。
 *
 * 鍵（アクセストークン）はブラウザへ一切渡さない。ここはサーバー側だけで動き、
 * 画面からは「作る」という指示しか受け取らない。トークンが画面に出た時点で、
 * 読んだ人は誰でもリポジトリに書ける状態になるため、この線は動かさない。
 *
 * 文面の組み立ては src/lib/domain/improvement-issue.ts（純粋な計算）。
 * ここが持つのは「設定を読む」「送る」「返事を読む」の3つだけ。
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { githubTokenMissingMessage } from "@/lib/domain/github-setup";
import { HttpError } from "@/lib/session";

export interface GithubIssueSettings {
  /** owner/repo の形 */
  repo: string;
  token: string;
}

interface RawEnv {
  GITHUB_REPO?: string;
  GITHUB_TOKEN?: string;
  CF_VERSION_METADATA?: { id?: string; tag?: string };
}

/**
 * 実行コンテキストの設定を読む。
 * vitest のように Cloudflare の実行コンテキストが無い場所では空として扱う
 * （設定が読めないことは「未設定」と同じ結果になり、案内文で止まる）。
 */
async function env(): Promise<RawEnv> {
  try {
    const { env: bindings } = await getCloudflareContext({ async: true });
    return bindings as unknown as RawEnv;
  } catch {
    return {};
  }
}

/**
 * 記録票の出し先。未設定なら「何をどこに入れるか」まで書いて止める。
 *
 * 「設定が足りません」だけだと、受け取った人が調べ直すことになる。
 * 設定できるのは運営者本人だけなので、その場で終えられる案内を出す。
 */
export async function requireGithubSettings(): Promise<GithubIssueSettings> {
  const e = await env();
  const repo = e.GITHUB_REPO?.trim();
  const token = e.GITHUB_TOKEN?.trim();
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new HttpError(
      503,
      "設定に GITHUB_REPO がありません。wrangler.jsonc の vars に足してください。形は owner/repo です。",
    );
  }
  if (!token) {
    // 取得先・選ぶ権限まで案内に含める（詳細は domain/github-setup.ts）。
    throw new HttpError(503, githubTokenMissingMessage(repo));
  }
  return { repo, token };
}

/** 配っているアプリの版。分からない環境では null（記録票には「不明」と出る）。 */
export async function appVersion(): Promise<string | null> {
  const meta = (await env()).CF_VERSION_METADATA;
  return meta?.id ?? null;
}

export interface CreatedIssue {
  number: number;
  url: string;
}

interface IssueFields {
  title: string;
  body: string;
  labels: string[];
}

/** GitHub の入口。呼び出しの作法（見出し・版・名乗り）を1箇所に閉じる。 */
async function callGithub(
  settings: GithubIssueSettings,
  path: string,
  method: "GET" | "POST" | "PATCH",
  payload?: unknown,
): Promise<Response> {
  try {
    return await fetch(`https://api.github.com/repos/${settings.repo}${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${settings.token}`,
        "content-type": "application/json",
        "user-agent": "hr-evaluation-system",
        "x-github-api-version": "2022-11-28",
      },
      body: method === "GET" ? undefined : JSON.stringify(payload),
    });
  } catch {
    throw new HttpError(502, "GitHub に接続できませんでした。時間をおいてもう一度お試しください。");
  }
}

/**
 * 断られ方を、運営者が自分で直せる言葉にする。
 *
 * 応答本文はそのまま画面へ出さない。トークンや内部情報が混ざり得るため。
 * 429 と 403 は「一度に送りすぎ」でも起きるので、待てば直ることを添える。
 */
function raiseGithubError(status: number, repo: string): never {
  if (status === 401) {
    throw new HttpError(502, "GitHub に断られました。トークンの権限と有効期限を確認してください。");
  }
  if (status === 403 || status === 429) {
    throw new HttpError(
      502,
      "GitHub の受付上限に当たったか、権限が足りません。少し待ってから、失敗した分だけ送り直してください。",
    );
  }
  if (status === 404) {
    throw new HttpError(502, `リポジトリ ${repo} が見つかりませんでした。GITHUB_REPO の綴りを確認してください。`);
  }
  throw new HttpError(502, `GitHub が記録票を受け付けませんでした（応答コード ${status}）。`);
}

/**
 * 記録票を1件作る。
 *
 * 失敗の理由は運営者が自分で直せる粒度で返す（権限不足・リポジトリ違い・上限）。
 * 応答本文はそのまま画面へ出さない。トークンや内部情報が混ざり得るため。
 */
export async function createGithubIssue(
  settings: GithubIssueSettings,
  issue: IssueFields,
): Promise<CreatedIssue> {
  const response = await callGithub(settings, "/issues", "POST", issue);
  if (!response.ok) raiseGithubError(response.status, settings.repo);

  const json = (await response.json()) as { number?: number; html_url?: string };
  if (typeof json.number !== "number" || typeof json.html_url !== "string") {
    throw new IssueMaybeCreatedError();
  }
  return { number: json.number, url: json.html_url };
}

/**
 * 「受け付けられたが、返事を読み取れなかった」失敗。
 *
 * 記録票ができているかどうかが分からない状態なので、呼び出し側は
 * すぐ作り直してはいけない（同じ票が2枚立つ）。他の失敗と区別するために型を分ける。
 */
export class IssueMaybeCreatedError extends HttpError {
  constructor() {
    super(502, "GitHub の応答を読み取れませんでした。作られているかを GitHub 側で確認してください。");
  }
}

/**
 * すでにある記録票を、いまの内容へ書き換える。
 *
 * 開いているか閉じているかは触らない。閉じた記録票を機械が開き直すと、
 * 「終わったこと」を人の判断なしに差し戻すことになる。閉じていた事実は
 * 返り値で伝え、コメント側に書き添える。
 *
 * GitHub 側で消されていた場合は例外にせず missing を返す。そこで止めると、
 * 一覧のその行が永久に送れないままになる（作り直す道を残す）。
 */
export async function updateGithubIssue(
  settings: GithubIssueSettings,
  issueNumber: number,
  issue: IssueFields,
): Promise<{ missing: true } | { missing: false; closed: boolean; url: string }> {
  const response = await callGithub(settings, `/issues/${issueNumber}`, "PATCH", issue);
  if (response.status === 404 || response.status === 410) return { missing: true };
  if (!response.ok) raiseGithubError(response.status, settings.repo);

  const json = (await response.json()) as { state?: string; html_url?: string };
  return {
    missing: false,
    closed: json.state === "closed",
    url: typeof json.html_url === "string" ? json.html_url : `https://github.com/${settings.repo}/issues/${issueNumber}`,
  };
}

/**
 * 記録票を「対応しない」として閉じる。
 *
 * 閉じる理由は completed（やり終えた）ではなく not_planned（やらないと決めた）を使う。
 * GitHub 側では閉じ方が集計や見え方に効くため、直したから閉じたのか、
 * 直さないと決めたのかを取り違えられない形で残す。
 *
 * 理由は閉じる前にコメントとして置く。閉じたあとに書くと、
 * 通知の並びで「黙って閉じられた」ように見える。
 */
export async function closeGithubIssue(
  settings: GithubIssueSettings,
  issueNumber: number,
  comment: string,
): Promise<{ missing: boolean }> {
  const commented = await callGithub(settings, `/issues/${issueNumber}/comments`, "POST", { body: comment });
  if (commented.status === 404 || commented.status === 410) return { missing: true };
  if (!commented.ok) raiseGithubError(commented.status, settings.repo);

  const closed = await callGithub(settings, `/issues/${issueNumber}`, "PATCH", {
    state: "closed",
    state_reason: "not_planned",
  });
  if (closed.status === 404 || closed.status === 410) return { missing: true };
  if (!closed.ok) raiseGithubError(closed.status, settings.repo);
  return { missing: false };
}

/**
 * 記録票が開いているか閉じているかだけを読む。
 *
 * GitHub 側で先に閉じられていることがあるため、アプリから見に行く道を残す。
 * 画面を開くたびに自動で読みには行かない（1画面あたりの外への往復を増やすと、
 * 受付上限に当たったときに一覧そのものが出なくなる）。
 */
export async function readGithubIssueState(
  settings: GithubIssueSettings,
  issueNumber: number,
): Promise<{ missing: true } | { missing: false; closed: boolean; url: string }> {
  const response = await callGithub(settings, `/issues/${issueNumber}`, "GET");
  if (response.status === 404 || response.status === 410) return { missing: true };
  if (!response.ok) raiseGithubError(response.status, settings.repo);

  const json = (await response.json()) as { state?: string; html_url?: string };
  return {
    missing: false,
    closed: json.state === "closed",
    url: typeof json.html_url === "string" ? json.html_url : `https://github.com/${settings.repo}/issues/${issueNumber}`,
  };
}

/** 記録票に「何がいつ変わったか」を足す。本文の置き換えだけだと経緯が消えるため。 */
export async function commentOnGithubIssue(
  settings: GithubIssueSettings,
  issueNumber: number,
  body: string,
): Promise<void> {
  const response = await callGithub(settings, `/issues/${issueNumber}/comments`, "POST", { body });
  if (!response.ok) raiseGithubError(response.status, settings.repo);
}

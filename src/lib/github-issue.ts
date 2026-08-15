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
    throw new HttpError(
      503,
      "GitHub の書き込み用トークンが未設定です。\n`wrangler secret put GITHUB_TOKEN`\nこれを実行して登録してください。権限は Issues の書き込みだけで足ります。",
    );
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

/**
 * 記録票を1件作る。
 *
 * 失敗の理由は運営者が自分で直せる粒度で返す（権限不足・リポジトリ違い・上限）。
 * 応答本文はそのまま画面へ出さない。トークンや内部情報が混ざり得るため。
 */
export async function createGithubIssue(
  settings: GithubIssueSettings,
  issue: { title: string; body: string; labels: string[] },
): Promise<CreatedIssue> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${settings.repo}/issues`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${settings.token}`,
        "content-type": "application/json",
        "user-agent": "hr-evaluation-system",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify(issue),
    });
  } catch {
    throw new HttpError(502, "GitHub に接続できませんでした。時間をおいてもう一度お試しください。");
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, "GitHub に断られました。トークンの権限（Issues の書き込み）と有効期限を確認してください。");
  }
  if (response.status === 404) {
    throw new HttpError(502, `リポジトリ ${settings.repo} が見つかりませんでした。GITHUB_REPO の綴りを確認してください。`);
  }
  if (!response.ok) {
    throw new HttpError(502, `GitHub が記録票を受け付けませんでした（応答コード ${response.status}）。`);
  }

  const json = (await response.json()) as { number?: number; html_url?: string };
  if (typeof json.number !== "number" || typeof json.html_url !== "string") {
    throw new HttpError(502, "GitHub の応答を読み取れませんでした。作られているかを GitHub 側で確認してください。");
  }
  return { number: json.number, url: json.html_url };
}

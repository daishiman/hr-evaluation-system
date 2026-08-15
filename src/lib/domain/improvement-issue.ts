/**
 * 改善要望を「そのまま実装に取りかかれる記録票」へ書き起こすための決まりごと。
 *
 * 使われる場面: 届いた要望1件を読んだ運営者が、開発の作業票（GitHub Issue）を
 * 作る。作った票だけを見て実装に入れることがこの機能の要件なので、
 * 「あとで本人に聞けば分かる」を前提にした書式にしない。
 *
 * ここには DOM も DB も HTTP も持ち込まない（純粋な計算だけを置く）。
 * ブラウザから技術情報を集める側は src/lib/client-diagnostics.ts、
 * 実際に票を出す側は src/lib/github-issue.ts。
 */

/* ───────────────────────── 種類 ───────────────────────── */

/**
 * 要望の種類。利用者に選ばせる唯一の追加入力。
 *
 * 「困っている（動かない・間違っている）」と「こうしてほしい（今は困らないが不便）」は、
 * 直す順番も、記録票に要る中身（再現手順が要るか）も違う。自動では判別できず、
 * 本文の言い回しから機械が当てにいくと外したときに優先順位を取り違える。
 */
export const IMPROVEMENT_KINDS = ["bug", "request"] as const;
export type ImprovementKind = (typeof IMPROVEMENT_KINDS)[number];

const KIND_LABEL: Record<ImprovementKind, string> = {
  bug: "困っている（うまく動かない）",
  request: "こうしてほしい（もっと使いやすく）",
};

/** 画面と記録票に出す種類の呼び名。DBの値（bug など）は画面に出さない。 */
export function improvementKindLabel(kind: ImprovementKind): string {
  return KIND_LABEL[kind];
}

/** 保存されている文字列が、扱ってよい種類かどうか。 */
export function isImprovementKind(value: string): value is ImprovementKind {
  return (IMPROVEMENT_KINDS as readonly string[]).includes(value);
}

/** 「どうなってほしいか」の上限。1行で書ける長さに留める（長い話は本文へ）。 */
export const IMPROVEMENT_EXPECTED_MAX = 300;

/* ───────────────────────── 自動で集める技術情報 ───────────────────────── */

export interface DiagnosticsLogEntry {
  /** 送信時刻から見て何ミリ秒前か（時刻そのものは端末時計がずれるため持たない） */
  agoMs: number;
  level: "error" | "warn" | "reject";
  text: string;
}

export interface DiagnosticsNetworkEntry {
  agoMs: number;
  method: string;
  /** 同一オリジンのパスだけ。クエリは落とす */
  path: string;
  /** 応答が返らなかった（切断・中断）ときは null */
  status: number | null;
  durationMs: number;
}

export interface DiagnosticsBreadcrumb {
  agoMs: number;
  kind: "route" | "click" | "submit" | "input";
  label: string;
}

export interface ImprovementDiagnostics {
  /** ブラウザが名乗る文字列（そのまま） */
  userAgent: string;
  /** 「Chrome 141」のように読める形にしたもの */
  browser: string;
  os: string;
  /** 「1280×720」 */
  viewport: string;
  /** 画面の細かさ。1 と 2 で崩れ方が変わることがある */
  devicePixelRatio: number;
  /** light | dark（見た目の設定。色の不具合の切り分けに要る） */
  theme: string;
  language: string;
  online: boolean;
  logs: DiagnosticsLogEntry[];
  network: DiagnosticsNetworkEntry[];
  breadcrumbs: DiagnosticsBreadcrumb[];
  performance: {
    /** サーバーの最初の1バイトまで */
    ttfbMs: number | null;
    domContentLoadedMs: number | null;
    loadMs: number | null;
    /** 主要な絵・文字が出そろうまで */
    largestContentfulPaintMs: number | null;
  };
}

/** 集める件数の上限。多く集めるほど読む気が失せるので、直前だけを残す。 */
export const DIAGNOSTICS_LIMITS = {
  logs: 20,
  network: 20,
  breadcrumbs: 30,
  /** 1件ぶんの文字数 */
  text: 300,
  /** JSON 全体のバイト数。これを超えたら保存しない（1行に収める） */
  bytes: 24_000,
} as const;

/* ───────────────────────── 伏せる ───────────────────────── */

/**
 * 外に出してはいけないものを伏せる。
 *
 * 記録票は社外のサービス（GitHub）に置くので、画面の中で見せてよい水準では足りない。
 * 「本人にしか結び付かないもの」と「持っていると入れてしまえるもの」を落とす。
 * 消すのではなく `***` に置き換える。丸ごと消すと、そこに何かがあった事実まで消える。
 */
export function maskSensitive(raw: string): string {
  return raw
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "***@***")
    .replace(/(bearer\s+)[\w.~+/=-]+/gi, "$1***")
    .replace(/((?:token|secret|password|passwd|pwd|apikey|api_key|authorization|session|cookie)["'\s:=]+)[^\s"',;]+/gi, "$1***")
    .replace(/\b[\w-]{32,}\b/g, "***")
    .replace(/\b\d{6,}\b/g, "***");
}

/** URL から出所（オリジン）とクエリを落とし、パスだけにする。 */
export function pathOnly(raw: string): string {
  const withoutQuery = raw.split(/[?#]/)[0];
  const afterScheme = withoutQuery.replace(/^[a-z][\w+.-]*:\/\/[^/]*/i, "");
  return afterScheme === "" ? "/" : afterScheme;
}

function clampText(raw: string): string {
  const masked = maskSensitive(raw.replace(/\s+/g, " ").trim());
  return masked.length > DIAGNOSTICS_LIMITS.text ? `${masked.slice(0, DIAGNOSTICS_LIMITS.text)}…` : masked;
}

function clampNumber(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(Math.max(n, 0), max);
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string {
  return typeof value === "string" ? clampText(value) : "";
}

/**
 * 受け取った技術情報を、保存してよい形へ整える。
 *
 * 送信側（ブラウザ）の作りを信用しない。件数・長さ・型をここで必ず切り直し、
 * 伏せる処理もここを必ず通す。壊れた形で届いたときは黙って捨てずに、
 * 分かるところだけを残す（技術情報が無いだけで要望を落とさない）。
 */
export function normalizeDiagnostics(raw: unknown): ImprovementDiagnostics {
  const d = asRecord(raw);
  const perf = asRecord(d.performance);
  return {
    userAgent: asText(d.userAgent),
    browser: asText(d.browser),
    os: asText(d.os),
    viewport: /^\d{2,5}×\d{2,5}$/.test(String(d.viewport)) ? String(d.viewport) : "",
    devicePixelRatio: clampNumber(d.devicePixelRatio, 4),
    theme: asText(d.theme),
    language: asText(d.language),
    online: d.online !== false,
    logs: asArray(d.logs)
      .slice(-DIAGNOSTICS_LIMITS.logs)
      .map((entry) => {
        const e = asRecord(entry);
        const level = e.level === "error" || e.level === "warn" || e.level === "reject" ? e.level : "error";
        return { agoMs: clampNumber(e.agoMs, 86_400_000), level, text: asText(e.text) };
      }),
    network: asArray(d.network)
      .slice(-DIAGNOSTICS_LIMITS.network)
      .map((entry) => {
        const e = asRecord(entry);
        return {
          agoMs: clampNumber(e.agoMs, 86_400_000),
          method: asText(e.method).toUpperCase().slice(0, 10),
          path: pathOnly(asText(e.path)),
          status: optionalNumber(e.status),
          durationMs: clampNumber(e.durationMs, 600_000),
        };
      }),
    breadcrumbs: asArray(d.breadcrumbs)
      .slice(-DIAGNOSTICS_LIMITS.breadcrumbs)
      .map((entry) => {
        const e = asRecord(entry);
        const kind =
          e.kind === "route" || e.kind === "click" || e.kind === "submit" || e.kind === "input" ? e.kind : "click";
        return { agoMs: clampNumber(e.agoMs, 86_400_000), kind, label: asText(e.label) };
      }),
    performance: {
      ttfbMs: optionalNumber(perf.ttfbMs),
      domContentLoadedMs: optionalNumber(perf.domContentLoadedMs),
      loadMs: optionalNumber(perf.loadMs),
      largestContentfulPaintMs: optionalNumber(perf.largestContentfulPaintMs),
    },
  };
}

/** 保存されている JSON 文字列を、扱える形に戻す。壊れていたら null。 */
export function parseDiagnostics(raw: string | null): ImprovementDiagnostics | null {
  if (!raw) return null;
  try {
    return normalizeDiagnostics(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 保存する JSON 文字列。大きすぎるものは記録票の読みやすさを壊すので保存しない。 */
export function serializeDiagnostics(value: ImprovementDiagnostics): string | null {
  const json = JSON.stringify(value);
  return new TextEncoder().encode(json).length > DIAGNOSTICS_LIMITS.bytes ? null : json;
}

/* ───────────────────────── 該当ファイルの候補 ───────────────────────── */

/**
 * どのファイルから読み始めればよいかの当たり。
 *
 * 画面のURLの形（route pattern）は、そのままファイルの置き場所になっている
 * （`scripts/check-docs-drift.mjs` が両者の一致を毎回検査している）。
 * だから推測ではなく導出できる。当てにいくのはここまでにして、
 * 「たぶんこの部品」までは書かない（外れた候補は読む時間を捨てさせる）。
 */
export function sourceCandidatesFor(routePattern: string): string[] {
  if (!routePattern.startsWith("/")) return [];
  const inner = routePattern === "/" ? "" : routePattern;
  return [`src/app${inner}/page.tsx`];
}

/* ───────────────────────── 記録票の文面 ───────────────────────── */

export interface IssueDraftInput {
  kind: ImprovementKind;
  /** 画面の呼び名（route-ledger.json の label） */
  screenLabel: string;
  /** 送信時の実URL（クエリは既に落ちている） */
  path: string;
  routePattern: string;
  body: string;
  expected: string | null;
  /** 送った人の役割。氏名・メールは記録票へ出さない */
  reporterRoleLabel: string;
  createdAt: Date;
  hasShot: boolean;
  /** 画像と原文を読む場所（社内の管理画面） */
  adminUrl: string;
  /** 配っているアプリの版。分からないときは null */
  appVersion: string | null;
  diagnostics: ImprovementDiagnostics | null;
}

/** 日本時間の日時。サーバーは UTC で動くので、読む人の時間に直してから書く。 */
export function formatJst(date: Date): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const at: Record<string, string> = {};
  for (const p of parts) at[p.type] = p.value;
  return `${at.year}-${at.month}-${at.day} ${at.hour}:${at.minute} JST`;
}

const TITLE_MAX = 60;

/** 記録票の見出し。一覧で「どの画面の何か」だけが読めればよい。 */
export function buildIssueTitle(input: Pick<IssueDraftInput, "kind" | "screenLabel" | "body">): string {
  const head = input.body.split("\n")[0].trim();
  const summary = head.length > TITLE_MAX ? `${head.slice(0, TITLE_MAX)}…` : head;
  const tag = input.kind === "bug" ? "不具合" : "改善";
  return `[${tag}] ${input.screenLabel}：${summary}`;
}

/** 記録票に付ける札。増やしすぎると絞り込めなくなるので2枚まで。 */
export function buildIssueLabels(kind: ImprovementKind): string[] {
  return ["改善要望", kind === "bug" ? "不具合" : "要望"];
}

function formatAgo(agoMs: number): string {
  return agoMs < 1000 ? "送信直前" : `${Math.round(agoMs / 1000)}秒前`;
}

function bulletList(lines: string[], emptyNote: string): string {
  return lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : emptyNote;
}

function reproductionSteps(diagnostics: ImprovementDiagnostics | null): string {
  const crumbs = diagnostics?.breadcrumbs ?? [];
  if (crumbs.length === 0) {
    return "（自動記録なし。送信直前の操作をブラウザ側で拾えていません）";
  }
  return crumbs
    .map((c, i) => {
      const verb = { route: "画面を開く", click: "押す", submit: "送信する", input: "入力する" }[c.kind];
      return `${i + 1}. ${verb}：${c.label || "（名前なし）"}（${formatAgo(c.agoMs)}）`;
    })
    .join("\n");
}

function environmentBlock(input: IssueDraftInput): string {
  const d = input.diagnostics;
  return [
    `- 画面：${input.screenLabel}（\`${input.routePattern}\`）`,
    `- 実URL：\`${input.path}\``,
    `- 送った人の役割：${input.reporterRoleLabel}`,
    `- 発生日時：${formatJst(input.createdAt)}`,
    `- ブラウザ：${d?.browser || "不明"} / OS：${d?.os || "不明"}`,
    `- 画面の広さ：${d?.viewport || "不明"}（表示倍率 ${d?.devicePixelRatio ?? "不明"}）`,
    `- 見た目の設定：${d?.theme || "不明"} / 表示言語：${d?.language || "不明"}`,
    `- 通信状態：${d ? (d.online ? "オンライン" : "オフライン") : "不明"}`,
    `- アプリの版：${input.appVersion ?? "不明"}`,
    `- UserAgent：\`${d?.userAgent || "不明"}\``,
  ].join("\n");
}

function technicalBlock(input: IssueDraftInput): string {
  const d = input.diagnostics;
  if (!d) return "（この要望には技術情報が付いていません。機能を入れる前に届いたものです）";

  const logs = bulletList(
    d.logs.map((l) => `\`${l.level}\` ${l.text}（${formatAgo(l.agoMs)}）`),
    "（記録なし）",
  );
  const network = bulletList(
    d.network.map(
      (n) => `\`${n.method} ${n.path}\` → ${n.status === null ? "応答なし" : n.status}（${n.durationMs}ms、${formatAgo(n.agoMs)}）`,
    ),
    "（記録なし）",
  );
  const perf = [
    `- 最初の応答まで：${d.performance.ttfbMs ?? "不明"}ms`,
    `- 画面の組み立て完了：${d.performance.domContentLoadedMs ?? "不明"}ms`,
    `- 読み込み完了：${d.performance.loadMs ?? "不明"}ms`,
    `- 主要な表示が出そろうまで：${d.performance.largestContentfulPaintMs ?? "不明"}ms`,
  ].join("\n");

  return [
    "**コンソールのエラー（直近）**",
    logs,
    "",
    "**失敗した通信（直近）**",
    network,
    "",
    "**表示の速さ**",
    perf,
  ].join("\n");
}

function acceptanceCriteria(input: IssueDraftInput): string {
  const common = [
    `\`${input.routePattern}\` を4つの幅で開いても崩れない`,
    "確かめる幅は 375 / 768 / 1280 / 1600px",
    "同じ操作を関係するロールで通しても、権限の境界が変わっていない",
  ];
  const byKind =
    input.kind === "bug"
      ? [
          "上の再現手順をなぞっても、報告された症状が出ない",
          "同じ原因で壊れる他の画面がないかを確認し、あれば一緒に直している",
          "再発を止めるテストが増えている（症状そのものを固定する）",
        ]
      : [
          input.expected ? `「${input.expected}」ができる` : "報告された不便が、その画面の中で解消している",
          "既存の操作手順が増えていない（この改善のために別の画面を開かせない）",
        ];
  return [...byKind, ...common].map((l) => `- [ ] ${l}`).join("\n");
}

/**
 * 記録票の本文。
 *
 * 読む順は「何が起きたか → どうしてほしいか → どうやれば再現するか →
 * どこを見ればよいか → 何ができたら完了か」。技術情報は最後に畳んで置く。
 * 先に技術情報を出すと、読む人が症状より先にログを読み始めてしまう。
 */
export function buildIssueBody(input: IssueDraftInput): string {
  const sections = [
    `## 概要`,
    `**${input.screenLabel}**で、${input.kind === "bug" ? "うまく動かない" : "使いにくい"}という声が届きました。`,
    ``,
    `## ユーザーの声（原文のまま）`,
    `> ${input.body.split("\n").join("\n> ")}`,
    ``,
    `## どうなってほしいか`,
    input.expected ? input.expected : "（本人からの記入なし。上の声から読み取ってください）",
    ``,
    `## 再現手順（送信直前の操作の自動記録）`,
    reproductionSteps(input.diagnostics),
    ``,
    `## 発生した場所と環境`,
    environmentBlock(input),
    ``,
    `## 見た目の記録`,
    input.hasShot
      ? `本人が書き込んだ画面の写しがあります（社内の管理画面で確認）：${input.adminUrl}`
      : `画像は添えられていません。原文は社内の管理画面で確認できます：${input.adminUrl}`,
    ``,
    `## 読み始めるファイルの候補`,
    bulletList(
      sourceCandidatesFor(input.routePattern).map((f) => `\`${f}\``),
      "（URL の形から導けませんでした。`system-spec/route-ledger.json` を見てください）",
    ),
    ``,
    `## 完了の条件`,
    acceptanceCriteria(input),
    ``,
    `<details><summary>技術情報（自動収集）</summary>`,
    ``,
    technicalBlock(input),
    ``,
    `</details>`,
    ``,
    `---`,
    `この記録票は人事評価システムの「改善要望」から自動で書き起こしました。氏名・メール・評価の中身は載せていません。`,
  ];
  return sections.join("\n");
}

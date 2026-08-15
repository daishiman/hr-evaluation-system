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
 * 「動かない」「使いにくい」「こんな機能がほしい」は、直す順番も、記録票に要る
 * 中身（再現手順が要るか）も、集めてよい技術情報の量も違う。自動では判別できず、
 * 本文の言い回しから機械が当てにいくと外したときに優先順位を取り違える。
 *
 * 押すのは1回だけ。ここを増やすと、送る側の負担が「直る速さ」に見合わなくなる。
 */
export const IMPROVEMENT_KINDS = ["bug", "usability", "feature"] as const;
export type ImprovementKind = (typeof IMPROVEMENT_KINDS)[number];

const KIND_LABEL: Record<ImprovementKind, string> = {
  bug: "うまく動かない",
  usability: "使いにくい・直したい",
  feature: "こんな機能がほしい",
};

/** 画面と記録票に出す種類の呼び名。DBの値（bug など）は画面に出さない。 */
export function improvementKindLabel(kind: ImprovementKind): string {
  return KIND_LABEL[kind];
}

/** 保存されている文字列が、扱ってよい種類かどうか。 */
export function isImprovementKind(value: string): value is ImprovementKind {
  return (IMPROVEMENT_KINDS as readonly string[]).includes(value);
}

/**
 * 種類ごとに、どこまで技術情報を集めるか。
 *
 * 不具合は「なぜ落ちたか」が分からないと直せないので全部集める。
 * 使いにくいは、直すのに要るのは画面と操作の流れで、通信の中身は要らない。
 * 新機能は、要るのは「どの画面の話か」だけ。集めても読まれないものは集めない
 * （集めた分だけ、外へ出す情報と、記録票を読む手間が増える）。
 */
export type DiagnosticsLevel = "full" | "medium" | "minimal";

const KIND_LEVEL: Record<ImprovementKind, DiagnosticsLevel> = {
  bug: "full",
  usability: "medium",
  feature: "minimal",
};

export function diagnosticsLevelFor(kind: ImprovementKind): DiagnosticsLevel {
  return KIND_LEVEL[kind];
}

/**
 * 「一緒に送られるもの」の説明文。画面・記録票・仕様書で同じ言葉を使うため、
 * 文言をここ1箇所に置く（画面だけ直して実物とずれる、を起こさない）。
 */
export const DIAGNOSTICS_LEVEL_NOTE: Record<DiagnosticsLevel, string[]> = {
  full: [
    "いま開いている画面のURL・画面の広さ・お使いのブラウザと OS",
    "この画面で出たエラーの記録",
    "失敗した通信の宛先と、そのやりとりの中身",
    "直前に押したもの・移った画面の順番（表示の名前だけ）",
    "画面が出るまでにかかった時間",
  ],
  medium: [
    "いま開いている画面のURL・画面の広さ・お使いのブラウザと OS",
    "直前に押したもの・移った画面の順番（表示の名前だけ）",
    "失敗した通信があったときだけ、その宛先と結果（中身は送りません）",
  ],
  minimal: ["いま開いている画面のURL・画面の広さ・お使いのブラウザと OS", "アプリの版"],
};

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
  /** パスだけ。クエリは落とす（合言葉がURLに乗ることがあるため） */
  path: string;
  /** 応答が返らなかった（切断・中断）ときは null */
  status: number | null;
  durationMs: number;
  /** 自分のアプリ以外への通信。この場合は宛先と結果だけで、中身は持たない */
  external: boolean;
  /** 送った中身（伏せ字ずみ）。持たないときは null */
  requestBody: string | null;
  /** 返ってきた中身（伏せ字ずみ）。持たないときは null */
  responseBody: string | null;
  /** 上限で切り詰めたか。切ったことを黙っていると、読む人が「全部これだけ」と誤読する */
  truncated: boolean;
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
  /** 通信1本ぶんの中身の文字数（送り・返りそれぞれ） */
  bodyText: 8_000,
  /** 通信の中身の合計。ここを超えたら古い方から中身を落とす（宛先と結果は残す） */
  bodyTotalText: 64_000,
  /** JSON 全体のバイト数。これを超えたら保存しない（1行に収める） */
  bytes: 200_000,
  /** 記録票の本文の上限（GitHub の上限 65536 に対する安全側の線） */
  issueBodyText: 58_000,
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

/**
 * 通信の中身で、名前からして持ち出してはいけない項目。
 *
 * 値そのものの見た目（maskSensitive）だけでは、氏名や評価コメントは判別できない。
 * 「この鍵の下にあるものは中身を見ずに伏せる」を先に効かせる。
 * 迷ったら伏せる側に倒す。伏せすぎて困るのは調べる手間、
 * 漏らして困るのは取り返しがつかない、という非対称があるため。
 */
const SENSITIVE_KEY =
  /token|secret|password|passwd|pwd|api[-_]?key|authorization|cookie|session|credential|signature|mail|name|comment|note|reason|remark|memo|feedback/i;

const PAYLOAD_ARRAY_MAX = 50;
const PAYLOAD_DEPTH_MAX = 6;

function maskValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return maskSensitive(value);
  if (Array.isArray(value)) {
    if (depth >= PAYLOAD_DEPTH_MAX) return "…";
    const head = value.slice(0, PAYLOAD_ARRAY_MAX).map((v) => maskValue(v, depth + 1));
    return value.length > PAYLOAD_ARRAY_MAX ? [...head, `…ほか${value.length - PAYLOAD_ARRAY_MAX}件`] : head;
  }
  if (typeof value === "object" && value !== null) {
    if (depth >= PAYLOAD_DEPTH_MAX) return "…";
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "***" : maskValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * 通信の送り・返りの中身を、外へ出してよい形へ整える。
 *
 * JSON として読めるときは鍵の名前で伏せる。読めないとき（HTMLの断片など）は
 * 見た目の規則（maskSensitive）だけを当てる。どちらの場合も上限で切り、
 * 切ったことは呼び出し側へ返す。
 */
export function maskPayload(raw: string): { text: string; truncated: boolean } {
  let text: string;
  try {
    text = JSON.stringify(maskValue(JSON.parse(raw), 0), null, 1);
  } catch {
    text = maskSensitive(raw);
  }
  if (text.length > DIAGNOSTICS_LIMITS.bodyText) {
    return { text: `${text.slice(0, DIAGNOSTICS_LIMITS.bodyText)}…`, truncated: true };
  }
  return { text, truncated: false };
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
export function normalizeDiagnostics(raw: unknown, level: DiagnosticsLevel = "full"): ImprovementDiagnostics {
  const d = asRecord(raw);
  const perf = asRecord(d.performance);
  const full = level === "full";
  return {
    userAgent: asText(d.userAgent),
    browser: asText(d.browser),
    os: asText(d.os),
    viewport: /^\d{2,5}×\d{2,5}$/.test(String(d.viewport)) ? String(d.viewport) : "",
    devicePixelRatio: clampNumber(d.devicePixelRatio, 4),
    theme: asText(d.theme),
    language: asText(d.language),
    online: d.online !== false,
    logs: full
      ? asArray(d.logs)
          .slice(-DIAGNOSTICS_LIMITS.logs)
          .map((entry) => {
            const e = asRecord(entry);
            const lv = e.level === "error" || e.level === "warn" || e.level === "reject" ? e.level : "error";
            return { agoMs: clampNumber(e.agoMs, 86_400_000), level: lv, text: asText(e.text) };
          })
      : [],
    network:
      level === "minimal"
        ? []
        : withinBodyBudget(
            asArray(d.network)
              .slice(-DIAGNOSTICS_LIMITS.network)
              .map((entry) => {
                const e = asRecord(entry);
                // 自分のアプリ以外への通信は、中身を持たない（相手の情報を持ち出さない）。
                const external = e.external === true;
                const body = (value: unknown) => {
                  if (!full || external || typeof value !== "string" || value === "") return null;
                  return maskPayload(value);
                };
                const req = body(e.requestBody);
                const res = body(e.responseBody);
                return {
                  agoMs: clampNumber(e.agoMs, 86_400_000),
                  method: asText(e.method).toUpperCase().slice(0, 10),
                  path: pathOnly(asText(e.path)),
                  status: optionalNumber(e.status),
                  durationMs: clampNumber(e.durationMs, 600_000),
                  external,
                  requestBody: req?.text ?? null,
                  responseBody: res?.text ?? null,
                  truncated: Boolean(req?.truncated || res?.truncated),
                };
              }),
          ),
    breadcrumbs:
      level === "minimal"
        ? []
        : asArray(d.breadcrumbs)
            .slice(-DIAGNOSTICS_LIMITS.breadcrumbs)
            .map((entry) => {
              const e = asRecord(entry);
              const kind =
                e.kind === "route" || e.kind === "click" || e.kind === "submit" || e.kind === "input" ? e.kind : "click";
              return { agoMs: clampNumber(e.agoMs, 86_400_000), kind, label: asText(e.label) };
            }),
    performance: {
      ttfbMs: full ? optionalNumber(perf.ttfbMs) : null,
      domContentLoadedMs: full ? optionalNumber(perf.domContentLoadedMs) : null,
      loadMs: full ? optionalNumber(perf.loadMs) : null,
      largestContentfulPaintMs: full ? optionalNumber(perf.largestContentfulPaintMs) : null,
    },
  };
}

/**
 * 通信の中身の合計に上限をかける。
 *
 * 溢れたときに落とすのは古い方の「中身」だけで、宛先と結果の行は残す。
 * 行ごと消すと「その通信が無かった」ことになり、時系列が読めなくなる。
 */
function withinBodyBudget(entries: DiagnosticsNetworkEntry[]): DiagnosticsNetworkEntry[] {
  let budget = DIAGNOSTICS_LIMITS.bodyTotalText;
  const kept: DiagnosticsNetworkEntry[] = [];
  // 新しいものほど原因に近いので、後ろから詰める。
  for (const entry of [...entries].reverse()) {
    const size = (entry.requestBody?.length ?? 0) + (entry.responseBody?.length ?? 0);
    if (size > budget) {
      kept.push({ ...entry, requestBody: null, responseBody: null, truncated: true });
      continue;
    }
    budget -= size;
    kept.push(entry);
  }
  return kept.reverse();
}

/** 保存されている JSON 文字列を、扱える形に戻す。壊れていたら null。 */
export function parseDiagnostics(raw: string | null, level: DiagnosticsLevel = "full"): ImprovementDiagnostics | null {
  if (!raw) return null;
  try {
    return normalizeDiagnostics(JSON.parse(raw), level);
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

/** すでに記録票になっている、似た要望（同じ画面・同じ種類）。 */
export interface RelatedIssue {
  number: number;
  url: string;
  /** 同じ画面から届いた要望の1行目 */
  summary: string;
}

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
  /** 同じ画面・同じ種類で、すでに記録票になっているもの */
  related?: RelatedIssue[];
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

const KIND_TAG: Record<ImprovementKind, string> = { bug: "不具合", usability: "改善", feature: "新機能" };

/** 記録票の見出し。一覧で「どの画面の何か」だけが読めればよい。 */
export function buildIssueTitle(input: Pick<IssueDraftInput, "kind" | "screenLabel" | "body">): string {
  const head = input.body.split("\n")[0].trim();
  const summary = head.length > TITLE_MAX ? `${head.slice(0, TITLE_MAX)}…` : head;
  return `[${KIND_TAG[input.kind]}] ${input.screenLabel}：${summary}`;
}

const KIND_TOPIC: Record<ImprovementKind, string> = {
  bug: "bug",
  usability: "enhancement",
  feature: "feature-request",
};

/**
 * 重大度。本人の言い方ではなく、自動で集めた事実だけから決める。
 *
 * 「動きません」と書いてあっても実際にはエラーが出ていないことがあり、
 * 逆に穏やかな文面の裏で 500 が出ていることがある。並べ替えの基準は
 * 文面ではなく事実側に置く（読む人が毎回本文を開かずに順番を決められる）。
 */
export function issueSeverity(kind: ImprovementKind, d: ImprovementDiagnostics | null): "high" | "medium" | "low" {
  const broken = (d?.logs.length ?? 0) > 0 || (d?.network ?? []).some((n) => n.status === null || n.status >= 500);
  if (broken) return "high";
  if (kind === "bug" || (d?.network.length ?? 0) > 0) return "medium";
  return "low";
}

/**
 * 画面のかたまり（機能領域）。URL の最初の区切りをそのまま使う。
 * 命名を別に決めると、画面が増えるたびに対応表の更新が要る。
 */
export function areaOf(routePattern: string): string | null {
  const first = routePattern.split("/").filter(Boolean)[0];
  return first && !first.startsWith("[") ? first : null;
}

/**
 * 記録票に付ける札。仕分けに使う4種類（何か / どれくらい急ぐか / どの領域か）に絞る。
 * GitHub 側に無い札は、記録票を作るときに自動で作られる。
 */
export function buildIssueLabels(
  kind: ImprovementKind,
  diagnostics: ImprovementDiagnostics | null = null,
  routePattern = "",
): string[] {
  const area = areaOf(routePattern);
  return [
    "improvement",
    KIND_TOPIC[kind],
    `severity:${issueSeverity(kind, diagnostics)}`,
    ...(area ? [`area:${area}`] : []),
  ];
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

/**
 * 環境。技術情報が付いている要望でしか呼ばないので、ここでは有無を分岐しない。
 * アプリの版は「影響範囲」に必ず出るため、ここでは重ねない。
 */
function environmentBlock(d: ImprovementDiagnostics): string {
  return [
    `- ブラウザ：${d.browser || "不明"} / OS：${d.os || "不明"}`,
    `- 画面の広さ：${d.viewport || "不明"}（表示倍率 ${d.devicePixelRatio}）`,
    `- 見た目の設定：${d.theme || "不明"} / 表示言語：${d.language || "不明"}`,
    `- 通信状態：${d.online ? "オンライン" : "オフライン"}`,
    `- UserAgent：\`${d.userAgent || "不明"}\``,
  ].join("\n");
}

/** 通信1本ぶん。宛先と結果を1行で出し、中身はさらに畳んで置く。 */
function networkEntryBlock(n: DiagnosticsNetworkEntry): string {
  const head = `- \`${n.method} ${n.path}\` → ${n.status === null ? "応答なし" : n.status}（${n.durationMs}ms、${formatAgo(n.agoMs)}）${n.external ? " ※外部サービス" : ""}`;
  const parts = [head];
  if (n.requestBody) parts.push("", "  送った中身", "  ```json", indent(n.requestBody), "  ```");
  if (n.responseBody) parts.push("", "  返ってきた中身", "  ```json", indent(n.responseBody), "  ```");
  if (n.truncated) parts.push("", "  （上限を超えたため途中で切っています）");
  return parts.join("\n");
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

/**
 * 技術情報の中身。開いた瞬間にログの壁にならないよう、小見出しで分ける。
 * 集めていない種類（新機能の要望など）では、その旨だけを書いて場所を取らない。
 */
function technicalBlock(input: IssueDraftInput): string {
  const d = input.diagnostics;
  const level = diagnosticsLevelFor(input.kind);

  // 技術情報が無い要望でも、読み始める場所だけは必ず出す（下で足す）。
  const sections = d
    ? ["### 環境", environmentBlock(d)]
    : ["（この要望には技術情報が付いていません。機能を入れる前に届いたものです）"];

  if (d && level === "full") {
    sections.push(
      "",
      "### コンソールのエラー（直近）",
      bulletList(d.logs.map((l) => `\`${l.level}\` ${l.text}（${formatAgo(l.agoMs)}）`), "（記録なし）"),
    );
  }

  if (d && level !== "minimal") {
    sections.push(
      "",
      "### 失敗した通信（直近）",
      d.network.length > 0 ? d.network.map(networkEntryBlock).join("\n") : "（記録なし）",
      "",
      "### 操作の履歴",
      reproductionSteps(d),
    );
  }

  if (d && level === "full") {
    sections.push(
      "",
      "### 表示の速さ",
      [
        `- 最初の応答まで：${d.performance.ttfbMs ?? "不明"}ms`,
        `- 画面の組み立て完了：${d.performance.domContentLoadedMs ?? "不明"}ms`,
        `- 読み込み完了：${d.performance.loadMs ?? "不明"}ms`,
        `- 主要な表示が出そろうまで：${d.performance.largestContentfulPaintMs ?? "不明"}ms`,
      ].join("\n"),
    );
  }

  sections.push(
    "",
    "### 読み始めるファイルの候補",
    bulletList(
      sourceCandidatesFor(input.routePattern).map((f) => `\`${f}\``),
      "（URL の形から導けませんでした。`system-spec/route-ledger.json` を見てください）",
    ),
  );

  return sections.join("\n");
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
  const level = diagnosticsLevelFor(input.kind);
  const overview = {
    bug: "うまく動かない",
    usability: "使いにくい",
    feature: "この機能がほしい",
  }[input.kind];
  const related = input.related ?? [];

  const sections = [
    `## 概要`,
    `**${input.screenLabel}**で、${overview}という声が届きました。`,
    ``,
    `## ユーザーの声（原文のまま）`,
    `> ${input.body.split("\n").join("\n> ")}`,
    ``,
    `## 期待と実際`,
    `- 期待：${input.expected ?? "（本人からの記入なし。上の声から読み取ってください）"}`,
    `- 実際：${input.kind === "bug" ? "上の声のとおり（再現手順は下の自動記録を参照）" : "上の声のとおり"}`,
    ``,
  ];

  if (level !== "minimal") {
    sections.push(`## 再現手順（送信直前の操作の自動記録）`, reproductionSteps(input.diagnostics), ``);
  }

  sections.push(
    `## 影響範囲`,
    [
      `- 画面：${input.screenLabel}（\`${input.routePattern}\`）`,
      `- 実URL：\`${input.path}\``,
      `- 送った人の役割：${input.reporterRoleLabel}`,
      `- 届いた日時：${formatJst(input.createdAt)}`,
      `- アプリの版：${input.appVersion ?? "不明"}`,
      input.hasShot
        ? `- 画面の写し：本人の書き込みあり（社内の管理画面で確認）：${input.adminUrl}`
        : `- 画面の写し：なし。原文は社内の管理画面で確認できます：${input.adminUrl}`,
    ].join("\n"),
    ``,
  );

  if (related.length > 0) {
    sections.push(
      `## 似ている記録票（同じ画面・同じ種類）`,
      `重複かどうかは中身を読んで判断してください。同じなら、こちらを閉じて向こうへ声を足す方が早いです。`,
      related.map((r) => `- #${r.number} ${r.summary}（${r.url}）`).join("\n"),
      ``,
    );
  }

  sections.push(
    `## 完了の条件`,
    acceptanceCriteria(input),
    ``,
    // 見出しの言い回しで「開かないと直せない」のか「参考までに」なのかを分ける。
    `<details><summary>${level === "full" ? "技術情報（実装に必須）" : "参考情報（自動収集）"}</summary>`,
    ``,
    technicalBlock(input),
    ``,
    `</details>`,
    ``,
    `---`,
    `この記録票は人事評価システムの「改善要望」から自動で書き起こしました。氏名・メール・評価の中身は載せていません。`,
  );

  const body = sections.join("\n");
  // GitHub には本文の上限がある。超えると記録票そのものが作れず、
  // 「押しても何も起きない」に見えるので、こちら側で先に切っておく。
  return body.length > DIAGNOSTICS_LIMITS.issueBodyText
    ? `${body.slice(0, DIAGNOSTICS_LIMITS.issueBodyText)}\n\n（長すぎるため、ここで切りました。全文は社内の管理画面で読めます）`
    : body;
}

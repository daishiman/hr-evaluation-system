import { describe, expect, it } from "vitest";
import {
  DIAGNOSTICS_LIMITS,
  IMPROVEMENT_KINDS,
  buildIssueBody,
  buildIssueLabels,
  buildIssueTitle,
  formatJst,
  improvementKindLabel,
  isImprovementKind,
  maskSensitive,
  normalizeDiagnostics,
  parseDiagnostics,
  pathOnly,
  serializeDiagnostics,
  sourceCandidatesFor,
  type ImprovementDiagnostics,
  type IssueDraftInput,
} from "@/lib/domain/improvement-issue";

/**
 * 記録票は社外（GitHub）に残る。だから「載せてよいものだけが載る」ことと、
 * 「載っているものだけで実装に入れる」ことの両方をここで固定する。
 */

const diagnostics: ImprovementDiagnostics = {
  userAgent: "Mozilla/5.0 (Macintosh) Chrome/141.0.0.0",
  browser: "Chrome 141",
  os: "macOS",
  viewport: "1280×720",
  devicePixelRatio: 2,
  theme: "dark",
  language: "ja",
  online: true,
  logs: [{ agoMs: 500, level: "error", text: "TypeError: undefined is not a function" }],
  network: [{ agoMs: 3000, method: "POST", path: "/api/responses/f1", status: 500, durationMs: 812 }],
  breadcrumbs: [
    { agoMs: 20000, kind: "route", label: "評価・結果" },
    { agoMs: 9000, kind: "input", label: "目標値" },
    { agoMs: 4000, kind: "click", label: "保存する" },
    { agoMs: 1500, kind: "submit", label: "評価フォーム" },
  ],
  performance: { ttfbMs: 120, domContentLoadedMs: 800, loadMs: 1400, largestContentfulPaintMs: 1100 },
};

const draft: IssueDraftInput = {
  kind: "bug",
  screenLabel: "評価・結果",
  path: "/manager/evaluations/ev_1",
  routePattern: "/manager/evaluations/[id]",
  body: "保存を押しても、点数が入らないまま前の画面に戻ってしまいます。",
  expected: "押したら点数が保存されてほしい。",
  reporterRoleLabel: "マネージャー",
  createdAt: new Date("2026-08-15T02:34:00Z"),
  hasShot: true,
  adminUrl: "https://hr.example.com/admin/improvements/improve_1",
  appVersion: "v-abc",
  diagnostics,
};

describe("要望の種類", () => {
  it("画面には呼び名を出し、保存値（bug）はそのまま出さない", () => {
    expect(IMPROVEMENT_KINDS).toEqual(["bug", "request"]);
    expect(improvementKindLabel("bug")).toContain("困っている");
    expect(improvementKindLabel("request")).toContain("こうしてほしい");
  });

  it("扱ってよい種類だけを通す", () => {
    expect(isImprovementKind("bug")).toBe(true);
    expect(isImprovementKind("feature")).toBe(false);
  });
});

describe("外へ出してよい形に伏せる", () => {
  it("本人に結び付くものと、持っていると入れてしまえるものを伏せる", () => {
    expect(maskSensitive("連絡先は taro.yamada+hr@example.co.jp です")).toBe("連絡先は ***@*** です");
    expect(maskSensitive("送信時ヘッダ Bearer abc.def-ghi")).toBe("送信時ヘッダ Bearer ***");
    expect(maskSensitive("token=Zm9vYmFy; x=1")).toBe("token=***; x=1");
    expect(maskSensitive("id=0123456789abcdef0123456789abcdef")).toBe("id=***");
    expect(maskSensitive("社員番号 1234567 の行")).toBe("社員番号 *** の行");
  });

  it("伏せるだけで消さない（そこに何かあった事実は残す）", () => {
    expect(maskSensitive("a@b.jp")).toContain("***");
    expect(maskSensitive("ふつうの文はそのまま")).toBe("ふつうの文はそのまま");
  });

  it("URL は出所とクエリを落としてパスだけにする", () => {
    expect(pathOnly("https://hr.example.com/admin/members?q=山田#top")).toBe("/admin/members");
    expect(pathOnly("/api/search?q=1")).toBe("/api/search");
    expect(pathOnly("https://hr.example.com")).toBe("/");
  });
});

describe("届いた技術情報の整え", () => {
  it("送信側の作りを信用せず、件数・長さ・型をここで切り直す", () => {
    const normalized = normalizeDiagnostics({
      userAgent: "UA",
      browser: 123,
      viewport: "こわれた値",
      devicePixelRatio: -5,
      online: false,
      logs: Array.from({ length: 40 }, (_, i) => ({ agoMs: i, level: "warn", text: `e${i}` })),
      network: [{ agoMs: "x", method: "post", path: "https://x.example.com/api/a?b=1", status: null, durationMs: 9 }],
      breadcrumbs: [{ agoMs: 1, kind: "なにか", label: "項".repeat(400) }],
    });

    expect(normalized.browser).toBe("");
    expect(normalized.viewport).toBe("");
    expect(normalized.devicePixelRatio).toBe(0);
    expect(normalized.online).toBe(false);
    expect(normalized.logs).toHaveLength(DIAGNOSTICS_LIMITS.logs);
    expect(normalized.logs[0]).toEqual({ agoMs: 20, level: "warn", text: "e20" });
    expect(normalized.network[0]).toEqual({
      agoMs: 0,
      method: "POST",
      path: "/api/a",
      status: null,
      durationMs: 9,
    });
    expect(normalized.breadcrumbs[0].kind).toBe("click");
    expect(normalized.breadcrumbs[0].label).toHaveLength(DIAGNOSTICS_LIMITS.text + 1);
    expect(normalized.performance).toEqual({
      ttfbMs: null,
      domContentLoadedMs: null,
      loadMs: null,
      largestContentfulPaintMs: null,
    });
  });

  it("形ごと壊れて届いても、要望を落とさず空の技術情報にする", () => {
    const normalized = normalizeDiagnostics(null);
    expect(normalized.userAgent).toBe("");
    expect(normalized.logs).toEqual([]);
    expect(normalized.online).toBe(true);
    expect(normalizeDiagnostics({ logs: "配列ではない" }).logs).toEqual([]);
  });

  it("整えた値はそのまま往復できる", () => {
    const json = serializeDiagnostics(diagnostics);
    expect(json).not.toBeNull();
    expect(parseDiagnostics(json)).toEqual(diagnostics);
    expect(parseDiagnostics(null)).toBeNull();
    expect(parseDiagnostics("{壊れたJSON")).toBeNull();
  });

  it("記録票を読めなくする大きさのものは保存しない", () => {
    const huge = { ...diagnostics, userAgent: "あ".repeat(DIAGNOSTICS_LIMITS.bytes) };
    expect(serializeDiagnostics(huge)).toBeNull();
  });

  it("受け取った異常な種類・水準は安全側の既定へ寄せる", () => {
    const normalized = normalizeDiagnostics({
      logs: [{ agoMs: 1, level: "debug", text: "x" }],
      breadcrumbs: [
        { agoMs: 1, kind: "route", label: "a" },
        { agoMs: 1, kind: "submit", label: "b" },
        { agoMs: 1, kind: "input", label: "c" },
      ],
      performance: { ttfbMs: 10.4, domContentLoadedMs: 20, loadMs: 30, largestContentfulPaintMs: 40 },
    });
    expect(normalized.logs[0].level).toBe("error");
    expect(normalized.breadcrumbs.map((b) => b.kind)).toEqual(["route", "submit", "input"]);
    expect(normalized.performance.ttfbMs).toBe(10);
  });
});

describe("読み始めるファイルの候補", () => {
  it("URLの形から導く（当てずっぽうの部品名までは書かない）", () => {
    expect(sourceCandidatesFor("/admin/improvements/[id]")).toEqual(["src/app/admin/improvements/[id]/page.tsx"]);
    expect(sourceCandidatesFor("/")).toEqual(["src/app/page.tsx"]);
    expect(sourceCandidatesFor("その他の画面")).toEqual([]);
  });
});

describe("記録票の文面", () => {
  it("日時は読む人の時間（日本時間）で書く", () => {
    expect(formatJst(new Date("2026-08-15T02:34:00Z"))).toBe("2026-08-15 11:34 JST");
  });

  it("見出しは「どの画面の何か」だけにし、長い本文は切る", () => {
    expect(buildIssueTitle(draft)).toBe("[不具合] 評価・結果：保存を押しても、点数が入らないまま前の画面に戻ってしまいます。");
    expect(buildIssueTitle({ kind: "request", screenLabel: "社員", body: "あ".repeat(80) })).toBe(
      `[改善] 社員：${"あ".repeat(60)}…`,
    );
  });

  it("札は2枚まで（増やすと絞り込めなくなる）", () => {
    expect(buildIssueLabels("bug")).toEqual(["改善要望", "不具合"]);
    expect(buildIssueLabels("request")).toEqual(["改善要望", "要望"]);
  });

  it("不具合は、再現手順・環境・完了条件がそろって出る", () => {
    const body = buildIssueBody(draft);
    expect(body).toContain("## 再現手順");
    expect(body).toContain("1. 画面を開く：評価・結果（20秒前）");
    expect(body).toContain("2. 入力する：目標値");
    expect(body).toContain("3. 押す：保存する");
    expect(body).toContain("4. 送信する：評価フォーム（2秒前）");
    expect(body).toContain("- 送った人の役割：マネージャー");
    expect(body).toContain("- 発生日時：2026-08-15 11:34 JST");
    expect(body).toContain("- アプリの版：v-abc");
    expect(body).toContain("`src/app/manager/evaluations/[id]/page.tsx`");
    expect(body).toContain("- [ ] 上の再現手順をなぞっても、報告された症状が出ない");
    expect(body).toContain("`POST /api/responses/f1` → 500（812ms、3秒前）");
    expect(body).toContain("本人が書き込んだ画面の写しがあります");
  });

  it("氏名・メールは載せない（役割だけを載せる）", () => {
    const body = buildIssueBody(draft);
    expect(body).not.toContain("@");
    expect(body).toContain("氏名・メール・評価の中身は載せていません");
  });

  it("要望は、本人の望みをそのまま完了条件にする", () => {
    const body = buildIssueBody({ ...draft, kind: "request" });
    expect(body).toContain("- [ ] 「押したら点数が保存されてほしい。」ができる");
    expect(body).toContain("使いにくい");
  });

  it("本人の記入・画像・技術情報が無くても、記録票として成り立つ", () => {
    const body = buildIssueBody({
      ...draft,
      kind: "request",
      expected: null,
      hasShot: false,
      appVersion: null,
      routePattern: "その他の画面",
      diagnostics: null,
    });
    expect(body).toContain("（本人からの記入なし");
    expect(body).toContain("（自動記録なし");
    expect(body).toContain("画像は添えられていません");
    expect(body).toContain("- アプリの版：不明");
    expect(body).toContain("- ブラウザ：不明 / OS：不明");
    expect(body).toContain("- 通信状態：不明");
    expect(body).toContain("`system-spec/route-ledger.json` を見てください");
    expect(body).toContain("- [ ] 報告された不便が、その画面の中で解消している");
    expect(body).toContain("この要望には技術情報が付いていません");
  });

  it("技術情報が空でも、欠けている箇所が読める形にする", () => {
    const body = buildIssueBody({
      ...draft,
      diagnostics: {
        ...diagnostics,
        online: false,
        browser: "",
        os: "",
        viewport: "",
        theme: "",
        language: "",
        userAgent: "",
        logs: [],
        network: [{ agoMs: 200, method: "GET", path: "/api/x", status: null, durationMs: 30 }],
        breadcrumbs: [{ agoMs: 200, kind: "click", label: "" }],
        performance: { ttfbMs: null, domContentLoadedMs: null, loadMs: null, largestContentfulPaintMs: null },
      },
    });
    expect(body).toContain("- 通信状態：オフライン");
    expect(body).toContain("1. 押す：（名前なし）（送信直前）");
    expect(body).toContain("**コンソールのエラー（直近）**\n（記録なし）");
    expect(body).toContain("`GET /api/x` → 応答なし（30ms、送信直前）");
    expect(body).toContain("- 最初の応答まで：不明ms");
    expect(body).toContain("- UserAgent：`不明`");
  });
});

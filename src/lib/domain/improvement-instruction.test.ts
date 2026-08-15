import { describe, expect, it } from "vitest";
import {
  DIAGNOSTICS_LEVEL_NOTE,
  DIAGNOSTICS_LIMITS,
  IMPROVEMENT_KINDS,
  buildBulkInstructionDocument,
  buildInstructionDocument,
  buildInstructionTitle,
  diagnosticsLevelFor,
  formatJst,
  improvementKindLabel,
  isImprovementKind,
  instructionSeverity,
  maskPayload,
  maskSensitive,
  normalizeDiagnostics,
  parseDiagnostics,
  pathOnly,
  serializeDiagnostics,
  severityLabel,
  sourceCandidatesFor,
  type DiagnosticsNetworkEntry,
  type ImprovementDiagnostics,
  type InstructionInput,
} from "@/lib/domain/improvement-instruction";

/**
 * 指示文はそのまま作業する側へ渡る。だから「載せてよいものだけが載る」ことと、
 * 「載っているものだけで作業に入れる」ことの両方をここで固定する。
 */

const netEntry = (over: Partial<DiagnosticsNetworkEntry> = {}): DiagnosticsNetworkEntry => ({
  agoMs: 3000,
  method: "POST",
  path: "/api/responses/f1",
  status: 500,
  durationMs: 812,
  external: false,
  requestBody: null,
  responseBody: null,
  truncated: false,
  ...over,
});

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
  network: [netEntry()],
  breadcrumbs: [
    { agoMs: 20000, kind: "route", label: "評価・結果" },
    { agoMs: 9000, kind: "input", label: "目標値" },
    { agoMs: 4000, kind: "click", label: "保存する" },
    { agoMs: 1500, kind: "submit", label: "評価フォーム" },
  ],
  performance: { ttfbMs: 120, domContentLoadedMs: 800, loadMs: 1400, largestContentfulPaintMs: 1100 },
};

const draft: InstructionInput = {
  id: "improve_1",
  kind: "bug",
  screenLabel: "評価・結果",
  path: "/manager/evaluations/ev_1",
  routePattern: "/manager/evaluations/[id]",
  body: "保存を押しても、点数が入らないまま前の画面に戻ってしまいます。",
  expected: "押したら点数が保存されてほしい。",
  reporterRoleLabel: "マネージャー",
  statusLabel: "未対応",
  handledNote: null,
  createdAt: new Date("2026-08-15T02:34:00Z"),
  hasShot: true,
  adminUrl: "https://hr.example.com/admin/improvements/improve_1",
  appVersion: "v-abc",
  diagnostics,
};

describe("要望の種類", () => {
  it("画面には呼び名を出し、保存値（bug）はそのまま出さない", () => {
    expect(IMPROVEMENT_KINDS).toEqual(["bug", "usability", "feature"]);
    expect(improvementKindLabel("bug")).toContain("動かない");
    expect(improvementKindLabel("usability")).toContain("使いにくい");
    expect(improvementKindLabel("feature")).toContain("機能");
  });

  it("扱ってよい種類だけを通す", () => {
    expect(isImprovementKind("feature")).toBe(true);
    expect(isImprovementKind("request")).toBe(false);
  });

  it("種類ごとに、集めてよい技術情報の量が決まる", () => {
    expect(diagnosticsLevelFor("bug")).toBe("full");
    expect(diagnosticsLevelFor("usability")).toBe("medium");
    expect(diagnosticsLevelFor("feature")).toBe("minimal");
  });

  it("送る人に見せる説明は、集める量が減るほど短くなる", () => {
    expect(DIAGNOSTICS_LEVEL_NOTE.full.length).toBeGreaterThan(DIAGNOSTICS_LEVEL_NOTE.medium.length);
    expect(DIAGNOSTICS_LEVEL_NOTE.medium.length).toBeGreaterThan(DIAGNOSTICS_LEVEL_NOTE.minimal.length);
    expect(DIAGNOSTICS_LEVEL_NOTE.full.join()).toContain("やりとりの中身");
    expect(DIAGNOSTICS_LEVEL_NOTE.medium.join()).toContain("中身は送りません");
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

describe("通信のやりとりの中身", () => {
  it("鍵の名前で伏せる（氏名・評価コメントは中身を見ずに落とす）", () => {
    const { text, truncated } = maskPayload(
      JSON.stringify({
        name: "山田太郎",
        評価コメント: "よい",
        comment: "とても丁寧です",
        score: 4,
        token: "abcdef",
        ok: true,
        nothing: null,
      }),
    );
    expect(text).not.toContain("山田太郎");
    expect(text).not.toContain("とても丁寧です");
    expect(text).toContain('"score": 4');
    expect(text).toContain('"ok": true');
    expect(text).toContain('"nothing": null');
    expect(truncated).toBe(false);
  });

  it("入れ子・並びも伏せ、深すぎるところと多すぎるところは省く", () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: "おく" }, h: [[1]] } } } } } };
    expect(maskPayload(JSON.stringify(deep)).text).toContain("…");

    const few = { items: [{ name: "山田太郎", score: 3 }] };
    const fewMasked = maskPayload(JSON.stringify(few)).text;
    expect(fewMasked).not.toContain("山田太郎");
    expect(fewMasked).not.toContain("ほか");

    const many = { items: Array.from({ length: 60 }, (_, i) => ({ mail: `x${i}@example.com`, i })) };
    const masked = maskPayload(JSON.stringify(many)).text;
    expect(masked).not.toContain("@example.com");
    expect(masked).toContain("…ほか10件");
  });

  it("JSON でないものは、見た目の規則だけを当てる", () => {
    expect(maskPayload("<p>連絡は a@b.jp まで</p>").text).toBe("<p>連絡は ***@*** まで</p>");
  });

  it("長すぎるものは切り、切ったことを伝える", () => {
    const long = maskPayload("あ".repeat(DIAGNOSTICS_LIMITS.bodyText + 100));
    expect(long.truncated).toBe(true);
    expect(long.text).toHaveLength(DIAGNOSTICS_LIMITS.bodyText + 1);
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
      network: [
        {
          agoMs: "x",
          method: "post",
          path: "https://x.example.com/api/a?b=1",
          status: null,
          durationMs: 9,
          requestBody: '{"name":"山田","score":3}',
          responseBody: "",
        },
      ],
      breadcrumbs: [{ agoMs: 1, kind: "なにか", label: "項".repeat(400) }],
    });

    expect(normalized.browser).toBe("");
    expect(normalized.viewport).toBe("");
    expect(normalized.devicePixelRatio).toBe(0);
    expect(normalized.online).toBe(false);
    expect(normalized.logs).toHaveLength(DIAGNOSTICS_LIMITS.logs);
    expect(normalized.logs[0]).toEqual({ agoMs: 20, level: "warn", text: "e20" });
    expect(normalized.network[0].path).toBe("/api/a");
    expect(normalized.network[0].method).toBe("POST");
    expect(normalized.network[0].requestBody).toContain('"name": "***"');
    expect(normalized.network[0].responseBody).toBeNull();
    expect(normalized.network[0].truncated).toBe(false);
    expect(normalized.breadcrumbs[0].kind).toBe("click");
    expect(normalized.breadcrumbs[0].label).toHaveLength(DIAGNOSTICS_LIMITS.text + 1);
  });

  it("外部サービスへの通信は、宛先と結果だけにする", () => {
    const normalized = normalizeDiagnostics({
      network: [
        {
          agoMs: 1,
          method: "GET",
          path: "https://api.example.com/v1/x",
          status: 500,
          durationMs: 5,
          external: true,
          requestBody: '{"a":1}',
          responseBody: '{"b":2}',
        },
      ],
    });
    expect(normalized.network[0].external).toBe(true);
    expect(normalized.network[0].requestBody).toBeNull();
    expect(normalized.network[0].responseBody).toBeNull();
  });

  it("中身の合計が上限を超えたら、古い方の中身から落とす（行は残す）", () => {
    const big = JSON.stringify({ v: "あ".repeat(DIAGNOSTICS_LIMITS.bodyText) });
    const normalized = normalizeDiagnostics({
      network: Array.from({ length: 12 }, (_, i) => ({
        agoMs: 100 - i,
        method: "POST",
        path: `/api/${i}`,
        status: 500,
        durationMs: 1,
        requestBody: big,
        responseBody: big,
      })),
    });
    const dropped = normalized.network[0];
    const kept = normalized.network[normalized.network.length - 1];
    expect(dropped.path).toBe("/api/0");
    expect(dropped.requestBody).toBeNull();
    expect(dropped.truncated).toBe(true);
    expect(kept.requestBody).not.toBeNull();
  });

  it("種類が下がると、集めるものそのものが減る", () => {
    const raw = {
      ...diagnostics,
      network: [{ ...netEntry(), requestBody: '{"score":1}', responseBody: '{"ok":false}' }],
    };
    const medium = normalizeDiagnostics(raw, "medium");
    expect(medium.logs).toEqual([]);
    expect(medium.network).toHaveLength(1);
    expect(medium.network[0].requestBody).toBeNull();
    expect(medium.breadcrumbs).toHaveLength(4);
    expect(medium.performance.ttfbMs).toBeNull();

    const minimal = normalizeDiagnostics(raw, "minimal");
    expect(minimal.network).toEqual([]);
    expect(minimal.breadcrumbs).toEqual([]);
    expect(minimal.browser).toBe("Chrome 141");
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
    expect(parseDiagnostics(json, "minimal")?.network).toEqual([]);
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

describe("重大度", () => {
  it("本人の言い方ではなく、集めた事実から決める", () => {
    expect(instructionSeverity("bug", diagnostics)).toBe("high");
    expect(instructionSeverity("feature", { ...diagnostics, logs: [], network: [netEntry({ status: null })] })).toBe("high");
    expect(instructionSeverity("bug", { ...diagnostics, logs: [], network: [] })).toBe("medium");
    expect(instructionSeverity("feature", { ...diagnostics, logs: [], network: [netEntry({ status: 404 })] })).toBe("medium");
    expect(instructionSeverity("usability", { ...diagnostics, logs: [], network: [] })).toBe("low");
    expect(instructionSeverity("bug", null)).toBe("medium");
  });

  it("高いときだけ理由を添える（並べ替えの根拠が読める）", () => {
    expect(severityLabel("high")).toContain("壊れている");
    expect(severityLabel("medium")).toBe("中");
    expect(severityLabel("low")).toBe("低");
  });
});

describe("指示文の文面", () => {
  it("日時は読む人の時間（日本時間）で書く", () => {
    expect(formatJst(new Date("2026-08-15T02:34:00Z"))).toBe("2026-08-15 11:34 JST");
  });

  it("見出しは「どの画面の何か」だけにし、長い本文は切る", () => {
    expect(buildInstructionTitle(draft)).toBe("[不具合] 評価・結果：保存を押しても、点数が入らないまま前の画面に戻ってしまいます。");
    expect(buildInstructionTitle({ kind: "usability", screenLabel: "社員", body: "あ".repeat(80) })).toBe(
      `[改善] 社員：${"あ".repeat(60)}…`,
    );
    expect(buildInstructionTitle({ kind: "feature", screenLabel: "社員", body: "検索がほしい" })).toBe(
      "[新機能] 社員：検索がほしい",
    );
  });

  it("進め方が先頭に来る（本文の途中から手を動かし始めない）", () => {
    const doc = buildInstructionDocument(draft);
    expect(doc.indexOf("## 作業のやり方")).toBeLessThan(doc.indexOf("## ユーザーの声"));
    expect(doc).toContain("- 要望は1件ずつ直す。まとめて1回で直さない。");
    expect(doc).toContain("- 直したら、再発を止めるテストを足す。");
    expect(doc).toContain("- 手元で確かめてから、公開まで通す。");
  });

  it("不具合は、再現手順・環境・受け入れ条件がそろって出る", () => {
    const doc = buildInstructionDocument(draft);
    expect(doc).toContain("- 要望ID：`improve_1`");
    expect(doc).toContain("- 重大度：高（壊れている記録あり）");
    expect(doc).toContain("- 会社側の状態：未対応");
    expect(doc).toContain("- 会社側のメモ：（記入なし）");
    expect(doc).toContain("## 再現手順（送信直前の操作の自動記録）");
    expect(doc).toContain("1. 画面を開く：評価・結果（20秒前）");
    expect(doc).toContain("2. 入力する：目標値");
    expect(doc).toContain("3. 押す：保存する");
    expect(doc).toContain("4. 送信する：評価フォーム（2秒前）");
    expect(doc).toContain("- 送った人の役割：マネージャー");
    expect(doc).toContain("- 投稿日時：2026-08-15 11:34 JST");
    expect(doc).toContain("- アプリの版：v-abc");
    expect(doc).toContain("`src/app/manager/evaluations/[id]/page.tsx`");
    expect(doc).toContain("- [ ] 上の再現手順をなぞっても、報告された症状が出ない");
    expect(doc).toContain("`POST /api/responses/f1` → 500（812ms、3秒前）");
    expect(doc).toContain("本人の書き込みあり");
  });

  it("ユーザーの声は原文のまま引用する（要約しない）", () => {
    const doc = buildInstructionDocument({ ...draft, body: "保存できません。\n2回試しました。" });
    expect(doc).toContain("> 保存できません。\n> 2回試しました。");
  });

  it("通信のやりとりは、伏せ字ずみの中身まで載せる", () => {
    const doc = buildInstructionDocument({
      ...draft,
      diagnostics: {
        ...diagnostics,
        network: [
          netEntry({ requestBody: '{\n "score": 3\n}', responseBody: '{\n "message": "失敗"\n}', truncated: true }),
          netEntry({ path: "/v1/other", external: true, status: 502 }),
        ],
      },
    });
    expect(doc).toContain("  送った中身");
    expect(doc).toContain("   \"score\": 3");
    expect(doc).toContain("  返ってきた中身");
    expect(doc).toContain("（上限を超えたため途中で切っています）");
    expect(doc).toContain("※外部サービス");
  });

  it("氏名・メールは載せない（役割だけを載せる）", () => {
    expect(buildInstructionDocument(draft)).not.toContain("@");
  });

  it("使いにくいは、本人の望みをそのまま受け入れ条件にする", () => {
    const doc = buildInstructionDocument({ ...draft, kind: "usability" });
    expect(doc).toContain("- [ ] 「押したら点数が保存されてほしい。」ができる");
    expect(doc).toContain("使いにくい");
    expect(doc).not.toContain("### コンソールのエラー");
    expect(doc).toContain("### 失敗した通信（直近）");
  });

  it("使いにくいで失敗した通信が無ければ、その欄は「記録なし」で残す", () => {
    const doc = buildInstructionDocument({
      ...draft,
      kind: "usability",
      diagnostics: normalizeDiagnostics({ ...diagnostics, network: [] }, "medium"),
    });
    expect(doc).toContain("### 失敗した通信（直近）\n（記録なし）");
    expect(doc).toContain("### 操作の履歴");
  });

  it("新機能は、再現手順も通信の記録も置かない", () => {
    const doc = buildInstructionDocument({
      ...draft,
      kind: "feature",
      diagnostics: normalizeDiagnostics(diagnostics, "minimal"),
    });
    expect(doc).toContain("この機能がほしい");
    expect(doc).not.toContain("## 再現手順");
    expect(doc).not.toContain("### 失敗した通信");
    expect(doc).toContain("### 環境");
    expect(doc).toContain("## 影響範囲と読み始めるファイルの候補");
  });

  it("本人の記入・画像・技術情報が無くても、指示文として成り立つ", () => {
    const doc = buildInstructionDocument({
      ...draft,
      kind: "usability",
      expected: null,
      hasShot: false,
      appVersion: null,
      handledNote: "先週まとめて直す予定",
      statusLabel: "対応中",
      routePattern: "その他の画面",
      diagnostics: null,
    });
    expect(doc).toContain("（本人からの記入なし");
    expect(doc).toContain("（自動記録なし");
    expect(doc).toContain("画面の写し：なし");
    expect(doc).toContain("- アプリの版：不明");
    expect(doc).toContain("- 会社側のメモ：先週まとめて直す予定");
    expect(doc).toContain("`system-spec/route-ledger.json` を見てください");
    expect(doc).toContain("- [ ] 報告された不便が、その画面の中で解消している");
    expect(doc).toContain("この要望には技術情報が付いていません");
  });

  it("技術情報が空でも、欠けている箇所が読める形にする", () => {
    const doc = buildInstructionDocument({
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
        network: [netEntry({ agoMs: 200, method: "GET", path: "/api/x", status: null, durationMs: 30 })],
        breadcrumbs: [{ agoMs: 200, kind: "click", label: "" }],
        performance: { ttfbMs: null, domContentLoadedMs: null, loadMs: null, largestContentfulPaintMs: null },
      },
    });
    expect(doc).toContain("- 通信状態：オフライン");
    expect(doc).toContain("1. 押す：（名前なし）（送信直前）");
    expect(doc).toContain("### コンソールのエラー（直近）\n（記録なし）");
    expect(doc).toContain("`GET /api/x` → 応答なし（30ms、送信直前）");
    expect(doc).toContain("- 最初の応答まで：不明ms");
    expect(doc).toContain("- UserAgent：`不明`");
  });

  it("長すぎる指示文は、渡す前にこちらで切る", () => {
    const doc = buildInstructionDocument({
      ...draft,
      diagnostics: {
        ...diagnostics,
        network: Array.from({ length: 10 }, () => netEntry({ responseBody: "あ".repeat(DIAGNOSTICS_LIMITS.bodyText) })),
      },
    });
    expect(doc.length).toBeLessThan(DIAGNOSTICS_LIMITS.documentText + 100);
    expect(doc).toContain("（長すぎるため、ここで切りました");
  });
});

describe("まとめて渡す指示文", () => {
  const low: InstructionInput = {
    ...draft,
    id: "improve_2",
    kind: "feature",
    screenLabel: "社員",
    routePattern: "/admin/members",
    body: "検索がほしい",
    diagnostics: null,
  };

  it("着手の順番を先に置き、重大度が高いものから並べる", () => {
    const doc = buildBulkInstructionDocument([low, draft]);
    expect(doc).toContain("# 作業指示：改善要望 2件");
    expect(doc).toContain("1. `improve_1`（重大度：高（壊れている記録あり）／評価・結果）");
    expect(doc).toContain("2. `improve_2`（重大度：低／社員）");
    expect(doc).toContain("- 上から順に進める。");
    expect(doc).toContain("## まとめ方の注意");
    expect(doc.indexOf("## 着手の順番")).toBeLessThan(doc.indexOf("## [不具合]"));
  });

  it("1件ぶんの見出しは1段下げる（全体の見出しと混ざらない）", () => {
    const doc = buildBulkInstructionDocument([draft]);
    expect(doc).toContain("## [不具合] 評価・結果：");
    expect(doc).toContain("### 作業のやり方");
  });

  it("同じ重大度なら、同じ画面が続くように並べる", () => {
    const a = { ...draft, id: "a", routePattern: "/z", diagnostics: null, kind: "usability" as const };
    const b = { ...draft, id: "b", routePattern: "/a", diagnostics: null, kind: "usability" as const };
    const doc = buildBulkInstructionDocument([a, b]);
    expect(doc.indexOf("`b`（重大度")).toBeLessThan(doc.indexOf("`a`（重大度"));
  });

  it("0件なら、その旨だけを返す", () => {
    expect(buildBulkInstructionDocument([])).toContain("対象の要望がありません");
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  BULK_MAX,
  DEFAULT_BASE,
  KEY_FILE,
  KEY_VAR,
  OP_REF_VAR,
  OP_RUN_GUARD,
  REDACTED,
  TOKEN_PATH,
  TOKEN_VAR,
  buildUrl,
  describeFailure,
  describeNetworkError,
  missingKeyMessage,
  parseArgs,
  readEnvValue,
  opRunPlan,
  resolveConfig,
  run,
  writeEnvLine,
} from "./improvements.mjs";

/** 通信のふり。実際には外へ出さない。 */
function fakeFetch(response) {
  return vi.fn(async () => response);
}

function textResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
  };
}

const KEY = "test-key-0123456789abcdefghijklmnop";

describe("引数の読み取り", () => {
  it("list を読む", () => {
    expect(parseArgs(["list"])).toMatchObject({ command: "list", json: false });
  });

  it("--json を付けられる", () => {
    expect(parseArgs(["list", "--json"])).toMatchObject({ command: "list", json: true });
  });

  it("get は要望IDを重複なしで受ける", () => {
    expect(parseArgs(["get", "a", "b", "a"])).toMatchObject({ command: "get", ids: ["a", "b"], dropped: 0 });
  });

  it(`get は${BULK_MAX}件で切り、切った件数を残す`, () => {
    const ids = Array.from({ length: BULK_MAX + 3 }, (_, i) => `id${i}`);
    const parsed = parseArgs(["get", ...ids]);
    expect(parsed.ids).toHaveLength(BULK_MAX);
    expect(parsed.dropped).toBe(3);
  });

  it("--base は値の形をどちらでも受ける", () => {
    expect(parseArgs(["list", "--base", "http://localhost:8787"]).base).toBe("http://localhost:8787");
    expect(parseArgs(["list", "--base=http://localhost:8787"]).base).toBe("http://localhost:8787");
  });

  it("--base の値が無ければ止める", () => {
    expect(parseArgs(["list", "--base"]).error).toContain("宛先のURL");
  });

  it("get に要望IDが無ければ、一覧の見方を案内して止める", () => {
    expect(parseArgs(["get"]).error).toContain("improvements list");
  });

  it("list に要望IDを付けたら get を案内する", () => {
    expect(parseArgs(["list", "abc"]).error).toContain("get");
  });

  it("知らない操作・知らない指定は止める", () => {
    expect(parseArgs(["remove"]).error).toContain("remove");
    expect(parseArgs(["list", "--force"]).error).toContain("--force");
  });

  it("引数なし・help は使い方を出す", () => {
    expect(parseArgs([]).command).toBe("help");
    expect(parseArgs(["--help"]).command).toBe("help");
  });
});

describe("設定ファイルの読み取り", () => {
  it("鍵の行を読む（引用符・export・コメントを跨ぐ）", () => {
    const text = ["# 鍵の置き場", `export ${KEY_VAR}="abc=def"`, "HR_APP_URL=http://localhost:8787"].join("\n");
    expect(readEnvValue(text, KEY_VAR)).toBe("abc=def");
    expect(readEnvValue(text, "HR_APP_URL")).toBe("http://localhost:8787");
  });

  it("空の値・無い行は未設定として扱う", () => {
    expect(readEnvValue(`${KEY_VAR}=`, KEY_VAR)).toBeNull();
    expect(readEnvValue("", KEY_VAR)).toBeNull();
    expect(readEnvValue(null, KEY_VAR)).toBeNull();
  });

  it("環境変数がファイルより先に効く", () => {
    const config = resolveConfig({ env: { [KEY_VAR]: "env-key" }, envFileText: `${KEY_VAR}=file-key` });
    expect(config.key).toBe("env-key");
  });

  it("宛先の既定は本番で、末尾のスラッシュは落とす", () => {
    expect(resolveConfig({}).base).toBe(DEFAULT_BASE);
    expect(resolveConfig({ baseOverride: "http://localhost:8787/" }).base).toBe("http://localhost:8787");
  });
});

describe("宛先の組み立て", () => {
  it("一覧は id を付けない", () => {
    expect(buildUrl("https://x.test", { command: "list", ids: [], json: false })).toBe(
      "https://x.test/api/improvements?format=markdown",
    );
  });

  it("1件は id、複数件は ids で渡す", () => {
    expect(buildUrl("https://x.test", { command: "get", ids: ["a"], json: false })).toContain("id=a");
    expect(buildUrl("https://x.test", { command: "get", ids: ["a", "b"], json: true })).toContain("ids=a%2Cb");
  });
});

describe("通行証も鍵も未設定のとき", () => {
  it("承認の画面と書き込み先を含む案内を出して終わる", async () => {
    const err = vi.fn();
    const fetchImpl = vi.fn();
    const code = await run({ argv: ["list"], env: {}, envFileText: null, fetchImpl, err, out: vi.fn() });

    expect(code).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    const message = err.mock.calls[0][0];
    expect(message).toContain("/system/agent-keys");
    expect(message).toContain(KEY_FILE);
    // 案内の主役は `login`。古い方式の鍵ではなく、通行証の置き場所を教える。
    expect(message).toContain("pnpm improvements login");
    expect(message).toContain(TOKEN_VAR);
  });

  it("案内には鍵の値を作る材料が入らない", () => {
    expect(missingKeyMessage(DEFAULT_BASE)).not.toContain(KEY);
  });
});

describe("鍵の値を外に出さない", () => {
  it("成功時の出力にも失敗時の出力にも鍵が現れない", async () => {
    const out = vi.fn();
    const err = vi.fn();
    await run({
      argv: ["list"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(textResponse("# 手つかずの改善要望 0件\n")),
      out,
      err,
    });
    await run({
      argv: ["list"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(textResponse("鍵が違います", { status: 401 })),
      out,
      err,
    });

    const printed = [...out.mock.calls, ...err.mock.calls].flat().join("\n");
    expect(printed).not.toContain(KEY);
  });

  it("鍵は Authorization ヘッダーだけに載せる", async () => {
    const fetchImpl = fakeFetch(textResponse("ok"));
    await run({ argv: ["list"], env: { [KEY_VAR]: KEY }, fetchImpl, out: vi.fn(), err: vi.fn() });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).not.toContain(KEY);
    expect(init.headers.authorization).toBe(`Bearer ${KEY}`);
  });
});

describe("失敗したときの言い分け", () => {
  it("鍵違いは発行し直しを案内する", () => {
    expect(describeFailure(401, null, DEFAULT_BASE)).toContain("発行し直");
  });

  it("回数制限は待つ秒数を出す（指定が無ければ既定）", () => {
    expect(describeFailure(429, "30", DEFAULT_BASE)).toContain("30秒");
    expect(describeFailure(429, null, DEFAULT_BASE)).toContain("60秒");
  });

  it("受け取り側に鍵が無いときは発行画面を案内する", () => {
    expect(describeFailure(503, null, DEFAULT_BASE)).toContain("/system/agent-keys");
  });

  it("宛先違いと想定外は別の文にする", () => {
    expect(describeFailure(404, null, "http://localhost:8787")).toContain("--base");
    expect(describeFailure(500, null, DEFAULT_BASE)).toContain("500");
  });

  it("つながらないときはURLと詳細を出す", () => {
    expect(describeNetworkError("http://localhost:8787", new Error("ECONNREFUSED"))).toContain("ECONNREFUSED");
  });

  it("応答が失敗なら終了コードは1で、本文は流さない", async () => {
    const out = vi.fn();
    const err = vi.fn();
    const code = await run({
      argv: ["list"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(textResponse("この API は鍵が要ります。", { status: 401 })),
      out,
      err,
    });

    expect(code).toBe(1);
    expect(out).not.toHaveBeenCalled();
    expect(err.mock.calls[0][0]).toContain("鍵が受け付けられませんでした");
  });

  it("通信そのものが失敗しても落ちずに案内で終わる", async () => {
    const err = vi.fn();
    const code = await run({
      argv: ["list"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: vi.fn(async () => {
        throw new Error("fetch failed");
      }),
      out: vi.fn(),
      err,
    });

    expect(code).toBe(1);
    expect(err.mock.calls[0][0]).toContain("つながりませんでした");
  });
});

describe("受け取れたとき", () => {
  it("本文をそのまま出す", async () => {
    const out = vi.fn();
    const code = await run({
      argv: ["get", "imp_1"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(textResponse("# 改善要望 imp_1\n\n本文\n")),
      out,
      err: vi.fn(),
    });

    expect(code).toBe(0);
    expect(out.mock.calls[0][0]).toBe("# 改善要望 imp_1\n\n本文");
  });

  it("上限で切ったときは、切ったことを伝える", async () => {
    const err = vi.fn();
    const ids = Array.from({ length: BULK_MAX + 1 }, (_, i) => `id${i}`);
    await run({
      argv: ["get", ...ids],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(textResponse("本文")),
      out: vi.fn(),
      err,
    });

    expect(err.mock.calls[0][0]).toContain("1件は今回含めていません");
  });

  it("--json のときは JSON を求める", async () => {
    const fetchImpl = fakeFetch(textResponse('{"count":0}'));
    await run({ argv: ["list", "--json"], env: { [KEY_VAR]: KEY }, fetchImpl, out: vi.fn(), err: vi.fn() });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("format=json");
    expect(init.headers.accept).toBe("application/json");
  });

  it("使い方だけを求めたときは成功で終わる", async () => {
    const out = vi.fn();
    const code = await run({ argv: [], env: {}, out, err: vi.fn() });

    expect(code).toBe(0);
    expect(out.mock.calls[0][0]).toContain("pnpm improvements list");
  });
});

/* ───────────────────────── 鍵の在り処と、値の漏れ ───────────────────────── */

describe("鍵の在り処", () => {
  it("環境変数がいちばん強い（その場だけ差し替えられる）", () => {
    const config = resolveConfig({
      env: { [KEY_VAR]: "env-key", [OP_REF_VAR]: "op://v/i/credential" },
      envFileText: `${KEY_VAR}=file-key`,
      secrets: { onePassword: () => "op-key", keychain: () => "chain-key" },
    });
    expect(config).toMatchObject({ key: "env-key", source: "環境変数" });
  });

  it("環境変数が無ければ 1Password を読む", () => {
    const onePassword = vi.fn(() => "op-key");
    const config = resolveConfig({
      env: { [OP_REF_VAR]: "op://保管庫/鍵/credential" },
      secrets: { onePassword, keychain: () => "chain-key" },
    });
    expect(config).toMatchObject({ key: "op-key", source: "1Password" });
    expect(onePassword).toHaveBeenCalledWith("op://保管庫/鍵/credential");
  });

  it("1Password が入っていなくてもキーチェーンへ落ちる", () => {
    const config = resolveConfig({
      env: {},
      secrets: { onePassword: () => null, keychain: () => "chain-key" },
    });
    expect(config).toMatchObject({ key: "chain-key", source: "キーチェーン" });
  });

  it("どの道具も無ければ設定ファイルを読む", () => {
    const config = resolveConfig({ env: {}, envFileText: `${KEY_VAR}=file-key` });
    expect(config).toMatchObject({ key: "file-key", source: KEY_FILE });
  });

  it("参照先が未設定なら 1Password は呼ばない", () => {
    const onePassword = vi.fn(() => "op-key");
    resolveConfig({ env: {}, secrets: { onePassword, keychain: () => "chain-key" } });
    expect(onePassword).not.toHaveBeenCalled();
  });

  it("key は在り処だけを言い、鍵の値は出さない", async () => {
    const out = vi.fn();
    const code = await run({
      argv: ["key"],
      env: {},
      secrets: { onePassword: () => null, keychain: () => KEY },
      fetchImpl: vi.fn(),
      out,
      err: vi.fn(),
    });

    expect(code).toBe(0);
    expect(out.mock.calls[0][0]).toContain("キーチェーン");
    expect(out.mock.calls[0][0]).not.toContain(KEY);
  });
});

describe("鍵が出力に混ざらない", () => {
  it("応答本文に鍵が入っていても伏せて出す", async () => {
    const out = vi.fn();
    await run({
      argv: ["list"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(textResponse(`控え: ${KEY} です`)),
      out,
      err: vi.fn(),
    });

    expect(out.mock.calls[0][0]).not.toContain(KEY);
    expect(out.mock.calls[0][0]).toContain(REDACTED);
  });

  it("失敗の案内にも鍵は出さない", async () => {
    const err = vi.fn();
    await run({
      argv: ["list"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(textResponse(`鍵 ${KEY} は無効です`, { status: 401 })),
      out: vi.fn(),
      err,
    });

    expect(err.mock.calls[0][0]).not.toContain(KEY);
  });

  it("鍵は Authorization ヘッダー以外のどこにも載せない", async () => {
    const fetchImpl = fakeFetch(textResponse("本文"));
    await run({ argv: ["list"], env: { [KEY_VAR]: KEY }, fetchImpl, out: vi.fn(), err: vi.fn() });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).not.toContain(KEY);
    expect(init.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.stringify({ ...init.headers, authorization: "" })).not.toContain(KEY);
  });
});

/* ───────────────────────── 終わったことを書き戻す ───────────────────────── */

describe("書き戻しの引数", () => {
  it("review と done は確認依頼の場所を省けない", () => {
    expect(parseArgs(["review", "req_1"]).error).toContain("--pr");
    expect(parseArgs(["done", "req_1"]).error).toContain("--pr");
  });

  it("failed は理由を省けない", () => {
    expect(parseArgs(["failed", "req_1"]).error).toContain("--reason");
  });

  it("書き戻しは1件ずつしか受け付けない", () => {
    expect(parseArgs(["done", "a", "b", "--pr", "#81"]).error).toContain("1つだけ");
    expect(parseArgs(["review", "a", "b", "--pr", "#81"]).error).toContain("1つだけ");
  });

  it("確認依頼の場所は値の形をどちらでも受ける", () => {
    expect(parseArgs(["review", "a", "--pr", "#81"])).toMatchObject({ command: "review", detail: "#81" });
    expect(parseArgs(["review", "a", "--pr=#81"])).toMatchObject({ command: "review", detail: "#81" });
  });

  it("v53 までの --release も受け続ける", () => {
    // 手順書やメモに残っている書き方で、いきなり動かなくならないようにする。
    expect(parseArgs(["done", "a", "--release", "#81"])).toMatchObject({ command: "done", detail: "#81" });
    expect(parseArgs(["done", "a", "--release=#81"])).toMatchObject({ command: "done", detail: "#81" });
  });
});

describe("書き戻しの実行", () => {
  it("review は結果と確認依頼の場所を送る", async () => {
    const fetchImpl = fakeFetch(textResponse('{"ok":true,"message":"レビュー待ちにしました。"}'));
    const out = vi.fn();
    const code = await run({
      argv: ["review", "req_1", "--pr", "https://example.com/pull/81"],
      env: { [KEY_VAR]: KEY },
      fetchImpl,
      out,
      err: vi.fn(),
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(code).toBe(0);
    expect(url).toBe(`${DEFAULT_BASE}/api/improvements`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      id: "req_1",
      result: "review",
      detail: "https://example.com/pull/81",
    });
    expect(out.mock.calls[0][0]).toContain("レビュー待ち");
  });

  it("done は結果と確認依頼の場所を送る", async () => {
    const fetchImpl = fakeFetch(textResponse('{"ok":true,"message":"対応済みにしました。"}'));
    const out = vi.fn();
    const code = await run({
      argv: ["done", "req_1", "--pr", "#81"],
      env: { [KEY_VAR]: KEY },
      fetchImpl,
      out,
      err: vi.fn(),
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(code).toBe(0);
    expect(url).toBe(`${DEFAULT_BASE}/api/improvements`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ id: "req_1", result: "done", detail: "#81" });
    expect(out.mock.calls[0][0]).toContain("対応済み");
  });

  it("順番を飛ばした断りは、サーバーの文をそのまま出す", async () => {
    // 「先にレビュー待ちにしてください」が次の一手そのものになる。訳し直さない。
    const fetchImpl = fakeFetch(
      textResponse('{"ok":false,"message":"まだ確認依頼が出ていないので、対応済みにできません。"}', {
        status: 409,
      }),
    );
    const err = vi.fn();
    const code = await run({
      argv: ["done", "req_1", "--pr", "#81"],
      env: { [KEY_VAR]: KEY },
      fetchImpl,
      out: vi.fn(),
      err,
    });

    expect(code).toBe(1);
    expect(err.mock.calls[0][0]).toContain("対応済みにできません");
  });

  it("failed は理由を送る", async () => {
    const fetchImpl = fakeFetch(textResponse('{"ok":true,"message":"対応中のまま残しました。"}'));
    await run({
      argv: ["failed", "req_1", "--reason", "再現できませんでした"],
      env: { [KEY_VAR]: KEY },
      fetchImpl,
      out: vi.fn(),
      err: vi.fn(),
    });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      id: "req_1",
      result: "failed",
      detail: "再現できませんでした",
    });
  });

  it("断られたときはサーバーの理由をそのまま次の一手にする", async () => {
    const err = vi.fn();
    const code = await run({
      argv: ["done", "req_1", "--release", "v53"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(
        textResponse('{"ok":false,"message":"この要望は、この鍵ではまだ受け取っていません。"}', { status: 403 }),
      ),
      out: vi.fn(),
      err,
    });

    expect(code).toBe(1);
    expect(err.mock.calls[0][0]).toContain("まだ受け取っていません");
  });
});

/* ───────────────────────── ブラウザで承認して端末を通す ───────────────────────── */

const REFRESH = "refresh-token-abcdefghijklmnopqrstuvwxyz";
const ACCESS = "access-token-0123456789abcdefghij";

/** 呼ばれた順に別の返事をする通信のふり。 */
function scriptedFetch(responses) {
  let i = 0;
  return vi.fn(async () => responses[Math.min(i++, responses.length - 1)]);
}

describe("端末を通す（login）", () => {
  const started = textResponse(
    JSON.stringify({
      userCode: "ABCD2345",
      deviceCode: "device-code-zzzzzzzzzzzzzzzzzzzz",
      intervalSeconds: 5,
      expiresInMinutes: 10,
      instructions: "ブラウザで次の画面を開き、合言葉を入れてください。\n  合言葉: ABCD-2345",
    }),
  );

  it("承認されるまで待ち、受け取った通行証は表示せず書き込む", async () => {
    const out = vi.fn();
    const err = vi.fn();
    const saveToken = vi.fn();
    const fetchImpl = scriptedFetch([
      started,
      textResponse(JSON.stringify({ state: "pending", message: "まだ承認されていません。" })),
      textResponse(JSON.stringify({ state: "approved", refreshToken: REFRESH, accessToken: ACCESS })),
    ]);

    const code = await run({
      argv: ["login", "--label", "開発機"],
      env: {},
      fetchImpl,
      out,
      err,
      sleep: async () => {},
      saveToken,
    });

    expect(code).toBe(0);
    // 待っている間に、断りの応答を返し続けない（待ちも 200 で見分ける）
    expect(fetchImpl.mock.calls[1][1].method).toBe("PUT");
    expect(saveToken).toHaveBeenCalledWith(REFRESH);
    const printed = [...out.mock.calls, ...err.mock.calls].flat().join("\n");
    expect(printed).toContain("ABCD-2345");
    expect(printed).toContain(KEY_FILE);
    expect(printed).not.toContain(REFRESH);
    expect(printed).not.toContain(ACCESS);
  });

  it("端末の名前は開始のときに送る", async () => {
    const fetchImpl = scriptedFetch([
      started,
      textResponse(JSON.stringify({ state: "approved", refreshToken: REFRESH, accessToken: ACCESS })),
    ]);
    await run({
      argv: ["login", "--label", "開発機"],
      env: {},
      fetchImpl,
      out: vi.fn(),
      err: vi.fn(),
      sleep: async () => {},
      saveToken: vi.fn(),
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ label: "開発機" });
  });

  it("断られたら理由を出して止まり、何も書き込まない", async () => {
    const err = vi.fn();
    const saveToken = vi.fn();
    const code = await run({
      argv: ["login"],
      env: {},
      fetchImpl: scriptedFetch([
        started,
        textResponse(JSON.stringify({ state: "denied", message: "この端末は承認されませんでした。" })),
      ]),
      out: vi.fn(),
      err,
      sleep: async () => {},
      saveToken,
    });

    expect(code).toBe(1);
    expect(saveToken).not.toHaveBeenCalled();
    expect(err.mock.calls[0][0]).toContain("承認されませんでした");
  });
});

describe("短い通行証を毎回取り直す", () => {
  it("長い方は送るだけで、受け取りには短い方を使う", async () => {
    const fetchImpl = scriptedFetch([
      textResponse(JSON.stringify({ accessToken: ACCESS, expiresInSeconds: 900 })),
      textResponse("# 手つかずの改善要望 0件\n"),
    ]);
    const out = vi.fn();
    const err = vi.fn();

    const code = await run({ argv: ["list"], env: { [TOKEN_VAR]: REFRESH }, fetchImpl, out, err });

    expect(code).toBe(0);
    const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0];
    expect(tokenUrl).toBe(`${DEFAULT_BASE}${TOKEN_PATH}`);
    expect(JSON.parse(tokenInit.body)).toEqual({ refreshToken: REFRESH });
    // 長い方は受け取りの通信には載せない（漏れても短い方だけで済むようにする）
    expect(fetchImpl.mock.calls[1][1].headers.authorization).toBe(`Bearer ${ACCESS}`);
    const printed = [...out.mock.calls, ...err.mock.calls].flat().join("\n");
    expect(printed).not.toContain(REFRESH);
    expect(printed).not.toContain(ACCESS);
  });

  it("長い方が切れていたら、入り直しを案内して止まる", async () => {
    const err = vi.fn();
    const fetchImpl = fakeFetch(
      textResponse(JSON.stringify({ message: "通行証の期限が切れました。" }), { status: 401 }),
    );
    const code = await run({ argv: ["list"], env: { [TOKEN_VAR]: REFRESH }, fetchImpl, out: vi.fn(), err });

    expect(code).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][0]).toContain("期限が切れました");
  });

  it("通行証があるときは、古い方式の注意を出さない", async () => {
    const err = vi.fn();
    await run({
      argv: ["list"],
      env: { [TOKEN_VAR]: REFRESH },
      fetchImpl: scriptedFetch([
        textResponse(JSON.stringify({ accessToken: ACCESS })),
        textResponse("本文"),
      ]),
      out: vi.fn(),
      err,
    });
    expect(err).not.toHaveBeenCalled();
  });

  it("古い鍵はそのまま動くが、移行の案内を最後に添える", async () => {
    const err = vi.fn();
    const out = vi.fn();
    const code = await run({
      argv: ["list"],
      env: { [KEY_VAR]: KEY },
      fetchImpl: fakeFetch(textResponse("本文")),
      out,
      err,
    });

    expect(code).toBe(0);
    expect(out).toHaveBeenCalledWith("本文");
    expect(err.mock.calls.flat().join("\n")).toContain("古い方式");
  });

  it("key は通行証と鍵のどちらが読めているかを言い分ける", async () => {
    const out = vi.fn();
    await run({ argv: ["key"], env: { [TOKEN_VAR]: REFRESH }, fetchImpl: vi.fn(), out, err: vi.fn() });
    expect(out.mock.calls[0][0]).toContain("通行証は 環境変数 から");
    expect(out.mock.calls[0][0]).not.toContain(REFRESH);
  });
});

describe("1Password に預けたときの受け渡し", () => {
  it("参照が書いてあれば、自分自身を op run で起動し直す計画を作る", () => {
    const plan = opRunPlan({
      env: { [TOKEN_VAR]: "op://保管庫/項目/credential" },
      scriptPath: "/x/improvements.mjs",
      argv: ["list"],
      execPath: "/usr/bin/node",
    });
    expect(plan).toEqual({
      command: "op",
      args: ["run", "--", "/usr/bin/node", "/x/improvements.mjs", "list"],
    });
  });

  it("設定ファイル側に書いてあれば、ファイルごと渡す", () => {
    const plan = opRunPlan({
      env: {},
      envFileText: `${TOKEN_VAR}=op://保管庫/項目/credential`,
      scriptPath: "/x/improvements.mjs",
      argv: [],
      execPath: "/usr/bin/node",
    });
    expect(plan.args.slice(0, 3)).toEqual(["run", "--env-file", KEY_FILE]);
  });

  it("すでに op run の中なら、もう起動し直さない", () => {
    expect(
      opRunPlan({ env: { [TOKEN_VAR]: "op://a/b/c", [OP_RUN_GUARD]: "1" } }),
    ).toBeNull();
  });

  it("値を直に持っているときは起動し直さない", () => {
    expect(opRunPlan({ env: { [TOKEN_VAR]: REFRESH } })).toBeNull();
  });
});

describe("設定ファイルへの書き込み", () => {
  it("同じ名前の古い行は残さず、1行だけにする", () => {
    const text = writeEnvLine(`${TOKEN_VAR}=old\nHR_APP_URL=http://localhost:8787\n`, TOKEN_VAR, "new");
    expect(readEnvValue(text, TOKEN_VAR)).toBe("new");
    expect(text.split("\n").filter((l) => l.startsWith(`${TOKEN_VAR}=`))).toHaveLength(1);
    expect(readEnvValue(text, "HR_APP_URL")).toBe("http://localhost:8787");
  });

  it("何も無いところにも書ける", () => {
    expect(readEnvValue(writeEnvLine(null, TOKEN_VAR, "v"), TOKEN_VAR)).toBe("v");
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  BULK_MAX,
  DEFAULT_BASE,
  KEY_FILE,
  KEY_VAR,
  OP_REF_VAR,
  REDACTED,
  buildUrl,
  describeFailure,
  describeNetworkError,
  missingKeyMessage,
  parseArgs,
  readEnvValue,
  resolveConfig,
  run,
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

describe("鍵が未設定のとき", () => {
  it("発行画面と書き込み先を含む案内を出して終わる", async () => {
    const err = vi.fn();
    const fetchImpl = vi.fn();
    const code = await run({ argv: ["list"], env: {}, envFileText: null, fetchImpl, err, out: vi.fn() });

    expect(code).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    const message = err.mock.calls[0][0];
    expect(message).toContain("/system/agent-keys");
    expect(message).toContain(KEY_FILE);
    expect(message).toContain(KEY_VAR);
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
  it("done は公開先を省けない", () => {
    expect(parseArgs(["done", "req_1"]).error).toContain("--release");
  });

  it("failed は理由を省けない", () => {
    expect(parseArgs(["failed", "req_1"]).error).toContain("--reason");
  });

  it("書き戻しは1件ずつしか受け付けない", () => {
    expect(parseArgs(["done", "a", "b", "--release", "v9"]).error).toContain("1つだけ");
  });

  it("公開先は値の形をどちらでも受ける", () => {
    expect(parseArgs(["done", "a", "--release", "v9"])).toMatchObject({ command: "done", detail: "v9" });
    expect(parseArgs(["done", "a", "--release=v9"])).toMatchObject({ command: "done", detail: "v9" });
  });
});

describe("書き戻しの実行", () => {
  it("done は結果と公開先を送る", async () => {
    const fetchImpl = fakeFetch(textResponse('{"ok":true,"message":"対応済みにしました。"}'));
    const out = vi.fn();
    const code = await run({
      argv: ["done", "req_1", "--release", "v53"],
      env: { [KEY_VAR]: KEY },
      fetchImpl,
      out,
      err: vi.fn(),
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(code).toBe(0);
    expect(url).toBe(`${DEFAULT_BASE}/api/improvements`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ id: "req_1", result: "done", detail: "v53" });
    expect(out.mock.calls[0][0]).toContain("対応済み");
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

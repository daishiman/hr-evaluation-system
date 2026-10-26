import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { IMPORT_MAX_BYTES } from "@/lib/import";
import { HttpError } from "@/lib/session";
import { readBodyWithinLimit, readJsonBodyWithinLimit } from "@/lib/request-body";

describe("API本文の実サイズ上限", () => {
  it("content-lengthで解析前に上限超過を拒否する", async () => {
    const request = new Request("http://localhost/api/improvements", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "101" },
      body: JSON.stringify({ value: "small" }),
    });
    await expect(readJsonBodyWithinLimit(request, 100)).rejects.toMatchObject({ status: 413 } satisfies Partial<HttpError>);
  });

  it("content-lengthが無くても読取中の実バイト数で拒否する", async () => {
    const request = new Request("http://localhost/api/improvements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "あ".repeat(100) }),
    });
    await expect(readJsonBodyWithinLimit(request, 100)).rejects.toMatchObject({ status: 413 } satisfies Partial<HttpError>);
  });

  it("上限内のJSONを解析する", async () => {
    const request = new Request("http://localhost/api/improvements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "ok" }),
    });
    await expect(readJsonBodyWithinLimit(request, 100)).resolves.toEqual({ value: "ok" });
  });

  it("超過後のcancelが失敗しても413を維持し、readerのロックを解放する", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(101)); },
      cancel() { throw new Error("cancel failed"); },
    });
    const request = new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST", body: stream, duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readBodyWithinLimit(request, 100)).rejects.toMatchObject({
      status: 413, message: "送信内容が大きすぎます。内容を減らしてお試しください。",
    });
    expect(stream.locked).toBe(false);
  });

  it("読み取り自体の失敗はサイズ超過へ置き換えず、ロックを解放する", async () => {
    const failure = new Error("read failed");
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(failure); } });
    const request = new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST", body: stream, duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readBodyWithinLimit(request, 100)).rejects.toBe(failure);
    expect(stream.locked).toBe(false);
  });

  it("本文が無ければ、そのまま読む口は null を返し、JSON として読む口は 400 にする", async () => {
    const empty = () => new Request("http://localhost/api/auth/sign-out", { method: "POST" });
    await expect(readBodyWithinLimit(empty(), 100)).resolves.toBeNull();
    await expect(readJsonBodyWithinLimit(empty(), 100)).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });

  it("そのまま読む口は、上限の内の本文を同じバイト列で返す", async () => {
    const text = "あいう-abc";
    const request = new Request("http://localhost/api/auth/sign-in/email", { method: "POST", body: text });
    const bytes = await readBodyWithinLimit(request, 100);
    expect(bytes && new TextDecoder().decode(bytes)).toBe(text);
  });
});

/**
 * 本文の上限の2段（DD-032 の9）。
 * Route Handler は全て readJsonBodyWithinLimit で読み、本文を直に読まない（外観の保存も含める）。
 * 認証の口は本文を better-auth に渡し直すので、解析しない readBodyWithinLimit で同じ上限まで読む。
 * Server Action の上限は、いちばん大きい取り込みの本文に form の包みを足しても収まる 6.5mb に絞る。
 */
describe("本文の上限の2段", () => {
  const ROOT = process.cwd();

  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return routeFiles(p);
      return e.name === "route.ts" ? [p] : [];
    });
  }

  it("Route Handler は本文を直に読まない", () => {
    const direct = routeFiles(join(ROOT, "src/app"))
      .filter((file) => /\b(req|request)\.(json|text|formData|arrayBuffer|blob)\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file));
    expect(direct).toEqual([]);
  });

  it("Server Action の上限は 6.5mb で、取り込みの上限より大きい", () => {
    const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    expect(config).toMatch(/bodySizeLimit:\s*"6\.5mb"/);
    expect(IMPORT_MAX_BYTES).toBe(6_100_000);
    expect(IMPORT_MAX_BYTES).toBeLessThan(6.5 * 1024 * 1024);
  });
});

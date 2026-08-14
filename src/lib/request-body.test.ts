import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/session";
import { readJsonBodyWithinLimit } from "@/lib/request-body";

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
});

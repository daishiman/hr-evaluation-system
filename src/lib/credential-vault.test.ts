import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import {
  LEGACY_CREDENTIAL_READ_UNTIL,
  importVaultKey,
  memoDelete,
  memoUpsert,
  openMemo,
  readMemo,
  sealMemo,
} from "@/lib/credential-vault";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn() }));

const KEY_A = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const KEY_B = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

describe("鍵の読み込み", () => {
  it("32バイトの鍵だけを受け付ける", async () => {
    expect(await importVaultKey(KEY_A)).not.toBeNull();
    expect(await importVaultKey(undefined)).toBeNull();
    expect(await importVaultKey("")).toBeNull();
    expect(await importVaultKey(btoa("short"))).toBeNull();
    expect(await importVaultKey("%%%not-base64%%%")).toBeNull();
  });

  it("鍵の指紋は鍵ごとに違い、同じ鍵なら同じ", async () => {
    const a1 = await importVaultKey(KEY_A);
    const a2 = await importVaultKey(KEY_A);
    const b = await importVaultKey(KEY_B);
    expect(a1?.version).toBe(a2?.version);
    expect(a1?.version).not.toBe(b?.version);
    // 版は HKDF で導いた鍵の指紋に h1: を付けたもの（DD-032 の1）
    expect(a1?.version).toMatch(/^h1:[0-9a-f]{12}$/);
  });
});

describe("控えの暗号化", () => {
  it("同じ利用者・同じ鍵なら開ける。暗号文に平文は現れない", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const sealed = await sealMemo(vault, "user-1", "Initial-Pass-01");
    expect(sealed.ciphertext).not.toContain("Initial-Pass-01");
    expect(atob(sealed.ciphertext)).not.toContain("Initial-Pass-01");
    expect(await openMemo(vault, "user-1", sealed)).toEqual({ ok: true, password: "Initial-Pass-01" });
  });

  it("同じパスワードでも毎回ちがう暗号文になる", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const a = await sealMemo(vault, "user-1", "same");
    const b = await sealMemo(vault, "user-1", "same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("別の利用者の行へ写した暗号文は開けない", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const sealed = await sealMemo(vault, "user-1", "Initial-Pass-01");
    expect(await openMemo(vault, "user-2", sealed)).toEqual({ ok: false, reason: "broken" });
  });

  it("鍵を入れ替えたあとの古い控えは、鍵が替わったと分かる", async () => {
    const a = (await importVaultKey(KEY_A))!;
    const b = (await importVaultKey(KEY_B))!;
    const sealed = await sealMemo(a, "user-1", "pw");
    expect(await openMemo(b, "user-1", sealed)).toEqual({ ok: false, reason: "key-changed" });
  });
});

describe("控えの保存（D1と同じ形の表）", () => {
  let t: TestDatabase;

  beforeEach(async () => {
    t = createTestDatabase();
    await t.db.insert(s.users).values({ id: "user-1", name: "試験", email: "t@example.com" });
  });
  afterEach(() => t.close());

  it("1人1行で、再発行すると置き換わる", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    await memoUpsert(t.db, { userId: "user-1", issuedBy: "admin", ...(await sealMemo(vault, "user-1", "first")) });
    await memoUpsert(t.db, { userId: "user-1", issuedBy: "admin", ...(await sealMemo(vault, "user-1", "second")) });

    const rows = await t.db.select().from(s.initialCredentialMemos);
    expect(rows).toHaveLength(1);
    const memo = (await readMemo(t.db, "user-1"))!;
    expect(await openMemo(vault, "user-1", memo)).toEqual({ ok: true, password: "second" });
  });

  it("消すと無くなり、利用者を消しても一緒に消える", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    await memoUpsert(t.db, { userId: "user-1", issuedBy: null, ...(await sealMemo(vault, "user-1", "pw")) });
    await memoDelete(t.db, "user-1");
    expect(await readMemo(t.db, "user-1")).toBeUndefined();

    await memoUpsert(t.db, { userId: "user-1", issuedBy: null, ...(await sealMemo(vault, "user-1", "pw")) });
    t.raw.exec("PRAGMA foreign_keys = ON");
    await t.db.delete(s.users).where(eq(s.users.id, "user-1"));
    expect(await readMemo(t.db, "user-1")).toBeUndefined();
  });

  it("平文の列を持たない", () => {
    const columns = t.raw.prepare("PRAGMA table_info(initial_credential_memos)").all() as { name: string }[];
    expect(columns.map((c) => c.name).sort()).toEqual(
      ["ciphertext", "issued_at", "issued_by", "iv", "key_version", "user_id"].sort(),
    );
  });
});

/**
 * 控えの鍵の版と、今の形式の控えを読む期限（DD-032 の1）。
 * 新しい控えは CREDENTIAL_ENC_KEY から HKDF で導いた鍵で包み、keyVersion を `h1:` で始める。
 * `h1:` の無い今の形式（生の鍵で包み、版は生の鍵の SHA-256 の先頭6バイト）は、
 * 移行の間（LEGACY_CREDENTIAL_READ_UNTIL まで）だけ読み、過ぎたら読まない。
 * 今の形式の見本は、実装を通さずにここで Web Crypto だけで作る（本番に残っている控えと同じ形）。
 */
describe("控えの鍵の版と、今の形式を読む期限", () => {
  const encoder = new TextEncoder();
  const BEFORE_UNTIL = new Date("2026-11-20T00:00:00Z");
  const AFTER_UNTIL = new Date("2026-12-02T00:00:00Z");

  const bytesOf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const b64Of = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

  /** 今の形式の控え（生の鍵で包み、版は h1: を持たない12桁の hex） */
  async function sealLegacy(rawB64: string, userId: string, password: string) {
    const raw = bytesOf(rawB64);
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(userId) },
      key,
      encoder.encode(password),
    );
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
    const keyVersion = [...digest.slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { ciphertext: b64Of(new Uint8Array(cipher)), iv: b64Of(iv), keyVersion };
  }

  it("新しい控えの版は h1: で始まり、期限の後でも開ける", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const sealed = await sealMemo(vault, "user-1", "Initial-Pass-01");
    expect(sealed.keyVersion).toMatch(/^h1:[0-9a-f]{12}$/);
    expect(await openMemo(vault, "user-1", sealed, AFTER_UNTIL)).toEqual({ ok: true, password: "Initial-Pass-01" });
  });

  it("新しい控えは、生の鍵では開けない（用途ごとに導いた鍵で包む）", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const sealed = await sealMemo(vault, "user-1", "Initial-Pass-01");
    const rawKey = await crypto.subtle.importKey("raw", bytesOf(KEY_A), "AES-GCM", false, ["decrypt"]);
    await expect(
      crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytesOf(sealed.iv), additionalData: encoder.encode("user-1") },
        rawKey,
        bytesOf(sealed.ciphertext),
      ),
    ).rejects.toThrow();
  });

  it("読む期限は 2026-11-30 の日のうちに置く", () => {
    const until = new Date(LEGACY_CREDENTIAL_READ_UNTIL).getTime();
    expect(until).toBeGreaterThanOrEqual(Date.parse("2026-11-29T15:00:00Z"));
    expect(until).toBeLessThanOrEqual(Date.parse("2026-12-01T15:00:00Z"));
  });

  it("今の形式の控えは、期限の前なら今の鍵のまま開ける", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const legacy = await sealLegacy(KEY_A, "user-1", "Legacy-Pass-01");
    expect(await openMemo(vault, "user-1", legacy, BEFORE_UNTIL)).toEqual({ ok: true, password: "Legacy-Pass-01" });
  });

  it("今の形式の控えは、期限を過ぎたら読まない", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const legacy = await sealLegacy(KEY_A, "user-1", "Legacy-Pass-01");
    const result = await openMemo(vault, "user-1", legacy, AFTER_UNTIL);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("Legacy-Pass-01");
  });

  it("今の形式でも、別の鍵で作った控えは鍵が替わったと分かる", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const legacy = await sealLegacy(KEY_B, "user-1", "pw");
    expect(await openMemo(vault, "user-1", legacy, BEFORE_UNTIL)).toEqual({ ok: false, reason: "key-changed" });
  });

  it("今の形式でも、別の利用者の行へ写した控えは開けない", async () => {
    const vault = (await importVaultKey(KEY_A))!;
    const legacy = await sealLegacy(KEY_A, "user-1", "pw");
    expect(await openMemo(vault, "user-2", legacy, BEFORE_UNTIL)).toEqual({ ok: false, reason: "broken" });
  });
});

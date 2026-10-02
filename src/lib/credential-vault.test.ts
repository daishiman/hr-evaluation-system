import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import {
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
    expect(a1?.version).toMatch(/^[0-9a-f]{12}$/);
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

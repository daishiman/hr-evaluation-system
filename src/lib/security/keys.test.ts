import { createHash, createHmac, hkdfSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HKDF_SALT,
  KEY_INFO,
  deriveCredentialMemoKey,
  deriveImportConfirmationKey,
  deriveKeyBytes,
} from "./keys";
import { issueImportConfirmation, verifyImportConfirmation } from "@/lib/domain/import-confirmation";
import { importVaultKey, sealMemo } from "@/lib/credential-vault";

/**
 * 鍵を用途ごとに HKDF で導く（DD-032 の1）。
 * 正解は node:crypto の hkdfSync で別に計算し、実装の Web Crypto の結果と突き合わせる。
 */

const encoder = new TextEncoder();
const RAW_32 = new Uint8Array(32).fill(7);
const RAW_32_B64 = btoa(String.fromCharCode(...RAW_32));

function expected(ikm: Uint8Array, info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", ikm, encoder.encode(HKDF_SALT), encoder.encode(info), 32));
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function confirmationBody(formId: string, csv: string): string {
  return `${formId.length}:${formId}${csv}`;
}

describe("鍵の導き方の定数", () => {
  it("salt と用途ごとの info は版を持つ固定の文字列", () => {
    expect(HKDF_SALT).toBe("hr-eval/hkdf/v1");
    expect(KEY_INFO.importConfirmation).toBe("hr-eval/import-confirmation/v1");
    expect(KEY_INFO.credentialMemo).toBe("hr-eval/credential-memo/v1");
  });
});

describe("deriveKeyBytes", () => {
  it("用途ごとに hkdfSync と同じ32バイトを返す", async () => {
    const secret = encoder.encode("better-auth-secret-for-test");
    for (const info of [KEY_INFO.importConfirmation, KEY_INFO.credentialMemo]) {
      const got = await deriveKeyBytes(secret, info);
      expect(got.byteLength).toBe(32);
      expect(Buffer.from(got).equals(expected(secret, info))).toBe(true);
    }
  });

  it("同じ秘密でも用途が違えば別の鍵になり、元の秘密とも違う", async () => {
    const a = await deriveKeyBytes(RAW_32, KEY_INFO.importConfirmation);
    const b = await deriveKeyBytes(RAW_32, KEY_INFO.credentialMemo);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(Buffer.from(a).equals(Buffer.from(RAW_32))).toBe(false);
  });
});

describe("取り込みの確認の印", () => {
  it("生の秘密ではなく、導いた鍵で HMAC を取る", async () => {
    const secret = "better-auth-secret-for-test";
    const body = confirmationBody("form-a", "氏名,回答\n山田,10");
    const token = await issueImportConfirmation(secret, "form-a", "氏名,回答\n山田,10");

    const withRawSecret = base64Url(createHmac("sha256", secret).update(body).digest());
    const derived = expected(encoder.encode(secret), KEY_INFO.importConfirmation);
    const withDerived = base64Url(createHmac("sha256", derived).update(body).digest());

    expect(token).not.toBe(withRawSecret);
    expect(token).toBe(withDerived);
    await expect(verifyImportConfirmation(secret, token, "form-a", "氏名,回答\n山田,10")).resolves.toBe(true);
  });

  it("deriveImportConfirmationKey は HMAC-SHA-256 の鍵を返す", async () => {
    const key = await deriveImportConfirmationKey("better-auth-secret-for-test");
    expect(key.algorithm).toMatchObject({ name: "HMAC", hash: { name: "SHA-256" } });
  });
});

describe("初期パスワードの控えの鍵", () => {
  it("版は h1: と、導いた鍵の SHA-256 の先頭6バイトの hex", async () => {
    const derived = expected(RAW_32, KEY_INFO.credentialMemo);
    const fingerprint = createHash("sha256").update(derived).digest("hex").slice(0, 12);
    const memoKey = await deriveCredentialMemoKey(RAW_32);
    expect(memoKey.version).toBe(`h1:${fingerprint}`);
    const vault = await importVaultKey(RAW_32_B64);
    expect(vault?.version).toBe(`h1:${fingerprint}`);
  });

  it("控えは導いた鍵で暗号化され、hkdfSync のバイトから作った鍵で開ける", async () => {
    const vault = (await importVaultKey(RAW_32_B64))!;
    const sealed = await sealMemo(vault, "user-1", "Initial-Pass-01");
    const derived = expected(RAW_32, KEY_INFO.credentialMemo);
    const key = await crypto.subtle.importKey("raw", new Uint8Array(derived), "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Uint8Array.from(atob(sealed.iv), (c) => c.charCodeAt(0)),
        additionalData: encoder.encode("user-1"),
      },
      key,
      Uint8Array.from(atob(sealed.ciphertext), (c) => c.charCodeAt(0)),
    );
    expect(new TextDecoder().decode(plain)).toBe("Initial-Pass-01");
  });
});

describe("keys.ts の依存", () => {
  it("Web Crypto のほかは import しない（移し替えの script が素の node で読めるように）", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/security/keys.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\(/);
  });
});

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function confirmationBody(formId: string, csv: string): ArrayBuffer {
  const bytes = encoder.encode(`${formId.length}:${formId}${csv}`);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** dry-runで確認したフォームIDとCSV本文を、秘密鍵で改ざん防止した短い証明にする。 */
export async function issueImportConfirmation(secret: string, formId: string, csv: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), confirmationBody(formId, csv));
  return bytesToBase64Url(new Uint8Array(signature));
}

/** 本取り込みの内容が、直前のdry-runで確認した内容と完全一致するか検証する。 */
export async function verifyImportConfirmation(
  secret: string,
  token: string,
  formId: string,
  csv: string,
): Promise<boolean> {
  const signature = base64UrlToBytes(token);
  if (!signature) return false;
  const signatureBuffer = signature.buffer.slice(
    signature.byteOffset,
    signature.byteOffset + signature.byteLength,
  ) as ArrayBuffer;
  return crypto.subtle.verify("HMAC", await hmacKey(secret), signatureBuffer, confirmationBody(formId, csv));
}

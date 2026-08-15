/**
 * ローカルpreviewで改善要望の縦切りをHTTP越しに確かめる。
 * productionへは接続せず、本文・cookie・パスワードを出力しない。
 */
import { DEMO_PASSWORD } from "./seed-data.mjs";

const base = process.argv[2] || "http://localhost:8787";
const originHeaders = { origin: base, referer: `${base}/login` };

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function signIn(email, attempt = 0) {
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", ...originHeaders },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
    redirect: "manual",
  });
  if (response.status === 429 && attempt < 3) {
    await pause(11_000);
    return signIn(email, attempt + 1);
  }
  const cookie = (response.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`sign-in failed (${response.status})`);
  return cookie;
}

async function jsonRequest(path, cookie, method, body) {
  const response = await fetch(base + path, {
    method,
    headers: { cookie, "content-type": "application/json", origin: base, referer: `${base}/admin` },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const json = await response.json();
  return { status: response.status, json };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const employeeCookie = await signIn("e1@kyufu.hyoka-demo.jp");
const submissionKey = crypto.randomUUID();
const request = {
  path: "/f/e2e-preview-token?employee=hidden",
  body: "preview縦切り確認用の改善要望",
  // 種類は必須（画面のchip選択と同じ値を送る）。
  kind: "usability",
  viewport: "375×812",
  shot: null,
  submissionKey,
};
const first = await jsonRequest("/api/improvements", employeeCookie, "POST", request);
const retry = await jsonRequest("/api/improvements", employeeCookie, "POST", request);
expect(first.status === 200 && retry.status === 200, "post/idempotent retry failed");
expect(first.json.id === retry.json.id, "idempotent retry returned another id");

const adminCookie = await signIn("admin@kyufu.hyoka-demo.jp");
const list = await fetch(`${base}/admin/improvements?route=%2Ff%2F%5Btoken%5D`, {
  headers: { cookie: adminCookie },
  redirect: "manual",
});
const listHtml = await list.text();
expect(list.status === 200 && listHtml.includes("preview縦切り確認用の改善要望"), "admin list did not show request");

const detail = await fetch(`${base}/admin/improvements/${first.json.id}`, {
  headers: { cookie: adminCookie },
  redirect: "manual",
});
const detailHtml = await detail.text();
expect(detail.status === 200, "admin detail failed");
expect(detailHtml.includes("/f/e2e-preview-token") && detailHtml.includes("配布されたアンケート"), "route identity missing");

const doing = await jsonRequest(`/api/improvements/${first.json.id}`, adminCookie, "PATCH", {
  status: "doing",
  note: "previewで確認中",
});
const clear = await jsonRequest(`/api/improvements/${first.json.id}`, adminCookie, "PATCH", {
  status: "doing",
  note: "",
});
const droppedWithoutReason = await jsonRequest(`/api/improvements/${first.json.id}`, adminCookie, "PATCH", {
  status: "dropped",
  note: "",
});
const dropped = await jsonRequest(`/api/improvements/${first.json.id}`, adminCookie, "PATCH", {
  status: "dropped",
  note: "preview確認を完了したため",
});
expect(doing.status === 200 && clear.status === 200, "same-status note edit/clear failed");
expect(droppedWithoutReason.status === 400 && dropped.status === 200, "dropped reason contract failed");

const forbidden = await jsonRequest(`/api/improvements/${first.json.id}`, employeeCookie, "PATCH", {
  status: "done",
  note: "権限外",
});
expect(forbidden.status === 403, "employee update was not rejected");

console.log(JSON.stringify({
  preview: base,
  post: first.status,
  idempotentRetry: retry.status,
  list: list.status,
  detail: detail.status,
  noteEdit: doing.status,
  noteClear: clear.status,
  droppedWithoutReason: droppedWithoutReason.status,
  droppedWithReason: dropped.status,
  employeeUpdate: forbidden.status,
}));

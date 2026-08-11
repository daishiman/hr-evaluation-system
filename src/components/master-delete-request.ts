import type { MasterDeleteBody } from "@/app/api/masters/body-schema";

/**
 * 制度設定の項目を完全に消す要求。
 *
 * 画面ごとに fetch を書き起こさない（4つの編集画面で同じ作法にそろえるため）。
 * 消してよいかの判定はサーバー側が行い、消せないときはその理由が message で返る。
 * 画面はその文をそのまま出す（画面側で理由を組み立て直さない）。
 */
export async function requestMasterDelete(
  kind: MasterDeleteBody["kind"],
  id: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/masters", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, id }),
    });
    const json = (await res.json()) as { ok: boolean; message?: string };
    if (!res.ok || !json.ok) return { ok: false, message: json.message ?? "消せませんでした。" };
    return { ok: true, message: json.message ?? "消しました。" };
  } catch {
    return { ok: false, message: "通信できませんでした。もう一度お試しください。" };
  }
}

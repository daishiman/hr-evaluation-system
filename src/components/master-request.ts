import { deleteMasterItem, saveMaster } from "@/actions/masters";
import { dispatchAction } from "@/lib/action-dispatch";
import type { MasterDeleteBody } from "@/lib/masters/body-schema";

/**
 * 制度設定の編集部品が送る要求（保存か、完全に消すか）。
 *
 * 1つの部品で保存と削除の両方を扱うため、Server Action を1つの入口にまとめる。
 * 部品は `const { save, saving } = useSaveAction(masterRequest, { resource: "masters" })`
 * で受け、`save(masterSave({...}))` と `save(masterDelete(kind, id))` を使い分ける。
 * こうすると送信中の表示と、保存後の画面の描き直しを1か所で扱える。
 *
 * 消してよいかの判定はサーバー側が行い、消せないときはその理由が message で返る。
 * 画面はその文をそのまま出す（画面側で理由を組み立て直さない）。
 */
export type MasterRequest =
  | { op: "save"; input: Record<string, unknown> }
  | { op: "delete"; input: MasterDeleteBody };

/** 保存・削除のどちらでも返りうる結果の中身（削除は message だけを返す）。 */
type MasterPayload = { warnings?: string[]; id?: string; previousVersionId?: string };

/** 要求の種類に応じて、保存か削除の Server Action を呼ぶ。 */
export const masterRequest = dispatchAction<MasterRequest, MasterPayload>({
  save: saveMaster,
  delete: deleteMasterItem,
});

/** 保存の要求を作る。中身の検査はサーバー側（bodySchema）が行う。 */
export const masterSave = (input: Record<string, unknown>): MasterRequest => ({ op: "save", input });

/** 完全に消す要求を作る。 */
export const masterDelete = (kind: MasterDeleteBody["kind"], id: string): MasterRequest => ({
  op: "delete",
  input: { kind, id },
});

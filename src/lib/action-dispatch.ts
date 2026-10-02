import type { SaveAction } from "@/lib/action-result";

/** 中継が受け取る1件の要求。op で呼ぶ Server Action を選び、input をそのまま渡す。 */
export type ActionRequest = { op: string; input: unknown };

/** op ごとに呼ぶ Server Action の対応表。input の形は要求の型（R）から決まる。 */
export type ActionTable<R extends ActionRequest, T extends object> = {
  [K in R["op"]]: SaveAction<Extract<R, { op: K }>["input"], T>;
};

/**
 * 1つの部品から呼ぶ複数の Server Action を、1つの入口にまとめる。
 *
 * useSaveAction が受け取る action は1つだけ。保存と削除のように呼び分ける部品でも、
 * 送信中の印（saving）と他のタブへの知らせを全部の操作で共有できるように、
 * 要求 `{ op, input }` を受けて対応表の action へ渡す1つの関数にする。
 *
 * - 対応表は部品の側に置く（lib から src/actions を import しない）。
 * - 部品の外で1回だけ作る。描くたびに作ると、useSaveAction の save も毎回作り直される。
 * - Server Action の引数は unknown なので、input の形は要求の型 R で縛る。
 *   中身の検査はサーバー側（zod）が行う。
 */
export function dispatchAction<R extends ActionRequest, T extends object>(
  table: ActionTable<R, T>,
): SaveAction<R, T> {
  return (request) => {
    // op と input の組は R が保証する。TypeScript は対応表の引きとの対応を追えないので、ここで型を寄せる
    const action = table[request.op as R["op"]] as SaveAction<R["input"], T>;
    return action(request.input);
  };
}

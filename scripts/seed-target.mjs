/**
 * 全テーブルをデモデータへ置き換える seed の実行先契約。
 * 本番初期化の仕組みとして再利用せず、ローカル開発専用に固定する。
 */
export const REMOTE_FULL_SEED_BLOCK_MESSAGE =
  "本番D1への全置換seedは実行できません。全テーブルの削除と共通デモパスワードの投入を防ぐため、db:seed はローカル専用です。";

export function assertFullSeedTargetIsLocal(args) {
  if (args.includes("--remote")) {
    throw new Error(REMOTE_FULL_SEED_BLOCK_MESSAGE);
  }
}

import type { getDb } from "@/lib/db";
import { batchAll, type BatchStatement } from "@/lib/db-batch";
import { isConstitutionSeqConflict } from "@/lib/domain/constitution-events";
import { HttpError } from "@/lib/session";

type Db = Awaited<ReturnType<typeof getDb>>;

/** 制度マスタの書き込みで1つの batch に入れる文。 */
export type MasterStatement = BatchStatement;

/**
 * 本体の書き込みと監査記録を、1回の D1 batch で書く。
 *
 * 以前は「本体を書く → 監査記録を書く」を別々の await で並べていたため、
 * 途中で失敗すると本体だけ変わって記録が残らない状態があり得た。
 * batch は全文が通るか、どれも書かれないかのどちらかになる。
 *
 * 同じ項目を2人が同時に保存すると、監査記録の番号（seq）が重なって一意索引で止まる。
 * このとき後から書いたほうは本体の変更ごと書かれていないので、上書きせずに断り、
 * 最新の内容を見てからやり直してもらう（先の人の変更を黙って消さない）。
 */
export const MASTER_CONFLICT_MESSAGE =
  "同じ項目を別の人が同時に保存しました。再読み込みして、最新の内容を確かめてから保存してください。";

export async function writeMasterBatch(db: Db, statements: MasterStatement[]): Promise<void> {
  try {
    await batchAll(db, statements);
  } catch (error) {
    if (isConstitutionSeqConflict(error)) throw new HttpError(409, MASTER_CONFLICT_MESSAGE);
    throw error;
  }
}

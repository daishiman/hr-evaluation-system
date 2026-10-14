import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import type { BandGrade } from "@/lib/domain/behavior-band-range";
import { HttpError } from "@/lib/session";
import { writeMasterBatch, type MasterStatement } from "./write-batch";

type Db = Awaited<ReturnType<typeof getDb>>;
type AssignmentSnapshot = readonly Pick<BandGrade, "id" | "displayOrder" | "isActive" | "behaviorBand">[];

export const GRADE_ASSIGNMENT_CONFLICT_MESSAGE =
  "等級の行動指針の割り当てを別の人が同時に変更しました。再読み込みして、最新の内容を確かめてから保存してください。";

/** SQLite の assertion が返すエラーだけを原因チェーンから識別する。通信・制約エラーは含めない。 */
function isAssignmentAssertionError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current != null; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (/^(?:D1_ERROR: )?integer overflow(?:: SQLITE_ERROR)?$/.test(message.trim())) return true;
    if (!(current instanceof Error)) break;
    current = current.cause;
  }
  return false;
}

/**
 * 判定した会社全体の割り当てがまだ同じことを、本体・監査と同じ transaction 内で確かめる。
 * 名称など規則に関係しない列と他社は比較しない。行数と各行を照合するので追加・削除も検出する。
 *
 * SQLite の RAISE は trigger 専用。代わりに CASE の失敗枝だけで abs(INT64_MIN) を評価する。
 * CASE は短絡評価、abs(INT64_MIN) は明示的な integer overflow となり、D1 batch 全体を戻す。
 * https://www.sqlite.org/lang_expr.html#the_case_expression
 * https://www.sqlite.org/lang_corefunc.html#abs
 * https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
 */
export async function writeGradeAssignmentBatch(
  db: Db,
  companyId: string,
  snapshot: AssignmentSnapshot | undefined,
  statements: MasterStatement[],
): Promise<void> {
  if (!snapshot) return writeMasterBatch(db, statements);
  const expected = JSON.stringify(snapshot.map(({ id, displayOrder, isActive, behaviorBand }) => ({
    id, displayOrder, isActive: isActive ? 1 : 0, behaviorBand,
  })));
  const guard = db.select({ assertion: sql<number>`case when
    (select count(*) from grades where company_id = ${companyId}) = ${snapshot.length}
    and not exists (
      select 1 from json_each(${expected}) expected
      left join grades current
        on current.company_id = ${companyId} and current.id = json_extract(expected.value, '$.id')
      where current.id is null
        or current.display_order is not json_extract(expected.value, '$.displayOrder')
        or current.is_active is not json_extract(expected.value, '$.isActive')
        or current.behavior_band is not json_extract(expected.value, '$.behaviorBand')
    ) then 1 else abs(-9223372036854775808) end` }).from(sql`(select 1)`);
  try {
    await writeMasterBatch(db, [guard, ...statements]);
  } catch (error) {
    if (isAssignmentAssertionError(error)) throw new HttpError(409, GRADE_ASSIGNMENT_CONFLICT_MESSAGE);
    throw error;
  }
}

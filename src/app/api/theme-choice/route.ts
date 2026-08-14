import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import { handle } from "@/lib/api";
import { getDb, schema as s } from "@/lib/db";
import { PALETTES } from "@/lib/palette";
import { apiViewer } from "@/lib/session";
import { THEMES } from "@/lib/theme";

export const dynamic = "force-dynamic";

/**
 * 見た目の選択を数える。
 *
 * 保存するのは「どの組み合わせが何回選ばれたか」だけで、誰が選んだかは持たない
 * （→ src/db/schema.ts の theme_choice_counts）。画面側の呼び出し口は
 * src/lib/theme-usage.ts に1箇所だけあり、送信先を替えたくなったらそこを差し替える。
 */
const bodySchema = z.object({
  palette: z.enum(PALETTES),
  mode: z.enum(THEMES),
  resolved: z.enum(["light", "dark"]),
});

export async function POST(req: Request) {
  return handle(async () => {
    // ログインしている人からの1票だけを受ける。外から回数を積み増せないようにするため。
    await apiViewer();
    const choice = bodySchema.parse(await req.json());
    const key = `${choice.palette}:${choice.mode}:${choice.resolved}`;

    const db = await getDb();
    await db
      .insert(s.themeChoiceCounts)
      .values({ ...choice, key, count: 1 })
      .onConflictDoUpdate({
        target: s.themeChoiceCounts.key,
        set: { count: sql`${s.themeChoiceCounts.count} + 1`, updatedAt: new Date() },
      });

    // 画面は応答を使わない（送りっぱなし）。それでも成否は返しておく。
    return { message: "選択を記録しました。" };
  });
}

/** どの色合いが選ばれているかの集計。制度全体を見る人だけが読める。 */
export async function GET() {
  return handle(async () => {
    await apiViewer("SUPER_ADMIN");
    const db = await getDb();
    const rows = await db
      .select()
      .from(s.themeChoiceCounts)
      .orderBy(desc(s.themeChoiceCounts.count));
    return { total: rows.reduce((sum, row) => sum + row.count, 0), rows };
  });
}

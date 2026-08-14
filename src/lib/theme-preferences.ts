import { and, asc, eq, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { schema as s, type DB } from "@/lib/db";
import { PALETTES } from "@/lib/palette";
import { THEMES } from "@/lib/theme";

/**
 * 利用者が現在選んでいる外観。
 * 明示的な light / dark は実表示と必ず一致させ、
 * auto のときだけ端末設定による resolved の両方を許可する。
 */
export const themePreferenceSchema = z
  .object({
    palette: z.enum(PALETTES),
    mode: z.enum(THEMES),
    resolved: z.enum(["light", "dark"]),
  })
  .strict()
  .superRefine((choice, ctx) => {
    if (choice.mode !== "auto" && choice.mode !== choice.resolved) {
      ctx.addIssue({
        code: "custom",
        path: ["resolved"],
        message: "明示した明るさと実際の表示が一致していません",
      });
    }
  });

export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export interface ThemePreferenceUsageRow extends ThemePreference {
  users: number;
  /** 計測済みの有効利用者を100%とした構成比。 */
  percentage: number;
}

export interface ThemePreferenceUsage {
  activeUsers: number;
  measuredUsers: number;
  /** 有効利用者のうち現在設定を計測できている割合。 */
  coverageRate: number;
  rows: ThemePreferenceUsageRow[];
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/** 利用者の現在値を1行にupsert。同値は更新時刻も変えない。 */
export async function upsertThemePreference(
  db: DB,
  userId: string,
  choice: ThemePreference,
  changedAt = new Date(),
): Promise<void> {
  await db
    .insert(s.themeUserPreferences)
    .values({ userId, ...choice, updatedAt: changedAt })
    .onConflictDoUpdate({
      target: s.themeUserPreferences.userId,
      set: { ...choice, updatedAt: changedAt },
      setWhere: or(
        ne(s.themeUserPreferences.palette, choice.palette),
        ne(s.themeUserPreferences.mode, choice.mode),
        ne(s.themeUserPreferences.resolved, choice.resolved),
      ),
    });
}

/** SUPER_ADMIN向けの集計。個人のID・氏名・メールは返さない。 */
export async function readThemePreferenceUsage(db: DB): Promise<ThemePreferenceUsage> {
  const [active] = await db
    .select({ users: sql<number>`COUNT(*)` })
    .from(s.users)
    .where(eq(s.users.isActive, true));

  const grouped = await db
    .select({
      palette: s.themeUserPreferences.palette,
      mode: s.themeUserPreferences.mode,
      resolved: s.themeUserPreferences.resolved,
      users: sql<number>`COUNT(*)`,
    })
    .from(s.themeUserPreferences)
    .innerJoin(
      s.users,
      and(eq(s.users.id, s.themeUserPreferences.userId), eq(s.users.isActive, true)),
    )
    .groupBy(
      s.themeUserPreferences.palette,
      s.themeUserPreferences.mode,
      s.themeUserPreferences.resolved,
    )
    .orderBy(
      asc(s.themeUserPreferences.palette),
      asc(s.themeUserPreferences.mode),
      asc(s.themeUserPreferences.resolved),
    );

  const activeUsers = Number(active?.users ?? 0);
  const measuredUsers = grouped.reduce((sum, row) => sum + Number(row.users), 0);
  return {
    activeUsers,
    measuredUsers,
    coverageRate: activeUsers > 0 ? oneDecimal((measuredUsers / activeUsers) * 100) : 0,
    rows: grouped.map((row) => ({
      palette: themePreferenceSchema.shape.palette.parse(row.palette),
      mode: themePreferenceSchema.shape.mode.parse(row.mode),
      resolved: themePreferenceSchema.shape.resolved.parse(row.resolved),
      users: Number(row.users),
      percentage: measuredUsers > 0 ? oneDecimal((Number(row.users) / measuredUsers) * 100) : 0,
    })),
  };
}

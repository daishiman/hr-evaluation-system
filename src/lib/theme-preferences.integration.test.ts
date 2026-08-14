import { afterEach, describe, expect, it } from "vitest";
import { schema as s } from "@/lib/db";
import {
  readThemePreferenceUsage,
  themePreferenceSchema,
  upsertThemePreference,
} from "@/lib/theme-preferences";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";

const opened: TestDatabase[] = [];

afterEach(() => {
  while (opened.length) opened.pop()?.close();
});

function database() {
  const testDb = createTestDatabase();
  opened.push(testDb);
  return testDb;
}

async function addUser(testDb: TestDatabase, id: string, active = true) {
  await testDb.db.insert(s.users).values({
    id,
    name: `利用者 ${id}`,
    email: `${id}@example.com`,
    role: "EMPLOYEE",
    isActive: active,
  });
}

describe("現在の配色設定", () => {
  it("マイグレーションが利用者1人に現在設定1行の表を作る", () => {
    const testDb = database();
    const columns = testDb.raw.prepare("PRAGMA table_info(theme_user_preferences)").all();

    expect(columns.map((column) => String(column.name))).toEqual([
      "user_id",
      "palette",
      "mode",
      "resolved",
      "updated_at",
    ]);
    expect(columns.find((column) => column.name === "user_id")?.pk).toBe(1);
  });

  it("不正値と、明示した明るさと実表示が矛盾する値を受け付けない", () => {
    expect(() => themePreferenceSchema.parse({ palette: "red", mode: "light", resolved: "light" })).toThrow();
    expect(() => themePreferenceSchema.parse({ palette: "azure", mode: "light", resolved: "dark" })).toThrow();
    expect(() => themePreferenceSchema.parse({ palette: "azure", mode: "dark", resolved: "light" })).toThrow();
    expect(themePreferenceSchema.parse({ palette: "azure", mode: "auto", resolved: "dark" })).toEqual({
      palette: "azure",
      mode: "auto",
      resolved: "dark",
    });

    const testDb = database();
    expect(() =>
      testDb.raw.exec(
        "INSERT INTO theme_user_preferences (user_id, palette, mode, resolved, updated_at) VALUES ('nobody', 'azure', 'light', 'dark', 0)",
      ),
    ).toThrow(/ck_theme_user_preferences_consistent/);
  });

  it("同じ利用者の選択を1行で上書きし、同値の再選択は更新時刻も変えない", async () => {
    const testDb = database();
    await addUser(testDb, "user-1");

    await upsertThemePreference(
      testDb.db,
      "user-1",
      { palette: "azure", mode: "dark", resolved: "dark" },
      new Date("2026-08-14T01:00:00.000Z"),
    );
    await upsertThemePreference(
      testDb.db,
      "user-1",
      { palette: "moss", mode: "light", resolved: "light" },
      new Date("2026-08-14T02:00:00.000Z"),
    );
    await upsertThemePreference(
      testDb.db,
      "user-1",
      { palette: "moss", mode: "light", resolved: "light" },
      new Date("2026-08-14T03:00:00.000Z"),
    );

    expect(
      testDb.raw
        .prepare("SELECT user_id, palette, mode, resolved, updated_at FROM theme_user_preferences")
        .all(),
    ).toEqual([
      {
        user_id: "user-1",
        palette: "moss",
        mode: "light",
        resolved: "light",
        updated_at: new Date("2026-08-14T02:00:00.000Z").getTime(),
      },
    ]);
  });

  it("有効な複数利用者の現在値だけを人数・割合・計測率にまとめる", async () => {
    const testDb = database();
    await addUser(testDb, "user-1");
    await addUser(testDb, "user-2");
    await addUser(testDb, "user-3");
    await addUser(testDb, "user-stopped", false);

    await upsertThemePreference(testDb.db, "user-1", { palette: "azure", mode: "dark", resolved: "dark" });
    await upsertThemePreference(testDb.db, "user-2", { palette: "azure", mode: "auto", resolved: "light" });
    await upsertThemePreference(testDb.db, "user-stopped", {
      palette: "sand",
      mode: "light",
      resolved: "light",
    });

    expect(await readThemePreferenceUsage(testDb.db)).toEqual({
      activeUsers: 3,
      measuredUsers: 2,
      coverageRate: 66.7,
      rows: [
        { palette: "azure", mode: "auto", resolved: "light", users: 1, percentage: 50 },
        { palette: "azure", mode: "dark", resolved: "dark", users: 1, percentage: 50 },
      ],
    });
  });
});

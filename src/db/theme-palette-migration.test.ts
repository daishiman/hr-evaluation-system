import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(join(process.cwd(), "drizzle/migrations", name), "utf8");

function apply(db: DatabaseSync, migration: string) {
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim() !== "") db.exec(statement);
  }
}

describe("配色の保存先にインディゴを足す移行（0030）", () => {
  it("既存の設定を残したまま、インディゴを保存できるようにする", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("CREATE TABLE users (id text PRIMARY KEY NOT NULL)");
    apply(db, read("0017_theme_user_preferences.sql"));
    db.exec("INSERT INTO users (id) VALUES ('user-1'), ('user-2')");
    db.exec(
      "INSERT INTO theme_user_preferences (user_id, palette, mode, resolved, updated_at) VALUES ('user-1', 'graphite', 'dark', 'dark', 1)",
    );
    expect(() =>
      db.exec(
        "INSERT INTO theme_user_preferences (user_id, palette, mode, resolved, updated_at) VALUES ('user-2', 'indigo', 'auto', 'light', 2)",
      ),
    ).toThrow(/ck_theme_user_preferences_palette/);

    apply(db, read("0030_theme_palette_indigo.sql"));

    db.exec(
      "INSERT INTO theme_user_preferences (user_id, palette, mode, resolved, updated_at) VALUES ('user-2', 'indigo', 'auto', 'light', 2)",
    );
    expect(db.prepare("SELECT user_id, palette, mode, resolved, updated_at FROM theme_user_preferences ORDER BY user_id").all()).toEqual([
      { user_id: "user-1", palette: "graphite", mode: "dark", resolved: "dark", updated_at: 1 },
      { user_id: "user-2", palette: "indigo", mode: "auto", resolved: "light", updated_at: 2 },
    ]);
    // 他の制約と、利用者を消したら設定も消える外部キーは作り直し後も残る
    expect(() =>
      db.exec("UPDATE theme_user_preferences SET mode = 'light', resolved = 'dark' WHERE user_id = 'user-1'"),
    ).toThrow(/ck_theme_user_preferences_consistent/);
    db.exec("DELETE FROM users WHERE id = 'user-1'");
    expect(db.prepare("SELECT user_id FROM theme_user_preferences").all()).toEqual([{ user_id: "user-2" }]);
    db.close();
  });
});

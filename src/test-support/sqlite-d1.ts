import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/**
 * テスト用の「本物のデータベース」。
 *
 * 評価の計算は「合っている数字を出す」だけでは足りない。出した数字が
 * 保管場所に入り、読み出したときに同じ値で返ることまで揃って初めて正しい。
 * その食い違いは、計算だけを見るテストでは絶対に見つからない。
 *
 * ここでは本番と同じ移行ファイル（drizzle/migrations/*.sql）をそのまま流して
 * 手元のSQLiteに同じ形の表を作り、本番と同じ Drizzle 経由で読み書きする。
 * 本番の D1 に触らず、テストごとにメモリ上の空のデータベースを作って捨てる。
 *
 * 仕組み: Drizzle の D1 用ドライバが使う口（prepare / bind / run / all / raw / batch）
 * だけを node:sqlite の上に用意した薄い変換層。SQL は変換せずそのまま渡す。
 */

const MIGRATION_DIR = join(process.cwd(), "drizzle/migrations");

let cachedMigrations: string[] | null = null;

function migrationStatements(): string[] {
  if (cachedMigrations) return cachedMigrations;
  const files = readdirSync(MIGRATION_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const statements: string[] = [];
  for (const f of files) {
    const sql = readFileSync(join(MIGRATION_DIR, f), "utf8");
    for (const st of sql.split("--> statement-breakpoint")) {
      if (st.trim() !== "") statements.push(st);
    }
  }
  cachedMigrations = statements;
  return statements;
}

/** node:sqlite に渡せる形へ寄せる（undefined は null、真偽値は 0/1、日付はミリ秒）。 */
function toBindable(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  return v;
}

/** D1 の PreparedStatement のうち、Drizzle が実際に呼ぶ口だけを実装する。 */
class SqlitePrepared {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): SqlitePrepared {
    return new SqlitePrepared(this.db, this.sql, params.map(toBindable));
  }

  private stmt(returnArrays: boolean) {
    const st = this.db.prepare(this.sql);
    // 列名が重なる結合でも取り違えないよう、Drizzle が求める配列形式で受け取る
    (st as unknown as { setReturnArrays?: (v: boolean) => void }).setReturnArrays?.(returnArrays);
    return st;
  }

  async run(): Promise<{ success: true; results: unknown[]; meta: Record<string, unknown> }> {
    const st = this.stmt(false);
    // INSERT ... RETURNING は run では結果を返さないが、SQLite では all で実行できる
    const results = st.all(...(this.params as never[])) as unknown[];
    return { success: true, results, meta: {} };
  }

  async all(): Promise<{ success: true; results: unknown[]; meta: Record<string, unknown> }> {
    const st = this.stmt(false);
    return { success: true, results: st.all(...(this.params as never[])) as unknown[], meta: {} };
  }

  async raw(): Promise<unknown[][]> {
    const st = this.stmt(true);
    // setReturnArrays(true) を立てているので、実体は行ごとの配列。
    // node:sqlite の型はそれを表せないため、ここで一度 unknown を挟む。
    return st.all(...(this.params as never[])) as unknown as unknown[][];
  }

  async first(): Promise<unknown> {
    const rows = (await this.all()).results;
    return rows[0] ?? null;
  }
}

export interface TestDatabase {
  /** 本番と同じ Drizzle クライアント */
  db: ReturnType<typeof drizzle<typeof schema>>;
  /** 生SQLで覗きたいとき用（保存された値をそのまま確かめる） */
  raw: DatabaseSync;
  close(): void;
}

/** 移行ファイルを流し終えた、空のテスト用データベースを1つ作る。 */
export function createTestDatabase(): TestDatabase {
  const sqlite = new DatabaseSync(":memory:");
  for (const st of migrationStatements()) sqlite.exec(st);

  const client = {
    prepare: (sql: string) => new SqlitePrepared(sqlite, sql),
    async batch(stmts: SqlitePrepared[]) {
      const out = [];
      for (const s of stmts) out.push(await s.all());
      return out;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: drizzle(client as any, { schema }),
    raw: sqlite,
    close: () => sqlite.close(),
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { CREDENTIAL_KEY_NAME, importVaultKey, memoUpsert, sealMemo } from "@/lib/credential-vault";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/*
 * 取り込みの「まず内容を確認する」（runRead）が、どの表にも1行も書かないこと。
 *
 * 確認は保存しない約束なので画面を描き直さない（runRead）。もし確認の途中で書いてしまうと、
 * 書いたのに画面は古いまま・確認しただけで社員や回答が増える、の両方が起きる。
 * 不正な行のときに答えが残らないことは src/lib/import.integration.test.ts が見ている。
 * ここでは取り込める正しい内容で確認し、全ての表の全行を前後で比べる
 * （作成・更新・取り込みの記録・期限切れの控えの掃除のどれが紛れ込んでも見つかる）。
 */

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));
const DAY_MS = 24 * 60 * 60 * 1000;

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
  env: {} as Record<string, unknown>,
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));

vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mocked.env }),
}));

import { importMembers, previewMembersImport } from "@/actions/member-import";
import { importResponses, previewResponsesImport } from "@/actions/response-import";

let t: TestDatabase;

const ADMIN = {
  id: IDS.evaluator,
  name: "会社の管理者",
  role: "COMPANY_ADMIN",
  companyId: IDS.company,
  gradeId: null,
  managerId: null,
  department: null,
  employeeCode: null,
  hiredAt: null,
  companyName: "テスト社",
  mustChangePassword: false,
} as Viewer;

/** 全ての表の全行。確認の前後で1か所でも違えば、どこかに書いている。 */
function snapshot(): Record<string, unknown[]> {
  const tables = t.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
  return Object.fromEntries(tables.map(({ name }) => [name, t.raw.prepare(`SELECT * FROM "${name}"`).all()]));
}

beforeEach(async () => {
  t = createTestDatabase();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockClear();
  mocked.viewer = ADMIN;
  mocked.env = { BETTER_AUTH_SECRET: "preview-test-secret-0123456789abcdef", [CREDENTIAL_KEY_NAME]: KEY };
  await seedCompany(t);
  // 本取込なら同じ batch で掃除される、期限切れの控え。確認で消えたら「書いた」ことになる
  const vault = (await importVaultKey(KEY))!;
  await memoUpsert(t.db, {
    userId: IDS.employee,
    issuedBy: IDS.evaluator,
    issuedAt: new Date(Date.now() - 30 * DAY_MS),
    ...(await sealMemo(vault, IDS.employee, "expired-pass-0001")),
  });
  await t.db.insert(s.formQuestions).values({
    id: "fq_count", companyId: IDS.company, formId: IDS.form, section: "kpi",
    questionType: "number", title: "件数", displayOrder: 1, unit: "件",
    validationMin: 0, validationMax: null, validationInteger: true,
  });
});

afterEach(() => {
  t.close();
});

describe("取り込みの確認は、どの表にも書かない", () => {
  it("社員一覧: 作成・更新できる内容でも、確認では1行も変わらず、本取込で初めて変わる", async () => {
    // すでにいる方（下ごしらえの本人）を更新し、同じドメインの新しい方を作る内容
    const [self] = await t.db.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, IDS.employee));
    const newcomer = self.email.replace(/^[^@]+/, "newcomer");
    const csv = ["氏名,メールアドレス,所属", `本人,${self.email},新しい部署`, `新しい方,${newcomer},新規部署`].join("\n");
    const before = snapshot();
    expect(Object.keys(before).length).toBeGreaterThan(10);

    const preview = await previewMembersImport({ csv });
    expect(preview).toMatchObject({ ok: true, created: 1, updated: 1, failed: 0, dryRun: true });
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();

    // 比べ方が空振りしていないこと: 同じ内容を本取込すれば、表は変わる
    expect(await importMembers({ csv })).toMatchObject({ ok: true });
    expect(snapshot()).not.toEqual(before);
  });

  it("回答一覧: 取り込める内容でも、確認では1行も変わらず、本取込で初めて変わる", async () => {
    const csv = ["氏名,件数", "本人,42"].join("\n");
    const before = snapshot();

    const preview = await previewResponsesImport({ formId: IDS.form, csv });
    expect(preview).toMatchObject({ ok: true, imported: 1, skipped: 0, dryRun: true });
    expect(snapshot()).toEqual(before);
    expect(mocked.refresh).not.toHaveBeenCalled();

    const token = preview.ok ? preview.confirmationToken : "";
    expect(await importResponses({ formId: IDS.form, csv, confirmationToken: token })).toMatchObject({ ok: true });
    expect(snapshot()).not.toEqual(before);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema as s } from "@/lib/db";
import type { Viewer } from "@/lib/session";
import { _resetRateLimitStoreForTest } from "@/lib/rate-limit";
import { createTestDatabase, type TestDatabase } from "@/test-support/sqlite-d1";
import { IDS, seedCompany } from "@/test-support/evaluation-fixture";

/*
 * 初期パスワードの控えが「生まれてから消えるまで」。
 *
 * 確かめるのは、控えを開ける人が限られていること、開けないときに理由が分かること、
 * 本人がパスワードを変えたら控えが残らないこと、発行から14日で開けなくなり掃除で消えること。
 * 加えて、パスワードを変えた端末のログインが保たれること（作り直された cookie を渡す）。
 */

const KEY_A = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const KEY_B = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const OTHER_COMPANY = "cmp_other";

const mocked = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  getDb: vi.fn(),
  refresh: vi.fn(),
  env: {} as Record<string, unknown>,
  changePassword: vi.fn(),
  jar: new Map<string, { value: string; options: Record<string, unknown> }>(),
}));

vi.mock("next/cache", () => ({ refresh: mocked.refresh }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "better-auth.session_token=old" }),
  cookies: async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) => mocked.jar.set(name, { value, options }),
  }),
}));

// 役割の判定は本物の atLeast で行う（入口が求める役割を、テストで取り違えないため）
vi.mock("@/lib/session", async () => (await import("@/test-support/action-mocks")).sessionAs(() => mocked.viewer));

vi.mock("@/lib/db", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db")>("@/lib/db")),
  getDb: mocked.getDb,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mocked.env }),
}));

vi.mock("@/lib/auth", () => ({
  getAuth: async () => ({ api: { changePassword: mocked.changePassword } }),
}));

import { changeOwnPassword } from "@/actions/account";
import { revealCredentialMemo } from "@/actions/credential-memos";
import { prepareCredential } from "@/lib/credential-issue";
import {
  importVaultKey,
  isMemoExpired,
  listMemoHolderIds,
  memoUpsert,
  readMemo,
  sealMemo,
} from "@/lib/credential-vault";

let t: TestDatabase;

function as(role: Viewer["role"], id: string, companyId: string | null = IDS.company): Viewer {
  return {
    id,
    name: "操作する人",
    email: `${id}@example.com`,
    role,
    companyId,
    gradeId: null,
    managerId: null,
    department: null,
    employeeCode: null,
    hiredAt: null,
    companyName: "テスト社",
    mustChangePassword: role === "EMPLOYEE",
  } as Viewer;
}

/** 管理者が発行したときと同じ形で、控えを1件置く。 */
async function storeMemo(userId: string, password: string, key = KEY_A) {
  const vault = (await importVaultKey(key))!;
  await memoUpsert(t.db, { userId, issuedBy: "usr_admin", ...(await sealMemo(vault, userId, password)) });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 発行から daysAgo 日たった控えを置く。 */
async function storeMemoIssued(userId: string, password: string, daysAgo: number) {
  const vault = (await importVaultKey(KEY_A))!;
  const issuedAt = new Date(Date.now() - daysAgo * DAY_MS);
  await memoUpsert(t.db, { userId, issuedBy: "usr_admin", issuedAt, ...(await sealMemo(vault, userId, password)) });
}

/** 表に残っている控えの持ち主（期限切れも含む）。 */
async function storedMemoIds() {
  return (await t.db.select({ userId: s.initialCredentialMemos.userId }).from(s.initialCredentialMemos))
    .map((r) => r.userId)
    .sort();
}

beforeEach(async () => {
  t = createTestDatabase();
  await seedCompany(t);
  await t.db.insert(s.companies).values({ id: OTHER_COMPANY, name: "よその会社", slug: "other" });
  await t.db.insert(s.users).values([
    { id: "usr_admin", name: "管理者", email: "admin@example.com", companyId: IDS.company, role: "COMPANY_ADMIN" },
    { id: "usr_other_admin", name: "他社の管理者", email: "oa@example.com", companyId: OTHER_COMPANY, role: "COMPANY_ADMIN" },
    { id: "usr_other_emp", name: "他社の人", email: "oe@example.com", companyId: OTHER_COMPANY, role: "EMPLOYEE" },
    { id: "usr_super", name: "システム管理者", email: "super@example.com", companyId: OTHER_COMPANY, role: "SUPER_ADMIN" },
  ]);
  await t.db.update(s.users).set({ mustChangePassword: true }).where(eq(s.users.id, IDS.employee));

  mocked.getDb.mockReset();
  mocked.getDb.mockResolvedValue(t.db);
  mocked.refresh.mockReset();
  mocked.changePassword.mockReset();
  mocked.jar.clear();
  mocked.env = { CREDENTIAL_ENC_KEY: KEY_A };
  _resetRateLimitStoreForTest();
});

afterEach(() => t.close());

describe("控えを持つ人の一覧（行に「控えを見る」を出すかどうか）", () => {
  it("会社を渡すとその会社の人だけ、null なら全社", async () => {
    await storeMemo(IDS.employee, "pw-own-company");
    await storeMemo("usr_other_emp", "pw-other-company");

    expect(await listMemoHolderIds(t.db, IDS.company)).toEqual([IDS.employee]);
    expect(await listMemoHolderIds(t.db, OTHER_COMPANY)).toEqual(["usr_other_emp"]);
    expect((await listMemoHolderIds(t.db, null)).sort()).toEqual([IDS.employee, "usr_other_emp"].sort());
  });
});

describe("控えを開く（revealCredentialMemo）", () => {
  it("同じ会社の管理者は開ける。読むだけなので画面は描き直さない", async () => {
    await storeMemo(IDS.employee, "Temp-Pass-0001");
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");

    const result = await revealCredentialMemo({ userId: IDS.employee });

    expect(result).toMatchObject({ ok: true, password: "Temp-Pass-0001" });
    if (result.ok) expect(Number.isNaN(Date.parse(result.issuedAt))).toBe(false);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("システム全体管理者は、どの会社の人の控えも開ける", async () => {
    await storeMemo(IDS.employee, "Temp-Pass-0002");
    mocked.viewer = as("SUPER_ADMIN", "usr_super", OTHER_COMPANY);

    expect(await revealCredentialMemo({ userId: IDS.employee })).toMatchObject({ ok: true, password: "Temp-Pass-0002" });
  });

  it("他社の管理者には、控えがあるかどうかも分からない言い方で断る", async () => {
    await storeMemo(IDS.employee, "Temp-Pass-0003");
    mocked.viewer = as("COMPANY_ADMIN", "usr_other_admin", OTHER_COMPANY);

    const otherCompany = await revealCredentialMemo({ userId: IDS.employee });
    const nobody = await revealCredentialMemo({ userId: "usr_missing" });

    expect(otherCompany).toEqual({ ok: false, message: "この方の控えはありません。" });
    // 実在しない人と同じ答え（他社の人の有無を探れない）
    expect(nobody).toEqual(otherCompany);
  });

  it("マネージャー・社員は開けない", async () => {
    await storeMemo(IDS.employee, "Temp-Pass-0004");
    for (const [role, id] of [
      ["MANAGER", IDS.evaluator],
      ["EMPLOYEE", IDS.employee],
    ] as const) {
      mocked.viewer = as(role, id);
      const result = await revealCredentialMemo({ userId: IDS.employee });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("Temp-Pass-0004");
    }
  });

  it("控えが無いときは、本人が変えた可能性を添えて返す", async () => {
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");
    expect(await revealCredentialMemo({ userId: IDS.employee })).toEqual({
      ok: false,
      message: "この方の控えはありません。ご本人が変更済みの可能性があります。",
    });
  });

  it("鍵が設定されていなければ開けない（控えの中身は返さない）", async () => {
    await storeMemo(IDS.employee, "Temp-Pass-0005");
    mocked.env = {};
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");

    expect(await revealCredentialMemo({ userId: IDS.employee })).toEqual({
      ok: false,
      message: "控えを開く鍵が設定されていません。",
    });
  });

  it("鍵を入れ替えたあとの古い控えは、再発行を促す", async () => {
    await storeMemo(IDS.employee, "Temp-Pass-0006", KEY_A);
    mocked.env = { CREDENTIAL_ENC_KEY: KEY_B };
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");

    expect(await revealCredentialMemo({ userId: IDS.employee })).toEqual({
      ok: false,
      message: "鍵が入れ替わったため開けません。再発行してください。",
    });
  });

  it("暗号文が壊れていれば、壊れていると分かる", async () => {
    await storeMemo(IDS.employee, "Temp-Pass-0007");
    const memo = (await readMemo(t.db, IDS.employee))!;
    const tampered = memo.ciphertext.startsWith("A") ? `B${memo.ciphertext.slice(1)}` : `A${memo.ciphertext.slice(1)}`;
    await t.db
      .update(s.initialCredentialMemos)
      .set({ ciphertext: tampered })
      .where(eq(s.initialCredentialMemos.userId, IDS.employee));
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");

    expect(await revealCredentialMemo({ userId: IDS.employee })).toEqual({
      ok: false,
      message: "控えが壊れているため開けません。再発行してください。",
    });
  });
});

describe("控えの期限（発行から14日）", () => {
  it("期限は14日ちょうどで切れる（1ミリ秒前までは開ける）", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    expect(isMemoExpired(new Date(now.getTime() - 14 * DAY_MS), now)).toBe(true);
    expect(isMemoExpired(new Date(now.getTime() - 14 * DAY_MS + 1), now)).toBe(false);
  });

  it("期限内は開けて期限も返す。過ぎた控えは開けず、一覧にも出さない", async () => {
    await storeMemoIssued(IDS.employee, "Temp-Pass-0101", 13);
    await storeMemoIssued(IDS.evaluator, "Temp-Pass-0102", 15);
    mocked.viewer = as("COMPANY_ADMIN", "usr_admin");

    const live = await revealCredentialMemo({ userId: IDS.employee });
    expect(live).toMatchObject({ ok: true, password: "Temp-Pass-0101" });
    if (live.ok) expect(Date.parse(live.expiresAt) - Date.parse(live.issuedAt)).toBe(14 * DAY_MS);

    const expired = await revealCredentialMemo({ userId: IDS.evaluator });
    expect(expired).toEqual({ ok: false, message: "発行から14日を過ぎたため開けません。再発行してください。" });
    expect(JSON.stringify(expired)).not.toContain("Temp-Pass-0102");

    // 押しても開けないボタンを出さない
    expect(await listMemoHolderIds(t.db, IDS.company)).toEqual([IDS.employee]);
    expect(await listMemoHolderIds(t.db, null)).toEqual([IDS.employee]);
  });

  it("次の発行の batch が、期限を過ぎた控えを全社分消す（新しい控えと期限内の控えは残す）", async () => {
    await storeMemoIssued(IDS.evaluator, "Temp-Pass-0103", 15);
    await storeMemoIssued("usr_other_emp", "Temp-Pass-0104", 30);
    await storeMemoIssued(IDS.employee, "Temp-Pass-0105", 1);

    const credential = await prepareCredential(t.db, { userId: "usr_admin", password: "Temp-Pass-0106", issuedBy: "usr_super" });
    await t.db.batch([...credential.memo]);

    expect(await storedMemoIds()).toEqual([IDS.employee, "usr_admin"].sort());
  });

  it("鍵が無いときの発行でも、期限を過ぎた控えは消す", async () => {
    await storeMemoIssued(IDS.evaluator, "Temp-Pass-0107", 15);
    await storeMemoIssued(IDS.employee, "Temp-Pass-0108", 1);
    mocked.env = {};

    const credential = await prepareCredential(t.db, { userId: "usr_admin", password: "Temp-Pass-0109", issuedBy: "usr_super" });
    await t.db.batch([...credential.memo]);

    expect(credential.stored).toBe(false);
    expect(await storedMemoIds()).toEqual([IDS.employee]);
  });
});

describe("本人のパスワード変更（changeOwnPassword）", () => {
  const input = { currentPassword: "Temp-Pass-0008", newPassword: "my-new-password-2026" };

  beforeEach(() => {
    mocked.viewer = as("EMPLOYEE", IDS.employee);
  });

  it("変えたら控えと「仮パスワードのまま」の印を消し、作り直したログインの印をこの端末へ渡す", async () => {
    await storeMemo(IDS.employee, input.currentPassword);
    mocked.changePassword.mockResolvedValue({
      headers: new Headers({
        "set-cookie": "better-auth.session_token=new-token; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800",
      }),
    });

    const result = await changeOwnPassword(input);

    expect(result).toEqual({
      ok: true,
      message: "パスワードを変更しました。次からは新しいパスワードでログインしてください。",
    });
    // 他の端末は切る・作り直したログインを受け取る、の2つを Better Auth へ頼んでいる
    expect(mocked.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ revokeOtherSessions: true }),
        returnHeaders: true,
      }),
    );
    // この端末のログインは新しい印で続く（締め出されない）
    expect(mocked.jar.get("better-auth.session_token")).toMatchObject({
      value: "new-token",
      options: expect.objectContaining({ httpOnly: true, path: "/" }),
    });
    expect(await readMemo(t.db, IDS.employee)).toBeUndefined();
    const [user] = await t.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    expect(user.mustChangePassword).toBe(false);
    expect(mocked.refresh).toHaveBeenCalledTimes(1);
  });

  it("変えた後の片付けが2回とも失敗しても、変わったことは正しく伝え、ログを残す", async () => {
    await storeMemo(IDS.employee, input.currentPassword);
    mocked.changePassword.mockResolvedValue({ headers: new Headers() });
    t.raw.exec(`CREATE TRIGGER fail_clear_must_change BEFORE UPDATE ON users
      WHEN NEW.must_change_password = 0
      BEGIN SELECT RAISE(ABORT, 'forced followup failure'); END;`);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const result = await changeOwnPassword(input);

      // 「保存できませんでした」と返すと、変わったのに古いパスワードで入ろうとしてしまう
      expect(result).toEqual({
        ok: true,
        message: "パスワードは変更済みです。お知らせが残るときは管理者に連絡してください。",
      });
      // 印と控えは1回の batch なので、片方だけ消えてはいない
      expect(await readMemo(t.db, IDS.employee)).toBeDefined();
      const [user] = await t.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
      expect(user.mustChangePassword).toBe(true);
      const logged = error.mock.calls.map((c) => String(c[0])).find((line) => line.includes("rollforward_failed"));
      expect(JSON.parse(logged!)).toMatchObject({ operation: "account.password", ids: { userId: IDS.employee } });
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });

  it("いまのパスワードが違えば、控えも印も残し、詳しい理由は出さない", async () => {
    await storeMemo(IDS.employee, input.currentPassword);
    mocked.changePassword.mockRejectedValue(new Error("INVALID_PASSWORD from better-auth"));

    const result = await changeOwnPassword(input);

    expect(result).toEqual({ ok: false, message: "いまのパスワードが違います。もう一度お試しください。" });
    expect(await readMemo(t.db, IDS.employee)).toBeDefined();
    const [user] = await t.db.select().from(s.users).where(eq(s.users.id, IDS.employee));
    expect(user.mustChangePassword).toBe(true);
    expect(mocked.jar.size).toBe(0);
    expect(mocked.refresh).not.toHaveBeenCalled();
  });

  it("いまと同じパスワードには変えさせない（Better Auth へ送る前に止める）", async () => {
    const result = await changeOwnPassword({ currentPassword: "same-password-0001", newPassword: "same-password-0001" });

    expect(result).toEqual({ ok: false, message: "いまのパスワードと違うものにしてください。" });
    expect(mocked.changePassword).not.toHaveBeenCalled();
  });

  it("10秒に4回目からは、合っていても試させない（総当たりを防ぐ）", async () => {
    mocked.changePassword.mockRejectedValue(new Error("INVALID_PASSWORD"));
    for (let i = 0; i < 3; i++) await changeOwnPassword(input);
    mocked.changePassword.mockReset();

    const fourth = await changeOwnPassword(input);

    expect(fourth).toEqual({ ok: false, message: "いまのパスワードが違います。もう一度お試しください。" });
    expect(mocked.changePassword).not.toHaveBeenCalled();
  });
});

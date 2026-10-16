/**
 * アカウントの権限にかかわる操作の監査記録（E7）。
 *
 * 全体管理者にする・外す、会社の役割を変える、所属の会社を移す、利用を止める・再開する、
 * パスワードを再発行する。どれもログインと見られる範囲そのものを変えるので、
 * 「誰が・誰に・いつ・何を変えたか」を後から説明できるように残す。
 *
 * ここは変更前と変更後の状態から、残す出来事を決めるだけの純粋な計算。
 * 書き込みの文は src/lib/account-security-events.ts が作り、本体の書き込みと同じ batch に入れる。
 * パスワードの本文・hash・セッションの token は、この型に入る場所を作らない（残しようがない形にする）。
 */

export type AccountSecurityEventType =
  | "account_created"
  | "super_admin_granted"
  | "super_admin_revoked"
  | "role_changed"
  | "company_moved"
  | "deactivated"
  | "reactivated"
  | "password_reissued";

/** どの入口からの操作か。画面の入口ごとに1つ。理由の文を入れる欄は画面に無いので、入口で代える。 */
export type AccountSecuritySource = "system_users" | "members" | "company_create" | "member_import";

/** 会社の役割（全体管理者は所属を持たないので、ここには入らない）。 */
export type CompanyRole = "EMPLOYEE" | "MANAGER" | "COMPANY_ADMIN";

/**
 * 1人の利用者の、権限にかかわる状態。
 * membership は「この操作で触った所属」。1人が複数の会社に所属していても、1回の操作が変えるのは1つだけ。
 */
export type AccountAccess = {
  superAdmin: boolean;
  isActive: boolean;
  membership: { companyId: string; role: CompanyRole } | null;
};

type Snapshot = Record<string, string | boolean | null>;

export type AccountSecurityChange = {
  eventType: AccountSecurityEventType;
  /** 出来事が起きた会社。会社の管理者が自社の分だけを読むための列。所属の無い全体管理者は null。 */
  companyId: string | null;
  before: Snapshot | null;
  after: Snapshot | null;
};

const roleOf = (access: AccountAccess) => (access.superAdmin ? "SUPER_ADMIN" : (access.membership?.role ?? null));

/**
 * 変更前（新規作成は null）と変更後の状態から、残す出来事を決める。
 * 同じ保存で複数のことが変われば、変わったことごとに1件ずつ返す。何も変わらなければ空。
 *
 * 新規作成は1件（account_created）にまとめる。最初の仮パスワードは作成の一部で、再発行ではない。
 * 全体管理者にする・外すときは所属の作り直しを伴うが、役割の変更・会社の移動とは別に数えない
 * （全体管理者の付け外しの before/after に、外した・作った所属の会社と役割を入れる）。
 */
export function accountSecurityChanges(
  before: AccountAccess | null,
  after: AccountAccess,
  options: { passwordReissued: boolean },
): AccountSecurityChange[] {
  if (!before) {
    return [
      {
        eventType: "account_created",
        companyId: after.membership?.companyId ?? null,
        before: null,
        after: { role: roleOf(after), companyId: after.membership?.companyId ?? null, isActive: after.isActive },
      },
    ];
  }

  const companyId = after.membership?.companyId ?? before.membership?.companyId ?? null;
  const changes: AccountSecurityChange[] = [];

  if (!before.superAdmin && after.superAdmin) {
    changes.push({
      eventType: "super_admin_granted",
      companyId,
      before: { role: roleOf(before), companyId: before.membership?.companyId ?? null },
      after: { role: "SUPER_ADMIN", companyId: null },
    });
  } else if (before.superAdmin && !after.superAdmin) {
    changes.push({
      eventType: "super_admin_revoked",
      companyId,
      before: { role: "SUPER_ADMIN", companyId: null },
      after: { role: roleOf(after), companyId: after.membership?.companyId ?? null },
    });
  } else if (!after.superAdmin) {
    const fromCompany = before.membership?.companyId ?? null;
    const toCompany = after.membership?.companyId ?? null;
    if (fromCompany !== toCompany) {
      changes.push({ eventType: "company_moved", companyId, before: { companyId: fromCompany }, after: { companyId: toCompany } });
    }
    if (roleOf(before) !== roleOf(after)) {
      changes.push({ eventType: "role_changed", companyId, before: { role: roleOf(before) }, after: { role: roleOf(after) } });
    }
  }

  if (before.isActive !== after.isActive) {
    changes.push({
      eventType: after.isActive ? "reactivated" : "deactivated",
      companyId,
      before: { isActive: before.isActive },
      after: { isActive: after.isActive },
    });
  }

  if (options.passwordReissued) {
    changes.push({ eventType: "password_reissued", companyId, before: null, after: null });
  }

  return changes;
}

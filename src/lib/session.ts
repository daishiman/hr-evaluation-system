import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

/**
 * 権限の判定をここ1箇所に集める。
 *
 * 画面側で条件分岐するだけでは、APIを直接叩かれたときに素通りしてしまう。
 * データを読む前に必ずこのモジュールを通し、会社の絞り込み（company_id）と
 * ロールの判定をサーバー側で行う。
 */

export const ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

/** 権限の強さ。数字が大きいほど広く見える。 */
const RANK: Record<Role, number> = {
  SUPER_ADMIN: 4,
  COMPANY_ADMIN: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

/**
 * 画面に出す役割の呼び名。
 *
 * EMPLOYEE を「評価される方」とは呼ばない。マネージャーも会社の管理者も
 * 自分の上長から評価を受けるため、「評価される／しない」で役割を言い分けると
 * 事実と食い違う。ここで分けているのは「制度を設定・閲覧できる範囲」なので、
 * 設定を持たない立場は「一般」と呼ぶ。
 *
 * DBに入っている値（EMPLOYEE など）は変えない。呼び名は今後も変わりうるが、
 * 保存済みのデータを呼び名に合わせて書き換えると、過去のデータと突き合わせが
 * できなくなるため、変えるのは表示だけにする。
 */
export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "システム全体管理者",
  COMPANY_ADMIN: "会社の管理者",
  MANAGER: "マネージャー",
  EMPLOYEE: "一般",
};

export interface Viewer {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  gradeId: string | null;
  managerId: string | null;
  department: string | null;
  employeeCode: string | null;
  hiredAt: string | null;
  companyName: string | null;
  /** 発行時の仮パスワードのまま使っている（変更をお願いし続ける） */
  mustChangePassword: boolean;
}

/** ログイン中の利用者。未ログインなら null。 */
export async function getViewer(): Promise<Viewer | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const db = await getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      companyId: schema.users.companyId,
      gradeId: schema.users.gradeId,
      managerId: schema.users.managerId,
      department: schema.users.department,
      employeeCode: schema.users.employeeCode,
      hiredAt: schema.users.hiredAt,
      mustChangePassword: schema.users.mustChangePassword,
      isActive: schema.users.isActive,
      companyName: schema.companies.name,
      companyIsActive: schema.companies.isActive,
    })
    .from(schema.users)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.users.companyId))
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  const u = rows[0];
  // 退職・停止したアカウントはセッションが残っていても通さない
  if (!u || !u.isActive) return null;

  const role: Role = (ROLES as readonly string[]).includes(u.role) ? (u.role as Role) : "EMPLOYEE";

  // 会社所属が必須のロールは、会社が未設定または停止中ならセッションが残っていても通さない。
  // SUPER_ADMIN の companyId は所属ではなく、後段で選ぶ操作対象会社なのでこの判定から除く。
  if (role !== "SUPER_ADMIN" && (!u.companyId || !u.companyIsActive)) return null;

  // システム全体管理者は会社に属さないため、いま見ている会社を別に決める（他のロールは自社に固定）
  let companyId = u.companyId;
  let companyName = u.companyName ?? null;
  if (role === "SUPER_ADMIN") {
    const scoped = await readCompanyScope(db);
    companyId = scoped?.id ?? null;
    companyName = scoped?.name ?? null;
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    companyId,
    gradeId: u.gradeId,
    managerId: u.managerId,
    department: u.department,
    employeeCode: u.employeeCode,
    hiredAt: u.hiredAt,
    companyName,
    mustChangePassword: Boolean(u.mustChangePassword),
  };
}

/** システム全体管理者が「いま見ている会社」を覚えておくクッキーの名前。 */
export const COMPANY_SCOPE_COOKIE = "hr_company";

/**
 * システム全体管理者がいま操作対象にしている会社を返す。
 *
 * クッキーの値をそのまま信じず、実在して有効な会社かをDBで確かめる。
 * 選ばれていなければ、会社一覧の先頭を既定にする（何も見えない状態にしない）。
 */
async function readCompanyScope(db: Awaited<ReturnType<typeof getDb>>) {
  const jar = await cookies();
  const requested = jar.get(COMPANY_SCOPE_COOKIE)?.value ?? null;

  if (requested) {
    const hit = await db
      .select({ id: schema.companies.id, name: schema.companies.name })
      .from(schema.companies)
      .where(and(eq(schema.companies.id, requested), eq(schema.companies.isActive, true)))
      .limit(1);
    if (hit[0]) return hit[0];
  }

  // 既定はひな形（制度テンプレート）ではなく、実在する会社の先頭
  const first = await db
    .select({ id: schema.companies.id, name: schema.companies.name })
    .from(schema.companies)
    .where(and(eq(schema.companies.isActive, true), eq(schema.companies.isTemplate, false)))
    .orderBy(schema.companies.name)
    .limit(1);
  return first[0] ?? null;
}

/** 画面用。未ログインならログイン画面へ送る。 */
export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

/** 画面用。権限が足りなければ自分のホームへ戻す。 */
export async function requireRole(min: Role): Promise<Viewer> {
  const v = await requireViewer();
  if (RANK[v.role] < RANK[min]) redirect(`${homePathFor(v.role)}?denied=1`);
  return v;
}

export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * 評価基準・配点・昇格に必要な点数を見てよいか。
 * 一般（EMPLOYEE）には画面にもAPIの返り値にも出さない（要件の明示事項）。
 * マネージャーは自分も評価を受けるが、基準は見てよい。
 */
export function canSeeCriteria(role: Role): boolean {
  return atLeast(role, "MANAGER");
}

/**
 * アンケートの中身（設問文・補足・選択肢・答え方）を読んでよいか。
 *
 * すべてのロールに開く。「この聞き方で適切か」を配る前に確かめられる人が
 * 作った本人だけだと、設問の誤りが配布後まで誰にも気づかれないため。
 * 読めるのは自社のアンケートだけで、会社の絞り込みは呼び出し側の companyId が担う。
 */
export function canSeeFormContent(_role: Role): boolean {
  return true;
}

/**
 * 誰がどう答えたか（回答データ）を見てよいか。
 *
 * 中身の確認とは別物として扱う。設問は「これから配る文面」だが、
 * 回答は個人の評価そのものなので、これまでどおり会社の管理者だけにする。
 */
export function canSeeFormResponses(role: Role): boolean {
  return atLeast(role, "COMPANY_ADMIN");
}

/** アンケートを作る・設問を直す・公開する・締め切ってよいか。閲覧を開いても書き込みは広げない。 */
export function canEditForm(role: Role): boolean {
  return atLeast(role, "COMPANY_ADMIN");
}

/** 他の人の情報（プロフィール・評価メモ）を変更してよいか。 */
export function canEditEmployee(role: Role): boolean {
  return atLeast(role, "COMPANY_ADMIN");
}

/** 制度（等級・KPI・配点・昇給額）を変更してよいか。マネージャーは閲覧のみ。 */
export function canEditScheme(role: Role): boolean {
  return atLeast(role, "COMPANY_ADMIN");
}

export function homePathFor(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/system";
    case "COMPANY_ADMIN":
      return "/admin";
    case "MANAGER":
      return "/manager";
    default:
      return "/me";
  }
}

/**
 * 対象の会社を確定する。
 * SUPER_ADMIN だけが会社を切り替えられ、それ以外は自分の会社に固定される。
 * URLに他社のIDを入れられても、ここで自社に強制される。
 */
export function resolveCompanyId(v: Viewer, requested?: string | null): string | null {
  // システム全体管理者だけが会社を指定できる。指定がなければ、いま選んでいる会社を使う
  if (v.role === "SUPER_ADMIN") return requested ?? v.companyId;
  return v.companyId;
}

/** 指定した利用者を閲覧してよいか。 */
export async function canViewEmployee(v: Viewer, employeeId: string): Promise<boolean> {
  if (v.id === employeeId) return true;
  if (v.role === "SUPER_ADMIN") return true;
  if (v.role === "EMPLOYEE") return false;

  const db = await getDb();
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, employeeId), eq(schema.users.companyId, v.companyId ?? "")))
    .limit(1);
  return rows.length > 0;
}

/** API用。権限が足りなければ 401 / 403 を投げる。 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 別サイトの画面から勝手に送られた書き込みを弾く。
 *
 * ログインしたまま外部のページを開いても、そこからこのアプリのデータを
 * 書き換えられないようにするための確認。データを変えるAPIはすべて apiViewer を
 * 通るので、ここで1回だけ見ればよい。
 */
async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // 画面以外（社内バッチ等）からの呼び出しにはブラウザが付けない
  const host = h.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "この操作は受け付けられませんでした。画面を開き直してからもう一度お試しください。");
  }
  if (!host || originHost !== host) {
    throw new HttpError(403, "この操作は受け付けられませんでした。画面を開き直してからもう一度お試しください。");
  }
}

export async function apiViewer(min: Role = "EMPLOYEE"): Promise<Viewer> {
  await assertSameOrigin();
  const v = await getViewer();
  if (!v) throw new HttpError(401, "ログインが必要です。");
  if (RANK[v.role] < RANK[min]) throw new HttpError(403, "この操作を行う権限がありません。");
  return v;
}

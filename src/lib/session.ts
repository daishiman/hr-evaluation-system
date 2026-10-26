import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import {
  canActOnEmployeeEvaluation,
  canReadEmployee as canReadEmployeeByRole,
  evaluationViewOf,
  type EvaluationView,
} from "@/lib/domain/evaluation-authority";
import { activeCompanyCondition, activeMembershipFor, membershipIn } from "@/lib/memberships";
import { atLeast, ROLES, type Role } from "@/lib/roles";
import { roleCan, roleCanOpen, routeAccessOf } from "@/lib/route-access";
import { isSameOriginRequest } from "@/lib/security/same-origin";

/**
 * 権限の判定をここ1箇所に集める。
 *
 * 画面側で条件分岐するだけでは、APIを直接叩かれたときに素通りしてしまう。
 * データを読む前に必ずこのモジュールを通し、会社の絞り込み（company_id）と
 * ロールの判定をサーバー側で行う。
 */

export { ROLES, ROLE_LABEL, atLeast, type Role } from "@/lib/roles";

export interface Viewer {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** いま使っている会社。所属が2つ以上ある人は切り替えられる（全体管理者は操作する会社） */
  companyId: string | null;
  gradeId: string | null;
  managerId: string | null;
  department: string | null;
  employeeCode: string | null;
  hiredAt: string | null;
  /** いまの会社での事業所（試験で作る Viewer は省くことがあるので、無いときは null と同じに扱う） */
  officeId?: string | null;
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
  const u = (
    await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        // 全体管理者か（所属を持たない人か）を見るためだけに読む。会社ごとの役割は所属の表から読む
        globalRole: schema.users.role,
        mustChangePassword: schema.users.mustChangePassword,
        isActive: schema.users.isActive,
      })
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id))
      .limit(1)
  )[0];
  // 退職・停止したアカウントはセッションが残っていても通さない
  if (!u || !u.isActive) return null;

  const base = { id: u.id, name: u.name, email: u.email, mustChangePassword: Boolean(u.mustChangePassword) };
  const requested = (await cookies()).get(COMPANY_SCOPE_COOKIE)?.value ?? null;

  // システム全体管理者は会社に属さないため、いま見ている会社を別に決める
  if (u.globalRole === "SUPER_ADMIN") {
    const scoped = await readCompanyScope(db, requested);
    return {
      ...base,
      role: "SUPER_ADMIN",
      companyId: scoped?.id ?? null,
      companyName: scoped?.name ?? null,
      gradeId: null,
      officeId: null,
      managerId: null,
      department: null,
      employeeCode: null,
      hiredAt: null,
    };
  }

  // それ以外は所属から決める。選んだ会社（cookie）に有効な所属があればそれ、無ければ一番古い有効な所属。
  // 有効な所属が1つも無い（会社が止まった・テンプレートだけ）なら、セッションが残っていても通さない
  const membership = await activeMembershipFor(db, u.id, requested);
  if (!membership) return null;
  const role: Role = (ROLES as readonly string[]).includes(membership.role) ? (membership.role as Role) : "EMPLOYEE";

  return {
    ...base,
    role,
    companyId: membership.companyId,
    companyName: membership.companyName,
    gradeId: membership.gradeId,
    officeId: membership.officeId,
    managerId: membership.managerId,
    department: membership.department,
    employeeCode: membership.employeeCode,
    hiredAt: membership.hiredAt,
  };
}

/**
 * いま見ている会社を覚えておくクッキーの名前。
 * 全体管理者は有効な会社ならどこでも、ほかの役割は自分が所属する会社だけを選べる。
 */
export const COMPANY_SCOPE_COOKIE = "hr_company";

/**
 * システム全体管理者がいま操作対象にしている会社を返す。
 *
 * クッキーの値をそのまま信じず、実在して有効な会社かをDBで確かめる。
 * 選ばれていなければ、会社一覧の先頭を既定にする（何も見えない状態にしない）。
 */
async function readCompanyScope(db: Awaited<ReturnType<typeof getDb>>, requested: string | null) {
  if (requested) {
    const hit = await db
      .select({ id: schema.companies.id, name: schema.companies.name })
      .from(schema.companies)
      .where(and(eq(schema.companies.id, requested), activeCompanyCondition()))
      .limit(1);
    if (hit[0]) return hit[0];
  }

  // 既定はひな形（制度テンプレート）ではなく、実在する会社の先頭
  const first = await db
    .select({ id: schema.companies.id, name: schema.companies.name })
    .from(schema.companies)
    .where(activeCompanyCondition())
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

/**
 * 画面用。台帳（system-spec/route-ledger.json）でそのページを開けない役割なら自分のホームへ戻す。
 *
 * path は台帳の書き方のパス（例: "/admin/members/[id]"）。各ページは自分のパスを渡す。
 * 誰が開けるかをページに書かず台帳から引くので、権限一覧のページと実際の入口がずれない。
 * 条件つき（自分の部下だけなど）の判定は、開いたあとにページの中で行う。
 */
export async function requireRoute(path: string): Promise<Viewer> {
  const access = routeAccessOf(path);
  if (!access || access.minRole === null) {
    throw new Error(`requireRoute: ${path} は台帳に無いか、ログインの前のページです`);
  }
  const v = await requireViewer();
  if (access.byRole[v.role] === "none") redirect(`${homePathFor(v.role)}?denied=1`);
  return v;
}

/**
 * 評価基準・配点・昇格に必要な点数を見てよいか。
 * 一般（EMPLOYEE）には画面にもAPIの返り値にも出さない（要件の明示事項）。
 * マネージャーは自分も評価を受けるが、基準は見てよい。
 */
export function canSeeCriteria(role: Role): boolean {
  return roleCanOpen(role, "/criteria");
}

/**
 * アンケートの中身（設問文・補足・選択肢・答え方）を読んでよいか。
 *
 * すべてのロールに開く。「この聞き方で適切か」を配る前に確かめられる人が
 * 作った本人だけだと、設問の誤りが配布後まで誰にも気づかれないため。
 * 読めるのは自社のアンケートだけで、会社の絞り込みは呼び出し側の companyId が担う。
 */
export function canSeeFormContent(role: Role): boolean {
  return roleCanOpen(role, "/forms");
}

/**
 * 誰がどう答えたか（回答データ）を見てよいか。
 *
 * 中身の確認とは別物として扱う。設問は「これから配る文面」だが、
 * 回答は個人の評価そのものなので、これまでどおり会社の管理者だけにする。
 */
export function canSeeFormResponses(role: Role): boolean {
  return roleCanOpen(role, "/admin/forms/[id]/responses");
}

/** アンケートを作る・設問を直す・公開する・締め切ってよいか。閲覧を開いても書き込みは広げない。 */
export function canEditForm(role: Role): boolean {
  return roleCan(role, "forms.update");
}

/**
 * 会社をまたいで操作する役割か（全体管理者）。全体管理者は所属を持たず、選んだ会社で操作する。
 * 会社の切り替え・所属の追加・会社をまたぐ利用者全体の値の変更で、所属の確認の代わりに使う。
 */
export function crossesCompanies(role: Role): boolean {
  return atLeast(role, "SUPER_ADMIN");
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
 * SUPER_ADMIN だけが会社を指定でき、それ以外はいまの会社（所属から決めた会社）に固定される。
 * URLに他社のIDを入れられても、ここでいまの会社に強制される。
 * 所属が2つ以上ある人の切り替えは、cookie を通して getViewer が決める（ここでは指定を受けない）。
 */
export function resolveCompanyId(v: Viewer, requested?: string | null): string | null {
  // システム全体管理者だけが会社を指定できる。指定がなければ、いま選んでいる会社を使う
  if (v.role === "SUPER_ADMIN") return requested ?? v.companyId;
  return v.companyId;
}

/**
 * 会社が決まらないまま書き込もうとしたときの断り文句。
 *
 * getViewer は会社のない SUPER_ADMIN 以外を通さないので、ここに当たるのは
 * 「会社を選んでいないシステム全体管理者」だけ。画面の「操作する会社」に合わせて呼ぶ。
 */
const NO_COMPANY_MESSAGE = "操作する会社が選ばれていません。";

/**
 * 操作する会社が決まっていることを確かめる（決まっていなければ 400）。
 *
 * 同じ条件を各 action が手で書くと、文言が入口ごとにばらける（以前は4通りあった）。
 * 条件と言い方をここ1か所に置き、通ったあとは companyId を string として扱えるようにする。
 */
export function assertCompanyChosen<T extends { companyId: string | null }>(
  v: T,
): asserts v is T & { companyId: string } {
  if (!v.companyId) throw new HttpError(400, NO_COMPANY_MESSAGE);
}

/** 会社を指定できる入口（取り込み・書き出し）で、対象の会社を確定する。決まらなければ 400。 */
export function requireTargetCompany(v: Viewer, requested?: string | null): string {
  const companyId = resolveCompanyId(v, requested);
  if (!companyId) throw new HttpError(400, NO_COMPANY_MESSAGE);
  return companyId;
}

/** いまの会社での、対象の人の所属（上長を含む）。いまの会社に所属していなければ null */
async function targetInCompany(v: Viewer, employeeId: string) {
  if (!v.companyId) return null;
  const db = await getDb();
  const row = await membershipIn(db, employeeId, v.companyId);
  return row ? { employeeId, managerId: row.managerId } : null;
}

/** 指定した利用者を閲覧してよいか。上長かどうかは、いまの会社の所属で決める。 */
export async function canViewEmployee(v: Viewer, employeeId: string): Promise<boolean> {
  const target = await targetInCompany(v, employeeId);
  return target ? canReadEmployeeByRole(v.id, v.role, target) : false;
}

/**
 * 指定した利用者の評価レポートを、どの形で見てよいか（reviewer＝点数まで／self＝本人向け）。見られなければ null。
 * 他社・存在しない人も null にして、画面では区別せず 404 にする。
 */
export async function canViewEvaluationOf(v: Viewer, employeeId: string): Promise<EvaluationView | null> {
  const target = await targetInCompany(v, employeeId);
  return target ? evaluationViewOf(v.id, v.role, target) : null;
}

/** 指定した利用者の評価・メモ・期限へ手を入れてよいか。 */
export async function canManageEmployee(v: Viewer, employeeId: string): Promise<boolean> {
  const target = await targetInCompany(v, employeeId);
  return target ? canActOnEmployeeEvaluation(v.id, v.role, target) : false;
}

/** 役割や範囲が足りないときの言い方（入口の判定と、所属による制限で同じ文にする） */
export const FORBIDDEN_MESSAGE = "この操作を行う権限がありません。";

/**
 * API用。権限が足りなければ 401 / 403 を投げる。
 *
 * fixHref は、断った理由を直す画面の場所（DD-028 の2）。画面からの書き込みでは action.ts の run が結果へ写し、
 * 画面は「直す画面を開く」のリンクにする。
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly responseHeaders?: HeadersInit,
    readonly fixHref?: string,
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
 * Origin が無い送信は、ブラウザの Sec-Fetch-Site で同じサイトからかを確かめる。
 * どちらも無ければ送り元を確かめられないので拒む（DD-032 の17）。
 */
async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const sameOrigin = isSameOriginRequest({
    origin: h.get("origin"),
    secFetchSite: h.get("sec-fetch-site"),
    host: h.get("host"),
  });
  if (!sameOrigin) {
    throw new HttpError(403, "この操作は受け付けられませんでした。画面を開き直してからもう一度お試しください。");
  }
}

/**
 * API・サーバー処理用。ログインと、min 以上の役割かを確かめる。
 *
 * 呼ぶ側は役割の名前を書かず、操作の名前から最低の役割を引いて渡す
 * （runAction の operation、Route Handler の apiViewerFor。台帳が正本）。
 */
export async function apiViewer(min: Role = "EMPLOYEE"): Promise<Viewer> {
  await assertSameOrigin();
  const v = await getViewer();
  if (!v) throw new HttpError(401, "ログインが必要です。");
  if (!atLeast(v.role, min)) throw new HttpError(403, FORBIDDEN_MESSAGE);
  return v;
}

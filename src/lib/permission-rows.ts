import { isCurrent, navGroupsFor, type NavItem } from "@/lib/nav";
import { atLeast, ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import { LEDGER_ROUTES, routeAccessOf, SHARED_OPERATIONS, type Grant, type Operation } from "@/lib/route-access";

/**
 * 権限一覧（/system/permissions と、一覧画面から開く窓）に出す行。
 *
 * 行は台帳（system-spec/route-ledger.json）から作る。画面の入口（requireRoute）・
 * サーバー処理（runAction の operation）・メニューも同じ台帳を読むので、
 * ここに出した可否と実際の動きはずれない（D-007・DD-006）。
 */

/** 1つの操作を、どの役割ができるか */
export interface PermissionOperation {
  id: string;
  label: string;
  description: string;
  /** できる最も弱い役割の呼び名（例: 会社の管理者） */
  minRoleLabel: string;
  byRole: Record<Role, boolean>;
}

export interface PermissionRow {
  /** 台帳の書き方のパス（例: /admin/members/[id]） */
  path: string;
  /** 画面名（台帳の label） */
  label: string;
  /** サイドバーの区分名。どのメニューにも無い画面は OUTSIDE_MENU */
  group: string;
  byRole: Record<Role, Grant>;
  /** 条件つきのときの条件（利用者の言葉） */
  condition?: string;
  /** その画面で何をするか（台帳の permissions.summary） */
  summary: string;
  operations: PermissionOperation[];
}

/**
 * 役割ごとの一言の説明。利用者一覧・社員一覧の「役割ごとにできること」に出す。
 * 細かい可否は権限一覧（台帳から作る表）に任せ、ここは役割の違いを掴むための要約だけにする。
 */
export const ROLE_SUMMARY: Record<Role, string> = {
  SUPER_ADMIN: "全ての会社と利用者を管理します。会社を切り替えて、どの会社の設定・評価も扱えます。",
  COMPANY_ADMIN: "自分の会社の制度・評価の進め方・社員を設定し、会社の全員の評価と結果を見ます。",
  MANAGER: "自分の部下の評価を進め、部下の情報と結果を見ます。自分の評価にも答えます。",
  EMPLOYEE: "自分あてのアンケートに答え、確定した自分の結果を見ます。",
};

/** どのメニューにも出ない画面（一覧の中の詳細・右上のメニューから開く画面など）の区分 */
export const OUTSIDE_MENU = "メニューの外から開く画面";

/** メニューを持つ役割を、区分名を借りる順に並べたもの（全体管理者のメニューを先に見る） */
const MENU_ORDER: readonly Role[] = ROLES;

/** そのパスが、どのメニューのどの区分にあるか。役割の順に見て、最初に当たった区分の名前 */
function groupOf(path: string): string {
  for (const role of MENU_ORDER) {
    const groups = navGroupsFor(role);
    const hrefs = groups.flatMap((g) => g.items.map((i: NavItem) => i.href));
    const hit = groups.find((g) => g.items.some((i) => isCurrent(path, i, hrefs)));
    if (hit) return hit.label;
  }
  return OUTSIDE_MENU;
}

/** 区分の並び。全体管理者のメニューの順を先に、ほかの役割にだけある区分をその後ろに置く */
function groupOrder(): string[] {
  const order: string[] = [];
  for (const role of MENU_ORDER) {
    for (const g of navGroupsFor(role)) if (!order.includes(g.label)) order.push(g.label);
  }
  return [...order, OUTSIDE_MENU];
}

function operationRow(op: Operation): PermissionOperation {
  const byRole = Object.fromEntries(ROLES.map((r) => [r, atLeast(r, op.minRole)])) as Record<Role, boolean>;
  return { id: op.id, label: op.label, description: op.description, minRoleLabel: ROLE_LABEL[op.minRole], byRole };
}

/**
 * 権限一覧の行。ログインの前に開く画面（/login・入口・回答用の URL）と、
 * 移動するだけの古い URL は除く（どれも minRole が null）。
 * 並びはサイドバーの区分の順、同じ区分の中は台帳の順。
 */
export function permissionRows(): PermissionRow[] {
  const order = groupOrder();
  const rows: PermissionRow[] = [];
  for (const route of LEDGER_ROUTES) {
    const access = routeAccessOf(route.path);
    if (!access?.minRole) continue;
    rows.push({
      path: route.path,
      label: route.label,
      group: groupOf(route.path),
      byRole: access.byRole,
      ...(access.condition ? { condition: access.condition } : {}),
      summary: route.permissions?.summary ?? route.purpose ?? "",
      operations: (route.permissions?.operations ?? []).map(operationRow),
    });
  }
  // sort は同じ値の並びを保つ（安定）ので、区分の中は台帳の順のまま
  return rows.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

/** 特定の画面に属さず、複数の画面で使う操作（検索・改善要望・外観など） */
export function sharedOperationRows(): PermissionOperation[] {
  return SHARED_OPERATIONS.map(operationRow);
}

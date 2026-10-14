import routeLedger from "../../system-spec/route-ledger.json";
import { atLeast, type Role } from "@/lib/roles";

/**
 * 「誰がどの画面を開け、どの操作をできるか」を台帳（system-spec/route-ledger.json）から引く。
 *
 * 画面の入口（requireRoute）・サーバー処理（runAction の operation）・API（apiViewerFor）・
 * メニュー・権限一覧のページは、どれもここを通して同じ台帳を読む。役割の名前をコードに
 * 書いて判定すると、権限一覧に書いたことと実際の動きがずれるため（D-007）。
 *
 * ブラウザ側の部品（メニュー）からも使うので、next/headers などサーバー専用のものを import しない。
 */

/** その役割が画面を開けるか。conditional は「条件を満たすときだけ」（例: 自分の部下だけ） */
export type Grant = "full" | "conditional" | "none";

export interface RouteAccess {
  /** 開ける最も弱い役割。ログインの前に出す画面は null */
  minRole: Role | null;
  byRole: Record<Role, Grant>;
  /** 条件つきのときの条件（利用者の言葉） */
  condition?: string;
  /** 条件を判定している関数（src/...ts#関数名） */
  conditionRef?: string;
}

export interface Operation {
  /** 操作の名前（例: members.viewGradeScore）。コードはこの名前で引く */
  id: string;
  label: string;
  /** その操作ができる最も弱い役割 */
  minRole: Role;
  /** その操作を受け付けるサーバー処理と API（actions/<file>.ts#関数 / api/<path>#METHOD） */
  actions: string[];
  description: string;
}

export interface LedgerRoute {
  path: string;
  label: string;
  accessClass: string;
  purpose?: string;
  subject?: string;
  navHiddenFor?: Role[];
  permissions?: { summary: string; operations: Operation[] };
}

interface Ledger {
  accessClasses: Record<string, { access?: RouteAccess }>;
  routes: LedgerRoute[];
  sharedOperations?: Operation[];
}

const ledger = routeLedger as unknown as Ledger;

/** 台帳の全ページ（台帳の順） */
export const LEDGER_ROUTES: readonly LedgerRoute[] = ledger.routes;

const routeByPath = new Map(ledger.routes.map((r) => [r.path, r]));

/** 特定のページに属さず、複数の画面で使う操作（検索・改善要望・外観など） */
export const SHARED_OPERATIONS: readonly Operation[] = ledger.sharedOperations ?? [];

/** 台帳の全操作。ページに付いた操作と、複数の画面で使う共有の操作 */
export const OPERATIONS: readonly Operation[] = [
  ...ledger.routes.flatMap((r) => r.permissions?.operations ?? []),
  ...SHARED_OPERATIONS,
];

const operationById = new Map(OPERATIONS.map((op) => [op.id, op]));

/** 台帳のページ（パスは台帳の書き方。例: /admin/members/[id]）。無ければ null */
export function routeOf(path: string): LedgerRoute | null {
  return routeByPath.get(path) ?? null;
}

/** そのページを誰が開けるか。台帳に無いページは null */
export function routeAccessOf(path: string): RouteAccess | null {
  const route = routeByPath.get(path);
  return route ? (ledger.accessClasses[route.accessClass]?.access ?? null) : null;
}

/** その操作ができる最も弱い役割。台帳に無い操作は null（どの役割にも許さない） */
export function minRoleFor(operationId: string): Role | null {
  return operationById.get(operationId)?.minRole ?? null;
}

/** その役割がその操作をできるか。台帳に無い操作は常に false */
export function roleCan(role: Role, operationId: string): boolean {
  const min = minRoleFor(operationId);
  return min !== null && atLeast(role, min);
}

/** ログイン中の人がその操作をできるか（画面の出し分け用） */
export function can(viewer: { role: Role }, operationId: string): boolean {
  return roleCan(viewer.role, operationId);
}

/** その役割がそのページを開けるか（条件つきも「開ける」に数える） */
export function roleCanOpen(role: Role, path: string): boolean {
  const access = routeAccessOf(path);
  return access !== null && access.byRole[role] !== "none";
}

/**
 * 役割の名前・強さ・呼び名。
 *
 * サーバー（src/lib/session.ts）とブラウザ側の部品（メニュー・権限一覧）の両方が使う。
 * session.ts は next/headers を読むためブラウザ側から import できないので、
 * 役割の定義だけをここに分けて置き、session.ts から同じ名前で export し直している。
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

/** role が min 以上の強さか */
export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * 権限の強さ（数字が大きいほど広く見える）。人の一覧を役割で並べるときに使う。
 * DB の生の値を受けるので、役割として知らない値は null にする（並べ替えでは末尾に置く）。
 */
export function roleRank(role: string): number | null {
  return (ROLES as readonly string[]).includes(role) ? RANK[role as Role] : null;
}

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

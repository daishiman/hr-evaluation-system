import type { Role } from "@/lib/session";

/**
 * サイドバーに出すメニューの定義。
 *
 * ここ1箇所で「誰に何を見せるか」を決める。画面側で条件分岐を書き足さない。
 * グループ名は利用者の言葉（動詞ベース）にする。「マスタ管理」のような
 * システム内部の言い方はしない。
 *
 * 注意: メニューを出さないことは権限の制御ではない。URLを直接開かれても
 * 通さないのは各画面の requireRole と API 側の判定（src/lib/session.ts）。
 */

export interface NavItem {
  href: string;
  label: string;
  /** 一覧の中の詳細画面など、この配下も現在地として扱いたいときに使う */
  exact?: boolean;
}

export interface NavGroup {
  /** null は見出しなし（ホームのように分類が要らないもの） */
  title: string | null;
  items: NavItem[];
}

/* 自分のアカウント（情報の確認・変更・パスワード・ログアウト）はサイドバーに置かない。
   全ロールのメニュー末尾に同じ項目が並ぶと、その分だけ毎回読む量が増えるため、
   右上の自分のアイコン（AccountMenu）にまとめている。 */

/** 会社の管理者とシステム全体管理者で共通の、会社ごとの運用メニュー。 */
const COMPANY_GROUPS: NavGroup[] = [
  {
    title: "制度を順番に設定する",
    items: [
      { href: "/admin/setup", label: "制度設定ガイド" },
      { href: "/admin/masters", label: "等級の設定" },
      { href: "/admin/masters/requirements", label: "等級要件（支援・運営）" },
      { href: "/admin/masters/promotion", label: "昇格の条件・要件" },
      { href: "/admin/behavior", label: "行動指針" },
      { href: "/admin/scheme", label: "KPI・評価セット" },
    ],
  },
  {
    title: "評価を順番に進める",
    items: [
      { href: "/admin/cycles", label: "評価期間" },
      { href: "/admin/forms", label: "アンケート" },
      { href: "/manager/cycles", label: "評価・結果を確認する" },
    ],
  },
  {
    title: "運用を補う",
    items: [
      { href: "/admin/kgi", label: "事業所KGIの達成率" },
      { href: "/admin/raises", label: "昇給の設定" },
    ],
  },
  {
    title: "人を管理する",
    items: [{ href: "/admin/members", label: "社員" }],
  },
  {
    title: "基準を確認する",
    items: [
      { href: "/criteria", label: "評価の基準" },
      { href: "/forms", label: "アンケートの中身" },
    ],
  },
];

/**
 * ロールごとのメニュー。
 * 評価される方（EMPLOYEE）には、制度の設定と評価基準を一切出さない。
 */
export function navGroupsFor(role: Role): NavGroup[] {
  switch (role) {
    case "SUPER_ADMIN":
      return [
        { title: null, items: [{ href: "/system", label: "ホーム", exact: true }] },
        {
          title: "システムを管理する",
          items: [
            { href: "/system/companies", label: "会社一覧" },
            { href: "/system/users", label: "利用者一覧" },
          ],
        },
        ...COMPANY_GROUPS,
      ];
    case "COMPANY_ADMIN":
      return [
        { title: null, items: [{ href: "/admin", label: "ホーム", exact: true }] },
        ...COMPANY_GROUPS,
      ];
    case "MANAGER":
      return [
        { title: null, items: [{ href: "/manager", label: "ホーム", exact: true }] },
        {
          title: "評価を進める",
          items: [{ href: "/manager/cycles", label: "評価・結果を確認する" }],
        },
        {
          title: "人を見る",
          items: [{ href: "/manager/members", label: "メンバー" }],
        },
        {
          title: "基準を確認する",
          items: [
            { href: "/criteria", label: "評価の基準" },
            { href: "/forms", label: "アンケートの中身" },
          ],
        },
      ];
    default:
      return [
        { title: null, items: [{ href: "/me", label: "ホーム", exact: true }] },
        {
          title: "半期の実績",
          items: [
            { href: "/me/forms", label: "実績を報告する" },
            { href: "/me/results", label: "評価の結果を見る" },
          ],
        },
        /* アンケートの中身は全ロールが読める（配点・昇格ゲートは出さない）。
           自分あての1本を答えることと、どの等級で何を聞いているかを読むことは
           別の用事なので、「実績を報告する」と同じ分類には入れない。 */
        {
          title: "内容を確認する",
          items: [{ href: "/forms", label: "アンケートの中身" }],
        },
      ];
  }
}

/** サイドバーの先頭に置くホームのリンク（アプリ名を押したときの戻り先と揃える）。 */
export function homeItemFor(role: Role): NavItem {
  return navGroupsFor(role)[0].items[0];
}

/**
 * いまの URL がそのメニュー項目かどうか。
 *
 * `exact` を付けた項目（ホーム）は完全一致だけ。付いていない項目は
 * 配下の詳細画面（/admin/forms/xxx）にいるときも現在地として光らせる。
 * ただし `/admin/masters` と `/admin/masters/requirements` のように
 * 片方がもう片方の前方一致になる場合は、長い方だけを現在地にする。
 */
export function isCurrent(pathname: string, item: NavItem, allHrefs: string[]): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href) return true;
  if (!pathname.startsWith(`${item.href}/`)) return false;
  // より深く一致する項目が他にあるなら、そちらに譲る
  return !allHrefs.some(
    (href) => href !== item.href && href.length > item.href.length && (pathname === href || pathname.startsWith(`${href}/`)),
  );
}

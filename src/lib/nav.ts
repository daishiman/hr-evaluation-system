import type { IconName } from "@/components/Icon";
import type { Role } from "@/lib/session";
import routeLedger from "../../system-spec/route-ledger.json";

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
  /**
   * その項目を表す絵。**省略できない**。
   *
   * メニューを畳むとアイコンだけの列になり、絵が唯一の手がかりになる。
   * 「その画面が扱う対象から一意に思い出せる絵」を選ぶ（書類・歯車のような
   * どの画面にも当てはまる絵は使わない）。同じロールのメニューの中で
   * 同じ絵を2つの項目に使わない（nav.test.ts が見張っている）。
   */
  icon: IconName;
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
      { href: "/admin/setup", label: "制度設定ガイド", icon: "guide" },
      { href: "/admin/masters", label: "等級の設定", icon: "grade" },
      { href: "/admin/masters/requirements", label: "等級要件（支援・運営）", icon: "requirement" },
      { href: "/admin/masters/promotion", label: "昇格の条件・要件", icon: "promotion" },
      { href: "/admin/behavior", label: "行動指針", icon: "behavior" },
      { href: "/admin/scheme", label: "KPI・評価セット", icon: "kpi" },
    ],
  },
  {
    title: "評価を順番に進める",
    items: [
      { href: "/admin/cycles", label: "評価期間", icon: "calendar" },
      { href: "/admin/forms", label: "アンケート", icon: "survey" },
      { href: "/manager/cycles", label: "評価・結果を確認する", icon: "evaluation" },
    ],
  },
  {
    title: "運用を補う",
    items: [
      { href: "/admin/kgi", label: "事業所KGIの達成率", icon: "achievement" },
      { href: "/admin/raises", label: "昇給の設定", icon: "raise" },
    ],
  },
  {
    title: "人を管理する",
    items: [{ href: "/admin/members", label: "社員", icon: "users" }],
  },
  {
    title: "基準を確認する",
    items: [
      { href: "/criteria", label: "評価の基準", icon: "criteria" },
      { href: "/forms", label: "アンケートの中身", icon: "surveyRead" },
    ],
  },
  /* 各画面から届いた「ここが使いにくい」を読む場所。
     他の人が書いた不満がそのまま載るため、管理者だけに出す。 */
  {
    title: "使い勝手を直す",
    items: [{ href: "/admin/improvements", label: "届いた改善要望", icon: "inbox" }],
  },
];

/**
 * 自分自身が評価を受ける立場としてのメニュー。
 *
 * マネージャーも会社の管理者も、自分の上長から評価を受ける（アンケートの配布は
 * 役割ではなく等級で決まる: src/lib/form-build.ts）。評価する側のメニューしか
 * 出していなかったため、権限の上では回答も結果の閲覧もできるのに、画面から
 * たどり着けない状態だった。同じ2項目を一般の方と同じ言い方で出す。
 *
 * 会社に属さないシステム全体管理者には出さない（評価を受ける立場を持たない）。
 */
const MY_EVALUATION_GROUP: NavGroup = {
  title: "自分の評価",
  items: [
    { href: "/me/forms", label: "実績を報告する", icon: "report" },
    { href: "/me/results", label: "評価の結果を見る", icon: "result" },
  ],
};

/**
 * ロールごとのメニュー。
 * 一般（EMPLOYEE）には、制度の設定と評価基準を一切出さない。
 */
export function navGroupsFor(role: Role): NavGroup[] {
  switch (role) {
    case "SUPER_ADMIN":
      return [
        { title: null, items: [{ href: "/system", label: "ホーム", icon: "home", exact: true }] },
        {
          title: "システムを管理する",
          items: [
            { href: "/system/companies", label: "会社一覧", icon: "building" },
            { href: "/system/users", label: "利用者一覧", icon: "userAdmin" },
            { href: "/system/usage", label: "利用状況", icon: "usage" },
            { href: "/system/agent-keys", label: "Claude Code 連携の鍵", icon: "lock" },
          ],
        },
        ...COMPANY_GROUPS,
      ];
    case "COMPANY_ADMIN":
      return [
        { title: null, items: [{ href: "/admin", label: "ホーム", icon: "home", exact: true }] },
        ...COMPANY_GROUPS,
        MY_EVALUATION_GROUP,
      ];
    case "MANAGER":
      return [
        { title: null, items: [{ href: "/manager", label: "ホーム", icon: "home", exact: true }] },
        {
          title: "評価を進める",
          items: [{ href: "/manager/cycles", label: "評価・結果を確認する", icon: "evaluation" }],
        },
        {
          title: "人を見る",
          items: [{ href: "/manager/members", label: "メンバー", icon: "users" }],
        },
        MY_EVALUATION_GROUP,
        {
          title: "基準を確認する",
          items: [
            { href: "/criteria", label: "評価の基準", icon: "criteria" },
            { href: "/forms", label: "アンケートの中身", icon: "surveyRead" },
          ],
        },
      ];
    default:
      return [
        { title: null, items: [{ href: "/me", label: "ホーム", icon: "home", exact: true }] },
        {
          title: "半期の実績",
          items: [
            { href: "/me/forms", label: "実績を報告する", icon: "report" },
            { href: "/me/results", label: "評価の結果を見る", icon: "result" },
          ],
        },
        /* アンケートの中身は全ロールが読める（配点・昇格ゲートは出さない）。
           自分あての1本を答えることと、どの等級で何を聞いているかを読むことは
           別の用事なので、「実績を報告する」と同じ分類には入れない。 */
        {
          title: "内容を確認する",
          items: [{ href: "/forms", label: "アンケートの中身", icon: "surveyRead" }],
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

/**
 * いまの画面の見出しに添える絵。
 *
 * 画面ごとに絵を選び直さない。**メニューで使っている絵をそのまま持ってくる**。
 * 左のメニュー（畳むとアイコンだけになる）と見出しに同じ絵が出ることで、
 * 「この絵はこの画面」という対応を、利用者が使いながら覚えられる。
 * 対応表を1つにしておかないと、同じ画面が場所によって違う絵で出てしまう。
 *
 * メニューに無い画面（一覧の中の詳細など）は、その一覧の絵を引き継ぐ。
 * どこにも当たらない画面は絵なし（当てずっぽうの絵を出さない）。
 */
export function navIconFor(pathname: string): IconName | null {
  const items = allNavItems();
  const allHrefs = items.map((i) => i.href);
  return items.find((item) => isCurrent(pathname, item, allHrefs))?.icon ?? null;
}

/** 全ロールぶんのメニュー項目を、同じURLで1つにまとめて返す。 */
export function allNavItems(): NavItem[] {
  const roles: Role[] = ["EMPLOYEE", "MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"];
  const byHref = new Map<string, NavItem>();
  for (const role of roles) {
    for (const group of navGroupsFor(role)) {
      for (const item of group.items) if (!byHref.has(item.href)) byHref.set(item.href, item);
    }
  }
  return [...byHref.values()];
}

/* ------------------------------------------------------------------ *
 * ここから下は「いまどの画面にいるか」の表示（ヘッダーの階層表示）用。
 * ------------------------------------------------------------------ */

/** 1つのURLの形と、その画面の呼び名。 */
export interface RouteMeta {
  /** URLの形。動的な部分は [id] のように書く（1区切りぶんの任意の値に一致する） */
  pattern: string;
  /** 画面の呼び名。サイドバーに出ている画面は、その語をそのまま使う */
  label: string;
  /** 階層の途中の段としては出さない（開いても意味のない中継URL） */
  hidden?: boolean;
}

/**
 * URLと画面の呼び名の対応表。**画面名の正本はここ1箇所**。
 *
 * サイドバーに出る画面（NavItem）と、その配下の詳細画面の両方を載せる。
 * 画面側で「社員 →」のような文字列を書き起こすと、呼び名を変えたときに
 * 直し漏れが出る。ヘッダーの階層表示はこの表だけを読む。
 *
 * 動的な部分（社員ID・アンケートID）は、名前ではなく**種類の呼び名**を出す。
 * 名前は画面の見出し（h1）に出ているので、階層表示で二度読ませない。
 *
 * 追加した画面がここに無いと nav.test.ts が落ちる（呼び名の付け忘れを防ぐ）。
 */
export const ROUTE_META: RouteMeta[] = routeLedger.routes.map((route) => ({
  pattern: route.path,
  label: route.label,
}));

/* 途中の段として出しても行き先が無いURL。階層表示から外す。 */
const HIDDEN_PREFIXES = ["/manager/evaluations"];

/** URL 1本ぶんの、対応表の引き当て。 */
export function routeMetaOf(pathname: string): RouteMeta | null {
  const segs = pathname.split("/").filter(Boolean);
  let best: { meta: RouteMeta; dynamic: number } | null = null;
  for (const meta of ROUTE_META) {
    const pat = meta.pattern.split("/").filter(Boolean);
    if (pat.length !== segs.length) continue;
    if (!pat.every((p, i) => (p.startsWith("[") ? segs[i].length > 0 : p === segs[i]))) continue;
    /* 決まった名前のほうを優先する。/admin/members/policy は
       /admin/members/[id]（社員1人）にも当たってしまうため、当たった数だけでは決められない。 */
    const dynamic = pat.filter((p) => p.startsWith("[")).length;
    if (best === null || dynamic < best.dynamic) best = { meta, dynamic };
  }
  return best?.meta ?? null;
}

/** 実URLは再現用に残し、集計だけを動的パターンへ正規化する。 */
export function routeIdentityOf(rawPath: string): { path: string; routePattern: string; label: string } {
  const path = rawPath.split(/[?#]/)[0] || "/";
  const meta = routeMetaOf(path);
  return {
    path,
    routePattern: meta?.pattern ?? path,
    label: meta?.label ?? "その他の画面",
  };
}

/** 階層表示の1段。 */
export interface TrailStep {
  label: string;
  /** 押して移れる段だけ href を持つ。いまの画面といちばん上の分類は持たない */
  href?: string;
}

/**
 * いまのURLから「ホーム → 分類 → 画面」の階層を組む。
 *
 * ・1段目はそのロールのホーム（役割ごとに行き先が違う）
 * ・2段目はサイドバーの分類名。押す先が無いので文字だけ出す
 * ・3段目以降はURLを上から順にたどる。最後の段がいまの画面
 *
 * 表に無いURLは段を作らない（知らない画面を推測した名前で呼ばない）。
 */
export function resolveTrail(pathname: string, role: Role): TrailStep[] {
  const groups = navGroupsFor(role);
  const home = groups[0].items[0];
  const steps: TrailStep[] = [{ label: "ホーム", href: home.href }];
  if (pathname === home.href) return steps;

  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const group = groups.find((g) => g.title && g.items.some((i) => isCurrent(pathname, i, allHrefs)));
  if (group?.title) steps.push({ label: group.title });

  const segs = pathname.split("/").filter(Boolean);
  for (let i = 1; i <= segs.length; i++) {
    const href = `/${segs.slice(0, i).join("/")}`;
    if (href === home.href) continue;
    if (HIDDEN_PREFIXES.includes(href)) continue;
    const meta = routeMetaOf(href);
    if (!meta || meta.hidden) continue;
    steps.push({ label: meta.label, href: i === segs.length ? undefined : href });
  }
  return steps;
}

/** 検索の結果に出す「画面」の候補。サイドバーに出ている画面だけを対象にする。 */
export function searchableScreens(role: Role): { href: string; label: string; group: string }[] {
  return navGroupsFor(role).flatMap((g) =>
    g.items.map((i) => ({ href: i.href, label: i.label, group: g.title ?? "" })),
  );
}

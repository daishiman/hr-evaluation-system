import Link from "next/link";
import type { ReactNode } from "react";
import { ROLE_LABEL, type Viewer } from "@/lib/session";
import { NavLink } from "@/components/NavLink";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * 画面の骨格。
 * ナビは「機能名」ではなく「いつ使うか」が分かる言葉にし、ロールごとに必要なものだけ出す。
 * 現在地は常に見える位置に固定する（ヘッダーは sticky）。
 */

const NAV: Record<Viewer["role"], { href: string; label: string }[]> = {
  EMPLOYEE: [
    { href: "/me", label: "ホーム" },
    { href: "/me/forms", label: "実績を報告する" },
    { href: "/me/results", label: "評価の結果を見る" },
  ],
  MANAGER: [
    { href: "/manager", label: "ホーム" },
    { href: "/manager/members", label: "メンバーを見る" },
    { href: "/manager/cycles", label: "評価サイクル" },
    { href: "/criteria", label: "評価基準を確認する" },
  ],
  COMPANY_ADMIN: [
    { href: "/admin", label: "ホーム" },
    { href: "/admin/members", label: "社員" },
    { href: "/admin/cycles", label: "評価サイクル" },
    { href: "/admin/forms", label: "アンケート" },
    { href: "/admin/scheme", label: "評価セット（8項目・配点）" },
    { href: "/admin/masters", label: "制度マスタ" },
    { href: "/admin/raises", label: "昇給の設定" },
    { href: "/criteria", label: "評価基準を確認する" },
  ],
  SUPER_ADMIN: [
    { href: "/system", label: "ホーム" },
    { href: "/system/companies", label: "会社一覧" },
    { href: "/system/users", label: "利用者一覧" },
  ],
};

export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const nav = NAV[viewer.role] ?? NAV.EMPLOYEE;
  return (
    <>
      <header className="app-header">
        <Link href={nav[0].href} className="app-name no-underline">
          人事評価
          <span className="app-name-sub">{viewer.companyName ?? "全社共通"}</span>
        </Link>
        <nav className="app-nav" aria-label="主要メニュー">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} />
          ))}
        </nav>
        <div className="ml-4 flex shrink-0 items-center gap-3 border-l border-[var(--line)] pl-4">
          <span className="hidden text-right text-[12px] leading-tight sm:block">
            <span className="block font-semibold">{viewer.name}</span>
            <span className="block text-[var(--ink-muted)]">{ROLE_LABEL[viewer.role]}</span>
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-7 xl:max-w-6xl">{children}</main>
    </>
  );
}

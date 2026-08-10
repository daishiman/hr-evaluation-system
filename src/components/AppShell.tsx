import Link from "next/link";
import type { ReactNode } from "react";
import { ROLE_LABEL, type Viewer } from "@/lib/session";
import { listCompanies } from "@/lib/queries";
import { SignOutButton } from "@/components/SignOutButton";
import { AppSidebar, SIDEBAR_INIT_SCRIPT } from "@/components/AppSidebar";
import { homeItemFor, navGroupsFor } from "@/lib/nav";
import { ReasonNote } from "@/components/ui";

/**
 * 画面の骨格。
 *
 * ・左のサイドバーに、分類ごとにまとめたメニューを置く（定義は src/lib/nav.ts）
 * ・上のヘッダーには「いま誰でログインしているか」と、狭い画面用のメニューボタンだけを置く
 * ・本文の最大幅・左右の余白はここ1箇所で決める（各画面で上書きしない）
 */
export async function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const groups = navGroupsFor(viewer.role);
  const home = homeItemFor(viewer.role);
  const companies = viewer.role === "SUPER_ADMIN" ? await listCompanies() : [];

  return (
    <div className="app-layout">
      {/* 前回閉じていた人の画面で、一瞬メニューが開いて見えるのを防ぐ */}
      <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />

      <AppSidebar
        groups={groups}
        appSubtitle={viewer.companyName ?? "全社共通"}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        currentCompanyId={viewer.companyId}
        homeHref={home.href}
      />

      <div className="app-body">
        <header className="app-header">
          <Link href={home.href} className="app-name app-name-header no-underline">
            人事評価
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link href="/account/password" className="hidden text-right text-[12px] leading-tight no-underline sm:block">
              <span className="block font-semibold">{viewer.name}</span>
              <span className="block text-[var(--ink-muted)]">{ROLE_LABEL[viewer.role]}</span>
            </Link>
            <SignOutButton />
          </div>
        </header>

        <main className="app-main">
          {viewer.mustChangePassword && (
            <div className="no-print" style={{ marginBottom: "var(--space-block)" }}>
              <ReasonNote
                action={
                  <Link href="/account/password" className="btn btn-primary no-underline">
                    パスワードを変更する
                  </Link>
                }
              >
                <strong>パスワードの変更をお願いします。</strong>
                いまのパスワードは、アカウントを発行したときの仮のものです。
              </ReasonNote>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

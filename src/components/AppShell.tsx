import type { ReactNode } from "react";
import { crossesCompanies, ROLE_LABEL, type Viewer } from "@/lib/session";
import { can } from "@/lib/route-access";
import { listSwitchableCompanies } from "@/lib/queries";
import { CompanyScopeProvider } from "@/lib/company-scope-context";
import { AccountMenu } from "@/components/AccountMenu";
import { AppSidebar, SIDEBAR_INIT_SCRIPT } from "@/components/AppSidebar";
import { SidebarDrawerProvider, SidebarOpenButton } from "@/components/SidebarDrawer";
import { HeaderNav } from "@/components/HeaderNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { homeItemFor, navGroupsFor, searchableScreens } from "@/lib/nav";
import { LinkButton, ReasonNote } from "@/components/ui";
import { StickyOffset } from "@/components/StickyOffset";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { FreshnessSync } from "@/components/FreshnessSync";
import { UsageTracker } from "@/components/UsageTracker";

/**
 * 画面の骨格。
 *
 * ・左のサイドバーに、分類ごとにまとめたメニューを置く（定義は src/lib/nav.ts）
 * ・上のヘッダーには、左から「メニュー（狭い画面）／戻る・進む／いま開いている階層」、
 *   右に「検索／自分のアカウント」を置く。画面ごとに中身を変えない
 * ・本文の最大幅・左右の余白はここ1箇所で決める（各画面で上書きしない）
 */
export async function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const groups = navGroupsFor(viewer.role);
  const home = homeItemFor(viewer.role);
  // 会社の切り替えは、全体管理者と、2つ以上の会社に所属する人に出す（S7・D-004）。
  // 所属が1つの人に、選べる項目が1つだけの欄を見せても迷わせるだけなので出さない。
  const switchable = can(viewer, "companyScope.switch") ? await listSwitchableCompanies(viewer) : [];
  const canSwitchCompany = crossesCompanies(viewer.role) || switchable.length >= 2;
  const companies = canSwitchCompany ? switchable : [];

  return (
    /* 画面を描いた会社を、画面からの書き込みに添える（別のタブで会社を切り替えた後の古い画面を止める） */
    <CompanyScopeProvider companyId={viewer.companyId}>
      <SidebarDrawerProvider>
        <div className="app-layout">
          {/* 前回閉じていた人の画面で、一瞬メニューが開いて見えるのを防ぐ */}
          <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />

          {/* 固定した見出しの帯の高さを実測して、その下に貼り付く位置を全画面に配る */}
          <StickyOffset />

          <AppSidebar
            groups={groups}
            appSubtitle={viewer.companyName ?? "全社共通"}
            companies={companies}
            currentCompanyId={viewer.companyId}
            homeHref={home.href}
          />

          <div className="app-body">
            <header className="app-header">
              {/* 狭い画面ではメニューが引き出しになる。開くボタンはヘッダーの左端 */}
              <SidebarOpenButton />
              <HeaderNav role={viewer.role} />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <GlobalSearch
                  screens={searchableScreens(viewer.role)}
                  /* 一般の方は他人の一覧を見られないので、人は探せない */
                  canSearchPeople={can(viewer, "search.people")}
                />
                {/* 自分のことは、すべてこのアイコンの中にまとめる（ヘッダーに文字を増やさない） */}
                <AccountMenu
                  userId={viewer.id}
                  name={viewer.name}
                  email={viewer.email}
                  roleLabel={ROLE_LABEL[viewer.role]}
                  companyContextLabel={
                    viewer.companyName ? `${canSwitchCompany ? "操作中" : "所属"}: ${viewer.companyName}` : null
                  }
                  needsPasswordChange={viewer.mustChangePassword}
                />
              </div>
            </header>

            <main className="app-main">
              {viewer.mustChangePassword && (
                <div className="no-print" style={{ marginBottom: "var(--space-block)" }}>
                  <ReasonNote
                    action={
                      <LinkButton href="/account/password" variant="primary" className="no-underline">
                        パスワードを変更する
                      </LinkButton>
                    }
                  >
                    <strong>パスワードの変更をお願いします。</strong>
                    いまのパスワードは、アカウントを発行したときの仮のものです。
                  </ReasonNote>
                </div>
              )}
              {children}
            </main>

            {/* 改善要望はここ1箇所だけ。画面ごとに置くと、置き忘れた画面ができる */}
            <FeedbackWidget />

            {/* 利用状況の記録も同じ理由でここ1箇所。画面には何も出ない */}
            <UsageTracker />

            {/* 他のタブでの保存・タブへの復帰で、表示中の画面を取り直す。画面には何も出ない */}
            <FreshnessSync />
          </div>
        </div>
      </SidebarDrawerProvider>
    </CompanyScopeProvider>
  );
}

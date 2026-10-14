"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * 画面を描いたときの会社（S7・D-004）。
 *
 * 1人が複数の会社に所属できるので、別のタブで会社を切り替えたあとも、古いタブには
 * 前の会社の画面（等級・上長の候補など）が残る。画面からの書き込みには、この会社の id を
 * `__scope` として添えて送り、サーバーが今の会社と食い違えば何も書かずに止める（action.ts の takeScope）。
 *
 * undefined は「会社の画面の外」（ログイン画面など）。このときは何も添えない。
 * null は「会社をまだ選んでいない」（全体管理者）。空の文字として送る。
 */
const CompanyScopeContext = createContext<string | null | undefined>(undefined);

export function CompanyScopeProvider({ companyId, children }: { companyId: string | null; children: ReactNode }) {
  return <CompanyScopeContext value={companyId}>{children}</CompanyScopeContext>;
}

export function useCompanyScope(): string | null | undefined {
  return useContext(CompanyScopeContext);
}

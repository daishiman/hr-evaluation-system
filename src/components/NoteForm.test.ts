import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readableNoteVisibilities } from "@/lib/domain/evaluation-authority";
import type { Role } from "@/lib/roles";

/*
 * 評価メモの入力欄に出す公開範囲の選択肢。
 *
 * 書ける段階は読める段階と同じ。メンバー詳細（/manager/members/[id]）は
 * readableNoteVisibilities(viewer.role) をそのまま渡すので、ここでも同じ関数で props を作る。
 * SSR の描画試験なので、保存の入口（サーバーの処理を読み込む）は差し替えて止める。
 */

vi.mock("@/lib/use-refresh", () => ({ useSaveAction: () => ({ save: vi.fn(), saving: false }) }));
vi.mock("@/actions/notes", () => ({ createNote: vi.fn() }));

import { NoteForm } from "./NoteForm";

const ADMIN_ONLY_LABEL = "管理者だけが読めるようにする";

const renderFor = (role: Role) =>
  renderToStaticMarkup(createElement(NoteForm, { employeeId: "usr_emp", visibilities: readableNoteVisibilities(role) }));

describe("評価メモの入力欄の公開範囲", () => {
  it("マネージャーには「管理者だけが読めるようにする」を出さない（メモは書ける）", () => {
    const html = renderFor("MANAGER");
    expect(html).not.toContain(ADMIN_ONLY_LABEL);
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("メモを残す");
  });

  it.each(["COMPANY_ADMIN", "SUPER_ADMIN"] as const)("%s には今までどおり「管理者だけが読めるようにする」を出す", (role) => {
    const html = renderFor(role);
    expect(html).toContain(ADMIN_ONLY_LABEL);
    expect(html).toContain('type="checkbox"');
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { minRoleFor } from "@/lib/route-access";
import { atLeast, ROLES } from "@/lib/roles";
import {
  canActOnEmployeeEvaluation,
  canReadEmployee,
  canReadResponseBody,
  canReadSelfResult,
  canReviewEmployeeEvaluation,
  evaluationViewOf,
  isOwnEvaluation,
  NOTE_VISIBILITIES,
  readableNoteVisibilities,
  selectNextActionableEvaluation,
  SELF_EVALUATION_BLOCK_REASON,
} from "./evaluation-authority";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("対象者ごとの権限契約", () => {
  const directReport = { employeeId: "member-a", managerId: "manager-a" };
  const outsideReport = { employeeId: "member-b", managerId: "manager-b" };

  it("マネージャーは直属メンバーだけを閲覧できる", () => {
    expect(canReadEmployee("manager-a", "MANAGER", directReport)).toBe(true);
    expect(canReadEmployee("manager-a", "MANAGER", outsideReport)).toBe(false);
  });

  it("会社管理者以上は自社の対象者を閲覧でき、一般は本人だけを閲覧できる", () => {
    expect(canReadEmployee("admin", "COMPANY_ADMIN", outsideReport)).toBe(true);
    expect(canReadEmployee("super", "SUPER_ADMIN", outsideReport)).toBe(true);
    expect(canReadEmployee("member-b", "EMPLOYEE", outsideReport)).toBe(true);
    expect(canReadEmployee("member-a", "EMPLOYEE", outsideReport)).toBe(false);
  });

  it("評価操作は管理者または直属上長だけに許可し、自己評価は常に拒否する", () => {
    expect(canActOnEmployeeEvaluation("manager-a", "MANAGER", directReport)).toBe(true);
    expect(canActOnEmployeeEvaluation("manager-a", "MANAGER", outsideReport)).toBe(false);
    expect(canActOnEmployeeEvaluation("admin", "COMPANY_ADMIN", outsideReport)).toBe(true);
    expect(
      canActOnEmployeeEvaluation("manager-a", "COMPANY_ADMIN", {
        employeeId: "manager-a",
        managerId: "director",
      }),
    ).toBe(false);
  });

  it("評価者向け画面は会社管理者以上または直属上長だけが開ける", () => {
    expect(canReviewEmployeeEvaluation("admin", "COMPANY_ADMIN", outsideReport)).toBe(true);
    expect(canReviewEmployeeEvaluation("super", "SUPER_ADMIN", outsideReport)).toBe(true);
    expect(canReviewEmployeeEvaluation("manager-a", "MANAGER", directReport)).toBe(true);
    expect(canReviewEmployeeEvaluation("manager-a", "MANAGER", outsideReport)).toBe(false);
    expect(canReviewEmployeeEvaluation("member-a", "EMPLOYEE", directReport)).toBe(false);
  });

  it("会社の管理者は評価者向け画面で自分の評価も開ける（いまの挙動。扱いは SECURITY-013 で決める）", () => {
    // SECURITY-013 で決まったら期待値を反転する（DD-021 の固定する検査）
    const ownAsAdmin = { employeeId: "admin", managerId: "director" };
    expect(canReviewEmployeeEvaluation("admin", "COMPANY_ADMIN", ownAsAdmin)).toBe(true);
    expect(canActOnEmployeeEvaluation("admin", "COMPANY_ADMIN", ownAsAdmin)).toBe(false);
  });

  it("評価レポートは本人なら役割にかかわらず本人向け、他の人には評価者向け画面と同じ範囲だけ（DD-024）", () => {
    const ownAsAdmin = { employeeId: "admin", managerId: "director" };
    expect(evaluationViewOf("admin", "COMPANY_ADMIN", ownAsAdmin)).toBe("self");
    expect(evaluationViewOf("manager-a", "MANAGER", { employeeId: "manager-a", managerId: null })).toBe("self");
    expect(evaluationViewOf("member-a", "EMPLOYEE", directReport)).toBe("self");
    expect(evaluationViewOf("manager-a", "MANAGER", directReport)).toBe("reviewer");
    expect(evaluationViewOf("admin", "COMPANY_ADMIN", outsideReport)).toBe("reviewer");
    expect(evaluationViewOf("manager-a", "MANAGER", outsideReport)).toBeNull();
    expect(evaluationViewOf("member-a", "EMPLOYEE", outsideReport)).toBeNull();
  });

  it("下書き回答の本文は本人だけ、提出済み回答は本人・直属上長・管理者だけが読める", () => {
    expect(canReadResponseBody("member-a", "EMPLOYEE", directReport, "draft")).toBe(true);
    expect(canReadResponseBody("manager-a", "MANAGER", directReport, "draft")).toBe(false);
    expect(canReadResponseBody("admin", "COMPANY_ADMIN", directReport, "draft")).toBe(false);
    expect(canReadResponseBody("manager-a", "MANAGER", directReport, "submitted")).toBe(true);
    expect(canReadResponseBody("manager-b", "MANAGER", directReport, "submitted")).toBe(false);
    expect(canReadResponseBody("admin", "COMPANY_ADMIN", directReport, "submitted")).toBe(true);
  });

  it("本人向け結果詳細は本人の確定済み評価だけを許可する", () => {
    expect(canReadSelfResult("member-a", directReport.employeeId, "finalized")).toBe(true);
    expect(canReadSelfResult("member-a", directReport.employeeId, "draft")).toBe(false);
    expect(canReadSelfResult("member-b", directReport.employeeId, "finalized")).toBe(false);
  });
});

describe("評価メモの公開範囲（readableNoteVisibilities）", () => {
  it("取る値は manager と admin の2つ（保存の検査も同じ値の組から引く）", () => {
    expect([...NOTE_VISIBILITIES]).toEqual(["manager", "admin"]);
    expect(read("src/actions/notes.ts")).toContain("z.enum(NOTE_VISIBILITIES)");
  });

  it("会社の管理者以上は「管理者のみ」を含めてすべて読める", () => {
    expect(readableNoteVisibilities("COMPANY_ADMIN")).toEqual(["manager", "admin"]);
    expect(readableNoteVisibilities("SUPER_ADMIN")).toEqual(["manager", "admin"]);
  });

  it("マネージャーは「管理者のみ」を読めない", () => {
    expect(readableNoteVisibilities("MANAGER")).toEqual(["manager"]);
  });

  it("一般（本人）には、どの公開範囲のメモも見せない", () => {
    expect(readableNoteVisibilities("EMPLOYEE")).toEqual([]);
  });

  it("公開範囲は最低の役割として働く（上の役割は、下の役割が読める段階をすべて読める）", () => {
    for (const higher of ROLES) {
      for (const lower of ROLES.filter((role) => atLeast(higher, role))) {
        expect(readableNoteVisibilities(higher)).toEqual(expect.arrayContaining(readableNoteVisibilities(lower)));
      }
    }
  });

  it("読み出し（listNotes）は役割を位置引数の必須で受け、メンバー詳細は見る人の役割を渡す", () => {
    expect(read("src/lib/queries.ts")).toContain(
      "export async function listNotes(companyId: string, employeeId: string, viewerRole: Viewer[\"role\"])",
    );
    expect(read("src/app/manager/members/[id]/page.tsx")).toContain("listNotes(viewer.companyId, id, viewer.role)");
  });

  it("書ける段階は読める段階と同じ。入力欄の選択肢と保存の検査は、どちらも readableNoteVisibilities から引く", () => {
    const page = read("src/app/manager/members/[id]/page.tsx");
    expect(page).toContain("const noteVisibilities = readableNoteVisibilities(viewer.role);");
    expect(page).toContain("<NoteForm employeeId={member.id} visibilities={noteVisibilities} />");
    expect(read("src/actions/notes.ts")).toContain("readableNoteVisibilities(viewer.role).includes(input.visibility)");
    // 入力欄の側で役割を見て別の判定を書かない
    expect(read("src/components/NoteForm.tsx")).not.toMatch(/MANAGER|COMPANY_ADMIN|SUPER_ADMIN/);
  });
});

describe("自分の評価かどうかの判定", () => {
  it("対象者と操作している人が同じなら自分の評価", () => {
    expect(isOwnEvaluation("usr_manager_1", "usr_manager_1")).toBe(true);
  });

  it("他人の評価は自分の評価ではない", () => {
    expect(isOwnEvaluation("usr_manager_1", "usr_e1")).toBe(false);
  });

  it("理由文は「なぜできないか」と「誰に頼むか」を日本語で伝える", () => {
    expect(SELF_EVALUATION_BLOCK_REASON).toContain("自分自身の評価");
    expect(SELF_EVALUATION_BLOCK_REASON).toContain("上長");
  });
});

describe("自分の評価を自分で確定できないこと（サーバー側）", () => {
  const route = read("src/actions/evaluations.ts");

  it("確定・差し戻し・コメントのどの分岐よりも前で、本人からの書き込みを止める", () => {
    const guard = route.indexOf("isOwnEvaluation(viewer.id, row.employeeId)");
    const firstAction = route.indexOf('input.action === "comment"');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(firstAction).toBeGreaterThan(guard);
  });

  it("403 で、画面と同じ理由文を返す", () => {
    expect(route).toContain("new HttpError(403, SELF_EVALUATION_BLOCK_REASON)");
  });

  it("役割では判定しない（会社の管理者でも自分自身の評価には手を入れられない）", () => {
    const guardLine = route.split("\n").find((l) => l.includes("isOwnEvaluation(viewer.id"));
    expect(guardLine).toBeDefined();
    expect(guardLine).not.toContain("role");
  });

  it("対象者の取得は会社の絞り込み付きのまま（他社の評価は見えない）", () => {
    expect(route).toContain("eq(s.evaluations.companyId, viewer.companyId)");
  });
});

describe("対象者ごとの契約がすべての入口で使われること", () => {
  it("評価のbuild・確定・再開・コメントは直属範囲をサーバー側で検査する", () => {
    const build = read("src/actions/evaluations.ts");
    const update = read("src/actions/evaluations.ts");
    // 上長はその会社での所属から読む（S7・D-004）。users の写しは他社の上長を指すことがある
    expect(build).toContain("joinMembership(viewer.companyId)");
    expect(build).toContain("eq(mem.managerId, viewer.id)");
    expect(build).toContain("直属メンバー以外の評価は集計できません");
    expect(update).toContain("canManageEmployee(viewer, row.employeeId)");
  });

  it("評価詳細・メンバー詳細・回答本文も直属範囲または本人へ閉じる", () => {
    expect(read("src/app/manager/evaluations/[id]/page.tsx")).toContain("canReviewEmployeeEvaluation(");
    expect(read("src/app/manager/members/[id]/page.tsx")).toContain("canViewEmployee(viewer, id)");
    expect(read("src/app/me/responses/[id]/page.tsx")).toContain("canReadResponseBody(");
  });

  it("回答一覧の氏名は、開ける回答のときだけ回答本文へのリンクにする（開けない下書きへ誘わない）", () => {
    // 管理者でも他人の下書きは開けない。リンクにすると、押した先が「この回答は開けません」の行き止まりになる
    expect(canReadResponseBody("admin-a", "COMPANY_ADMIN", { employeeId: "member-a", managerId: null }, "draft")).toBe(false);
    // リンクを出す条件は、リンク先（/me/responses/[id]）と同じ関数で決める
    expect(read("src/app/admin/forms/[id]/responses/page.tsx")).toContain("canReadResponseBody(");
  });

  it("メモと個別期限も直属範囲へ閉じる", () => {
    expect(read("src/actions/notes.ts")).toContain("canManageEmployee(viewer, input.employeeId)");
    const deadline = read("src/actions/form-extensions.ts");
    expect(deadline).toContain("canManageEmployee(viewer, employee.id)");
    expect(deadline).toContain("canManageEmployee(viewer, row.employeeId)");
  });

  it("回答・社員CSVは会社管理者以上、結果・KPIはマネージャー以上に分ける", () => {
    // 入口は台帳の操作 id で判定し、どの役割からできるかは台帳が決める（D-007）
    const route = read("src/app/api/export/route.ts");
    expect(route).toContain('q.type === "responses" || q.type === "members" ? "exports.companyData" : "exports.evaluationData"');
    expect(minRoleFor("exports.companyData")).toBe("COMPANY_ADMIN");
    expect(minRoleFor("exports.evaluationData")).toBe("MANAGER");
  });

  it("本人向け結果の詳細は確定済みだけを開く", () => {
    const page = read("src/app/me/results/[id]/page.tsx");
    expect(page).toContain("canReadSelfResult(viewer.id, result.employeeId, result.status)");
  });
});

describe("自分の評価の画面（閲覧は塞がない）", () => {
  const page = read("src/app/manager/evaluations/[id]/page.tsx");
  const panel = read("src/components/EvaluatorPanel.tsx");

  it("自分の評価かどうかを画面でも判定し、同じ理由文を使う", () => {
    expect(page).toContain("isOwnEvaluation(viewer.id, detail.head.employeeId)");
    expect(page).toContain("SELF_EVALUATION_BLOCK_REASON");
  });

  it("自分の評価では確定・差し戻し・コメントの操作を出さず、理由だけ出す", () => {
    expect(page).toContain("blockedReason={own ? SELF_EVALUATION_BLOCK_REASON : null}");
    expect(panel).toContain("if (blockedReason) {");
    const blocked = panel.slice(panel.indexOf("if (blockedReason) {"), panel.indexOf("return (\n    <Card"));
    expect(blocked).not.toContain("ActionButton");
    expect(blocked).not.toContain("textarea");
  });

  it("評価の中身そのものは自分の評価でも表示する（閲覧は止めない）", () => {
    expect(page).toContain("<EvaluationDetail");
    // 自分の評価だからといって画面ごと落とさない
    expect(page).not.toContain("if (own) notFound()");
    const afterGuard = page.slice(page.indexOf("const own ="));
    expect(afterGuard).toContain("<EvaluationDetail");
  });
});

describe("確定後に進める次の評価", () => {
  const rows = [
    { id: "current", employeeId: "member-a", status: "finalized" },
    { id: "own", employeeId: "manager", status: "draft" },
    { id: "outside", employeeId: "member-outside", status: "draft" },
    { id: "done", employeeId: "member-b", status: "finalized" },
    { id: "assigned", employeeId: "member-b", status: "draft" },
  ];

  it("マネージャーは自己評価・確定済み・担当外を飛ばし、担当チームの未確定評価へ進む", () => {
    expect(
      selectNextActionableEvaluation(rows, {
        currentId: "current",
        viewerId: "manager",
        viewerRole: "MANAGER",
        assignedEmployeeIds: new Set(["member-a", "member-b"]),
      }),
    ).toEqual(rows[4]);
  });

  it("会社管理者は会社内の担当外評価にも進めるが、自己評価には進まない", () => {
    expect(
      selectNextActionableEvaluation(rows, {
        currentId: "current",
        viewerId: "manager",
        viewerRole: "COMPANY_ADMIN",
        assignedEmployeeIds: new Set(),
      }),
    ).toEqual(rows[2]);
  });

  it("システム管理者も会社管理者と同じく、会社内の自己評価以外へ進める", () => {
    expect(
      selectNextActionableEvaluation(rows, {
        currentId: "current",
        viewerId: "manager",
        viewerRole: "SUPER_ADMIN",
        assignedEmployeeIds: new Set(),
      }),
    ).toEqual(rows[2]);
  });

  it("操作できる候補がなければ次の評価を出さない", () => {
    expect(
      selectNextActionableEvaluation(rows.slice(0, 4), {
        currentId: "current",
        viewerId: "manager",
        viewerRole: "MANAGER",
        assignedEmployeeIds: new Set(["member-a", "member-b"]),
      }),
    ).toBeNull();
    expect(
      selectNextActionableEvaluation(rows, {
        currentId: "current",
        viewerId: "employee",
        viewerRole: "EMPLOYEE",
        assignedEmployeeIds: new Set(["member-b"]),
      }),
    ).toBeNull();
  });
});

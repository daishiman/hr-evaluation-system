import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canActOnEmployeeEvaluation,
  canReadEmployee,
  canReadResponseBody,
  canReadSelfResult,
  canReviewEmployeeEvaluation,
  isOwnEvaluation,
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
  const route = read("src/app/api/evaluations/[id]/route.ts");

  it("確定・差し戻し・コメントのどの分岐よりも前で、本人からの書き込みを止める", () => {
    const guard = route.indexOf("isOwnEvaluation(viewer.id, row.employeeId)");
    const firstAction = route.indexOf('body.action === "comment"');
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
    const build = read("src/app/api/evaluations/build/route.ts");
    const update = read("src/app/api/evaluations/[id]/route.ts");
    expect(build).toContain("eq(s.users.managerId, viewer.id)");
    expect(build).toContain("直属メンバー以外の評価は集計できません");
    expect(update).toContain("canManageEmployee(viewer, row.employeeId)");
  });

  it("評価詳細・メンバー詳細・回答本文も直属範囲または本人へ閉じる", () => {
    expect(read("src/app/manager/evaluations/[id]/page.tsx")).toContain("canReviewEmployeeEvaluation(");
    expect(read("src/app/manager/members/[id]/page.tsx")).toContain("canViewEmployee(viewer, id)");
    expect(read("src/app/me/responses/[id]/page.tsx")).toContain("canReadResponseBody(");
  });

  it("メモと個別期限も直属範囲へ閉じる", () => {
    expect(read("src/app/api/notes/route.ts")).toContain("canManageEmployee(viewer, body.employeeId)");
    const deadline = read("src/app/api/forms/[id]/extensions/route.ts");
    expect(deadline).toContain("canManageEmployee(viewer, employee.id)");
    expect(deadline).toContain("canManageEmployee(viewer, row.employeeId)");
  });

  it("回答・社員CSVは会社管理者以上、結果・KPIはマネージャー以上に分ける", () => {
    const route = read("src/app/api/export/route.ts");
    expect(route).toContain('q.type === "responses" || q.type === "members" ? "COMPANY_ADMIN" : "MANAGER"');
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

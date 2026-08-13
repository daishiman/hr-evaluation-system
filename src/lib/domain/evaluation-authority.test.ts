import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isOwnEvaluation,
  selectNextActionableEvaluation,
  SELF_EVALUATION_BLOCK_REASON,
} from "./evaluation-authority";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

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

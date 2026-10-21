import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ requireRoute: vi.fn(), getResponseDetail: vi.fn(), listEvaluations: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireRoute: mocked.requireRoute }));
vi.mock("@/lib/response-access", () => ({ getResponseDetail: mocked.getResponseDetail }));
vi.mock("@/lib/queries", () => ({ listEvaluations: mocked.listEvaluations }));

import ResponsePage from "./[id]/page";

const detail = (status = "submitted") => ({
  response: { id: "response", employeeId: "employee", managerId: "manager", status, submittedAt: null, employeeName: "回答者" },
  form: { title: "アンケート", cycleName: "上期", gradeName: "等級1" },
  rows: [],
});
const viewer = (role: string, id: string) => mocked.requireRoute.mockResolvedValue({ role, id, companyId: "company" });
const html = async () => renderToStaticMarkup(await ResponsePage({ params: Promise.resolve({ id: "response" }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getResponseDetail.mockResolvedValue(detail());
  mocked.listEvaluations.mockResolvedValue([{ id: "evaluation", employeeId: "employee", status: "finalized" }]);
});

describe("回答から評価へ進む導線", () => {
  it("システム管理者・会社管理者・直属上長は、その回答の評価へ進める", async () => {
    for (const [role, id] of [["SUPER_ADMIN", "admin"], ["COMPANY_ADMIN", "admin"], ["MANAGER", "manager"]]) {
      viewer(role, id);
      expect(await html()).toContain('href="/manager/evaluations/evaluation"');
      expect(mocked.listEvaluations).toHaveBeenLastCalledWith("company", role, { employeeId: "employee", responseId: "response" });
    }
  });

  it("上長は未確定の評価へ進み判断を確認できる", async () => {
    viewer("MANAGER", "manager");
    mocked.listEvaluations.mockResolvedValue([{ id: "draft-evaluation", employeeId: "employee", status: "computed" }]);
    expect(await html()).toContain('href="/manager/evaluations/draft-evaluation"');
  });

  it("本人は役割にかかわらず確定した評価だけへ進める", async () => {
    for (const role of ["EMPLOYEE", "MANAGER", "COMPANY_ADMIN"]) {
      viewer(role, "employee");
      expect(await html()).toContain('href="/me/results/evaluation"');
      mocked.listEvaluations.mockResolvedValueOnce([{ id: "private", employeeId: "employee", status: "computed" }]);
      const pending = await html();
      expect(pending).not.toContain('href="/me/results/private"');
      expect(pending).toContain("この回答の評価はまだ公開されていません");
    }
  });

  it("未集計なら管理者へ次の操作を案内する", async () => {
    viewer("SUPER_ADMIN", "admin");
    mocked.listEvaluations.mockResolvedValue([]);
    const body = await html();
    expect(body).toContain("この回答から作った評価はまだありません");
    expect(body).toContain('href="/manager/cycles"');
    expect(body).toContain("提出した回答と会社の評価基準から計算します");
  });

  it("直属でない上長へは回答も評価リンクも返さない", async () => {
    viewer("MANAGER", "other-manager");
    const body = await html();
    expect(body).toContain("この回答は開けません");
    expect(body).not.toContain("/manager/evaluations/");
    expect(mocked.listEvaluations).not.toHaveBeenCalled();
  });

  it("入力途中の回答には評価への導線を出さない", async () => {
    viewer("EMPLOYEE", "employee");
    mocked.getResponseDetail.mockResolvedValue(detail("draft"));
    expect(await html()).not.toContain("この回答から作った評価を見る");
    expect(mocked.listEvaluations).not.toHaveBeenCalled();
  });
});

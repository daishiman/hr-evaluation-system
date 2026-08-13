import { describe, expect, it } from "vitest";
import { resolveAuthoritativeResponses } from "./authoritative-response";

const response = (
  id: string,
  employeeId: string,
  submittedAt: string,
  formVersion: number,
) => ({ id, employeeId, submittedAt: new Date(submittedAt), formVersion });

describe("評価期間×社員の正式回答版", () => {
  it("同じ社員に複数の提出版があれば、最後に提出した回答を1件だけ選ぶ", () => {
    const old = response("res-old", "employee-a", "2026-08-01T00:00:00Z", 1);
    const current = response("res-current", "employee-a", "2026-08-02T00:00:00Z", 2);
    expect(resolveAuthoritativeResponses([old, current])).toEqual([current]);
  });

  it("DBの返却順が変わっても結果が変わらない", () => {
    const rows = [
      response("res-a-v1", "employee-a", "2026-08-01T00:00:00Z", 1),
      response("res-a-v2", "employee-a", "2026-08-02T00:00:00Z", 2),
      response("res-b", "employee-b", "2026-08-03T00:00:00Z", 1),
    ];
    expect(resolveAuthoritativeResponses([...rows].reverse()).map((row) => row.id)).toEqual(
      resolveAuthoritativeResponses(rows).map((row) => row.id),
    );
  });

  it("提出日時が同じならフォーム版、回答IDの順で決定する", () => {
    const time = "2026-08-02T00:00:00Z";
    const rows = [
      response("res-z", "employee-a", time, 1),
      response("res-a", "employee-a", time, 2),
      response("res-z2", "employee-a", time, 2),
    ];
    expect(resolveAuthoritativeResponses(rows)).toEqual([rows[2]]);
  });

  it("提出日時が欠けた回答同士でもフォーム版と回答IDで決定する", () => {
    const rows = [
      { id: "res-old", employeeId: "employee-a", submittedAt: null, formVersion: 1 },
      { id: "res-current", employeeId: "employee-a", submittedAt: null, formVersion: 2 },
    ];
    expect(resolveAuthoritativeResponses(rows)).toEqual([rows[1]]);
  });
});

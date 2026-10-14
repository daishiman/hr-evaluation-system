import { describe, expect, it } from "vitest";
import {
  SUBMISSION_STATE_LABEL,
  filterSubmissionRows,
  summarizeSubmissions,
} from "@/lib/domain/submission-status";

/*
 * 提出状況（S8・A7）。
 *
 * 対象者（所属の表から求めた人）と回答から、対象者全員に
 * 提出済み・入力途中・未回答のどれかと提出日時を付け、件数を数える。
 * 回答が無い人も「未回答」として必ず行に出る。
 */

const TARGETS = [
  { employeeId: "u1", name: "青木" },
  { employeeId: "u2", name: "井上" },
  { employeeId: "u3", name: "上田" },
  { employeeId: "u4", name: "江藤" },
];

const SUBMITTED_AT = new Date("2026-10-01T09:00:00Z");

const RESPONSES = [
  { employeeId: "u1", status: "submitted", submittedAt: SUBMITTED_AT },
  { employeeId: "u2", status: "draft", submittedAt: null },
  // 対象者ではない人の回答（異動などで対象から外れた）は数えない
  { employeeId: "x9", status: "submitted", submittedAt: SUBMITTED_AT },
];

describe("summarizeSubmissions", () => {
  it("対象者全員に状態と提出日時を付ける（回答が無い人は未回答）", () => {
    const { rows } = summarizeSubmissions(TARGETS, RESPONSES);
    expect(rows.map((r) => [r.employeeId, r.state, r.submittedAt])).toEqual([
      ["u1", "submitted", SUBMITTED_AT],
      ["u2", "draft", null],
      ["u3", "none", null],
      ["u4", "none", null],
    ]);
    expect(rows.map((r) => r.name)).toEqual(["青木", "井上", "上田", "江藤"]);
  });

  it("件数は対象者の数と一致し、対象外の回答を数えない", () => {
    const { counts } = summarizeSubmissions(TARGETS, RESPONSES);
    expect(counts).toEqual({ total: 4, submitted: 1, draft: 1, none: 2 });
  });

  it("対象者がいなければ全て0", () => {
    expect(summarizeSubmissions([], RESPONSES).counts).toEqual({ total: 0, submitted: 0, draft: 0, none: 0 });
  });

  it("未知の状態の回答は入力途中として扱う（提出済みと取り違えない）", () => {
    const { rows } = summarizeSubmissions([{ employeeId: "u1", name: "青木" }], [
      { employeeId: "u1", status: "imported", submittedAt: null },
    ]);
    expect(rows[0].state).toBe("draft");
  });
});

describe("状態の言葉と絞り込み", () => {
  it("状態の言葉は 提出済み・入力途中・未回答", () => {
    expect(SUBMISSION_STATE_LABEL).toEqual({ submitted: "提出済み", draft: "入力途中", none: "未回答" });
  });

  it("状態で絞り込める（all は全員）", () => {
    const { rows } = summarizeSubmissions(TARGETS, RESPONSES);
    expect(filterSubmissionRows(rows, "none").map((r) => r.employeeId)).toEqual(["u3", "u4"]);
    expect(filterSubmissionRows(rows, "submitted").map((r) => r.employeeId)).toEqual(["u1"]);
    expect(filterSubmissionRows(rows, "all")).toHaveLength(4);
  });
});

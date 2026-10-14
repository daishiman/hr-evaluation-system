import { describe, expect, it } from "vitest";
import { countSubmissions, parseSubmissionFilter, summarizeSubmissions } from "./submission-status";

/*
 * 提出状況の境目。1人に回答が複数あるとき（版の作り直し・入力途中の残り）に、
 * どの回答を状態の元にするかと、URL の絞り込みの読み取りを固定する。
 */

const TARGET = [{ employeeId: "u1", name: "青木" }];
const EARLY = new Date("2026-10-01T09:00:00Z");
const LATE = new Date("2026-10-02T09:00:00Z");

describe("1人に回答が複数あるとき", () => {
  it("入力途中と提出済みがあれば、並びに関わらず提出済みを取る", () => {
    const submitted = { id: "r2", employeeId: "u1", status: "submitted", submittedAt: EARLY };
    const draft = { id: "r1", employeeId: "u1", status: "draft", submittedAt: null };
    for (const responses of [
      [draft, submitted],
      [submitted, draft],
    ]) {
      const [row] = summarizeSubmissions(TARGET, responses).rows;
      expect(row.state).toBe("submitted");
      expect(row.response?.id).toBe("r2");
      expect(row.submittedAt).toBe(EARLY);
    }
  });

  it("提出済みどうしなら、最後に提出したものを取る", () => {
    const early = { id: "r1", employeeId: "u1", status: "submitted", submittedAt: EARLY };
    const late = { id: "r2", employeeId: "u1", status: "submitted", submittedAt: LATE };
    expect(summarizeSubmissions(TARGET, [early, late]).rows[0].response?.id).toBe("r2");
    expect(summarizeSubmissions(TARGET, [late, early]).rows[0].response?.id).toBe("r2");
  });

  it("提出日時が欠けた提出済みは、日時のある提出済みより古いものとして扱う", () => {
    const unknown = { id: "r1", employeeId: "u1", status: "submitted", submittedAt: null };
    const dated = { id: "r2", employeeId: "u1", status: "submitted", submittedAt: EARLY };
    expect(summarizeSubmissions(TARGET, [unknown, dated]).rows[0].response?.id).toBe("r2");
    expect(summarizeSubmissions(TARGET, [dated, unknown]).rows[0].response?.id).toBe("r2");
  });

  it("入力途中どうしなら、先に見つかったものを残す（件数は1人1件のまま）", () => {
    const { rows, counts } = summarizeSubmissions(TARGET, [
      { id: "r1", employeeId: "u1", status: "draft", submittedAt: null },
      { id: "r2", employeeId: "u1", status: "draft", submittedAt: null },
    ]);
    expect(rows[0].response?.id).toBe("r1");
    expect(counts).toEqual({ total: 1, submitted: 0, draft: 1, none: 0 });
  });
});

describe("行を減らしたあとの数え直し", () => {
  it("担当の部下だけに絞った行から、全員と状態ごとの件数を数え直す", () => {
    const { rows } = summarizeSubmissions(
      [{ employeeId: "u1" }, { employeeId: "u2" }, { employeeId: "u3" }],
      [
        { employeeId: "u1", status: "submitted", submittedAt: EARLY },
        { employeeId: "u2", status: "draft", submittedAt: null },
      ],
    );
    const mine = rows.filter((row) => row.employeeId !== "u1");
    expect(countSubmissions(mine)).toEqual({ total: 2, submitted: 0, draft: 1, none: 1 });
    expect(countSubmissions([])).toEqual({ total: 0, submitted: 0, draft: 0, none: 0 });
  });
});

describe("URL の絞り込み", () => {
  it("状態の値はそのまま、知らない値と未指定は全員", () => {
    expect(parseSubmissionFilter("submitted")).toBe("submitted");
    expect(parseSubmissionFilter("draft")).toBe("draft");
    expect(parseSubmissionFilter("none")).toBe("none");
    expect(parseSubmissionFilter("all")).toBe("all");
    expect(parseSubmissionFilter("imported")).toBe("all");
    expect(parseSubmissionFilter(undefined)).toBe("all");
  });
});

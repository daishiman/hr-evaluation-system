import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubmissionStatusTable } from "./SubmissionStatusTable";
import { summarizeSubmissions } from "@/lib/domain/submission-status";

/* 対象者3人：提出済み・入力途中・未回答が1人ずつ */
const { rows, counts } = summarizeSubmissions(
  [
    { employeeId: "u1", name: "青木" },
    { employeeId: "u2", name: "井上" },
    { employeeId: "u3", name: "上田" },
  ],
  [
    // 日本時間の 9:05。機械の時間帯で作る new Date(2026, 9, 1, 9, 5) だと、UTC の CI では日本時間 18:05 になる
    { employeeId: "u1", status: "submitted", submittedAt: new Date("2026-10-01T09:05:00+09:00") },
    { employeeId: "u2", status: "draft", submittedAt: null },
  ],
);

const render = (filter: "all" | "submitted" | "draft" | "none") =>
  renderToStaticMarkup(
    createElement(SubmissionStatusTable<(typeof rows)[number]>, {
      rows,
      counts,
      filter,
      filterHref: (f) => `/manager/cycles?cycle=c1${f === "all" ? "" : `&status=${f}`}`,
      caption: "対象者と提出の状況",
    }),
  );

describe("SubmissionStatusTable", () => {
  it("全員を、状態と提出日時つきで並べる（未回答の人も行に出す）", () => {
    const html = render("all");

    for (const name of ["青木", "井上", "上田"]) expect(html).toContain(name);
    for (const label of ["提出済み", "入力途中", "未回答"]) expect(html).toContain(label);
    expect(html).toContain("2026年10月1日 09:05");
  });

  it("絞り込みは件数つきのリンクで、いまの条件を印で示し、ほかの条件を残す", () => {
    const html = render("none");

    expect(html).toContain("全員 3人");
    expect(html).toContain('href="/manager/cycles?cycle=c1&amp;status=none"');
    expect(html).toContain('href="/manager/cycles?cycle=c1"');
    expect(html.match(/<a[^>]*aria-current="true"[^>]*>([^<]*)<\/a>/)?.[1]).toBe("未回答 1人");
    expect(html).toContain("上田");
    expect(html).not.toContain("青木");
  });

  it("絞った結果が0人なら、表の代わりにその旨を出す", () => {
    const empty = summarizeSubmissions([{ employeeId: "u1", name: "青木" }], []);
    const html = renderToStaticMarkup(
      createElement(SubmissionStatusTable<(typeof empty.rows)[number]>, {
        rows: empty.rows,
        counts: empty.counts,
        filter: "submitted",
        filterHref: () => "/x",
        caption: "対象者",
      }),
    );

    expect(html).toContain("「提出済み」の方はいません。");
    expect(html).not.toContain("<table");
  });
});

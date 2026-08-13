import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { matchMembers, MembersFilter, type FilterableMember } from "./MembersFilter";

const members: FilterableMember[] = [
  { id: "1", name: "山田 太郎", email: "taro@example.com", roleLabel: "一般", gradeName: "Regular", department: "営業" },
  { id: "2", name: "佐藤 花子", email: "hanako@example.com", roleLabel: "マネージャー", gradeName: "Chief", department: null },
];

describe("社員一覧の検索", () => {
  it("氏名・等級・所属を、大文字小文字と前後空白を無視して絞り込む", () => {
    expect(matchMembers(members, "  YAMADA ").map((member) => member.id)).toEqual([]);
    expect(matchMembers(members, " 山田 ").map((member) => member.id)).toEqual(["1"]);
    expect(matchMembers(members, "chief").map((member) => member.id)).toEqual(["2"]);
    expect(matchMembers(members, "営業").map((member) => member.id)).toEqual(["1"]);
  });

  it("未入力では全員を表示し、表示件数と共通カードを描く", () => {
    const html = renderToStaticMarkup(createElement(MembersFilter, { members }));
    expect(html).toContain("2 / 2人を表示");
    expect(html).toContain('class="card"');
    expect(html).toContain("山田 太郎");
    expect(html).toContain("佐藤 花子");
  });

  it("一致しない条件は0件になる", () => {
    expect(matchMembers(members, "存在しない")).toEqual([]);
  });
});

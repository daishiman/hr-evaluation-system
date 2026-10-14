import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { availableSortKeys, parsePeopleView } from "@/lib/domain/people-list";
import { PeopleList, type PeopleListRow } from "./PeopleList";

const rows: PeopleListRow[] = [
  { key: "m1", id: "u1", href: "/admin/members/u1", isActive: true, name: "山田 太郎", email: "taro@example.com", role: "EMPLOYEE", gradeName: "等級2", gradeOrder: 2, latestScore: null, department: "営業部", employeeCode: "A-001" },
  { key: "m2", id: "u2", href: "/admin/members/u2", isActive: false, name: "佐藤 花子", email: "hanako@example.com", role: "MANAGER", gradeName: "等級3", gradeOrder: 3, latestScore: null, department: null, employeeCode: null },
];

function render(sortKeys = availableSortKeys({ acrossCompanies: false, gradeAndScore: true }), q = "") {
  const initial = parsePeopleView({ q }, sortKeys);
  return renderToStaticMarkup(createElement(PeopleList, { rows, sortKeys, initial }));
}

describe("人の一覧", () => {
  it("開いたときの並びと人数を読み上げる欄に出し、共通のカードに全員を描く", () => {
    const html = render();
    expect(html).toContain("等級の低い順・2 / 2人を表示");
    expect(html).toContain('role="status"');
    expect(html).toContain('class="card"');
    expect(html).toContain("山田 太郎");
    expect(html).toContain("佐藤 花子");
    expect(html).toContain("社員番号 A-001");
  });

  it("並べ替えの欄には、その一覧で選べるものだけを出す", () => {
    const html = render();
    expect(html).toContain('<option value="grade" selected="">等級</option>');
    expect(html).toContain('<option value="score">点数</option>');
    expect(html).not.toContain('value="company"');
  });

  it("点数と等級を見られない一覧では、点数・等級で並べ替えられず、等級を検索の案内にも出さない", () => {
    const hidden = rows.map(({ gradeName: _grade, gradeOrder: _order, latestScore: _score, ...rest }) => rest);
    const sortKeys = availableSortKeys({ acrossCompanies: false, gradeAndScore: false });
    const html = renderToStaticMarkup(createElement(PeopleList, { rows: hidden, sortKeys, initial: parsePeopleView({}, sortKeys) }));
    expect(html).not.toContain('value="score"');
    expect(html).not.toContain('value="grade"');
    expect(html).not.toContain("等級");
    expect(html).toContain("名前・メール・役割・所属・社員番号で探す");
  });

  it("向きを変えるボタンは、押したあとの並びを名前に持つ", () => {
    expect(render()).toContain("等級の高い順にする");
  });

  it("利用停止の人は札だけでなく行の見た目でも分かる", () => {
    const html = render();
    expect(html).toContain("利用停止");
    expect(html).toContain('data-off="true"');
  });

  it("3つの一覧は利用停止の人も同じ一覧に入れ、行の状態をそのまま渡す（別の節に分けない。§28-13）", () => {
    for (const [file, row] of [
      ["src/app/system/users/page.tsx", "u"],
      ["src/app/admin/members/page.tsx", "m"],
      ["src/app/manager/members/page.tsx", "m"],
    ] as const) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).toContain(`isActive: ${row}.isActive,`);
      expect(source, file).not.toMatch(/isActive:\s*true/);
    }
    // 社員の一覧は、等級と点数を付ける前に在籍中の人へ絞らない
    const admin = readFileSync(path.join(process.cwd(), "src/app/admin/members/page.tsx"), "utf8");
    expect(admin).toContain("withGradeAndScore(db, viewer, members)");
  });

  it("URL の検索語で開くと、当たる人だけを出し、当たらなければ消す手段を示す", () => {
    expect(render(undefined, "山田")).toContain("1 / 2人を表示");
    const none = render(undefined, "存在しない");
    expect(none).toContain("条件に合う人がいません");
    expect(none).toContain("検索を消す");
  });
});

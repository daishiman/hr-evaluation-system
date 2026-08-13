import { describe, expect, it } from "vitest";
import { matchPerson, matchScreen, rankScreens, type PersonHit, type ScreenHit } from "@/lib/domain/search";

const person = (over: Partial<PersonHit> = {}): PersonHit => ({
  kind: "member",
  id: "u1",
  name: "山田 太郎",
  note: "主任",
  href: "/admin/members/u1",
  email: "taro@example.com",
  code: "E-0012",
  ...over,
});

const screens: ScreenHit[] = [
  { href: "/admin/cycles", label: "評価期間", group: "評価を順番に進める" },
  { href: "/criteria", label: "評価の基準", group: "基準を確認する" },
  { href: "/admin/members", label: "社員", group: "人を管理する" },
  { href: "/admin/masters", label: "等級の設定", group: "制度を順番に設定する" },
];

describe("人を探す", () => {
  it("名前で見つかる", () => {
    expect(matchPerson(person(), "山田")).toBe(true);
  });

  it("名前の間の空白は無視する（一覧の表記に合わせて打たなくてよい）", () => {
    expect(matchPerson(person(), "山田太郎")).toBe(true);
  });

  it("メールアドレスと社員番号でも見つかる", () => {
    expect(matchPerson(person(), "taro@")).toBe(true);
    expect(matchPerson(person(), "E0012")).toBe(true);
  });

  it("英字の大小・全角半角の違いで外れない", () => {
    expect(matchPerson(person(), "TARO")).toBe(true);
    expect(matchPerson(person({ code: "Ｅ-００１２" }), "E0012")).toBe(true);
  });

  it("手がかり（等級・部署）でも探せる", () => {
    expect(matchPerson(person(), "主任")).toBe(true);
  });

  it("空欄では何も返さない（全員を出さない）", () => {
    expect(matchPerson(person(), "")).toBe(false);
    expect(matchPerson(person(), "　")).toBe(false);
  });

  it("関係のない語では見つからない", () => {
    expect(matchPerson(person(), "佐藤")).toBe(false);
  });
});

describe("画面を探す", () => {
  it("画面の名前で見つかる", () => {
    expect(matchScreen(screens[0], "評価期間")).toBe(true);
  });

  it("分類名でも見つかる（何をする区画かで思い出せる）", () => {
    expect(matchScreen(screens[2], "人を管理")).toBe(true);
  });

  it("先頭から一致する画面を先に出す", () => {
    const hits = rankScreens(screens, "評価").map((s) => s.label);
    // 「評価期間」「評価の基準」が先。分類名でしか当たらないものは後ろ
    expect(hits.slice(0, 2)).toEqual(["評価期間", "評価の基準"]);
  });

  it("空欄では候補を作らない", () => {
    expect(rankScreens(screens, "")).toEqual([]);
  });

  it("出す数に上限がある（窓に入らない数を並べない）", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      href: `/x${i}`,
      label: `評価の画面${i}`,
      group: "",
    }));
    expect(rankScreens(many, "評価")).toHaveLength(6);
  });
});

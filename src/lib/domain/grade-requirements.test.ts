import { describe, it, expect } from "vitest";
import {
  GRADE_REQUIREMENT_MAX,
  activeOf,
  denominatorOf,
  inactiveOf,
  remainingSlots,
  swapForMove,
  type RequirementRow,
} from "./grade-requirements";

const row = (id: string, category: string, seq: number, isActive = true): RequirementRow => ({
  id,
  category,
  seq,
  text: `要件${id}`,
  isActive,
});

/* 元データの実際の形（さくら福祉会）。等級ごとに個数がバラバラで、上限が10。 */
const beginner = [
  ...[1, 2, 3, 4, 5].map((n) => row(`s${n}`, "support", n)),
  ...[6, 7, 8, 9, 10].map((n) => row(`o${n}`, "operation", n)),
];
const managerII = [...[1, 2, 3, 4, 5].map((n) => row(`o${n}`, "operation", n))]; // 支援0件

describe("等級要件の構造（支援・運営 × 0〜10項目）", () => {
  it("区分ごとに並び順で取り出せる", () => {
    expect(activeOf(beginner, "support").map((r) => r.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    expect(activeOf(beginner, "operation")).toHaveLength(5);
  });

  it("支援が0件でも成立する（本番に登録済みの Manager Ⅱ の等級要件と同じ形）", () => {
    expect(activeOf(managerII, "support")).toHaveLength(0);
    expect(denominatorOf(managerII)).toBe(5);
  });

  it("達成率の分母は支援＋運営の登録数（上限10や合計20ではない）", () => {
    expect(denominatorOf(beginner)).toBe(10);
    // 支援10・運営10のChiefは20、支援2・運営3のAMは5
    const chief = [
      ...Array.from({ length: 10 }, (_, i) => row(`s${i}`, "support", i + 1)),
      ...Array.from({ length: 10 }, (_, i) => row(`o${i}`, "operation", i + 11)),
    ];
    expect(denominatorOf(chief)).toBe(20);
    expect(denominatorOf([row("s1", "support", 1), row("o1", "operation", 2), row("o2", "operation", 3)])).toBe(3);
  });

  it("使わない項目は分母に入らず、別枠で取り出せる", () => {
    const rows = [row("s1", "support", 1), row("s2", "support", 2, false)];
    expect(denominatorOf(rows)).toBe(1);
    expect(inactiveOf(rows).map((r) => r.id)).toEqual(["s2"]);
  });

  it("あと何項目登録できるかを出せる", () => {
    expect(remainingSlots(0)).toBe(GRADE_REQUIREMENT_MAX);
    expect(remainingSlots(5)).toBe(5);
    expect(remainingSlots(10)).toBe(0);
    expect(remainingSlots(12)).toBe(0); // 移行データが上限を超えていても落ちない
  });
});

describe("並べ替え", () => {
  it("同じ区分の中で隣どうしの並び順を入れ替える", () => {
    expect(swapForMove(beginner, "support", "s2", "up")).toEqual([
      { id: "s2", seq: 1 },
      { id: "s1", seq: 2 },
    ]);
    expect(swapForMove(beginner, "support", "s2", "down")).toEqual([
      { id: "s2", seq: 3 },
      { id: "s3", seq: 2 },
    ]);
  });

  it("先頭で↑・末尾で↓は動かせない", () => {
    expect(swapForMove(beginner, "support", "s1", "up")).toBeNull();
    expect(swapForMove(beginner, "support", "s5", "down")).toBeNull();
  });

  it("別の区分の並びには影響しない（運営の先頭は運営の中で判定される）", () => {
    // o6 は全体では6番目だが、運営の中では先頭なので↑では動かない
    expect(swapForMove(beginner, "operation", "o6", "up")).toBeNull();
    expect(swapForMove(beginner, "operation", "o7", "up")).toEqual([
      { id: "o7", seq: 6 },
      { id: "o6", seq: 7 },
    ]);
  });
});

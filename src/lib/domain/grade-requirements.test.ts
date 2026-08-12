import { describe, it, expect } from "vitest";
import {
  GRADE_REQUIREMENT_MAX,
  activeOf,
  denominatorOf,
  historicalOf,
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

/* 文面を直したときは、古い行を消さずに新しい行を足す（previousVersionId で親を指す）。 */
const revised = (id: string, previousVersionId: string, category: string, seq: number, isActive = true): RequirementRow => ({
  ...row(id, category, seq, isActive),
  previousVersionId,
});

describe("版として残したときの数え方", () => {
  it("文面を直しても分母は増えない（新版だけを数え、旧版は数えない）", () => {
    const rows = [row("s1", "support", 1), revised("s1v2", "s1", "support", 1)];
    expect(denominatorOf(rows)).toBe(1);
    expect(activeOf(rows, "support").map((r) => r.id)).toEqual(["s1v2"]);
  });

  it("3版・10版と直しても、出題されるのは最新版1件だけ", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `s1v${i + 1}`);
    const rows = ids.map((id, i) => (i === 0 ? row(id, "support", 1) : revised(id, ids[i - 1], "support", 1)));
    expect(activeOf(rows, "support").map((r) => r.id)).toEqual(["s1v10"]);
    expect(denominatorOf(rows)).toBe(1);
  });

  it("最新版を「今後使わない」にすると、分母から外れて別枠に出る（旧版は別枠にも出さない）", () => {
    const rows = [row("s1", "support", 1), revised("s1v2", "s1", "support", 1, false)];
    expect(denominatorOf(rows)).toBe(0);
    expect(inactiveOf(rows).map((r) => r.id)).toEqual(["s1v2"]);
  });

  it("最新版が使用中なら、旧版が使わない状態でも分母に入る（旧版の状態に引きずられない）", () => {
    const rows = [row("s1", "support", 1, false), revised("s1v2", "s1", "support", 1)];
    expect(denominatorOf(rows)).toBe(1);
    expect(inactiveOf(rows)).toHaveLength(0);
  });

  it("並べ替えは最新版どうしで行い、旧版を巻き込まない", () => {
    const rows = [
      row("s1", "support", 1),
      revised("s1v2", "s1", "support", 1),
      row("s2", "support", 2),
    ];
    expect(swapForMove(rows, "support", "s2", "up")).toEqual([
      { id: "s2", seq: 1 },
      { id: "s1v2", seq: 2 },
    ]);
    // 旧版そのものは並べ替えの対象にならない
    expect(swapForMove(rows, "support", "s1", "up")).toBeNull();
    expect(swapForMove(rows, "support", "s1", "down")).toBeNull();
  });
});

describe("履歴として見せる版（historicalOf）", () => {
  it("一度も直していなければ履歴は0件", () => {
    expect(historicalOf([])).toEqual([]);
    expect(historicalOf([row("s1", "support", 1)])).toEqual([]);
    expect(historicalOf(beginner)).toEqual([]);
  });

  it("1回直すと、直す前の1件だけが履歴になる（最新版は履歴に出さない）", () => {
    const rows = [row("s1", "support", 1), revised("s1v2", "s1", "support", 1)];
    expect(historicalOf(rows).map((r) => r.id)).toEqual(["s1"]);
  });

  it("3版なら履歴は2件（最新版を除いた全部）", () => {
    const rows = [
      row("s1", "support", 1),
      revised("s1v2", "s1", "support", 1),
      revised("s1v3", "s1v2", "support", 1),
    ];
    expect(historicalOf(rows).map((r) => r.id)).toEqual(["s1", "s1v2"]);
  });

  it("系譜が複数あっても、それぞれの最新版だけが履歴から外れる", () => {
    const rows = [
      row("s1", "support", 1),
      revised("s1v2", "s1", "support", 1),
      row("o1", "operation", 1),
      revised("o1v2", "o1", "operation", 1),
      row("o2", "operation", 2),
    ];
    expect(historicalOf(rows).map((r) => r.id)).toEqual(["s1", "o1"]);
  });

  it("使わない状態にした版も、後続版があれば履歴として出る", () => {
    const rows = [row("s1", "support", 1, false), revised("s1v2", "s1", "support", 1)];
    expect(historicalOf(rows).map((r) => r.id)).toEqual(["s1"]);
  });

  it("履歴と最新版・停止中の項目は、必ず重ならず全件を分け合う", () => {
    const rows = [
      row("s1", "support", 1),
      revised("s1v2", "s1", "support", 1, false),
      row("o1", "operation", 1),
    ];
    const ids = [
      ...activeOf(rows, "support").map((r) => r.id),
      ...activeOf(rows, "operation").map((r) => r.id),
      ...inactiveOf(rows).map((r) => r.id),
      ...historicalOf(rows).map((r) => r.id),
    ];
    expect(ids.sort()).toEqual(["o1", "s1", "s1v2"]);
  });
});

describe("並び順の境界", () => {
  it("並び順が同じときはIDの小さい順（毎回同じ順に出す）", () => {
    const rows = [row("b", "support", 3), row("a", "support", 3), row("c", "support", 3)];
    expect(activeOf(rows, "support").map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(inactiveOf([row("b", "support", 1, false), row("a", "support", 1, false)]).map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("並び順が0・マイナス・とても大きい値でも小さい順に並ぶ", () => {
    const rows = [row("x", "support", 999999), row("y", "support", 0), row("z", "support", -1)];
    expect(activeOf(rows, "support").map((r) => r.id)).toEqual(["z", "y", "x"]);
  });

  it("登録できる残り枠は上限のちょうど上・下・同値で切り替わる", () => {
    expect(remainingSlots(GRADE_REQUIREMENT_MAX - 1)).toBe(1);
    expect(remainingSlots(GRADE_REQUIREMENT_MAX)).toBe(0);
    expect(remainingSlots(GRADE_REQUIREMENT_MAX + 1)).toBe(0);
  });

  it("区分が空文字や未知の名前でも、0件として静かに返す", () => {
    expect(activeOf(beginner, "")).toEqual([]);
    expect(activeOf(beginner, "unknown")).toEqual([]);
    expect(denominatorOf([])).toBe(0);
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

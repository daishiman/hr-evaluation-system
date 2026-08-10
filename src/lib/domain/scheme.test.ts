import { describe, expect, it } from "vitest";
import { suggestWeights, validateScheme, type SchemeSelection } from "./scheme";

const CATS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];

function build(weights: number[], overrides?: Partial<SchemeSelection>[]): SchemeSelection[] {
  const rows: SchemeSelection[] = [
    { kpiItemId: "k0", categoryId: null, weight: weights[0], isFixedSlot: true },
    ...CATS.map((c, i) => ({
      kpiItemId: `k${i + 1}`,
      categoryId: c,
      weight: weights[i + 1],
      isFixedSlot: false,
    })),
  ];
  overrides?.forEach((o, i) => Object.assign(rows[i], o));
  return rows;
}

describe("validateScheme", () => {
  const opts = { totalPoints: 100, categoryIds: CATS };

  it("固定枠1 + 7カテゴリ各1、合計100点なら通る", () => {
    const r = validateScheme(build([16, 12, 12, 12, 12, 12, 12, 12]), opts);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(100);
    expect(r.errors).toEqual([]);
  });

  it("合計が100点でなければ、あと何点かを日本語で伝える", () => {
    const r = validateScheme(build([10, 12, 12, 12, 12, 12, 12, 12]), opts);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("あと6点増やす"))).toBe(true);
  });

  it("同じカテゴリから2つ選ぶと弾く（別カテゴリが空になることも伝える）", () => {
    const rows = build([16, 12, 12, 12, 12, 12, 12, 12], [{}, {}, { categoryId: "c1" }]);
    const r = validateScheme(rows, opts);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("c1") && e.includes("1件です"))).toBe(true);
    expect(r.errors.some((e) => e.includes("c2") && e.includes("1件選んで"))).toBe(true);
  });

  it("固定枠がないと弾く", () => {
    const rows = build([16, 12, 12, 12, 12, 12, 12, 12], [{ isFixedSlot: false, categoryId: "c1" }]);
    const r = validateScheme(rows, opts);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("固定枠"))).toBe(true);
  });

  it("配点0の項目を弾く", () => {
    const r = validateScheme(build([16, 12, 12, 12, 12, 12, 12, 12], [{ weight: 0 }]), opts);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("1点以上"))).toBe(true);
  });

  it("カテゴリ名を渡すと、指摘に業務の言葉が出る", () => {
    const r = validateScheme(build([16, 12, 12, 12, 12, 12, 12, 0]), {
      ...opts,
      categoryNameOf: (id) => ({ c7: "成長・チーム貢献" })[id] ?? id,
    });
    expect(r.errors.some((e) => e.includes("成長・チーム貢献"))).toBe(false); // c7は選ばれている（配点だけ0）
    expect(r.errors.some((e) => e.includes("1点以上"))).toBe(true);
  });
});

describe("suggestWeights", () => {
  it("等分して端数を先頭に寄せ、合計は必ず満点になる", () => {
    const w = suggestWeights(8, 100);
    expect(w).toHaveLength(8);
    expect(w.reduce((a, b) => a + b, 0)).toBe(100);
    expect(w[0]).toBe(13);
    expect(w[7]).toBe(12);
  });

  it("項目が0件なら空", () => {
    expect(suggestWeights(0, 100)).toEqual([]);
  });
});

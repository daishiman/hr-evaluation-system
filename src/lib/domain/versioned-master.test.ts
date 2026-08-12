import { describe, it, expect } from "vitest";
import {
  currentVersionRows,
  isCurrentVersion,
  predecessorIds,
  versionFamilyDeleteOrder,
  versionFamilyIds,
  type VersionedMasterRow,
} from "./versioned-master";

/**
 * 版として残す制度マスタ（等級要件・昇格要件）の系譜の読み方。
 *
 * ここが狂うと「古い文面が現行として出題される」「達成率の分母が二重に数えられる」
 * という、昇給・昇格の判定そのものを誤らせる事故になる。
 * そのため 0件・1件・複数件、系譜の先頭/途中/末尾、親が見つからない壊れた行、
 * 上限（10版）まで伸ばした系譜を、すべて明示的に確かめる。
 */

const v = (id: string, previousVersionId?: string | null): VersionedMasterRow => ({
  id,
  ...(previousVersionId === undefined ? {} : { previousVersionId }),
});

/** id1 → id2 → … の一本道をつくる（先頭が最初の版、末尾が現在版）。 */
const chain = (...ids: string[]): VersionedMasterRow[] =>
  ids.map((id, i) => (i === 0 ? v(id) : v(id, ids[i - 1])));

describe("predecessorIds（後続版を持つID）", () => {
  it("0件のときは空", () => {
    expect(predecessorIds([])).toEqual(new Set());
  });

  it("1件だけ（まだ一度も直していない）のときは空＝その1件が現在版", () => {
    expect(predecessorIds([v("a")])).toEqual(new Set());
  });

  it("2版・3版と伸ばすと、末尾以外がすべて入る", () => {
    expect(predecessorIds(chain("a", "b"))).toEqual(new Set(["a"]));
    expect(predecessorIds(chain("a", "b", "c"))).toEqual(new Set(["a", "b"]));
  });

  it("null・undefined・空文字はどれも「親なし」として扱う", () => {
    expect(predecessorIds([v("a", null), v("b"), v("c", "")])).toEqual(new Set());
  });

  it("行に存在しない親IDでも、そのまま親として数える（取りこぼしを作らない）", () => {
    expect(predecessorIds([v("b", "missing")])).toEqual(new Set(["missing"]));
  });
});

describe("currentVersionRows（各系譜の現在版だけ）", () => {
  it("0件なら0件", () => {
    expect(currentVersionRows([])).toEqual([]);
  });

  it("1件ならその1件", () => {
    expect(currentVersionRows([v("a")]).map((r) => r.id)).toEqual(["a"]);
  });

  it("一本道は末尾（最新版）だけを返す", () => {
    expect(currentVersionRows(chain("v1", "v2")).map((r) => r.id)).toEqual(["v2"]);
    expect(currentVersionRows(chain("v1", "v2", "v3")).map((r) => r.id)).toEqual(["v3"]);
  });

  it("10回直した系譜でも現在版は1件だけ（上限まで伸ばしても増えない）", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `v${i + 1}`);
    const rows = chain(...ids);
    expect(rows).toHaveLength(10);
    expect(currentVersionRows(rows).map((r) => r.id)).toEqual(["v10"]);
  });

  it("系譜が複数あれば、系譜の数だけ現在版が出る", () => {
    const rows = [...chain("a1", "a2"), ...chain("b1", "b2", "b3"), v("c1")];
    expect(currentVersionRows(rows).map((r) => r.id)).toEqual(["a2", "b3", "c1"]);
  });

  it("並び順は元の並びのまま（呼び出し側の並べ替えを壊さない）", () => {
    const rows = [v("z"), v("a"), v("m")];
    expect(currentVersionRows(rows).map((r) => r.id)).toEqual(["z", "a", "m"]);
  });

  it("親の行が消えている（壊れた）行も、現在版として拾う＝画面から消えない", () => {
    expect(currentVersionRows([v("b", "missing")]).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("isCurrentVersion（この版は現在版か）", () => {
  it("1件だけならその1件は現在版", () => {
    const rows = [v("a")];
    expect(isCurrentVersion(rows[0], rows)).toBe(true);
  });

  it("0件の一覧と突き合わせると、後続版が無いので現在版と答える", () => {
    expect(isCurrentVersion(v("a"), [])).toBe(true);
  });

  it("一本道では末尾だけが現在版、それ以外は過去版", () => {
    const rows = chain("v1", "v2", "v3");
    expect(rows.map((row) => isCurrentVersion(row, rows))).toEqual([false, false, true]);
  });

  it("別系譜の版に引きずられない", () => {
    const rows = [...chain("a1", "a2"), v("b1")];
    expect(isCurrentVersion(rows[2], rows)).toBe(true);
    expect(isCurrentVersion(rows[0], rows)).toBe(false);
  });

  it("currentVersionRows と必ず同じ答えになる（2つの読み方が食い違わない）", () => {
    const rows = [...chain("a1", "a2", "a3"), ...chain("b1", "b2"), v("c1"), v("d1", "missing")];
    const currentIds = new Set(currentVersionRows(rows).map((row) => row.id));
    for (const row of rows) {
      expect(isCurrentVersion(row, rows)).toBe(currentIds.has(row.id));
    }
  });
});

describe("versionFamilyIds（つながっている版をすべて）", () => {
  it("一覧に無いIDを聞かれたら空（存在しない版に道を作らない）", () => {
    expect(versionFamilyIds(chain("a", "b"), "zzz")).toEqual([]);
    expect(versionFamilyIds([], "a")).toEqual([]);
  });

  it("1件だけならその1件", () => {
    expect(versionFamilyIds([v("a")], "a")).toEqual(["a"]);
  });

  it("先頭・途中・末尾のどこから聞いても同じ系譜が返る", () => {
    const rows = chain("v1", "v2", "v3");
    const expected = ["v1", "v2", "v3"];
    for (const id of expected) {
      expect(versionFamilyIds(rows, id).sort()).toEqual(expected);
    }
  });

  it("別の系譜の版は混ざらない", () => {
    const rows = [...chain("a1", "a2", "a3"), ...chain("b1", "b2")];
    expect(versionFamilyIds(rows, "a2").sort()).toEqual(["a1", "a2", "a3"]);
    expect(versionFamilyIds(rows, "b1").sort()).toEqual(["b1", "b2"]);
  });

  it("10版まで伸ばしても全部たどれる", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `v${i + 1}`);
    expect(versionFamilyIds(chain(...ids), "v5")).toHaveLength(10);
  });

  it("親の行が消えていたら、そこで打ち切って自分だけ返す", () => {
    expect(versionFamilyIds([v("b", "missing")], "b")).toEqual(["b"]);
  });

  it("親子が輪になった壊れたデータでも止まらず、その2件を返す", () => {
    const rows = [v("a", "b"), v("b", "a")];
    expect(versionFamilyIds(rows, "a").sort()).toEqual(["a", "b"]);
  });
});

describe("versionFamilyDeleteOrder（子から親の順）", () => {
  it("一覧に無いIDなら空", () => {
    expect(versionFamilyDeleteOrder(chain("a", "b"), "zzz")).toEqual([]);
  });

  it("1件だけならその1件", () => {
    expect(versionFamilyDeleteOrder([v("a")], "a")).toEqual(["a"]);
  });

  it("2版なら新しい版が先、古い版が後", () => {
    expect(versionFamilyDeleteOrder(chain("v1", "v2"), "v1")).toEqual(["v2", "v1"]);
  });

  it("3版でも必ず子→親の順（どの版から聞いても同じ）", () => {
    const rows = chain("v1", "v2", "v3");
    expect(versionFamilyDeleteOrder(rows, "v1")).toEqual(["v3", "v2", "v1"]);
    expect(versionFamilyDeleteOrder(rows, "v3")).toEqual(["v3", "v2", "v1"]);
  });

  it("10版でも、親は必ず子より後ろに来る（自己参照を壊さない）", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `v${i + 1}`);
    const order = versionFamilyDeleteOrder(chain(...ids), "v1");
    expect(order).toEqual([...ids].reverse());
    for (const id of ids) {
      const parent = ids[ids.indexOf(id) - 1];
      if (parent) expect(order.indexOf(id)).toBeLessThan(order.indexOf(parent));
    }
  });

  it("別の系譜は1件も含めない", () => {
    const rows = [...chain("a1", "a2"), ...chain("b1", "b2")];
    expect(versionFamilyDeleteOrder(rows, "a1")).toEqual(["a2", "a1"]);
  });

  it("親子が輪になった壊れたデータでも止まらず、件数を落とさない", () => {
    const rows = [v("a", "b"), v("b", "a")];
    expect(versionFamilyDeleteOrder(rows, "a").sort()).toEqual(["a", "b"]);
  });
});

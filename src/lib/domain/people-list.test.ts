import { describe, expect, it } from "vitest";
import { atLeast, ROLES, roleRank } from "@/lib/roles";
import {
  availableSortKeys,
  buildSearchIndex,
  countPeople,
  defaultDirection,
  DEPARTMENT_UNSET_LABEL,
  defaultSortKey,
  filterPeople,
  NO_COMPANY_LABEL,
  normalizeForSearch,
  parsePeopleView,
  peopleViewParams,
  personLabels,
  QUERY_MAX_LENGTH,
  reversed,
  searchTokens,
  sortLabel,
  sortPeople,
  type PersonFields,
} from "./people-list";

const score = (totalScore: number, maxScore = 100) => ({ totalScore, maxScore, requirementRate: null, cycleName: "2026年度上期" });

const rows: PersonFields[] = [
  {
    key: "m1",
    id: "u1",
    name: "山田 太郎",
    email: "taro@example.com",
    role: "EMPLOYEE",
    companyName: "テスト商事",
    gradeName: "等級2",
    gradeOrder: 2,
    latestScore: score(72.5),
    department: "営業部",
    employeeCode: "A-001",
  },
  {
    key: "m2",
    id: "u2",
    name: "佐藤 花子",
    email: "hanako@example.com",
    role: "MANAGER",
    companyName: "サンプル工業",
    gradeName: "等級4-1",
    gradeOrder: 4,
    latestScore: null,
    department: null,
    employeeCode: null,
  },
  {
    key: "u3",
    id: "u3",
    name: "Admin User",
    email: "admin@example.com",
    role: "SUPER_ADMIN",
    companyName: null,
  },
  {
    key: "m4",
    id: "u4",
    name: "青木 一郎",
    email: "ichiro@example.com",
    role: "COMPANY_ADMIN",
    companyName: "テスト商事",
    gradeName: "等級未設定",
    gradeOrder: null,
    latestScore: score(90),
    department: "管理部",
    employeeCode: "A-010",
  },
];

const keysOf = (list: readonly PersonFields[]) => list.map((row) => row.key);

describe("検索語をそろえる", () => {
  it("全角半角・大文字小文字・カタカナとひらがなの違いを消し、空白を除く", () => {
    expect(normalizeForSearch("ＡＢＣ")).toBe("abc");
    expect(normalizeForSearch("ｻﾝﾌﾟﾙ")).toBe("さんぷる");
    expect(normalizeForSearch("サンプル")).toBe("さんぷる");
    expect(normalizeForSearch("山田　太郎")).toBe("山田太郎");
  });

  it("全角の空白でも語を区切り、空の語は捨てる", () => {
    expect(searchTokens("　山田　 営業 ")).toEqual(["山田", "営業"]);
    expect(searchTokens("   ")).toEqual([]);
  });
});

describe("札の呼び方", () => {
  it("会社に属さない人・所属の無い人の札は、ほかの画面と同じ呼び方の定数から作る", () => {
    expect(NO_COMPANY_LABEL).toBe("会社に属さない");
    expect(DEPARTMENT_UNSET_LABEL).toBe("所属 未設定");
    expect(personLabels(rows[2]).company).toBe(NO_COMPANY_LABEL);
    expect(personLabels(rows[1]).department).toBe(DEPARTMENT_UNSET_LABEL);
  });

  it("その一覧で出さない欄（会社・所属）は、札も作らない", () => {
    expect(personLabels({ key: "k1", id: "k1", name: "名前", role: "EMPLOYEE" })).toMatchObject({
      company: undefined,
      department: undefined,
    });
  });
});

describe("探す", () => {
  const index = buildSearchIndex(rows);

  it("空の検索語では全員を、並びを変えずに返す", () => {
    expect(keysOf(filterPeople(rows, index, ""))).toEqual(["m1", "m2", "u3", "m4"]);
  });

  it("名前・メール・役割の呼び名・会社・等級・所属・社員番号で当たる", () => {
    expect(keysOf(filterPeople(rows, index, "山田"))).toEqual(["m1"]);
    expect(keysOf(filterPeople(rows, index, "HANAKO@"))).toEqual(["m2"]);
    expect(keysOf(filterPeople(rows, index, "マネージャー"))).toEqual(["m2"]);
    expect(keysOf(filterPeople(rows, index, "さんぷる"))).toEqual(["m2"]);
    expect(keysOf(filterPeople(rows, index, "等級4-1"))).toEqual(["m2"]);
    expect(keysOf(filterPeople(rows, index, "営業部"))).toEqual(["m1"]);
    expect(keysOf(filterPeople(rows, index, "a-010"))).toEqual(["m4"]);
  });

  it("出ている札の文字でも当たる（会社に属さない・所属 未設定）", () => {
    expect(keysOf(filterPeople(rows, index, "会社に属さない"))).toEqual(["u3"]);
    expect(keysOf(filterPeople(rows, index, "未設定"))).toEqual(["m2", "m4"]);
  });

  it("表示した社員番号の札をそのまま検索できる（番号の無い人には当たらない）", () => {
    expect(keysOf(filterPeople(rows, index, "社員番号 A-001"))).toEqual(["m1"]);
    expect(keysOf(filterPeople(rows, index, "社員番号"))).toEqual(["m1", "m4"]);
  });

  it("語を空白で区切ると、すべてを含む行だけを出す", () => {
    expect(keysOf(filterPeople(rows, index, "テスト 管理"))).toEqual(["m4"]);
    expect(keysOf(filterPeople(rows, index, "テスト 存在しない"))).toEqual([]);
  });

  it("名前の途中の空白を打たなくても当たる", () => {
    expect(keysOf(filterPeople(rows, index, "山田太郎"))).toEqual(["m1"]);
  });

  it("出していない欄（役割の生の値・点数）では当たらない", () => {
    expect(keysOf(filterPeople(rows, index, "SUPER_ADMIN"))).toEqual([]);
    expect(keysOf(filterPeople(rows, index, "72.5"))).toEqual([]);
  });

  it("出していない欄は索引に入らない（等級を見られない一覧では等級名で当たらない）", () => {
    const hidden = rows.map(({ gradeName: _grade, gradeOrder: _order, latestScore: _score, ...rest }) => rest);
    expect(filterPeople(hidden, buildSearchIndex(hidden), "等級2")).toEqual([]);
  });

  it("欄の境目をまたいでは当たらない", () => {
    // 名前「山田 太郎」とメールの先頭「taro」をつないだ文字は、どの欄にも無い
    expect(filterPeople(rows, index, "太郎taro")).toEqual([]);
  });

  it("索引に無い行は、検索語があるときは出さない", () => {
    expect(filterPeople(rows, new Map(), "山田")).toEqual([]);
    expect(filterPeople(rows, new Map(), "")).toEqual(rows);
  });
});

describe("並べ替える", () => {
  it("点数は満点に対する割合で比べ、高い順では点数の無い人を末尾に置く", () => {
    expect(keysOf(sortPeople(rows, "score", "desc"))).toEqual(["m4", "m1", "u3", "m2"]);
  });

  it("向きを逆にしても、値の無い人は末尾のまま", () => {
    expect(keysOf(sortPeople(rows, "score", "asc"))).toEqual(["m1", "m4", "u3", "m2"]);
    expect(keysOf(sortPeople(rows, "grade", "asc")).slice(-2)).toEqual(["u3", "m4"]);
    expect(keysOf(sortPeople(rows, "grade", "desc")).slice(-2)).toEqual(["u3", "m4"]);
    expect(keysOf(sortPeople(rows, "company", "desc")).at(-1)).toBe("u3");
  });

  it("等級は等級の並びで比べる（名前の文字の順ではない）", () => {
    // 1社の一覧（会社名を持たない行）
    const oneCompany = rows.map(({ companyName: _company, ...rest }) => rest);
    expect(keysOf(sortPeople(oneCompany, "grade", "asc")).slice(0, 2)).toEqual(["m1", "m2"]);
    expect(keysOf(sortPeople(oneCompany, "grade", "desc")).slice(0, 2)).toEqual(["m2", "m1"]);
  });

  it("役割は権限の広い順", () => {
    expect(keysOf(sortPeople(rows, "role", "asc"))).toEqual(["u3", "m4", "m2", "m1"]);
    expect(keysOf(sortPeople(rows, "role", "desc"))).toEqual(["m1", "m2", "m4", "u3"]);
  });

  it("役割の並びは、権限の判定（atLeast）と同じ強さ（roleRank）で決まり、強い順が小さい順", () => {
    for (const a of ROLES) {
      for (const b of ROLES) expect(roleRank(a)! >= roleRank(b)!).toBe(atLeast(a, b));
    }
    const shuffled = ["MANAGER", "SUPER_ADMIN", "EMPLOYEE", "COMPANY_ADMIN"].map((role) => ({ key: role, id: role, name: "同じ 名前", role }));
    expect(keysOf(sortPeople(shuffled, "role", "asc"))).toEqual(["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"]);
    // 役割として知らない値は強さを持たない（Object の持ち物の名前でも数を返さない）
    expect(roleRank("LEGACY")).toBeNull();
    expect(roleRank("toString")).toBeNull();
  });

  it("同じ会社の中は名前順に並ぶ", () => {
    const sorted = sortPeople(rows, "company", "asc").filter((row) => row.companyName === "テスト商事");
    expect(sorted.map((row) => row.name)).toEqual(["山田 太郎", "青木 一郎"].sort(new Intl.Collator("ja").compare));
  });

  it("数字は数として比べる（等級10が等級2より後ろ）", () => {
    const named = ["等級10", "等級2", "等級1"].map((name, i) => ({ key: `k${i}`, id: `k${i}`, name, role: "EMPLOYEE" }));
    expect(sortPeople(named, "name", "asc").map((row) => row.name)).toEqual(["等級1", "等級2", "等級10"]);
  });

  it("同じ名前の行（2社に所属する人）は、行の鍵の順で毎回同じ並びにする", () => {
    const dual = [
      { key: "mem_b", id: "u9", name: "同じ 名前", role: "EMPLOYEE" },
      { key: "mem_a", id: "u9", name: "同じ 名前", role: "EMPLOYEE" },
    ];
    expect(keysOf(sortPeople(dual, "name", "asc"))).toEqual(["mem_a", "mem_b"]);
    expect(keysOf(sortPeople(dual, "name", "desc"))).toEqual(["mem_a", "mem_b"]);
    expect(keysOf(sortPeople([...dual].reverse(), "name", "asc"))).toEqual(["mem_a", "mem_b"]);
    // 同じ行が重なって渡されても、比べ方が食い違わない
    expect(keysOf(sortPeople([dual[0], dual[0]], "name", "asc"))).toEqual(["mem_b", "mem_b"]);
  });

  it("書き方だけが違う同じ会社名（濁点を分けて打った等）は、同じ会社として名前順に並ぶ", () => {
    const composed = "ガイア商事";
    const split = [
      { key: "c1", id: "c1", name: "いとう", role: "EMPLOYEE", companyName: composed.normalize("NFD") },
      { key: "c2", id: "c2", name: "あべ", role: "EMPLOYEE", companyName: composed },
    ];
    expect(keysOf(sortPeople(split, "company", "asc"))).toEqual(["c2", "c1"]);
  });

  it("満点が0の点数は0点として比べ、点数の無い人より前に置く", () => {
    const zero = [
      { key: "z1", id: "z1", name: "満点なし", role: "EMPLOYEE", latestScore: score(0, 0) },
      { key: "z2", id: "z2", name: "評価なし", role: "EMPLOYEE", latestScore: null },
      { key: "z3", id: "z3", name: "評価あり", role: "EMPLOYEE", latestScore: score(10) },
    ];
    expect(keysOf(sortPeople(zero, "score", "desc"))).toEqual(["z3", "z1", "z2"]);
  });

  it("台帳に無い役割は、そのままの名前で出し、役割の並べ替えでは向きによらず末尾に置く", () => {
    const odd = { key: "x1", id: "x1", name: "古い 役割", role: "LEGACY" };
    expect(personLabels(odd).role).toBe("LEGACY");
    expect(keysOf(sortPeople([odd, ...rows], "role", "asc")).at(-1)).toBe("x1");
    expect(keysOf(sortPeople([odd, ...rows], "role", "desc")).at(-1)).toBe("x1");
  });

  it("元の配列は変えない", () => {
    const before = keysOf(rows);
    sortPeople(rows, "score", "desc");
    expect(keysOf(rows)).toEqual(before);
  });
});

describe("全社の一覧の等級順", () => {
  // 2社 × 等級。会社に属さない人と、会社にいて等級未設定の人も混ぜる（渡す順はばらばら）
  const across: PersonFields[] = [
    { key: "t2", id: "t2", name: "あべ", role: "EMPLOYEE", companyName: "テスト商事", gradeOrder: 2 },
    { key: "s2", id: "s2", name: "いとう", role: "EMPLOYEE", companyName: "サンプル工業", gradeOrder: 2 },
    { key: "t1", id: "t1", name: "うえだ", role: "EMPLOYEE", companyName: "テスト商事", gradeOrder: 1 },
    { key: "s3", id: "s3", name: "えのもと", role: "EMPLOYEE", companyName: "サンプル工業", gradeOrder: 3 },
    { key: "s1", id: "s1", name: "おおた", role: "EMPLOYEE", companyName: "サンプル工業", gradeOrder: 1 },
    { key: "none", id: "none", name: "かとう", role: "SUPER_ADMIN", companyName: null, gradeOrder: null },
    { key: "sx", id: "sx", name: "きむら", role: "EMPLOYEE", companyName: "サンプル工業", gradeOrder: null },
  ];

  it("会社名でまとめてから等級の低い順に並べ、別の会社の同じ等級を混ぜない", () => {
    expect(keysOf(sortPeople(across, "grade", "asc"))).toEqual(["s1", "s2", "s3", "t1", "t2", "none", "sx"]);
  });

  it("向きを逆にすると会社の中だけが等級の高い順になり、会社の並びは会社名順のまま", () => {
    expect(keysOf(sortPeople(across, "grade", "desc"))).toEqual(["s3", "s2", "s1", "t2", "t1", "none", "sx"]);
  });

  it("同名の別会社も会社ごとにまとめ、会社の順は等級の向きを変えても同じ", () => {
    const sameName = [
      { key: "a1", id: "a1", name: "あべ", role: "EMPLOYEE", companyId: "company_a", companyName: "同名社", gradeOrder: 1 },
      { key: "b2", id: "b2", name: "いとう", role: "EMPLOYEE", companyId: "company_b", companyName: "同名社", gradeOrder: 2 },
      { key: "a3", id: "a3", name: "うえだ", role: "EMPLOYEE", companyId: "company_a", companyName: "同名社", gradeOrder: 3 },
      { key: "b1", id: "b1", name: "えのもと", role: "EMPLOYEE", companyId: "company_b", companyName: "同名社", gradeOrder: 1 },
    ];
    expect(keysOf(sortPeople(sameName, "grade", "asc"))).toEqual(["a1", "a3", "b1", "b2"]);
    expect(keysOf(sortPeople([...sameName].reverse(), "grade", "desc"))).toEqual(["a3", "a1", "b2", "b1"]);
    // 等級以外では、会社の識別子によって順番を変えない。
    expect(keysOf(sortPeople(sameName, "name", "asc"))).toEqual(["a1", "b2", "a3", "b1"]);
  });

  it("会社に属さない人と等級未設定の人は、会社によらず末尾に名前順で置く", () => {
    for (const dir of ["asc", "desc"] as const) {
      expect(keysOf(sortPeople(across, "grade", dir)).slice(-2)).toEqual(["none", "sx"]);
    }
  });

  it("1社の一覧（会社名を持たない行）は、これまでどおり等級の並びだけで比べる", () => {
    const oneCompany = across.filter((row) => row.companyName === "サンプル工業").map(({ companyName: _company, ...rest }) => rest);
    expect(keysOf(sortPeople(oneCompany, "grade", "asc"))).toEqual(["s1", "s2", "s3", "sx"]);
  });

  it("等級以外の並べ替えは会社でまとめない（点数は会社をまたいで比べる）", () => {
    const scored = across.map((row) => ({ ...row, latestScore: typeof row.gradeOrder === "number" ? score(row.gradeOrder * 10) : null }));
    // 会社名順ならサンプル工業が先に来るが、点数が同じなら名前順で、テスト商事の人が間に入る
    expect(keysOf(sortPeople(scored, "score", "desc")).slice(0, 2)).toEqual(["s3", "t2"]);
    expect(keysOf(sortPeople(scored, "score", "asc")).slice(0, 2)).toEqual(["t1", "s1"]);
  });
});

describe("向き", () => {
  it("選んだ並びと向きに合わせて画面と読み上げの呼び名を作る", () => {
    expect(sortLabel("score", "desc")).toBe("点数の高い順");
    expect(sortLabel("grade", "asc")).toBe("等級の低い順");
  });
  it("並べ替えを選ぶと、点数だけは高い順から、ほかは小さい順から始める", () => {
    expect(defaultDirection("score")).toBe("desc");
    expect((["name", "company", "role", "grade"] as const).map((key) => defaultDirection(key))).toEqual(["asc", "asc", "asc", "asc"]);
  });

  it("向きを逆にする", () => {
    expect(reversed("asc")).toBe("desc");
    expect(reversed("desc")).toBe("asc");
  });
});

describe("選べる並べ替え", () => {
  it("会社は全社の一覧だけ、点数と等級は見てよい役割だけ", () => {
    expect(availableSortKeys({ acrossCompanies: true, gradeAndScore: true })).toEqual(["name", "company", "role", "score", "grade"]);
    expect(availableSortKeys({ acrossCompanies: false, gradeAndScore: true })).toEqual(["name", "role", "score", "grade"]);
    expect(availableSortKeys({ acrossCompanies: false, gradeAndScore: false })).toEqual(["name", "role"]);
  });

  it("開いたときの並びは、会社順・等級順・名前順の順に選べるものを使う", () => {
    expect(defaultSortKey(["name", "company", "role", "score", "grade"])).toBe("company");
    expect(defaultSortKey(["name", "role", "score", "grade"])).toBe("grade");
    expect(defaultSortKey(["name", "role"])).toBe("name");
  });
});

describe("URL の読み書き", () => {
  const companyAdmin = availableSortKeys({ acrossCompanies: false, gradeAndScore: true });

  it("その一覧で選べない並べ替えは、既定の並びに戻す", () => {
    expect(parsePeopleView({ sort: "company", dir: "desc" }, companyAdmin)).toEqual({ q: "", sort: "grade", dir: "desc" });
    expect(parsePeopleView({ sort: "score" }, ["name", "role"])).toEqual({ q: "", sort: "name", dir: "asc" });
  });

  it("向きが無い・不正なら、選んだ並べ替えの既定の向き（点数は高い順）", () => {
    expect(parsePeopleView({ sort: "score" }, companyAdmin).dir).toBe("desc");
    expect(parsePeopleView({ sort: "score", dir: "up" }, companyAdmin).dir).toBe("desc");
  });

  it("同じ引数が並んだら最初を使い、長すぎる検索語は切る", () => {
    expect(parsePeopleView({ q: ["山田", "佐藤"], sort: ["name", "grade"] }, companyAdmin)).toMatchObject({ q: "山田", sort: "name" });
    expect(parsePeopleView({ q: "あ".repeat(QUERY_MAX_LENGTH + 20) }, companyAdmin).q).toHaveLength(QUERY_MAX_LENGTH);
  });

  it("既定と同じ値は URL に残さない", () => {
    expect(peopleViewParams({ q: " ", sort: "grade", dir: "asc" }, companyAdmin)).toEqual({ q: null, sort: null, dir: null });
    expect(peopleViewParams({ q: "山田", sort: "score", dir: "asc" }, companyAdmin)).toEqual({ q: "山田", sort: "score", dir: "asc" });
    expect(peopleViewParams({ q: "", sort: "score", dir: "desc" }, companyAdmin)).toEqual({ q: null, sort: "score", dir: null });
  });

  it("書いた値を読み直すと同じ並びに戻る", () => {
    const view = { q: "営業", sort: "name" as const, dir: "desc" as const };
    const params = peopleViewParams(view, companyAdmin);
    const back = parsePeopleView(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null)) as Record<string, string>,
      companyAdmin,
    );
    expect(back).toEqual(view);
  });
});

it("人数は行ではなく人で数える（2社に所属する人は1人）", () => {
  expect(countPeople([{ id: "u1" }, { id: "u1" }, { id: "u2" }])).toBe(2);
});

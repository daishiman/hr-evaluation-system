/**
 * 利用者の一覧の、検索と並べ替え（spec.md §28-13）。
 *
 * 利用者一覧（/system/users）・社員（/admin/members）・メンバー（/manager/members）が同じ関数を使う。
 * 一覧は多くて数百人なので、サーバーには問い合わせず、手元の配列を並べ替えて絞る。
 *
 * - 並べ替えの種類は、一覧の範囲と見てよい値で決まる（availableSortKeys）。会社は全社の一覧だけ、
 *   点数と等級は等級と点数を見てよい役割（台帳の members.viewGradeScore）だけ。
 * - 値が無い行（所属なし・等級未設定・確定した評価なし）は、向きを逆にしても常に末尾に置く。
 * - 検索は画面に出ている文字だけを対象にする（見えない値に当たって、理由の分からない行が出ないように）。
 *   語を空白で区切ると、すべてを含む行だけを出す。全角半角・大文字小文字・カタカナとひらがなの違いは無視する。
 */

import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import type { LatestScore } from "@/lib/score-visibility";

export const PEOPLE_SORT_KEYS = ["name", "company", "role", "score", "grade"] as const;
export type PeopleSortKey = (typeof PEOPLE_SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

/** 一覧の1行。値を持たない欄（undefined）は、その一覧では出さない欄 */
export interface PersonFields {
  /** 行の鍵。同じ人が会社ごとに複数行になる一覧では所属の id */
  key: string;
  /** 人の id。人数は行ではなく人で数える */
  id: string;
  name: string;
  email?: string;
  /** 役割の生値（SUPER_ADMIN など）。呼び名はここで作る */
  role: string;
  /** 全社の一覧だけが持つ。会社に属さない人は null */
  companyName?: string | null;
  /** 等級名（未設定なら「等級未設定」）。見てよい役割の一覧だけが持つ（S6） */
  gradeName?: string;
  /** 等級の並び（小さいほど下の等級）。未設定なら null */
  gradeOrder?: number | null;
  /** 確定した最新の点数。確定した評価が無ければ null */
  latestScore?: LatestScore | null;
  department?: string | null;
  employeeCode?: string | null;
}

export const SORT_KEY_LABEL: Record<PeopleSortKey, string> = {
  name: "名前",
  company: "会社",
  role: "役割",
  score: "点数",
  grade: "等級",
};

/** 向きごとの呼び名。並べ替えの欄と「〜にする」のボタンに出す */
const DIRECTION_LABEL: Record<PeopleSortKey, Record<SortDirection, string>> = {
  name: { asc: "名前順", desc: "名前の逆順" },
  company: { asc: "会社名順", desc: "会社名の逆順" },
  role: { asc: "権限の広い順", desc: "権限の狭い順" },
  score: { asc: "点数の低い順", desc: "点数の高い順" },
  grade: { asc: "等級の低い順", desc: "等級の高い順" },
};

/** 選んだときの向き。点数だけは高い順から見たいことが多い */
const DEFAULT_DIRECTION: Record<PeopleSortKey, SortDirection> = {
  name: "asc",
  company: "asc",
  role: "asc",
  score: "desc",
  grade: "asc",
};

export function sortLabel(key: PeopleSortKey, dir: SortDirection): string {
  return DIRECTION_LABEL[key][dir];
}

export function defaultDirection(key: PeopleSortKey): SortDirection {
  return DEFAULT_DIRECTION[key];
}

export function reversed(dir: SortDirection): SortDirection {
  return dir === "asc" ? "desc" : "asc";
}

/**
 * その一覧で選べる並べ替え（並びは名前・会社・役割・点数・等級）。
 * acrossCompanies: 全社にまたがる一覧か。gradeAndScore: 等級と点数を見てよいか。
 */
export function availableSortKeys(scope: { acrossCompanies: boolean; gradeAndScore: boolean }): PeopleSortKey[] {
  return PEOPLE_SORT_KEYS.filter((key) => {
    if (key === "company") return scope.acrossCompanies;
    if (key === "score" || key === "grade") return scope.gradeAndScore;
    return true;
  });
}

/** 開いたときの並び。これまでの一覧の並び（会社順・等級順）を引き継ぐ */
export function defaultSortKey(keys: readonly PeopleSortKey[]): PeopleSortKey {
  if (keys.includes("company")) return "company";
  if (keys.includes("grade")) return "grade";
  return "name";
}

export interface PeopleView {
  q: string;
  sort: PeopleSortKey;
  dir: SortDirection;
}

type Param = string | string[] | undefined;
const firstOf = (value: Param) => (Array.isArray(value) ? value[0] : value);

/** 一覧の画面が受け取る URL の引数（Next の searchParams） */
export type PeopleSearchParams = { q?: Param; sort?: Param; dir?: Param };

/** 検索語の長さの上限。URL に残すので、長すぎる値は切る */
export const QUERY_MAX_LENGTH = 100;

/**
 * URL の q・sort・dir を読む。その一覧で選べない並べ替え（会社の管理者の ?sort=company など）は既定に戻す。
 */
export function parsePeopleView(params: PeopleSearchParams, keys: readonly PeopleSortKey[]): PeopleView {
  const rawSort = firstOf(params.sort);
  const sort = keys.find((key) => key === rawSort) ?? defaultSortKey(keys);
  const rawDir = firstOf(params.dir);
  const dir = rawDir === "asc" || rawDir === "desc" ? rawDir : DEFAULT_DIRECTION[sort];
  return { q: (firstOf(params.q) ?? "").slice(0, QUERY_MAX_LENGTH), sort, dir };
}

/** URL に残す値。既定と同じものは残さない（null は消す） */
export function peopleViewParams(view: PeopleView, keys: readonly PeopleSortKey[]): Record<keyof PeopleView, string | null> {
  return {
    q: view.q.trim() === "" ? null : view.q,
    sort: view.sort === defaultSortKey(keys) ? null : view.sort,
    dir: view.dir === DEFAULT_DIRECTION[view.sort] ? null : view.dir,
  };
}

/** 行に出す札の文字。表示と検索の両方がこれを使う（出ている文字だけを探せるように） */
export function personLabels(row: PersonFields) {
  return {
    role: ROLE_LABEL[row.role as Role] ?? row.role,
    company: row.companyName === undefined ? undefined : (row.companyName ?? "所属なし"),
    grade: row.gradeName,
    department: row.department === undefined ? undefined : (row.department ?? "所属 未設定"),
    employeeCode: row.employeeCode ? `社員番号 ${row.employeeCode}` : undefined,
  };
}

const KATAKANA = /[ァ-ヶ]/g;

/** 比べるための形にそろえる。全角半角（NFKC）・大文字小文字・カタカナとひらがなの違いを消し、空白を除く */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(KATAKANA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");
}

/** 検索語を語に分ける（全角の空白も区切りにする） */
export function searchTokens(query: string): string[] {
  return query
    .normalize("NFKC")
    .split(/\s+/)
    .map(normalizeForSearch)
    .filter((token) => token !== "");
}

/**
 * 行ごとの検索用の文字列（欄ごとにそろえて改行でつなぐ）。行が変わったときにだけ作り直す。
 * 語は空白を含まないので、欄をまたいで当たることはない。
 */
export function buildSearchIndex(rows: readonly PersonFields[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of rows) {
    const labels = personLabels(row);
    const fields = [row.name, row.email, labels.role, labels.company, labels.grade, labels.department, row.employeeCode];
    index.set(
      row.key,
      fields
        .filter((field): field is string => typeof field === "string" && field !== "")
        .map(normalizeForSearch)
        .join("\n"),
    );
  }
  return index;
}

/** 並べ替え済みの行から、検索語をすべて含む行だけを残す（並びは保つ） */
export function filterPeople<T extends PersonFields>(rows: readonly T[], index: ReadonlyMap<string, string>, query: string): T[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [...rows];
  return rows.filter((row) => {
    const text = index.get(row.key) ?? "";
    return tokens.every((token) => text.includes(token));
  });
}

/**
 * 名前・会社名の比べ方。ふりがなを持っていないので読みの順にはならない
 * （漢字は JIS の並び＝おおむね音読みの順。数字は数として比べる）。
 */
const collator = new Intl.Collator("ja", { numeric: true });

/** 満点に対する割合。KPI の満点は等級によらず100点だが、違っても公平に比べる */
function scoreRatio(score: LatestScore): number {
  return score.maxScore > 0 ? score.totalScore / score.maxScore : 0;
}

function sortValue(key: PeopleSortKey, row: PersonFields): string | number | null {
  switch (key) {
    case "name":
      return row.name;
    case "company":
      return row.companyName ?? null;
    case "role": {
      const order = (ROLES as readonly string[]).indexOf(row.role);
      return order < 0 ? null : order;
    }
    case "score":
      return row.latestScore ? scoreRatio(row.latestScore) : null;
    case "grade":
      return row.gradeOrder ?? null;
  }
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * 並べ替える。値が同じなら名前順、名前も同じなら行の鍵の順（毎回同じ並びにする）。
 * 値が無い行は、向きにかかわらず末尾に置く。
 */
export function sortPeople<T extends PersonFields>(rows: readonly T[], key: PeopleSortKey, dir: SortDirection): T[] {
  const sign = dir === "asc" ? 1 : -1;
  // 並べる値は1行につき1回だけ求める（比べるたびに求め直さない）
  const decorated = rows.map((row) => ({ row, value: sortValue(key, row) }));
  decorated.sort((a, b) => {
    if (a.value !== b.value) {
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      const byValue = compareValues(a.value, b.value);
      if (byValue !== 0) return byValue * sign;
    }
    const byName = collator.compare(a.row.name, b.row.name);
    if (byName !== 0) return byName;
    return a.row.key < b.row.key ? -1 : a.row.key > b.row.key ? 1 : 0;
  });
  return decorated.map((entry) => entry.row);
}

/** 人数（行ではなく人で数える） */
export function countPeople(rows: readonly Pick<PersonFields, "id">[]): number {
  return new Set(rows.map((row) => row.id)).size;
}

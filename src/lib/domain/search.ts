import { normalizeKey } from "@/lib/csv-normalize";

/**
 * ヘッダーの検索の「当たり判定」と並び順。
 *
 * 探せるものを2種類だけに絞っている（docs/product/spec.md §25-3）。
 *   ・画面 … どこで設定するのか分からなくなったときの入口
 *   ・人  … 社員・利用者・会社（毎日探すもので、一覧を目で追うのがつらい）
 *
 * 等級・評価期間・KPI項目・アンケートの設問は入れない。数が数個〜十数個で、
 * 置き場の画面を開けば全部見えるうえ、それ単体で開けるURLを持たない。
 * 開いた先が「画面の途中」になる候補は、押した結果が読めないので出さない。
 *
 * 打ち間違いを拾うために、全角半角・空白・区切り記号の違いは無視する
 * （突き合わせの規則は src/lib/csv-normalize.ts と同じものを使う）。
 */

export type PersonKind = "member" | "user" | "company";

export interface PersonHit {
  kind: PersonKind;
  id: string;
  name: string;
  /** 名前だけでは見分けられないときの手がかり（等級・部署・会社名） */
  note: string | null;
  href: string;
  email?: string;
  code?: string | null;
}

export interface ScreenHit {
  href: string;
  label: string;
  /** サイドバーの分類名。同じ語の画面が複数あるときの見分けに使う */
  group: string;
}

/** 探しているものが名前・メール・社員番号・手がかりのどれかに含まれるか。 */
export function matchPerson(p: PersonHit, query: string): boolean {
  const q = normalizeKey(query);
  if (q.length === 0) return false;
  const fields = [p.name, p.email ?? "", p.code ?? "", p.note ?? ""];
  return fields.some((f) => normalizeKey(f).includes(q));
}

/** 画面の名前か、その分類名に含まれるか。 */
export function matchScreen(s: ScreenHit, query: string): boolean {
  const q = normalizeKey(query);
  if (q.length === 0) return false;
  return normalizeKey(s.label).includes(q) || normalizeKey(s.group).includes(q);
}

/**
 * 画面の候補を絞って並べる。
 * 先頭から一致するものを先に出す（「評価」と打ったとき「評価期間」を後回しにしない）。
 */
export function rankScreens(screens: ScreenHit[], query: string, limit = 6): ScreenHit[] {
  const q = normalizeKey(query);
  if (q.length === 0) return [];
  return screens
    .filter((s) => matchScreen(s, query))
    .map((s) => ({ s, head: normalizeKey(s.label).startsWith(q) ? 0 : 1 }))
    .sort((a, b) => a.head - b.head)
    .map((x) => x.s)
    .slice(0, limit);
}

/**
 * 行動指針の「基準セット」。
 *
 * 会社ごとに何セットでも作れる。以前は g1_2 / g3_4 の2つをコードに直書きしていたが、
 * 制度の中身（何セット用意し、それぞれを何と呼ぶか）は会社が決めることなので、
 * セットそのものを behavior_band_sets テーブルに置き、コードは「並べ方・既定値・
 * 表示名の引き方」だけを持つ。
 *
 * 画面名だけを持つ定数も Client Component に置くと、Server Component から値を
 * 読めなくなる。制度上の語と、等級を切り替えたときの現在値の解決は、サーバーと
 * ブラウザのどちらからも読めるこのモジュールを正本にする。
 */

/**
 * 会社を作ったときに入っている基準セット。
 *
 * 呼び名は等級名（Beginner / Regular / Chief / AM）に合わせる。
 * 「等級1〜2の基準」という呼び方は、画面の等級一覧（等級１：Beginner …）や
 * 評価セットの等級区分（Beginner / Regular / Chief / AM / Manager）と語が違い、
 * どの等級のことか読み替えが要る。制度の中で等級を指す語を1つにそろえる。
 */
export const DEFAULT_BAND_SETS = [
  { code: "g1_2", name: "Beginner・Regular向け", displayOrder: 1 },
  { code: "g3_4", name: "Chief・AM向け", displayOrder: 2 },
] as const;

/** 行動指針の5段階。点数は制度の骨格なので会社ごとに動かせない（文章だけ変えられる）。 */
export const BEHAVIOR_LEVEL_TEMPLATE = [
  { score: 3, label: "模範" },
  { score: 2, label: "信頼" },
  { score: 1, label: "安定" },
  { score: 0, label: "不安定" },
  { score: -1, label: "悪影響" },
] as const;

/** 新しく作った観点の初期文言。空文字だと保存できないため、書き換える前提の下書きを入れる。 */
export function defaultLevelText(aspectName: string, label: string): string {
  return `${aspectName}について「${label}」と見なす状態をここに書きます`;
}

export interface BehaviorBandSetRow {
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

/** 画面に出す順。会社が作った順（displayOrder）を正、同着はコードで安定させる。 */
export function sortBandSets<T extends { displayOrder: number; code: string }>(sets: readonly T[]): T[] {
  return [...sets].sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
}

/**
 * DB から来る基準セットのコードを画面の呼び名に変える。
 * 会社の設定に無いコードは隠さず、そのまま表示する（消えたように見せない）。
 */
export function behaviorBandLabel(
  sets: readonly BehaviorBandSetRow[],
  code: string | null | undefined,
): string {
  if (!code) return "";
  return sets.find((set) => set.code === code)?.name ?? code;
}

export interface BehaviorAssignmentGrade {
  id: string;
  behaviorBand: string | null;
}

/** 選んだ等級にいま保存されている基準セット。見つからなければ適用なし。 */
export function behaviorBandForGrade(
  grades: readonly BehaviorAssignmentGrade[],
  gradeId: string,
): string | null {
  return grades.find((grade) => grade.id === gradeId)?.behaviorBand ?? null;
}

/** select の空文字を API / DB の「適用なし」である null にそろえる。 */
export function behaviorBandPayloadValue(value: string): string | null {
  return value === "" ? null : value;
}

/** その基準セットを出す設定になっている等級。使用を止める前に必ず見る。 */
export function gradesUsingBand(
  grades: readonly (BehaviorAssignmentGrade & { name: string })[],
  code: string,
): { id: string; name: string }[] {
  return grades.filter((grade) => grade.behaviorBand === code).map((grade) => ({ id: grade.id, name: grade.name }));
}

/**
 * 複製したセットの既定の呼び名。
 * 同じ名前が2つ並ぶと画面で見分けられないため、末尾の番号で必ず違う名前にする。
 */
export function copiedBandSetName(existingNames: readonly string[], sourceName: string): string {
  const base = `${sourceName}のコピー`;
  if (!existingNames.includes(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}${n}`;
    if (!existingNames.includes(candidate)) return candidate;
  }
  return `${base}${Date.now()}`;
}

/** 新しいセットの並び順。いちばん後ろに足す。 */
export function nextDisplayOrder(sets: readonly { displayOrder: number }[]): number {
  return sets.reduce((max, set) => Math.max(max, set.displayOrder), 0) + 1;
}

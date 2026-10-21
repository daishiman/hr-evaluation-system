/**
 * 評価期間に使う評価セット（KPI評価の方式）を1つに決める（DD-024）。
 *
 * 以前は、アンケートの作成（src/lib/form-build.ts）・点数の計算（src/lib/evaluate.ts）・
 * ズレの比較（src/lib/comparison-gap-loader.ts）がそれぞれ別の書き方で選んでいた。
 * 期間に評価セットが付いていないとき、作成と計算は「使用中」へ落とし、比較は何も選ばなかったため、
 * 同じ期間を見ているのに、画面によって別の評価セットの話をすることがあった。
 * いまは作成・計算・比較と、公開と受付開始の判定（src/lib/cycle-scheme.ts 経由）がここを呼ぶ。
 * 評価レポートは、計算がここで決めた評価セットで出した結果を読むので、選び直さない。
 *
 * 1. 期間に付いた評価セット（cycle.schemeId）があれば、それ
 * 2. 無ければ、状態が使用中（active）の評価セット
 * 3. どちらも無ければ null（呼び出し側が「評価セットがありません」と止める。先頭の1件へは落とさない）
 *
 * 会社の境界は、呼び出し側がその会社の評価セットだけを渡して閉じる。
 */

export interface SchemeCandidate {
  id: string;
  status: string;
}

export function resolveSchemeForCycle<T extends SchemeCandidate>(
  cycle: { schemeId: string | null },
  schemes: readonly T[],
): T | null {
  if (cycle.schemeId) {
    const attached = schemes.find((scheme) => scheme.id === cycle.schemeId);
    if (attached) return attached;
  }
  return schemes.find((scheme) => scheme.status === "active") ?? null;
}

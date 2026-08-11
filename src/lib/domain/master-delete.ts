/**
 * 制度設定の項目を「完全に消してよいか」を決める文言と判定。
 *
 * 制度設定には、利用者が自分で足せる項目がある（行動指針の基準セット・観点、
 * 等級要件、昇格要件）。足せるのに消せないと、試しに作った項目が一覧に残り続ける。
 *
 * ただし何でも消せるようにはできない。公開したアンケートと確定済みの評価は、
 * この項目を指したまま残っている。指されている行を消すと、過去のアンケートと
 * 評価の中身が変わってしまう（=1文字も変えない、という約束が破れる）。
 *
 * そこで線を1本だけ引く:
 *   - 一度もアンケートに出しておらず、評価の記録にも残っていない → 完全に消せる
 *   - 一度でも使った → 消せない。従来どおり「使わない」で今後の出題から外す
 *
 * この判定は必ずサーバー側で行う（画面のボタンの出し分けだけに頼らない）。
 * 画面と API が同じ文言・同じ基準で判断できるよう、ここに集約している。
 */

/** 使っている場所を名指しする件数。全部並べると読めなくなるので先頭2件+件数にする。 */
const NAMED_PLACES = 2;

/** 「アンケート「◯◯」・確定済みの評価 ほか2件」の形にする。 */
export function placesText(usedBy: readonly string[]): string {
  const named = usedBy.slice(0, NAMED_PLACES).join("・");
  const rest = usedBy.length - NAMED_PLACES;
  return rest > 0 ? `${named} ほか${rest}件` : named;
}

/**
 * 消せないときに画面へ出す1文。消してよいときは null。
 * 「なぜ消せないか」→「代わりに何をすればよいか」の順で書く。
 */
export function deleteBlockedReason(usedBy: readonly string[]): string | null {
  if (usedBy.length === 0) return null;
  /* 1件ずつ出る文なので短く言い切る。
     長い説明を項目の数だけ並べると、一覧そのものが読めなくなる
     （2026-08-12、等級要件の9項目すべてに3行の説明が出て一覧が埋まった）。 */
  return `${placesText(usedBy)}で使っているため、完全には消せません。「使わない」なら次のアンケートから外せます。`;
}

/**
 * 基準セットを消せない理由。
 * 等級への割り当てが残っているときは、そちらを先に外す順番を示す
 * （「使用を止める」ときと同じ順番にそろえる）。
 */
export function bandSetBlockedReason(gradeNames: readonly string[], usedBy: readonly string[]): string | null {
  if (gradeNames.length > 0) {
    return (
      `この基準は ${gradeNames.join("・")} に出す設定になっています。` +
      "先に「どの等級に出すか」でほかの基準か「適用しない」に変えてから、使用を止める・消すの操作をしてください。"
    );
  }
  return deleteBlockedReason(usedBy);
}

/** 消す前の確認文。何が消えて、何が残るかを書く。 */
export function deleteConfirmText(name: string, alsoRemoved?: string): string {
  return (
    `「${name}」を完全に消します。元に戻せません。` +
    (alsoRemoved ? `${alsoRemoved}` : "") +
    "まだ一度もアンケートに出していない項目のため、公開したアンケートと確定済みの評価は変わりません。"
  );
}

/** 消せる状態の項目に付けるボタンの文言（全画面で同じにする）。 */
export const DELETE_LABEL = "完全に消す";

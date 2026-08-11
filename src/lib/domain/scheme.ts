/**
 * 評価セット（等級区分ごとの項目選択と配点）の組み立てルール。
 *
 * 制度上の決めごと（2026-08-11 確定 / 2026-08-11 項目選択を自由化）:
 *  - 選ぶ項目数と配点は等級区分で変わる（grade_point_rules が正）。
 *  - 「等級要件達成率」は全等級で必須の固定枠。差し替えできない。
 *  - それ以外の枠には、**どの項目でも入れられる**。分類の重複も可。
 *  - 合計は満点（既定100点）ちょうど。
 *
 * 自由化でやめた検証（意図的に消している。戻すときは理由を書くこと）:
 *
 *  1. カテゴリ網羅（「7カテゴリから1つずつ」）
 *     Regular は固定枠のほかに2項目しか選べず、物理的に成り立たなかった。
 *
 *  2. 等級区分ごとの選択候補の制限（kpi_reference_points に行がある項目だけ）
 *     元スプレッドシートの配点表に行があるかどうかで候補を絞っていたため、
 *     Regular では33項目中10項目しか選べなかった。
 *     元表は「その会社が過去にそう運用していた」記録であって、制度上の禁止ではない。
 *     会社ごとに評価軸を組み替えられることが要件なので、候補は絞らない。
 *
 *  3. 20点枠を金銭系（単価率・売上達成率・利益率）に限る制限
 *     20点枠は「ほかより重く見る枠」であって「お金の枠」ではない。
 *     何を重く見るかは会社が決めることなので、どの項目でも置けるようにした。
 *
 * ただし自由に選べることと、選んだ項目が適切な水準で評価されることは別問題。
 * ランク基準（kpi_rank_criteria）は項目ごとに1組しかなく、採点は target_grades を見ない。
 * つまりその等級区分を想定していない項目を選ぶと、上位等級向けの閾値がそのまま当たる。
 * これを見えるようにするため warnings で返す（判定は validateScheme の呼び出し側ではなく
 * この関数の中で行う。画面とAPIで判断が食い違わないようにするため）。
 *
 * どれもDBの値を使って判定する。ここには点数を書かない。
 */

import { expectedItemCount, pointsForSlot, slotKindOf, type GradePointRule } from "./grade-points";

export interface SchemeSelection {
  kpiItemId: string;
  categoryId: string | null;
  weight: number;
  /** 固定枠（等級要件達成率） */
  isFixedSlot: boolean;
  /** 20点枠（金銭系） */
  isMajorSlot: boolean;
}

export interface SchemeValidation {
  ok: boolean;
  /** 画面にそのまま出せる日本語の指摘。空なら問題なし。これがあると保存できない。 */
  errors: string[];
  /** 保存はできるが知らせておくべきこと。空なら問題なし。 */
  warnings: string[];
  total: number;
}

export interface ValidateSchemeOptions {
  /** この等級区分の持ち点の型 */
  rule: GradePointRule;
  /** 固定枠になれる項目のID（kpi_items.is_fixed_slot = true。実データでは No.1 の1件） */
  fixedSlotItemIds: Iterable<string>;
  /**
   * この等級区分を対象としてランク基準（A〜E）が作られている項目のID。
   * ここに無い項目を選んでも採点はされるが、上位等級向けの閾値が当たる。
   * 渡さなかった場合は判定しない（呼び出し側がまだ対応していない箇所での誤警告を避ける）。
   */
  ratedItemIds?: Iterable<string>;
  /** 指摘に業務の言葉（項目名）を出すための引き当て */
  itemNameOf?: (id: string) => string;
}

export function validateScheme(selections: SchemeSelection[], opts: ValidateSchemeOptions): SchemeValidation {
  const { rule } = opts;
  const errors: string[] = [];
  const warnings: string[] = [];
  const total = selections.reduce((sum, x) => sum + x.weight, 0);
  const nameOf = opts.itemNameOf ?? ((id: string) => id);
  const fixedCandidates = new Set(opts.fixedSlotItemIds);

  const expected = expectedItemCount(rule);
  if (selections.length !== expected) {
    const diff = expected - selections.length;
    errors.push(
      `${rule.pointGroup} で選ぶ項目は${expected}件です（いまは${selections.length}件。` +
        `${diff > 0 ? `あと${diff}件選んでください` : `${-diff}件外してください`}）。`,
    );
  }

  /* 固定枠は「1件であること」だけでなく「本当に等級要件達成率か」まで見る。
     画面が正しく送ることに任せると、APIを直接叩いて別の項目を100点の固定枠にできてしまう。 */
  const fixed = selections.filter((x) => x.isFixedSlot);
  if (fixed.length !== 1) {
    errors.push(`固定枠（等級要件達成率）はちょうど1件にしてください（いまは${fixed.length}件）。`);
  }
  for (const f of fixed) {
    if (!fixedCandidates.has(f.kpiItemId)) {
      errors.push(`「${nameOf(f.kpiItemId)}」は固定枠にできません。固定枠は等級要件達成率だけです。`);
    }
  }

  /* 20点枠に置ける項目の種類は問わない（どの項目でも重く見てよい）。
     見るのは「枠の数がその等級区分の型と合っているか」だけ。
     Beginner / Regular は majorSlotCount が0なので「0件であること」も同じ式で見る。 */
  const major = selections.filter((x) => !x.isFixedSlot && x.isMajorSlot);
  if (major.length !== rule.majorSlotCount) {
    errors.push(
      rule.majorSlotCount === 0
        ? `${rule.pointGroup} に${rule.majorSlotPoints || 20}点枠はありません（いまは${major.length}件選ばれています）。`
        : `${rule.majorSlotPoints}点枠はちょうど${rule.majorSlotCount}件にしてください（いまは${major.length}件）。`,
    );
  }

  /* その等級区分を想定していないランク基準しか無い項目は、採点自体は行われる。
     ただし当たる閾値は上位等級向けのものなので、意図せず厳しくなる。
     このズレは画面上どこにも出ないため、ここで必ず気づけるようにする。 */
  if (opts.ratedItemIds !== undefined) {
    const rated = new Set(opts.ratedItemIds);
    const unrated = selections.filter((x) => !rated.has(x.kpiItemId));
    /* errors ではなく warnings にする。
       errors にすると「基準を整えるまで項目を選べない」ことになり、
       「まず評価軸を決めて、それから基準を詰める」という自然な作業順序を塞いでしまう。
       今回の自由化そのものが「選び方を制度で縛らない」ためのものなので、
       ここで新しい縛りを作ると自由化の意味が薄れる。
       そのぶん文面では「上位等級向けの閾値が当たる」ところまで書き切り、読み飛ばしにくくする。 */
    if (unrated.length > 0) {
      warnings.push(
        `${unrated.map((x) => `「${nameOf(x.kpiItemId)}」`).join("・")}のランク基準（A〜E）は、` +
          `${rule.pointGroup} を対象として想定されていません。このまま保存でき、採点も行われますが、` +
          `上位の等級を想定して作られた基準がそのまま使われるため、${rule.pointGroup} には厳しすぎる可能性があります。` +
          `「評価基準」で閾値を確認してください。`,
      );
    }
  }

  /* 配点は等級区分から決まる。画面から送られた値は信用せず、型と一致するかを見る
     （APIは一致しない値を弾くのではなく、この型の値で上書きして保存する）。 */
  for (const sel of selections) {
    const expectedWeight = pointsForSlot(rule, slotKindOf(sel));
    if (sel.weight !== expectedWeight) {
      errors.push(
        `「${nameOf(sel.kpiItemId)}」の配点は${expectedWeight}点です（いまは${sel.weight}点）。配点は等級区分から決まります。`,
      );
    }
  }

  const ids = new Set(selections.map((x) => x.kpiItemId));
  if (ids.size !== selections.length) errors.push("同じ項目が重複して選ばれています。");

  /* 0点の項目は作らない。Beginner のように評価しない項目は「0点の行」ではなく行そのものを作らない
     （黙って0点にすると「評価されなかった」が「0点だった」に化けるため。src/lib/domain/scoring.ts と同じ方針）。 */
  if (selections.some((x) => x.weight <= 0)) errors.push("配点は1点以上にしてください。");

  if (total !== rule.totalPoints) {
    const diff = rule.totalPoints - total;
    errors.push(
      `配点の合計が${total}点です。${rule.totalPoints}点ちょうどにしてください（あと${diff > 0 ? `${diff}点増やす` : `${-diff}点減らす`}）。`,
    );
  }

  return { ok: errors.length === 0, errors, warnings, total };
}

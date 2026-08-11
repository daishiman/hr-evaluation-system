/**
 * 評価セット（等級区分ごとの項目選択と配点）の組み立てルール。
 *
 * 制度上の決めごと（2026-08-11 確定）:
 *  - 選ぶ項目数と配点は等級区分で変わる（grade_point_rules が正）。
 *  - 「等級要件達成率」は全等級で必須の固定枠。差し替えできない。
 *  - Chief 以上は金銭系を1つだけ 20点枠として選ぶ。残りは1項目10点。
 *  - どの項目をその等級区分で選べるかは kpi_reference_points に行があるかどうかが正。
 *  - 合計は満点（既定100点）ちょうど。
 *
 * 以前は「固定枠1 + 7カテゴリから1つずつ = 8件ちょうど」だったが、
 * Regular は固定枠のほかに2項目しか選べず、7カテゴリから1つずつは物理的に成り立たない。
 * カテゴリの網羅は制度の要件ではなかったため、この検証はやめている
 * （偏りは画面側で「カテゴリが偏っています」と助言する程度に留める）。
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
  /** 画面にそのまま出せる日本語の指摘。空なら問題なし。 */
  errors: string[];
  total: number;
}

export interface ValidateSchemeOptions {
  /** この等級区分の持ち点の型 */
  rule: GradePointRule;
  /** この等級区分で選べる項目のID（kpi_reference_points に行がある項目） */
  selectableItemIds: Iterable<string>;
  /** 固定枠になれる項目のID（kpi_items.is_fixed_slot = true。実データでは No.1 の1件） */
  fixedSlotItemIds: Iterable<string>;
  /** 20点枠になれる項目のID（kpi_items.is_monetary = true。No.6/9/24） */
  monetaryItemIds: Iterable<string>;
  /** 指摘に業務の言葉（項目名）を出すための引き当て */
  itemNameOf?: (id: string) => string;
}

export function validateScheme(selections: SchemeSelection[], opts: ValidateSchemeOptions): SchemeValidation {
  const { rule } = opts;
  const errors: string[] = [];
  const total = selections.reduce((sum, x) => sum + x.weight, 0);
  const nameOf = opts.itemNameOf ?? ((id: string) => id);
  const selectable = new Set(opts.selectableItemIds);
  const fixedCandidates = new Set(opts.fixedSlotItemIds);
  const monetary = new Set(opts.monetaryItemIds);

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

  /* 20点枠は金銭系（単価率・売上達成率・利益率）だけ。
     Beginner / Regular は majorSlotCount が0なので「0件であること」も同じ式で見る。 */
  const major = selections.filter((x) => !x.isFixedSlot && x.isMajorSlot);
  if (major.length !== rule.majorSlotCount) {
    errors.push(
      rule.majorSlotCount === 0
        ? `${rule.pointGroup} に${rule.majorSlotPoints || 20}点枠はありません（いまは${major.length}件選ばれています）。`
        : `${rule.majorSlotPoints}点枠（金銭系）はちょうど${rule.majorSlotCount}件にしてください（いまは${major.length}件）。`,
    );
  }
  for (const m of major) {
    if (!monetary.has(m.kpiItemId)) {
      errors.push(
        `「${nameOf(m.kpiItemId)}」は${rule.majorSlotPoints}点枠にできません。${rule.majorSlotPoints}点枠に置けるのは金銭系の項目だけです。`,
      );
    }
  }

  /* その等級区分で評価対象になっていない項目は選べない。
     元の配点表（kpi_reference_points）にその等級区分の行があるかどうかが正。 */
  for (const sel of selections) {
    if (!selectable.has(sel.kpiItemId)) {
      errors.push(`「${nameOf(sel.kpiItemId)}」は ${rule.pointGroup} の評価対象ではないため選べません。`);
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

  return { ok: errors.length === 0, errors, total };
}

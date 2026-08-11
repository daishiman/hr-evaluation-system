/**
 * 等級区分ごとの「持ち点の型」を扱う純関数。
 *
 * 制度（2026-08-11 確定・data/kpi-points.json のランクA行で実測検証済み）:
 *   - 評価は等級区分を問わず 100点満点。100点で次の等級に昇格する。
 *   - 「等級要件達成率」(No.1) は全等級で必須の固定枠。配点は等級区分ごとに違う。
 *   - Chief 以上は金銭系（単価率／売上達成率／利益率）を1つだけ 20点枠として選ぶ。
 *   - 残りは1項目 10点。
 *
 *   等級区分  固定枠  20点枠  10点枠  項目数
 *   Beginner   100      0       0        1
 *   Regular     80      0       2        3
 *   Chief       40      1       4        6
 *   AM          30      1       5        7
 *   Manager     20      1       6        8
 *
 * 数値はここに書かない。すべて grade_point_rules テーブルの行を受け取って判断する。
 * このファイルが持つのは「行をどう解釈するか」だけ。
 */

/** grade_point_rules の1行（DBの列名をキャメルケースにしたもの） */
export interface GradePointRule {
  pointGroup: string;
  totalPoints: number;
  fixedSlotPoints: number;
  majorSlotPoints: number;
  majorSlotCount: number;
  minorSlotPoints: number;
  minorSlotCount: number;
}

/** 枠の種類。固定枠（等級要件達成率）／20点枠（金銭系）／それ以外 */
export type SlotKind = "fixed" | "major" | "minor";

/** その等級区分で選ぶ項目数（固定枠を含む） */
export function expectedItemCount(rule: GradePointRule): number {
  return 1 + rule.majorSlotCount + rule.minorSlotCount;
}

/** 枠1つぶんの配点。配点はユーザー入力ではなくここから決める。 */
export function pointsForSlot(rule: GradePointRule, kind: SlotKind): number {
  if (kind === "fixed") return rule.fixedSlotPoints;
  if (kind === "major") return rule.majorSlotPoints;
  return rule.minorSlotPoints;
}

/** 選択の状態から枠の種類を決める。固定枠が最優先（固定枠は20点枠になれない）。 */
export function slotKindOf(sel: { isFixedSlot: boolean; isMajorSlot?: boolean }): SlotKind {
  if (sel.isFixedSlot) return "fixed";
  return sel.isMajorSlot ? "major" : "minor";
}

/**
 * 「配点の型そのもの」が破綻していないかを見る。
 *
 * 評価セットの内容ではなく、マスタ（grade_point_rules）側の検算。
 * 固定枠 + 20点枠×数 + 10点枠×数 が満点ちょうどにならない行が入ると、
 * どんな選び方をしても保存できない状態になるため、シードや移行の時点で気づけるようにする。
 */
export function checkGradePointRule(rule: GradePointRule): string[] {
  const errors: string[] = [];
  const sum =
    rule.fixedSlotPoints + rule.majorSlotPoints * rule.majorSlotCount + rule.minorSlotPoints * rule.minorSlotCount;
  if (sum !== rule.totalPoints) {
    errors.push(
      `${rule.pointGroup} の配点の型が合いません。固定枠${rule.fixedSlotPoints}点 + ${rule.majorSlotPoints}点枠×${rule.majorSlotCount} + ${rule.minorSlotPoints}点枠×${rule.minorSlotCount} ＝ ${sum}点で、満点${rule.totalPoints}点になりません。`,
    );
  }
  if (rule.fixedSlotPoints <= 0) {
    errors.push(`${rule.pointGroup} の固定枠（等級要件達成率）の配点が0点以下です。`);
  }
  if (rule.majorSlotCount < 0 || rule.minorSlotCount < 0) {
    errors.push(`${rule.pointGroup} の枠数が負の数になっています。`);
  }
  if (rule.majorSlotCount > 0 && rule.majorSlotPoints <= 0) {
    errors.push(`${rule.pointGroup} は20点枠を持つのに、その配点が0点以下です。`);
  }
  if (rule.minorSlotCount > 0 && rule.minorSlotPoints <= 0) {
    errors.push(`${rule.pointGroup} は10点枠を持つのに、その配点が0点以下です。`);
  }
  return errors;
}

/**
 * 「対象等級」欄（kpi_questions.target_grades / kpi_rank_criteria.target_grades）に
 * この等級区分が含まれるかを判定する。
 *
 * 元スプレッドシートの表記そのままで「Beginner／Regular／Chief／AM／Manager」のような
 * 全角スラッシュ区切りの文字列が入っている。空欄と「全等級」は全等級が対象。
 * 区切り文字は表記ゆれ（半角スラッシュ・読点）があっても拾えるようにしている。
 */
export function targetsPointGroup(targetGrades: string | null | undefined, pointGroup: string): boolean {
  const raw = (targetGrades ?? "").trim();
  if (raw === "" || raw === "全等級") return true;
  return raw
    .split(/[／/、,・]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .includes(pointGroup);
}

/** 等級区分ごとの行を引きやすい形に直す */
export function indexRules(rules: GradePointRule[]): Map<string, GradePointRule> {
  return new Map(rules.map((r) => [r.pointGroup, r]));
}

/**
 * 「なぜこの配点なのか」を1行の日本語で説明する。
 *
 * 配点を画面から編集できなくする以上、決まっている理由をその場に出さないと
 * 「入力できないのは不具合ではないか」と受け取られるため、画面にそのまま出す文をここで作る。
 */
export function describeRule(rule: GradePointRule): string {
  const parts = [`等級要件達成率（固定枠）${rule.fixedSlotPoints}点`];
  if (rule.majorSlotCount > 0) parts.push(`金銭系の${rule.majorSlotPoints}点枠を${rule.majorSlotCount}項目`);
  if (rule.minorSlotCount > 0) parts.push(`ほかの項目を${rule.minorSlotPoints}点ずつ${rule.minorSlotCount}項目`);
  return `${rule.pointGroup} は ${parts.join(" ＋ ")} ＝ ${rule.totalPoints}点。配点は等級区分から決まるため、この画面では変更できません。`;
}

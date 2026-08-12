/**
 * 等級区分ごとの「持ち点の型」を扱う純関数。
 *
 * 制度（2026-08-11 確定・data/kpi-points.json のランクA行で実測検証済み）:
 *   - 評価は等級区分を問わず 100点満点。100点で次の等級に昇格する。
 *   - 「等級要件達成率」(No.1) は全等級で必須の固定枠。配点は等級区分ごとに違う。
 *   - Chief 以上は「ほかより重く見る項目」を1つだけ 20点枠として選ぶ。
 *     2026-08-11 まではこの枠を金銭系（単価率／売上達成率／利益率）に限っていたが、
 *     何を重く見るかは会社が決めることなので、どの項目でも置けるようにした。
 *   - 残りは1項目 10点。
 *   - どの枠にどの項目を入れるか、どの分類から選ぶかは自由（同じ分類の重複も可）。
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
 * 満点の内訳を、枠ごとの1件に分ける。
 *
 * 以前はこれを1本の文にしていた（「Manager は 等級要件達成率（固定枠）10点 ＋
 * 5点枠を4項目 ＋ ほかの項目を2点ずつ5項目 ＝ 40点。…」）。
 * 足し算は文ではないので読むたびに頭の中で分解し直すことになり、しかも
 * 等級区分名の差し込みぶん伸びて、画面では60文字を超える1行になっていた。
 * 文にせず、画面が並び（<ul>）として出せる形で返す。
 *
 * 配点を画面から編集できなくする以上、決まっている理由も併せて出す必要がある
 * （出さないと「入力できないのは不具合ではないか」と受け取られる）。それは RULE_NOTES。
 */
export interface RulePart {
  /** 並びの鍵（枠の種類） */
  kind: SlotKind;
  /** 枠の呼び名 */
  label: string;
  /** その枠の中身（1つあたりの配点 × 個数）。固定枠は1つしかないので持たない */
  detail: string | null;
  /** その枠ぶんの小計 */
  points: number;
}

export function ruleBreakdown(rule: GradePointRule): RulePart[] {
  const parts: RulePart[] = [
    { kind: "fixed", label: "等級要件達成率（固定枠）", detail: null, points: rule.fixedSlotPoints },
  ];
  if (rule.majorSlotCount > 0) {
    parts.push({
      kind: "major",
      label: `${rule.majorSlotPoints}点枠`,
      detail: `${rule.majorSlotPoints}点 × ${rule.majorSlotCount}項目`,
      points: rule.majorSlotPoints * rule.majorSlotCount,
    });
  }
  if (rule.minorSlotCount > 0) {
    parts.push({
      kind: "minor",
      label: "ほかの項目",
      detail: `${rule.minorSlotPoints}点 × ${rule.minorSlotCount}項目`,
      points: rule.minorSlotPoints * rule.minorSlotCount,
    });
  }
  return parts;
}

/**
 * 配点が動かせないことと、枠の使い方の決まり。
 *
 * 1文＝1つのことにして並べる。画面はこれをそのまま並びとして出す。
 */
export const RULE_NOTES = [
  "配点は等級区分から決まります。",
  "この画面では変更できません。",
  "固定枠を除く枠には、どの分類の項目でも入れられます。",
  "同じ分類から複数選んでもかまいません。",
] as const;

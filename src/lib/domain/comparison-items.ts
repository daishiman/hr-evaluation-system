/**
 * 比べる警告（DD-012）の、等級要件と行動指針の材料と、行から飛ぶ先。
 *
 * KPI項目は「使うKPIを選ぶ」で選んだ項目と比べる。等級要件と行動指針には選ぶ画面が無く、
 * アンケートを作った時点のマスタ（form-build.ts）がそのまま設問になる。だから、いまのマスタで
 * 作り直したら聞くはずの項目を、form-build.ts と同じ選び方でここに作り、聞いている項目と比べる。
 *
 * 等級要件は版の系列で比べる。本文を直すと新版の行ができる（versioned-master.ts）が、
 * 項目としては同じなので、版の id ではなく系列の起点の id で数える（本文の直しを足りない＋余分の2行に見せない）。
 *
 * 差を取るのは comparison-gap.ts だけ（ここは材料を並べるまで）。
 */

import { currentVersionRows, lineageRootId, type VersionedMasterRow } from "./versioned-master";

/** 等級要件の画面（台帳の書き方） */
export const REQUIREMENTS_LEDGER_PATH = "/admin/masters/requirements";
/** 行動指針の画面（台帳の書き方） */
export const BEHAVIOR_LEDGER_PATH = "/admin/behavior";

/** 等級要件の一覧の行の id（系列の起点の id で付ける。本文を直しても URL の # が変わらない） */
export function gradeRequirementAnchor(seriesRootId: string): string {
  return `grade-requirement-${seriesRootId}`;
}

/** 行動指針の観点のカードの id */
export function behaviorGuidelineAnchor(guidelineId: string): string {
  return `behavior-guideline-${guidelineId}`;
}

/** 等級要件の画面を、その等級を開いた状態で見せるURL。系列を渡すと、その行の位置へ飛ぶ */
export function gradeRequirementsPath(gradeId: string, seriesRootId?: string): string {
  const base = `${REQUIREMENTS_LEDGER_PATH}?grade=${encodeURIComponent(gradeId)}`;
  return seriesRootId ? `${base}#${encodeURIComponent(gradeRequirementAnchor(seriesRootId))}` : base;
}

/**
 * 行動指針の画面を、その等級と基準を開いた状態で見せるURL。観点を渡すと、そのカードの位置へ飛ぶ。
 * 引数の並びは画面の behaviorHref（grade → band）と同じ。基準が分からないときは画面の既定の基準で開く
 */
export function behaviorGuidelinesPath(gradeId: string, band: string | null, guidelineId?: string): string {
  const params = new URLSearchParams({ grade: gradeId });
  if (band) params.set("band", band);
  const base = `${BEHAVIOR_LEDGER_PATH}?${params.toString()}`;
  return guidelineId ? `${base}#${encodeURIComponent(behaviorGuidelineAnchor(guidelineId))}` : base;
}

/** 設問を作る区分の順（form-build.ts と同じ。支援 → 運営） */
const REQUIREMENT_CATEGORIES = ["support", "operation"] as const;

export interface RequirementMasterRow extends VersionedMasterRow {
  gradeId: string;
  category: string;
  seq: number;
  text: string;
  isActive: boolean;
}

export interface RequirementSeries {
  /** いまのマスタで、その等級のアンケートが聞くはずの系列（区分の順 → seq の順） */
  expectedOf: (gradeId: string) => string[];
  /** 設問が持つ版の id を、系列の起点の id に読み替える。マスタに無い id はそのまま返す */
  rootsOf: (versionIds: readonly string[]) => string[];
  /** 系列の名前（いまの版の本文）。マスタに無い系列は undefined */
  nameOf: (seriesRootId: string) => string | undefined;
}

/**
 * 等級要件を系列で数える道具。rows は会社の等級要件すべて（版の系譜をたどるため、等級で絞らずに渡す）。
 * 聞くはずの項目は form-build.ts と同じく「各系列のいまの版のうち、使う項目」
 */
export function requirementSeries(rows: readonly RequirementMasterRow[]): RequirementSeries {
  const current = currentVersionRows(rows).map((row) => ({ row, root: lineageRootId(rows, row.id) }));
  const nameByRoot = new Map(current.map(({ row, root }) => [root, row.text]));
  return {
    expectedOf: (gradeId) =>
      REQUIREMENT_CATEGORIES.flatMap((category) =>
        current
          .filter(({ row }) => row.gradeId === gradeId && row.category === category && row.isActive)
          .sort((a, b) => a.row.seq - b.row.seq)
          .map(({ root }) => root),
      ),
    rootsOf: (versionIds) => versionIds.map((id) => lineageRootId(rows, id)),
    nameOf: (seriesRootId) => nameByRoot.get(seriesRootId),
  };
}

export interface GuidelineMasterRow {
  id: string;
  band: string;
  aspectName: string;
  seq: number;
  isActive: boolean;
}

export interface GuidelineCatalog {
  /** いまのマスタで、その基準の等級のアンケートが聞くはずの観点（seq の順）。基準の無い等級は聞かない */
  expectedOf: (band: string | null) => string[];
  /** 観点の呼び名。マスタに無い観点は undefined */
  nameOf: (guidelineId: string) => string | undefined;
  /** 観点の基準（行動指針の画面の band）。マスタに無い観点は undefined */
  bandOf: (guidelineId: string) => string | undefined;
}

/** 行動指針の観点を引く道具。聞くはずの項目は form-build.ts と同じく「等級の基準の、使う観点」 */
export function guidelineCatalog(rows: readonly GuidelineMasterRow[]): GuidelineCatalog {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    expectedOf: (band) =>
      rows
        .filter((row) => band !== null && row.band === band && row.isActive)
        .sort((a, b) => a.seq - b.seq)
        .map((row) => row.id),
    nameOf: (guidelineId) => byId.get(guidelineId)?.aspectName,
    bandOf: (guidelineId) => byId.get(guidelineId)?.band,
  };
}

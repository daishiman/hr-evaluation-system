/**
 * 届いた要望1件から、作業指示文を組み立てる。
 *
 * 詳細画面の下見（何が渡るかの確認）と、実際に払い出す API が
 * **同じ文面**を使うためにここへ集める。別々に組み立てると、
 * 確認した内容と渡った内容が食い違い、確認そのものが意味を失う。
 */

import { ROLE_LABEL, type Role } from "@/lib/session";
import { appOrigin } from "@/lib/origin";
import { appVersion } from "@/lib/app-version";
import { improvementStatusLabel, isImprovementStatus } from "@/lib/domain/improvement";
import { improvementFingerprint } from "@/lib/domain/improvement-handout";
import {
  buildBulkInstructionDocument,
  buildInstructionDocument,
  buildInstructionTitle,
  diagnosticsLevelFor,
  isImprovementKind,
  parseDiagnostics,
  type ImprovementKind,
  type InstructionInput,
} from "@/lib/domain/improvement-instruction";

export interface ImprovementForInstruction {
  id: string;
  kind: string;
  screenLabel: string;
  path: string;
  routePattern: string;
  body: string;
  expected: string | null;
  diagnostics: string | null;
  createdAt: Date;
  hasShot: boolean;
  /** 送った人の役割。氏名は指示文へ出さないので受け取らない */
  reporterRole: string | null;
  /** open | doing | done | dropped */
  status: string;
  handledNote: string | null;
}

export interface InstructionDraft {
  title: string;
  document: string;
  kind: ImprovementKind;
  /** この文面を作った時点の内容の指紋。次に渡すときの「変わったか」の基準になる。 */
  fingerprint: string;
}

function roleLabelOf(role: string | null): string {
  return role && role in ROLE_LABEL ? ROLE_LABEL[role as Role] : "不明";
}

/**
 * 「渡したあとに変わったか」を見るための指紋。
 *
 * 文面ではなく元の内容から作る。文面にはアプリの版が混ざるため、
 * こちらの都合（配布のたびに版が変わる）で毎回「更新あり」になってしまう。
 */
export type FingerprintSource = Pick<
  ImprovementForInstruction,
  "kind" | "screenLabel" | "path" | "routePattern" | "body" | "expected" | "status" | "handledNote"
>;

export function improvementFingerprintOf(item: FingerprintSource): string {
  return improvementFingerprint({
    kind: item.kind,
    screenLabel: item.screenLabel,
    path: item.path,
    routePattern: item.routePattern,
    body: item.body,
    expected: item.expected,
    status: item.status,
    handledNote: item.handledNote,
  });
}

async function instructionInputOf(
  item: ImprovementForInstruction,
  origin: string,
  version: string | null,
): Promise<InstructionInput> {
  const kind: ImprovementKind = isImprovementKind(item.kind) ? item.kind : "usability";
  return {
    id: item.id,
    kind,
    screenLabel: item.screenLabel,
    path: item.path,
    routePattern: item.routePattern,
    body: item.body,
    expected: item.expected,
    reporterRoleLabel: roleLabelOf(item.reporterRole),
    statusLabel: improvementStatusLabel(isImprovementStatus(item.status) ? item.status : "open"),
    handledNote: item.handledNote,
    createdAt: item.createdAt,
    hasShot: item.hasShot,
    adminUrl: `${origin}/admin/improvements/${item.id}`,
    appVersion: version,
    diagnostics: parseDiagnostics(item.diagnostics, diagnosticsLevelFor(kind)),
  };
}

export async function buildImprovementInstruction(item: ImprovementForInstruction): Promise<InstructionDraft> {
  const input = await instructionInputOf(item, await appOrigin(), await appVersion());
  return {
    title: buildInstructionTitle(input),
    document: buildInstructionDocument(input),
    kind: input.kind,
    fingerprint: improvementFingerprintOf(item),
  };
}

/**
 * 複数件をまとめた指示文。
 * 版と宛先は1回だけ読む（件数ぶん読み直しても同じ値にしかならない）。
 */
export async function buildBulkImprovementInstruction(items: ImprovementForInstruction[]): Promise<string> {
  const origin = await appOrigin();
  const version = await appVersion();
  const inputs = await Promise.all(items.map((item) => instructionInputOf(item, origin, version)));
  return buildBulkInstructionDocument(inputs);
}

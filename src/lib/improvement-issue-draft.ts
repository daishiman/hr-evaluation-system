/**
 * 届いた要望1件から、記録票の下書きを組み立てる。
 *
 * 詳細画面の下見（何が外へ出るかの確認）と、実際に出す API が
 * **同じ文面**を使うためにここへ集める。別々に組み立てると、
 * 確認した内容と出た内容が食い違い、確認そのものが意味を失う。
 */

import { ROLE_LABEL, type Role } from "@/lib/session";
import { appOrigin } from "@/lib/origin";
import { appVersion } from "@/lib/github-issue";
import { improvementStatusLabel, isImprovementStatus } from "@/lib/domain/improvement";
import { improvementFingerprint } from "@/lib/domain/improvement-sync";
import {
  buildIssueBody,
  buildIssueLabels,
  buildIssueTitle,
  diagnosticsLevelFor,
  isImprovementKind,
  parseDiagnostics,
  type ImprovementKind,
  type RelatedIssue,
} from "@/lib/domain/improvement-issue";

export interface ImprovementForIssue {
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
  /** 送った人の役割。氏名は記録票へ出さないので受け取らない */
  reporterRole: string | null;
  /** open | doing | done | dropped */
  status: string;
  handledNote: string | null;
}

export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
  kind: ImprovementKind;
  /** この文面を作った時点の内容の指紋。次に送るときの「変わったか」の基準になる。 */
  fingerprint: string;
}

function roleLabelOf(role: string | null): string {
  return role && role in ROLE_LABEL ? ROLE_LABEL[role as Role] : "不明";
}

/**
 * 「記録票を作ったあとに変わったか」を見るための指紋。
 *
 * 文面ではなく元の内容から作る。文面にはアプリの版や「似ている記録票」が
 * 混ざるため、こちらの都合（配布・別の要望の起票）で毎回変わってしまい、
 * 中身が同じ記録票に更新コメントが積み上がる。
 */
export function improvementFingerprintOf(item: ImprovementForIssue): string {
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

export async function buildImprovementIssueDraft(
  item: ImprovementForIssue,
  related: RelatedIssue[] = [],
): Promise<IssueDraft> {
  const kind: ImprovementKind = isImprovementKind(item.kind) ? item.kind : "usability";
  const origin = await appOrigin();
  const diagnostics = parseDiagnostics(item.diagnostics, diagnosticsLevelFor(kind));
  const input = {
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
    appVersion: await appVersion(),
    diagnostics,
    related,
  };
  return {
    title: buildIssueTitle(input),
    body: buildIssueBody(input),
    labels: buildIssueLabels(kind, diagnostics, item.routePattern),
    kind,
    fingerprint: improvementFingerprintOf(item),
  };
}

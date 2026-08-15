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
import {
  buildIssueBody,
  buildIssueLabels,
  buildIssueTitle,
  isImprovementKind,
  parseDiagnostics,
  type ImprovementKind,
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
}

export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
  kind: ImprovementKind;
}

function roleLabelOf(role: string | null): string {
  return role && role in ROLE_LABEL ? ROLE_LABEL[role as Role] : "不明";
}

export async function buildImprovementIssueDraft(item: ImprovementForIssue): Promise<IssueDraft> {
  const kind: ImprovementKind = isImprovementKind(item.kind) ? item.kind : "request";
  const origin = await appOrigin();
  const input = {
    kind,
    screenLabel: item.screenLabel,
    path: item.path,
    routePattern: item.routePattern,
    body: item.body,
    expected: item.expected,
    reporterRoleLabel: roleLabelOf(item.reporterRole),
    createdAt: item.createdAt,
    hasShot: item.hasShot,
    adminUrl: `${origin}/admin/improvements/${item.id}`,
    appVersion: await appVersion(),
    diagnostics: parseDiagnostics(item.diagnostics),
  };
  return {
    title: buildIssueTitle(input),
    body: buildIssueBody(input),
    labels: buildIssueLabels(kind),
    kind,
  };
}

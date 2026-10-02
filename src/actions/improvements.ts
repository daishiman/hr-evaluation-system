"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { SMALL_JSON_MAX_BYTES } from "@/lib/api";
import { assertCompanyChosen, type Viewer } from "@/lib/session";
import { IMPROVEMENT_REQUEST_MAX_BYTES } from "@/lib/domain/improvement";
import { DISPOSITION_ACTIONS } from "@/lib/domain/improvement-disposition";
import { improvementSubmitSchema, reporterOf, submitImprovement as saveSubmission } from "@/lib/improvements/submit";
import {
  handlerOf,
  IMPROVEMENT_STATUS_MAX_BYTES,
  improvementStatusSchema,
  updateImprovementStatus as saveStatus,
} from "@/lib/improvements/status";
import { handOutImprovement as recordScreenHandout } from "@/lib/improvement-handout-write";
import { applyDisposition } from "@/lib/improvement-disposition";

/**
 * 改善要望の画面からの書き込み。
 *
 * - 送る（全員）／対応状況を変える（会社の管理者以上）は、中身を src/lib/improvements/ に置き、
 *   公開前の確かめ用に残した Route Handler（POST /api/improvements・PATCH /api/improvements/[id]）と共有する。
 * - 払い出す・落とす・戻す（システム全体管理者だけ）は画面からしか呼ばれないので、ここだけにある。
 *   一覧のまとめ操作は、画面がこれを**1件ずつ順番に**呼ぶ（どこまで進んだかを件数で見せ、
 *   成功した分はその時点で確定し、失敗した行だけやり直せるようにするため）。
 */

const statusSchema = improvementStatusSchema.extend({ id: z.string().min(1).max(60) }).strict();

const handoutSchema = z.object({ id: z.string().min(1).max(60) }).strict();

const disposeSchema = z
  .object({
    id: z.string().min(1).max(60),
    action: z.enum(DISPOSITION_ACTIONS),
    reasonCode: z.string().max(40).default(""),
    reasonNote: z.string().max(1000).default(""),
    duplicateOfId: z.string().max(60).nullish(),
  })
  .strict();

/** 落とす・戻す・払い出すで使う、操作する会社。会社が選ばれていなければ断る。 */
function operatorOf(viewer: Viewer): { id: string; companyId: string } {
  assertCompanyChosen(viewer);
  return { id: viewer.id, companyId: viewer.companyId };
}

/** 改善要望を1件送る。画像を含むので、大きさの上限を Route Handler と同じにする。 */
export async function submitImprovement(raw: unknown) {
  return runAction(
    {
      role: "EMPLOYEE",
      input: improvementSubmitSchema,
      maxBytes: IMPROVEMENT_REQUEST_MAX_BYTES,
      tooLargeMessage: "送信内容が大きすぎます。画像を外すか、撮り直してお試しください。",
    },
    raw,
    async ({ viewer, input }) => {
      const reporter = reporterOf(viewer);
      const userAgent = (await headers()).get("user-agent");
      return saveSubmission(reporter, input, userAgent);
    },
  );
}

/** 要望の対応状況とメモを変える（会社の管理者とシステム全体管理者）。 */
export async function updateImprovementStatus(raw: unknown) {
  return runAction(
    { role: "COMPANY_ADMIN", input: statusSchema, maxBytes: IMPROVEMENT_STATUS_MAX_BYTES },
    raw,
    async ({ viewer, input }) => {
      const { id, ...change } = input;
      return saveStatus(handlerOf(viewer), id, change);
    },
  );
}

/**
 * 選んだ要望1件を払い出し済みにする（システム全体管理者だけ）。
 * 廃棄済み・内容が変わっていないものは渡さず、その理由を結果に載せる。
 */
export async function handOutImprovement(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: handoutSchema, maxBytes: SMALL_JSON_MAX_BYTES }, raw, async ({ viewer, input }) => {
    const result = await recordScreenHandout(operatorOf(viewer), input.id);
    return { result, message: result.reason };
  });
}

/**
 * 要望1件を落とす（対応しない・重複・廃棄）、または戻す（システム全体管理者だけ）。
 * 理由が無い・統合先が無いなどは失敗（ok: false）として返す。
 */
export async function disposeImprovement(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: disposeSchema, maxBytes: SMALL_JSON_MAX_BYTES }, raw, async ({ viewer, input }) => {
    const result = await applyDisposition(operatorOf(viewer), input.id, {
      action: input.action,
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote,
      duplicateOfId: input.duplicateOfId ?? null,
    });
    return { result, message: result.reason };
  });
}

"use server";

import { z } from "zod";
import { runAction, runRead } from "@/lib/action";
import { SMALL_JSON_MAX_BYTES } from "@/lib/api";
import { assertCompanyChosen, HttpError } from "@/lib/session";
import { issueAgentKey, revokeAgentKey as stopAgentKey, setEnvKeyEnabled } from "@/lib/agent-keys";
import {
  approveDeviceGrant,
  denyDeviceGrant,
  findDeviceGrant,
  revokeAgentSession as stopAgentSession,
} from "@/lib/agent-device";
import { agentPromptTextWithKey } from "@/lib/domain/agent-api";
import { agentKeyEnvFileLine, agentKeyLabelError } from "@/lib/domain/agent-keys";
import {
  DEVICE_APPROVED_MESSAGE,
  DEVICE_DENIED_MESSAGE,
  DEVICE_EXPIRED_MESSAGE,
  DEVICE_UNKNOWN_MESSAGE,
  deviceApprovalQuestion,
  normalizeUserCode,
} from "@/lib/domain/agent-device";
import { appOrigin } from "@/lib/origin";

/**
 * Claude Code 連携の鍵と、合言葉で通した端末の管理（どれもシステム全体管理者だけ）。
 *
 * 画面（/system/agent-keys）からしか呼ばれないので Route Handler は置かない。
 * 端末側が使う入口（/api/agent/device・/api/agent/token）はそのまま別にある。
 *
 * 生の鍵は発行の返事に1回だけ載せる。保存もログ出力もしない。
 */

const issueSchema = z.object({ label: z.string().max(200) }).strict();
const idSchema = z.object({ id: z.string().max(100) }).strict();
const envSchema = z.object({ envKeyEnabled: z.boolean() }).strict();
const codeSchema = z.object({ userCode: z.string().max(50) }).strict();
const decideSchema = z.object({ userCode: z.string().max(50), approve: z.boolean() }).strict();

/**
 * 鍵を1本発行する。
 *
 * 発行しても他の鍵は止めない。端末ごと・人ごとに配れることが目的なので、
 * 止めるのは失効の操作だけに寄せる（発行のついでに止まる道を作らない）。
 */
export async function createAgentKey(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: issueSchema, maxBytes: SMALL_JSON_MAX_BYTES }, raw, async ({ viewer, input }) => {
    const labelError = agentKeyLabelError(input.label);
    if (labelError) throw new HttpError(400, labelError);

    // 会社は発行の時点で焼き込む。あとから広げられないので、ここで必ず決める。
    assertCompanyChosen(viewer);
    const { raw: key, prefix } = await issueAgentKey(viewer.id, viewer.companyId, input.label);
    const origin = await appOrigin();
    return {
      // 生の鍵。画面はこれを1回だけ出し、保存しない。
      key,
      prefix,
      envFileLine: agentKeyEnvFileLine(key),
      prompt: agentPromptTextWithKey(origin, "", key),
      message: "鍵を発行しました。いまだけ表示しています。",
    };
  });
}

/**
 * 鍵を1本だけ失効させる。他の鍵は動き続ける。
 * すでに止まっている鍵を押されたときは、成功にせず理由を返す。
 */
export async function revokeAgentKey(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: idSchema, maxBytes: SMALL_JSON_MAX_BYTES }, raw, async ({ viewer, input }) => {
    if (!input.id) throw new HttpError(400, "止める鍵が選ばれていません。");
    const revoked = await stopAgentKey(viewer.id, input.id);
    if (!revoked) throw new HttpError(400, "この鍵はすでに止まっています。");
    return { message: "鍵を止めました。この鍵での受け取りはできなくなります。" };
  });
}

/**
 * サーバーの設定値の鍵を、受け付けるかどうかを切り替える。
 *
 * 設定値そのものはターミナルからしか消せない。画面の鍵を全部止めても
 * 設定値の鍵は残るため、画面だけで完全に止められる道をここで用意する。
 */
export async function setAgentEnvKey(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: envSchema, maxBytes: SMALL_JSON_MAX_BYTES }, raw, async ({ viewer, input }) => {
    await setEnvKeyEnabled(viewer.id, input.envKeyEnabled);
    return {
      message: input.envKeyEnabled
        ? "サーバーの設定値の鍵を、また受け付けます。"
        : "サーバーの設定値の鍵での受け取りを止めました。",
    };
  });
}

/** 打ち込まれた合言葉が何なのかを、押す前に見せる。何も書き換えない。 */
export async function checkDeviceCode(raw: unknown) {
  return runRead({ role: "SUPER_ADMIN", input: codeSchema, maxBytes: SMALL_JSON_MAX_BYTES }, raw, async ({ input }) => {
    const code = normalizeUserCode(input.userCode);
    if (!code) throw new HttpError(400, DEVICE_UNKNOWN_MESSAGE);
    const found = await findDeviceGrant(code);
    if (!found || found.state === "expired") throw new HttpError(404, DEVICE_EXPIRED_MESSAGE);
    if (found.state === "denied") throw new HttpError(400, DEVICE_DENIED_MESSAGE);
    return { question: deviceApprovalQuestion(found.label, found.userCode), state: found.state, message: "" };
  });
}

/**
 * 合言葉を承認する・断る。
 *
 * 会社は承認した人の会社を焼き込む。ここで決めないと、通ったあとに
 * 「どの会社の話か」が決まらないまま読み書きできる端末ができてしまう。
 */
export async function approveDevice(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: decideSchema, maxBytes: SMALL_JSON_MAX_BYTES }, raw, async ({ viewer, input }) => {
    const code = normalizeUserCode(input.userCode);
    if (!code) throw new HttpError(400, DEVICE_UNKNOWN_MESSAGE);

    if (!input.approve) {
      const state = await denyDeviceGrant(code);
      if (state !== "denied") throw new HttpError(400, DEVICE_EXPIRED_MESSAGE);
      return { message: "この端末は通しませんでした。" };
    }

    assertCompanyChosen(viewer);
    const state = await approveDeviceGrant(viewer.id, viewer.companyId, code);
    if (state !== "approved") throw new HttpError(400, DEVICE_EXPIRED_MESSAGE);
    return { message: DEVICE_APPROVED_MESSAGE };
  });
}

/** 通した端末を1台だけ止める。他の端末は動き続ける。 */
export async function revokeAgentSession(raw: unknown) {
  return runAction({ role: "SUPER_ADMIN", input: idSchema, maxBytes: SMALL_JSON_MAX_BYTES }, raw, async ({ viewer, input }) => {
    if (!input.id) throw new HttpError(400, "止める端末が選ばれていません。");
    const revoked = await stopAgentSession(viewer.id, input.id);
    if (!revoked) throw new HttpError(400, "この端末はすでに止まっています。");
    return { message: "この端末からの受け取りを止めました。" };
  });
}

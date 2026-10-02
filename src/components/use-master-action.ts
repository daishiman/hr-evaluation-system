"use client";

import { useState } from "react";
import { useSaveAction } from "@/lib/use-refresh";
import { masterDelete, masterRequest, masterSave, type MasterRequest } from "@/components/master-request";

/** 要件編集の送信と結果表示。入力を閉じる判断・業務条件は各画面に残す。 */
export function useMasterAction(kind: "gradeRequirement" | "promotionRequirement") {
  const { save, saving } = useSaveAction(masterRequest, { resource: "masters" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const execute = async (request: MasterRequest) => {
    setError(null);
    setMessage(null);
    const result = await save(request);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setMessage(result.message);
    return true;
  };

  return {
    saving,
    error,
    message,
    // 成功時だけ入力を閉じられるよう、描画完了を待った結果を返す。
    send: (payload: Record<string, unknown>) => execute(masterSave(payload)),
    remove: (id: string) => execute(masterDelete(kind, id)),
  };
}

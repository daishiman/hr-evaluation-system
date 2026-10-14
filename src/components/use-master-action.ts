"use client";

import { useState } from "react";
import { useSaveAction } from "@/lib/use-refresh";
import { masterDelete, masterRequest, masterSave, type MasterRequest } from "@/components/master-request";
import type { MasterDeleteBody } from "@/lib/masters/body-schema";

/** 制度設定の送信と結果表示。入力を閉じる判断・業務条件は各画面に残す。 */
export function useMasterAction(kind: MasterDeleteBody["kind"]) {
  const { save, saving } = useSaveAction(masterRequest, { resource: "masters" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const clearResult = () => {
    setError(null);
    setMessage(null);
  };

  const execute = async (request: MasterRequest) => {
    clearResult();
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
    clearResult,
    // 並べ替え中だけはfieldsetを止めない（つまみ・矢印のフォーカスを残す）。
    reordering,
    // 成功時だけ入力を閉じられるよう、描画完了を待った結果を返す。
    send: (payload: Record<string, unknown>) => execute(masterSave(payload)),
    sendOrder: async (payload: Record<string, unknown>) => {
      setReordering(true);
      try {
        return await execute(masterSave(payload));
      } finally {
        setReordering(false);
      }
    },
    remove: (id: string) => execute(masterDelete(kind, id)),
  };
}

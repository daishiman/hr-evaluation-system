"use client";

import { useState } from "react";
import { applyFormAlignment, previewFormAlignment } from "@/actions/form-align";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Icon } from "@/components/Icon";
import { RefreshStatus } from "@/components/RefreshStatus";
import { Button, LinkButton, ReasonNote } from "@/components/ui";
import type { AlignDirection } from "@/lib/domain/form-align";
import { useReadAction, useSaveAction } from "@/lib/use-refresh";

type Preview = {
  message: string;
  planKey: string;
  items: { formId: string; direction: AlignDirection; title: string }[];
  failed: { formId: string; title: string; fixHref: string; reason: string }[];
};

/** 一覧の各行に添える「どちらへそろえるか」。結果の文（alignResultMessage）と同じ言い方にする */
const DIRECTION_LABEL: Record<AlignDirection, string> = {
  toForm: "設定に合わせて作り直す",
  toSettings: "下書きの直しを設定へ反映する",
};

/**
 * KPI・評価セットの入口に出す「設定とずれた下書きのアンケート」の知らせ（DD-028 の6・I30）。
 *
 * 件数はサーバーで数えて渡す。0件なら何も出さない（そろえた直後の結果の文だけは残す）。
 * 内容を見る（何も書かない）→ 確認 → そろえる → 結果の文、の順に進む。
 * そろえるときは内容を見たときの印（planKey）を送り、間に保存が入っていたらサーバーが断る。
 */
export function FormAlignNotice({ count }: { count: number }) {
  const { read, reading } = useReadAction(previewFormAlignment, { resource: "form-align" });
  const { save, saving } = useSaveAction(applyFormAlignment, { resource: "form-align" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (count === 0 && !message && !saving) return null;

  const open = async () => {
    setError(null);
    setMessage(null);
    const result = await read(undefined);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreview(result);
  };

  const apply = async () => {
    if (!preview) return;
    setError(null);
    const result = await save({ planKey: preview.planKey });
    // 断られたら一覧は古いので捨てる。もう一度内容を見てから押してもらう
    setPreview(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
  };

  return (
    <div className="mt-3 grid gap-2">
      {count > 0 && (
        <div className="caution-panel ui-notice ui-notice-caution">
          <div className="flex min-w-0 items-start gap-2">
            <Icon name="info" className="reason-note-mark" />
            <div className="min-w-0 flex-1">
              <p className="m-0 font-bold">
                設定とずれた下書きのアンケートが{count}件あります
              </p>
              <p className="m-0 mt-1 text-sub">
                回答の無い下書きは、後から直した方に合わせてそろえられます。回答のあるアンケートと締め切ったアンケートには触れません。
              </p>

              {!preview && (
                <div className="mt-2">
                  <Button onClick={open} disabled={reading || saving}>
                    {reading ? "確かめています…" : "内容を見る"}
                  </Button>
                </div>
              )}

              {preview && (
                <div className="mt-2 grid gap-2">
                  <p className="m-0">{preview.message}</p>
                  {preview.items.length > 0 && (
                    <ul className="m-0 list-disc pl-5">
                      {preview.items.map((item) => (
                        <li key={item.formId}>
                          {item.title}：{DIRECTION_LABEL[item.direction]}
                        </li>
                      ))}
                    </ul>
                  )}
                  {preview.failed.length > 0 && (
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {preview.failed.map((f) => (
                        <li key={f.formId}>
                          <ReasonNote action={<LinkButton href={f.fixHref}>直す画面を開く</LinkButton>}>
                            {f.title}：{f.reason}
                          </ReasonNote>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <ConfirmButton
                      label="そろえる"
                      disabled={preview.items.length === 0}
                      busy={saving}
                      busyLabel="そろえています…"
                      confirm={
                        <>
                          <p className="m-0">{preview.items.length}件の下書きをそろえます。</p>
                          <p className="m-0 mt-1">
                            「設定に合わせて作り直す」下書きは、今の設問が設定から作り直されます。「下書きの直しを設定へ反映する」下書きは、設定の文が下書きに合わせて変わります。
                          </p>
                        </>
                      }
                      onConfirm={apply}
                    >
                      <Button variant="tertiary" onClick={() => setPreview(null)} disabled={saving}>
                        閉じる
                      </Button>
                    </ConfirmButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {error && <ReasonNote>{error}</ReasonNote>}
      <RefreshStatus message={message} refreshing={saving} target="入口" />
    </div>
  );
}

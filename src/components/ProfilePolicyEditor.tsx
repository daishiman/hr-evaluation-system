"use client";

import { saveProfilePolicy } from "@/actions/masters";
import { useSaveAction } from "@/lib/use-refresh";
import { useState } from "react";
import { hasIcon, Icon } from "@/components/Icon";
import { HintToggle, Segmented } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";

/**
 * 「この項目を本人にも変えさせるか」の切り替え。
 *
 * 状態を文で書かず、2択のスイッチそのものを状態表示にする。
 * 押した瞬間に保存し、取り消しは同じ場所をもう一度押すだけにする
 * （保存ボタンを別に置くと「押したのに変わっていない」が起きる）。
 *
 * 保存は1件ずつ。保存中はすべてのスイッチを止め、押した項目の横にだけ状態を出す。
 */

export interface PolicyItem {
  key: string;
  label: string;
  hint: string;
  icon: string;
  selfEditable: boolean;
}

export function ProfilePolicyEditor({ items }: { items: PolicyItem[] }) {
  const { save, saving } = useSaveAction(saveProfilePolicy, { resource: "masters" });
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.key, item.selfEditable])),
  );
  /** いま保存している項目。状態の表示をその項目の横にだけ出すために持つ。 */
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [openHint, setOpenHint] = useState<string | null>(null);

  const setPolicy = async (item: PolicyItem, selfEditable: boolean) => {
    if ((values[item.key] ?? item.selfEditable) === selfEditable || saving) return;
    setPendingKey(item.key);
    setErrors((current) => {
      const next = { ...current };
      delete next[item.key];
      return next;
    });
    setSaved((current) => {
      const next = { ...current };
      delete next[item.key];
      return next;
    });
    const result = await save({ field: item.key, selfEditable });
    if (!result.ok) {
      setErrors((current) => ({ ...current, [item.key]: result.message }));
      return;
    }
    setValues((current) => ({ ...current, [item.key]: selfEditable }));
    setSaved(() => ({
      [item.key]: selfEditable
        ? "本人も変更できるようになりました。"
        : "会社の管理者だけが変更できるようになりました。",
    }));
  };

  return (
    <div className="profile-rows">
      {items.map((item) => {
        const selfEditable = values[item.key] ?? item.selfEditable;
        const savingThis = saving && pendingKey === item.key;
        return (
          <div key={item.key} className="profile-row">
            <span className="profile-row-icon">
              <Icon name={hasIcon(item.icon) ? item.icon : "user"} size={18} />
            </span>

            <div className="min-w-0 flex-1">
              <HintToggle
                open={openHint === item.key}
                onClick={() => setOpenHint(openHint === item.key ? null : item.key)}
              >
                {item.label}
              </HintToggle>
              {openHint === item.key && <p className="profile-row-hint">{item.hint}</p>}
              {errors[item.key] && (
                <p className="profile-row-hint text-danger" role="alert">
                  {errors[item.key]}
                </p>
              )}
              <RefreshStatus
                message={saved[item.key] ?? null}
                refreshing={savingThis}
                target="画面"
                className="profile-saved pop-in"
              />
            </div>

            <Segmented
              label={`${item.label}を変更できる人`}
              value={selfEditable ? "self" : "admin"}
              disabled={saving}
              onChange={(next) => void setPolicy(item, next === "self")}
              options={[
                {
                  value: "admin",
                  label: (
                    <>
                      <Icon name="lock" size={13} />
                      会社の管理者のみ
                    </>
                  ),
                },
                {
                  value: "self",
                  label: (
                    <>
                      <Icon name="pencil" size={13} />
                      本人も
                    </>
                  ),
                },
              ]}
            />
          </div>
        );
      })}
    </div>
  );
}

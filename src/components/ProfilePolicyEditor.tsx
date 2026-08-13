"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hasIcon, Icon } from "@/components/Icon";
import { HintToggle, Segmented } from "@/components/ui";

/**
 * 「この項目を本人にも変えさせるか」の切り替え。
 *
 * 状態を文で書かず、2択のスイッチそのものを状態表示にする。
 * 押した瞬間に保存し、取り消しは同じ場所をもう一度押すだけにする
 * （保存ボタンを別に置くと「押したのに変わっていない」が起きる）。
 */

export interface PolicyItem {
  key: string;
  label: string;
  hint: string;
  icon: string;
  selfEditable: boolean;
}

export function ProfilePolicyEditor({ items }: { items: PolicyItem[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.key, item.selfEditable])),
  );
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [openHint, setOpenHint] = useState<string | null>(null);

  const setPolicy = async (item: PolicyItem, selfEditable: boolean) => {
    if ((values[item.key] ?? item.selfEditable) === selfEditable || pending.has(item.key)) return;
    setPending((current) => new Set(current).add(item.key));
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
    try {
      const res = await fetch("/api/masters/profile-policy", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: item.key, selfEditable }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setErrors((current) => ({ ...current, [item.key]: json.message ?? "保存できませんでした。" }));
        return;
      }
      setValues((current) => ({ ...current, [item.key]: selfEditable }));
      setSaved((current) => ({
        ...current,
        [item.key]: selfEditable
          ? "本人も変更できるようになりました。"
          : "会社の管理者だけが変更できるようになりました。",
      }));
      router.refresh();
    } catch {
      setErrors((current) => ({
        ...current,
        [item.key]: "通信できませんでした。もう一度お試しください。",
      }));
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(item.key);
        return next;
      });
    }
  };

  return (
    <div className="profile-rows">
      {items.map((item) => {
        const selfEditable = values[item.key] ?? item.selfEditable;
        const busy = pending.has(item.key);
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
              {saved[item.key] && (
                <p className="profile-saved pop-in" role="status">
                  <Icon name="check" size={13} />
                  {saved[item.key]}
                </p>
              )}
            </div>

            <Segmented
              label={`${item.label}を変更できる人`}
              value={selfEditable ? "self" : "admin"}
              disabled={busy}
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

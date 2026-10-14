"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { type Column, DataTable } from "@/components/DataTable";
import { InfoTip } from "@/components/InfoTip";
import { InlineDetail } from "@/components/ui";
import type { PermissionRow } from "@/lib/permission-rows";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import type { Grant } from "@/lib/route-access";

/**
 * 権限一覧の表（DD-006）。行は画面、列は4つの役割。
 *
 * - 可否は色だけに頼らず、記号（○・△・—）と言葉（できる・条件つき・できない）を並べる。
 *   記号は読み上げから外し、言葉を読ませる。
 * - 条件つきの欄には「i」（InfoTip）を付け、条件を指す・押す・フォーカスで出す。
 * - 役割のタブで1列に絞れる。タブは ←→・Home・End で移り、移った先をそのまま選ぶ。
 * - 広い容器では表、狭い容器ではカード（DataTable の切り替え）。どちらも同じ行の配列から描く。
 *
 * 権限一覧のページと、利用者一覧・社員一覧から開く窓の両方でこの部品を使う。
 */

const MARK: Record<Grant, string> = { full: "○", conditional: "△", none: "—" };
const WORD: Record<Grant, string> = { full: "できる", conditional: "条件つき", none: "できない" };

type TabKey = Role | "all";

function GrantCell({ row, role }: { row: PermissionRow; role: Role }) {
  const grant = row.byRole[role];
  return (
    <span className="grant" data-grant={grant}>
      <span aria-hidden="true" className="grant-mark">
        {MARK[grant]}
      </span>
      <span>{WORD[grant]}</span>
      {grant === "conditional" && row.condition && <InfoTip label={row.label}>{row.condition}</InfoTip>}
    </span>
  );
}

/** 区分の先頭の行にだけ、サイドバーの区分名を添える（同じ区分の行が続く間は繰り返さない） */
function ScreenCell({ row, groupStart }: { row: PermissionRow; groupStart: boolean }) {
  return (
    <div className="perm-screen">
      {groupStart && <span className="perm-group">{row.group}</span>}
      <span className="perm-screen-name">{row.label}</span>
      {row.summary && <span className="perm-screen-summary">{row.summary}</span>}
      {row.operations.length > 0 && (
        <div className="perm-ops">
          <InlineDetail summary={`この画面の操作（${row.operations.length}）`}>
            <ul>
              {row.operations.map((op) => (
                <li key={op.id}>
                  {op.label}
                  <span className="perm-ops-min">（{op.minRoleLabel}から）</span>
                </li>
              ))}
            </ul>
          </InlineDetail>
        </div>
      )}
    </div>
  );
}

export function PermissionMatrix({ rows, initialRole }: { rows: PermissionRow[]; initialRole?: Role }) {
  const baseId = useId();
  const [selected, setSelected] = useState<TabKey>(initialRole ?? "all");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "全ての役割" },
    ...ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r] })),
  ];
  const tabId = (key: TabKey) => `${baseId}-tab-${key}`;
  const panelId = `${baseId}-panel`;

  /* タブの移動（WAI-ARIA の Tabs: 移った先をそのまま選ぶ形） */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.findIndex((t) => t.key === selected);
    const next =
      e.key === "ArrowRight"
        ? (at + 1) % tabs.length
        : e.key === "ArrowLeft"
          ? (at - 1 + tabs.length) % tabs.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setSelected(tabs[next].key);
    tabRefs.current[next]?.focus();
  };

  const groupStarts = new Set(rows.filter((row, i) => i === 0 || rows[i - 1].group !== row.group).map((r) => r.path));
  const roles = selected === "all" ? ROLES : [selected];
  const columns: Column<PermissionRow>[] = [
    { key: "screen", header: "画面", role: "title", cell: (row) => <ScreenCell row={row} groupStart={groupStarts.has(row.path)} /> },
    ...roles.map((role) => ({
      key: role,
      header: ROLE_LABEL[role],
      cell: (row: PermissionRow) => <GrantCell row={row} role={role} />,
    })),
  ];

  return (
    <div className="perm-matrix">
      <div role="tablist" aria-label="役割で絞る" className="role-tabs" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            aria-selected={selected === t.key}
            id={tabId(t.key)}
            aria-controls={panelId}
            tabIndex={selected === t.key ? 0 : -1}
            type="button"
            className="role-tab"
            onClick={() => setSelected(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="perm-legend footnote">
        <span aria-hidden="true">{MARK.full}</span> {WORD.full}・<span aria-hidden="true">{MARK.conditional}</span>{" "}
        {WORD.conditional}（「i」を指すか押すと条件が出ます）・<span aria-hidden="true">{MARK.none}</span> {WORD.none}
      </p>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selected)}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.path}
          caption={selected === "all" ? "画面ごとに、4つの役割が開けるか" : `画面ごとに、${ROLE_LABEL[selected]}が開けるか`}
          rowData={(row) => ({ "data-permission-row": row.path, "data-group": row.group })}
          cardsData={{ "data-permission-cards": "true" }}
        />
      </div>
    </div>
  );
}

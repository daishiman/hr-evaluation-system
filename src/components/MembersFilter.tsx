"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";

export interface FilterableMember {
  id: string;
  name: string;
  email: string;
  /** 表示用に解決済みのラベル。role の生値と ROLE_LABEL の変換はサーバー側で行う
      （@/lib/session は next/headers に依存しており、クライアント部品からは読み込めない）。 */
  roleLabel: string;
  gradeName: string | null;
  department: string | null;
}

/**
 * 在籍中の一覧を、氏名・等級・所属で絞り込む。
 * サーバーには問い合わせない（在籍者は多くて数百人規模のため、手元の配列を絞るだけで十分）。
 */
export function MembersFilter({ members }: { members: FilterableMember[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => matchMembers(members, query), [members, query]);

  return (
    <div>
      <label className="mb-2 block">
        <span className="sr-only">氏名・等級・所属でしぼる</span>
        <input
          type="search"
          className="input w-full max-w-sm"
          placeholder="氏名・等級・所属で絞り込む"
          aria-describedby="member-filter-count"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p id="member-filter-count" className="footnote m-0 mb-3" role="status" aria-live="polite">
        {filtered.length} / {members.length}人を表示
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="条件に一致する社員がいません" body="別のキーワードを試してください。" />
      ) : (
        <Card>
          {filtered.map((m) => (
            <Link key={m.id} href={`/admin/members/${m.id}`} className="user-row no-underline">
              <Avatar name={m.name} seed={m.id} size={36} />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-body font-semibold text-[var(--ink)]">{m.name}</p>
                <p className="m-0 truncate text-note text-[var(--ink-muted)]">{m.email}</p>
              </div>
              <span className="user-row-tags">
                <span className="tag">
                  <Icon name="shield" size={13} />
                  {m.roleLabel}
                </span>
                <span className="tag">
                  <Icon name="layers" size={13} />
                  {m.gradeName ?? "等級 未設定"}
                </span>
                <span className="tag">
                  <Icon name="building" size={13} />
                  {m.department ?? "所属 未設定"}
                </span>
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

export function matchMembers(members: FilterableMember[], query: string): FilterableMember[] {
  const keyword = query.trim().toLowerCase();
  if (keyword === "") return members;
  return members.filter((m) =>
    [m.name, m.gradeName, m.department].some((field) => field?.toLowerCase().includes(keyword)),
  );
}

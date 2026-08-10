"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 現在地を常に見える状態にする（aria-current でスタイルも切り替わる）。 */
export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rounded-md px-3 py-1.5 text-[13px] no-underline"
      style={
        active
          ? { color: "var(--brand-deep)", background: "var(--brand-soft)", fontWeight: 600 }
          : { color: "var(--ink-muted)" }
      }
    >
      {label}
    </Link>
  );
}

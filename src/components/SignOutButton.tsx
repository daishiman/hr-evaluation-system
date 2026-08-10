"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-tertiary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      {busy ? "ログアウト中…" : "ログアウト"}
    </button>
  );
}

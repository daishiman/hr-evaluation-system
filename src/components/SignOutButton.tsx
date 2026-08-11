"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="tertiary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      {busy ? "ログアウト中…" : "ログアウト"}
    </Button>
  );
}

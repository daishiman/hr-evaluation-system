"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/** 404/権限境界から、直前に見ていた一覧へ戻る共通の回復操作。 */
export function BackButton({ label = "前の画面へ戻る" }: { label?: string }) {
  const router = useRouter();
  return (
    <Button variant="secondary" onClick={() => router.back()}>
      {label}
    </Button>
  );
}

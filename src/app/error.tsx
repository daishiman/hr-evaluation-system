"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="narrow-form text-center" role="alert">
      <h1 className="page-title">画面を表示できませんでした</h1>
      <p className="page-lede">
        入力中の内容はこの画面に残っている場合があります。まず、もう一度読み込んでください。
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => reset()}>
          もう一度読み込む
        </Button>
        <LinkButton href="/" variant="secondary">
          ホームへ戻る
        </LinkButton>
      </div>
    </main>
  );
}

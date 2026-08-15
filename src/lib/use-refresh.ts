"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * 保存・実行のあと、画面の中身を出し直すための唯一の入口。
 *
 * この画面の一覧・集計・残数はサーバー側で作っている。保存しても、
 * サーバーにもう一度作らせない限り古い中身のままになる。
 * それを頼むのが `router.refresh()` で、既に各所から呼んでいた。
 *
 * にもかかわらず「リロードしないと反映されない」と見えていたのは、
 * **頼んだことが画面に出ていなかった**ため。
 * `router.refresh()` は投げっぱなしで、返ってくるまでのあいだ
 * 画面には「保存しました」だけが出て一覧は古いまま。利用者は
 * 反映されていないと判断して、自分でページを読み直していた。
 *
 * ここでは `startTransition` の中で頼むことで、**出し直しが終わるまで**
 * `refreshing` を true にする。呼ぶ側はこの間だけ「一覧に反映しています…」を
 * 出し、終わったら文言を切り替える。待つ時間そのものは変わらないが、
 * 「頼んである・まだ終わっていない」が見えるので読み直しが要らなくなる。
 *
 * `router.refresh()` を直接呼んでよいのはこのファイルだけ（ui-rules.test.ts
 * が見張っている）。画面ごとに待ち方が違うと、反映されたのかどうかの見え方が
 * 画面ごとにばらつく。
 */
export function useRefreshAfterSave(): {
  /** 保存・実行が成功したあとに呼ぶ。画面の中身をサーバーに作り直させる */
  refresh: () => void;
  /** 作り直しが終わるまで true。この間は「反映しています…」を出す */
  refreshing: boolean;
} {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return { refresh, refreshing };
}

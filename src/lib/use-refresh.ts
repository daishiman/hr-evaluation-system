"use client";

import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useState, useTransition } from "react";
import type { ActionResult, SaveAction } from "@/lib/action-result";
import { announceChange, type FreshnessResource } from "@/lib/freshness";
import { recordActionCall } from "@/lib/usage-client";

/**
 * 表示中の画面を取り直す（保存を伴わないとき）。
 *
 * 使うのは、ログイン・ログアウトのように画面ごと切り替わるときと、
 * 他のタブでの保存やタブへの復帰を受けて取り直す見張り役（FreshnessSync）。
 * 画面からの保存は useSaveAction を使う。保存の応答に新しい画面が同梱されるので、
 * 別に取り直しを頼む必要がない。
 * 取り直しの間を見せる部品はないので、待っている状態は返さない。
 */
export function useRouterRefresh(): { refresh: () => void } {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);
  return { refresh };
}

/** 送れなかったとき（通信が切れた・画面が古い）に出す言葉。入力は消さずに残す。 */
export const NETWORK_FAILURE_MESSAGE = "送れませんでした。通信を確かめて、もう一度押してください。";
export const STALE_PAGE_MESSAGE = "画面が古くなっています。再読み込みしてから送ってください。";

/**
 * 送信そのものが失敗したときの言葉を選ぶ。
 *
 * 新しい版を公開すると、開いたままの古い画面が持つ書き込みの宛先は使えなくなる
 * （Next.js が公開ごとに宛先の識別子を入れ替えるため）。そのときは
 * 「もう一度押す」では直らないので、読み直しを案内する。
 */
export function failureMessageOf(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  return /Server Action|unexpected response/i.test(text) ? STALE_PAGE_MESSAGE : NETWORK_FAILURE_MESSAGE;
}

/**
 * 画面からの保存。Server Action を呼び、結果を値で返す。
 *
 * - 保存中は saving が true。ボタンを押せなくし、状態の表示（RefreshStatus）に結び付ける。
 * - 成功した応答には、保存後の画面が同梱されている（サーバー側の refresh()）。
 *   一覧・件数・メニューは応答と同時に入れ替わるので、別に取り直さない。
 * - 結果を返すのは、その新しい画面が描き終わってから（O1）。成功の言葉が古い一覧の上に出ない。
 * - 成功したら、同じブラウザの他のタブへ「変わった」と知らせる（D-001）。
 * - 送信自体が失敗しても例外にせず { ok: false } で返す。入力欄は呼び出し側が残す。
 */
export function useSaveAction<I, T extends object>(
  action: SaveAction<I, T>,
  options: { resource: FreshnessResource },
): { save: (input: I) => Promise<ActionResult<T>>; saving: boolean } {
  const { call, pending } = useActionCall(action, options.resource, true);
  return { save: call, saving: pending };
}

/**
 * 読み出しだけの Server Action（runRead）を呼ぶ。
 *
 * useSaveAction と同じく結果を値で返すが、何も変えていないので
 * 他のタブへ「変わった」とは知らせない（知らせると他のタブが無駄に描き直す）。
 * 取り込み前の確認や、初期パスワードの控えを開くときに使う。
 */
export function useReadAction<I, T extends object>(
  action: SaveAction<I, T>,
  options: { resource: FreshnessResource },
): { read: (input: I) => Promise<ActionResult<T>>; reading: boolean } {
  const { call, pending } = useActionCall(action, options.resource, false);
  return { read: call, reading: pending };
}

/**
 * 呼び出し元へ結果を渡すのを、画面への反映が済むまで待たせる関所。
 *
 * Server Action の応答に入った新しい画面は transition として描かれる。一方、
 * `await save()` の後に呼び出し元が出す成功の言葉は通常の更新なので、そのまま返すと
 * 言葉が先に描かれ、一覧・件数はあとから追いつく（O1 に反する）。
 * 同じ transition に「描き終わり」の印を載せ、その印が画面に入ったところで release する。
 */
export function createCommitGate() {
  let waiting: (() => void)[] = [];
  let closed = false;
  const release = () => {
    const settled = waiting;
    waiting = [];
    for (const done of settled) done();
  };
  return {
    open() {
      closed = false;
    },
    wait(done: () => void) {
      if (closed) {
        done();
        return false;
      }
      waiting.push(done);
      return true;
    },
    release,
    close() {
      closed = true;
      release();
    },
  };
}

function useActionCall<I, T extends object>(action: SaveAction<I, T>, resource: FreshnessResource, announce: boolean) {
  const [pending, startTransition] = useTransition();
  const [gate] = useState(createCommitGate);
  /** 「描き終わり」の印。応答の新しい画面と同じ transition で進める */
  const [settled, setSettled] = useState(0);

  // 印が DOM に入った直後（描く前）に返す。続く成功の言葉もほぼ同じ描画に乗る
  useLayoutEffect(() => gate.release(), [settled, gate]);
  // 保存の結果で部品ごと消えたとき（削除した行など）も、呼び出し元を待たせたままにしない
  useLayoutEffect(() => {
    // Strict Mode の effect 再設定でも、同じ gate を再び使えるようにする。
    gate.open();
    return () => gate.close();
  }, [gate]);

  const call = useCallback(
    (input: I) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          const started = performance.now();
          let result: ActionResult<T>;
          try {
            result = await action(input);
          } catch (e) {
            result = { ok: false, message: failureMessageOf(e) };
          }
          recordActionCall(resource, performance.now() - started, result.ok);
          if (announce && result.ok) announceChange(resource);
          if (!gate.wait(() => resolve(result))) return;
          // await の後の更新は、包み直さないと transition に入らない（React の決まり）
          startTransition(() => setSettled((n) => n + 1));
        });
      }),
    [action, resource, announce, gate],
  );

  return { call, pending };
}

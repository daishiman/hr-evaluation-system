/**
 * 「別の画面で保存した」を、同じブラウザの他のタブへ知らせる（D-001）。
 *
 * 使われる場面: 書き込みが成功したとき（useSaveAction）と、全画面共通の
 * 見張り役（FreshnessSync）。知らせを受けたタブは、表示中の画面を取り直す。
 *
 * ── 送るもの ──
 * 「何の種類が・いつ変わったか」だけ。値（氏名・点数など）は送らない。
 * 同じブラウザの中だけで届く仕組み（BroadcastChannel）なので外へは出ないが、
 * 受け手は取り直すだけで中身を使わないため、送る必要がない。
 *
 * ── 自分には届かない ──
 * 送る口と受ける口を同じ1つの BroadcastChannel にしている。仕様上、送った
 * そのオブジェクト自身には届かないので、保存したタブが二重に取り直すことはない。
 * 保存したタブは Server Action の応答で既に新しい画面を受け取っている。
 */

export const FRESHNESS_CHANNEL = "hr-evaluation:freshness";

/**
 * 変わったものの種類。画面からの書き込み（useSaveAction・useReadAction）が名乗り、
 * 他のタブへの知らせと利用状況の集計（/actions/<種類> の行）に使う。
 *
 * 名前は src/actions のファイル名にそろえる。取り込み（member-import・response-import）は、
 * 取り込み先の members・responses を名乗る。書き間違えると、集計で同じ操作が別の行に散る。
 */
export type FreshnessResource =
  | "account"
  | "agent-keys"
  | "companies"
  | "company-scope"
  | "credential-memos"
  | "cycles"
  | "evaluations"
  | "form-extensions"
  | "forms"
  | "improvements"
  | "kgi-results"
  | "masters"
  | "members"
  | "notes"
  | "responses"
  | "scheme"
  | "system-users";

export interface FreshnessMessage {
  kind: "saved";
  /**
   * 変わったものの種類（"members" など）。受け手は今のところ区別せず取り直す。
   * 送るときは FreshnessResource に限るが、受け取るときは文字列のまま扱う
   * （種類の一覧が違う版のタブからも届きうる。区別しないので検査しない）。
   */
  resource: string;
  at: number;
}

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(FRESHNESS_CHANNEL);
  } catch {
    // 使えない環境（古い端末・制限付きの表示）では知らせない。各タブは戻ったときに取り直す
    channel = null;
  }
  return channel;
}

export function isFreshnessMessage(data: unknown): data is FreshnessMessage {
  if (!data || typeof data !== "object") return false;
  const m = data as Partial<FreshnessMessage>;
  return m.kind === "saved" && typeof m.resource === "string" && typeof m.at === "number";
}

/** 保存できたことを他のタブへ知らせる。知らせられなくても保存そのものは済んでいる。 */
export function announceChange(resource: FreshnessResource, now: number = Date.now()): void {
  const c = getChannel();
  if (!c) return;
  const message: FreshnessMessage = { kind: "saved", resource, at: now };
  try {
    c.postMessage(message);
  } catch {
    // 閉じかけのタブなどで送れないことがある。取り直しは戻ったときに行われる
  }
}

/** 他のタブからの知らせを受け取る。返り値を呼ぶと受け取りをやめる。 */
export function subscribeChanges(onChange: (message: FreshnessMessage) => void): () => void {
  const c = getChannel();
  if (!c) return () => {};
  const listener = (event: MessageEvent) => {
    if (isFreshnessMessage(event.data)) onChange(event.data);
  };
  c.addEventListener("message", listener);
  return () => c.removeEventListener("message", listener);
}

/**
 * 取り直しを間引く間隔。
 *
 * タブを行き来するたび・知らせが続けて届くたびに取り直すと、一覧の多い画面で
 * 通信が積み上がる。この間隔の中では1回にまとめる（最後の知らせは必ず反映する）。
 */
export const FRESHNESS_THROTTLE_MS = 1500;

/**
 * 間引き付きで関数を呼ぶ口を作る。
 *
 * 間隔の中に来た呼び出しは捨てずに、間隔が明けたところで1回だけ呼ぶ。
 * 捨てると「最後に届いた保存」が反映されないまま残るため。
 */
export function throttleTrailing(fn: () => void, intervalMs: number, now: () => number = Date.now) {
  let last = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fire = () => {
    timer = null;
    last = now();
    fn();
  };

  const call = () => {
    const wait = last + intervalMs - now();
    if (wait <= 0 && timer === null) {
      fire();
      return;
    }
    if (timer === null) timer = setTimeout(fire, Math.max(0, wait));
  };

  call.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  /** 間隔を待たずに今すぐ呼ぶ。待っていた呼び出しはこれにまとめ、ここから間隔を数え直す。 */
  call.now = () => {
    call.cancel();
    fire();
  };
  return call;
}

/** 見張りが使うブラウザの部品。試験では作り物を渡す */
export interface FreshnessHost {
  document: EventTarget & { readonly visibilityState: DocumentVisibilityState };
  window: EventTarget;
}

/**
 * 表示中の画面を取り直すきっかけを見張る（FreshnessSync の中身）。返り値を呼ぶと見張りをやめる。
 *
 * 1. 他のタブでの保存の知らせ。このタブが裏にあるときは取り直さない（表に戻ったときに 2 で取り直す）
 * 2. タブ・アプリに戻ってきた（visibilitychange）
 * 3. bfcache から画面がそのまま戻った（pageshow の persisted）と、通信が戻った（online）
 *
 * 3 の pageshow は、Next.js のルーターも同じきっかけで「履歴に控えた画面へ戻す」（RESTORE）を出す。
 * ルーターは RESTORE のとき実行中の取り直しを捨てる（discarded）ので、先に取り直すと
 * 結果が捨てられ、古い画面のまま残る。ルーターが戻し終えた後（次のタスク）に取り直す。
 */
export function watchFreshness(refresh: () => void, host: FreshnessHost): () => void {
  const throttled = throttleTrailing(refresh, FRESHNESS_THROTTLE_MS);
  let afterRestore: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = subscribeChanges(() => {
    if (host.document.visibilityState === "hidden") return;
    throttled();
  });

  const onVisibility = () => {
    if (host.document.visibilityState === "visible") throttled();
  };
  const onPageShow = (event: Event) => {
    if (!(event as PageTransitionEvent).persisted) return;
    if (afterRestore !== null) clearTimeout(afterRestore);
    afterRestore = setTimeout(() => {
      afterRestore = null;
      // 直前に visibilitychange などで取り直していると（ルーターに捨てられる方）、間引くと
      // 戻した後の取り直しが間隔の明けるまで待たされ、その間は古い画面が残る。ここは間引かない
      throttled.now();
    }, 0);
  };
  const onOnline = () => throttled();

  host.document.addEventListener("visibilitychange", onVisibility);
  host.window.addEventListener("pageshow", onPageShow);
  host.window.addEventListener("online", onOnline);

  return () => {
    unsubscribe();
    throttled.cancel();
    if (afterRestore !== null) clearTimeout(afterRestore);
    host.document.removeEventListener("visibilitychange", onVisibility);
    host.window.removeEventListener("pageshow", onPageShow);
    host.window.removeEventListener("online", onOnline);
  };
}

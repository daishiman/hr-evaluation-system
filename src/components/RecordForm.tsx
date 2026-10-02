"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, Card, ReasonNote } from "@/components/ui";
import { RefreshStatus } from "@/components/RefreshStatus";
import { useSaveAction } from "@/lib/use-refresh";
import type { SaveAction } from "@/lib/action-result";
import type { FreshnessResource } from "@/lib/freshness";
import { NumberField } from "@/components/NumberField";
import { checkBounds, parseNumberInput, type NumberFieldPolicy } from "@/lib/domain/number-input";
import { generateInitialPassword } from "@/lib/domain/initial-password";

/**
 * 管理画面の小さな入力フォーム（共通）。
 *
 * 入力の作法を1組に揃えるためにここへ集約する。
 *  - Enter は「次の欄へ移動」。送信はボタンだけ（日本語変換の確定Enterでは何も起きない）。
 *  - 数値欄は右寄せ・数字キーボード。
 *  - 保存に失敗しても入力内容は消さない。
 *  - 保存は Server Action（action）で行う。成功の応答に保存後の画面が同梱されるので、
 *    一覧は保存と同時に新しくなる（取り直しを頼み忘れる余地を作らない）。
 *  - 発行した値（generate の欄）の控えは、成功の知らせの後ろに畳んで置く。
 *    連続作成で確かめたいのは一覧の新しい行なので、控えで一覧を押し下げない。
 *    控えを保存できなかったとき（一覧から開き直せないとき）だけ、最初から開いておく。
 */

export type FieldSpec =
  | {
      name: string;
      label: string;
      type: "text" | "email" | "password" | "date";
      required?: boolean;
      placeholder?: string;
      help?: string;
      defaultValue?: string;
      /**
       * 開いたときに作った値を初期表示する（発行して相手に渡すパスワード向け）。
       * 渡す側が読み上げ・書き写しをするため、伏せ字にせずそのまま見せる。
       */
      generate?: boolean;
    }
  | {
      name: string;
      label: string;
      type: "number";
      required?: boolean;
      help?: string;
      defaultValue?: number | null;
      unit?: string;
      /**
       * 数値の決まり（マイナス・小数を許すか、上下限）。
       * 指定しない場合は「0以上・小数あり」。欄ごとに決められるようにしているのは、
       * 一律に禁止すると行動指針の -1 点や達成率の小数が入らなくなるため。
       */
      policy?: NumberFieldPolicy;
    }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean; help?: string; defaultValue?: string }
  | { name: string; label: string; type: "checkbox"; help?: string; defaultValue?: boolean }
  | { name: string; label: string; type: "textarea"; required?: boolean; help?: string; defaultValue?: string };

export function RecordForm({
  action,
  resource,
  fields,
  fixed,
  submitLabel,
  title,
  description,
  resetAfterSubmit,
  onSaved,
  boundsPair,
}: {
  /** 保存する Server Action（src/actions/*）。入力の検査と権限の確認はその中で行う */
  action: SaveAction<Record<string, unknown>>;
  /** 保存したものの種類。他のタブへの知らせと利用状況の集計に使う */
  resource: FreshnessResource;
  fields: FieldSpec[];
  /** 画面に出さずに一緒に送る値（対象のIDなど） */
  fixed?: Record<string, unknown>;
  submitLabel: string;
  title?: string;
  description?: string;
  resetAfterSubmit?: boolean;
  /** 保存できたときに呼ぶ。開いたときだけ読む画面で、控えを捨てて読み直すために使う */
  onSaved?: () => void;
  /**
   * 「下限の欄」「上限の欄」の名前の組。指定すると、送る前に組み合わせの矛盾を断る。
   * 関数ではなく欄の名前で渡すのは、この画面を出しているのがサーバー側の部品で、
   * 関数をそのまま渡せないため。
   * 同じ判定はサーバー側にも置く（画面を通さずに送られたときに素通りしないため）。
   */
  boundsPair?: { lower: string; upper: string };
}) {
  const { save, saving } = useSaveAction(action, { resource });
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* 作ったパスワード。サーバーで描いたHTMLと食い違わないよう、画面が出てから作る
     （サーバーとブラウザで別々の乱数になると React が警告を出す）。 */
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [issuedGenerated, setIssuedGenerated] = useState<Record<string, string> | null>(null);
  /** 控えをサーバーに保存できたか（一覧の行から開き直せるか）。値そのものはサーバーから受け取らない */
  const [memoStored, setMemoStored] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const memoId = useId();
  const [copied, setCopied] = useState<string | null>(null);
  const generateNames = fields
    .filter((f) => "generate" in f && f.generate)
    .map((f) => f.name)
    .join(",");

  useEffect(() => {
    if (generateNames === "") return;
    const made: Record<string, string> = {};
    for (const name of generateNames.split(",")) made[name] = generateInitialPassword();
    setGenerated(made);
  }, [generateNames]);

  const beginNextSubmission = () => {
    const made: Record<string, string> = {};
    for (const name of generateNames.split(",").filter(Boolean)) made[name] = generateInitialPassword();
    setGenerated(made);
    setIssuedGenerated(null);
    setMemoStored(false);
    setMemoOpen(false);
    setCopied(null);
    setMessage(null);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return;
    const t = e.target as HTMLElement;
    if (t.tagName === "TEXTAREA") return;
    // 日本語変換の確定Enterでは何もしない
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    e.preventDefault();
    const els = Array.from(formRef.current?.elements ?? []).filter(
      (x): x is HTMLElement => x instanceof HTMLElement && !(x instanceof HTMLButtonElement),
    );
    const i = els.indexOf(t);
    if (i >= 0 && i + 1 < els.length) els[i + 1].focus();
  };

  const submit = async () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const payload: Record<string, unknown> = { ...fixed };
    for (const f of fields) {
      const raw = fd.get(f.name);
      if (f.type === "checkbox") {
        payload[f.name] = raw === "on";
        continue;
      }
      const str = typeof raw === "string" ? raw.trim() : "";
      if (f.type === "number") {
        /* 空欄は null のまま送る。0 に置き換えない（空欄と 0 は意味が違う）。 */
        const parsed = parseNumberInput(str, f.policy);
        if (parsed.kind === "invalid") {
          setError(`「${f.label}」：${parsed.reason}`);
          return;
        }
        payload[f.name] = parsed.kind === "empty" ? null : parsed.value;
        continue;
      }
      payload[f.name] = str === "" ? null : str;
    }

    if (boundsPair) {
      const lower = payload[boundsPair.lower];
      const upper = payload[boundsPair.upper];
      const r = checkBounds(typeof lower === "number" ? lower : null, typeof upper === "number" ? upper : null);
      if (!r.ok) {
        setError(r.message);
        return;
      }
    }

    const missing = fields.find((f) => "required" in f && f.required && (payload[f.name] === null || payload[f.name] === ""));
    if (missing) {
      setError(`「${missing.label}」を入力してください。`);
      return;
    }

    setError(null);
    setMessage(null);
    const result = await save(payload);
    if (!result.ok) {
      // 入力欄はそのまま残す（直して押し直せるように）
      setError(result.message);
      return;
    }
    setMessage(result.message);
    if (resetAfterSubmit) {
      if (generateNames !== "") {
        // サーバーへ送った値を控えとして残す。次の値は、管理者がこの控えを
        // 写し終えて「次の入力」を始めるまで作らない。
        // 一覧は保存の応答で新しくなっているが、この部品の状態は描き直しでは消えない。
        const issued: Record<string, string> = {};
        for (const name of generateNames.split(",")) issued[name] = String(payload[name] ?? "");
        setIssuedGenerated(issued);
        // 保存できたと言い切れないとき（返り値に印が無いときも）は、開き直せない前提で開いておく
        const stored = "memoStored" in result && result.memoStored === true;
        setMemoStored(stored);
        setMemoOpen(!stored);
      } else {
        form.reset();
      }
    }
    onSaved?.();
  };

  return (
    <Card className="card-pad">
      {title && <p className="section-heading m-0 mb-1">{title}</p>}
      {description && <p className="footnote m-0 mb-3">{description}</p>}
      {issuedGenerated === null && (
        <form
          ref={formRef}
          onKeyDown={onKeyDown}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="field-grid"
        >
          {fields.map((f) => (
          <label key={f.name} className={f.type === "textarea" ? "md:col-span-2" : undefined}>
            <span className="block text-note text-ink-muted">
              {f.label}
              {"required" in f && f.required && <span className="ml-1 text-danger">必須</span>}
            </span>
            {f.type === "select" ? (
              <select name={f.name} defaultValue={f.defaultValue ?? ""} className="input mt-1 w-full">
                {/* 「空欄」に意味がある項目（例: 適用しない）は自前の選択肢を持っているので、案内文の行を足さない */}
                {!f.options.some((o) => o.value === "") && <option value="">選択してください</option>}
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "checkbox" ? (
              <span className="mt-1 flex items-center gap-2 text-sub">
                <input type="checkbox" name={f.name} defaultChecked={f.defaultValue ?? false} />
                {f.help}
              </span>
            ) : f.type === "textarea" ? (
              <textarea name={f.name} defaultValue={f.defaultValue ?? ""} rows={3} className="input mt-1 w-full" />
            ) : f.type === "number" ? (
              <span className="mt-1 block">
                <NumberField name={f.name} defaultValue={f.defaultValue ?? null} policy={f.policy} unit={f.unit} />
              </span>
            ) : "generate" in f && f.generate ? (
              /* 発行して相手に渡す値。伏せ字にすると渡す側が読めないので、そのまま見せる。
                 打ち直しもできるが、初期表示は必ず作った値にする */
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  name={f.name}
                  type="text"
                  value={generated[f.name] ?? ""}
                  onChange={(e) => {
                    setGenerated((s) => ({ ...s, [f.name]: e.target.value }));
                    setCopied(null);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  className="input input-code w-full sm:w-64"
                />
                <Button
                  type="button"
                  onClick={() => {
                    setGenerated((s) => ({ ...s, [f.name]: generateInitialPassword() }));
                    setCopied(null);
                  }}
                >
                  作り直す
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(generated[f.name] ?? "")
                      .then(() => setCopied(f.name))
                      .catch(() => setCopied(null));
                  }}
                >
                  {copied === f.name ? "写しました" : "写す"}
                </Button>
              </span>
            ) : (
              <input
                name={f.name}
                type={f.type === "date" ? "date" : f.type}
                defaultValue={"defaultValue" in f ? (f.defaultValue ?? "") : ""}
                placeholder={"placeholder" in f ? f.placeholder : undefined}
                autoComplete={f.type === "password" ? "new-password" : "off"}
                enterKeyHint="next"
                className="input mt-1 w-full"
              />
            )}
            {f.help && f.type !== "checkbox" && <span className="footnote block">{f.help}</span>}
          </label>
          ))}
          <div className="md:col-span-2">
            {/* 一覧へ反映し終わるまで押せないままにする。二度押しで同じものが2件できるのを防ぐ */}
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "保存しています…" : submitLabel}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <div className="mt-3">
          <ReasonNote>{error}</ReasonNote>
        </div>
      )}
      {/* 保存できたことと、一覧へ出し終えたことを分けて出す。
          「保存しました」だけを出して黙ると、一覧が古いままの数秒を
          「反映されていない」と受け取られ、ページの読み直しを促してしまう。 */}
      <RefreshStatus message={message} refreshing={saving} className="m-0 mt-3 text-sub text-brand-deep" />
      {/* 控えは成功の知らせの後ろに畳んで置く（一覧の新しい行 ＞ 成功の知らせ ＞ 控え）。
          開いたときだけ値を描く。畳んでいる間は値を画面の要素に残さない */}
      {issuedGenerated !== null && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              aria-expanded={memoOpen}
              aria-controls={memoOpen ? memoId : undefined}
              onClick={() => setMemoOpen((open) => !open)}
            >
              {memoOpen ? "控えを隠す" : "仮パスワードの控えを見る"}
            </Button>
            <Button type="button" variant="tertiary" onClick={beginNextSubmission}>
              次の入力を始める
            </Button>
          </div>
          {memoOpen && (
            <div id={memoId} className="field-grid mt-3" role="group" aria-label="今回発行した仮パスワードの控え">
              <div className="md:col-span-2">
                <ReasonNote>
                  {memoStored
                    ? "今回発行した値です。隠したあとも、一覧の行の「仮パスワードの控えを見る」から開き直せます。"
                    : "今回発行した値です。控えは保存していません。この画面を離れる前に、ご本人へ伝えるか控えてください。"}
                </ReasonNote>
              </div>
              {Object.entries(issuedGenerated).map(([name, value]) => (
                <label key={name}>
                  <span className="block text-note text-ink-muted">
                    {fields.find((field) => field.name === name)?.label ?? name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <input className="input input-code w-full sm:w-64" type="text" value={value} readOnly />
                    <Button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(value)
                          .then(() => setCopied(name))
                          .catch(() => setCopied(null));
                      }}
                    >
                      {copied === name ? "写しました" : "写す"}
                    </Button>
                  </span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

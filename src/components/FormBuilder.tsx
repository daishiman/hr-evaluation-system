"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHead, CardRow, ReasonNote } from "@/components/ui";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { NumberField } from "@/components/NumberField";
import { SECTION_LABEL, SECTION_ORDER } from "@/lib/view";

/**
 * アンケートの設問をクリックで組み立てる画面。
 *
 * 設問文を打ち込む以外は、すべてボタンで完結するようにしている
 * （種類を選ぶ・並べ替える・選択肢を足す）。
 * 集計に使う紐づけ（等級要件・KPI項目）は編集させない。ここを人が触ると
 * 「何の実績としてカウントするか」が分からなくなるため、表示だけにとどめる。
 */

export interface BuilderQuestion {
  id?: string;
  section: string;
  questionType: string;
  title: string;
  helpText: string | null;
  unit: string | null;
  required: boolean;
  validationMin: number | null;
  validationMax: number | null;
  validationInteger: boolean;
  options: { value: string; label: string; score?: number }[];
  isGate: boolean;
  linkLabel: string | null;
  gradeRequirementId: string | null;
  promotionRequirementId: string | null;
  behaviorGuidelineId: string | null;
  kpiItemId: string | null;
  kpiQuestionKey: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  yesno: "はい / いいえ",
  single: "1つ選ぶ",
  multi: "いくつでも選ぶ",
  number: "数値を入れる",
  text: "文章で書く",
  scale: "段階で選ぶ",
};

export function FormBuilder({
  formId,
  initial,
  editable,
  lockReason,
}: {
  formId: string;
  initial: BuilderQuestion[];
  editable: boolean;
  lockReason?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BuilderQuestion[]>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const patch = (i: number, p: Partial<BuilderQuestion>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const add = (section: string, questionType: string) =>
    setRows((prev) => [
      ...prev,
      {
        section,
        questionType,
        title: "",
        helpText: null,
        unit: null,
        required: true,
        validationMin: questionType === "number" ? 0 : null,
        validationMax: null,
        /* 単位が決まっていない新しい設問は、まず小数を許す側にしておく。
           分からないものを止めると、打てるはずの値が打てなくなる。 */
        validationInteger: false,
        options:
          questionType === "single" || questionType === "multi"
            ? [
                { value: "1", label: "選択肢1" },
                { value: "2", label: "選択肢2" },
              ]
            : [],
        isGate: false,
        linkLabel: null,
        gradeRequirementId: null,
        promotionRequirementId: null,
        behaviorGuidelineId: null,
        kpiItemId: null,
        kpiQuestionKey: null,
      },
    ]);

  const save = async () => {
    const blank = rows.findIndex((r) => !r.title.trim());
    if (blank >= 0) {
      setError(`${blank + 1}問目の設問文が空です。入力してから保存してください。`);
      setOpenId(blank);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/forms/${formId}/questions`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questions: rows.map((r) => ({
            id: r.id,
            section: r.section,
            questionType: r.questionType,
            title: r.title,
            helpText: r.helpText,
            unit: r.unit,
            required: r.required,
            validationMin: r.validationMin,
            validationMax: r.validationMax,
            validationInteger: r.validationInteger,
            options: r.options.length > 0 ? r.options : undefined,
            isGate: r.isGate,
            gradeRequirementId: r.gradeRequirementId,
            promotionRequirementId: r.promotionRequirementId,
            behaviorGuidelineId: r.behaviorGuidelineId,
            kpiItemId: r.kpiItemId,
            kpiQuestionKey: r.kpiQuestionKey,
          })),
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "保存できませんでした。");
        return;
      }
      setMessage(json.message ?? "保存しました。");
      router.refresh();
    } catch {
      setError("通信できませんでした。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  };

  if (!editable) {
    return (
      <>
        <ReasonNote>{lockReason ?? "このアンケートは編集できません。"}</ReasonNote>
        <div className="mt-3">
          <QuestionList rows={rows} />
        </div>
      </>
    );
  }

  return (
    <>
      {error && <ReasonNote>{error}</ReasonNote>}
      {message && <p className="m-0 mb-3 text-[13px] text-[var(--brand-deep)]">{message}</p>}

      <div className="grid gap-3">
        {rows.map((r, i) => (
          <Card key={i} className="card-pad">
            <CardHead
              title={
                <>
                  <span className="num mr-2 text-[var(--ink-muted)]">{i + 1}.</span>
                  {r.title || <span className="text-[var(--ink-muted)]">（設問文が未入力です）</span>}
                </>
              }
              sub={
                <>
                  {SECTION_LABEL[r.section] ?? r.section} ／ {TYPE_LABEL[r.questionType] ?? r.questionType}
                  {r.unit ? ` ／ 単位 ${r.unit}` : ""} ／ {r.required ? "必須" : "任意"}
                </>
              }
              detail={r.linkLabel ? <p className="footnote m-0 mt-1">集計との紐づけ：{r.linkLabel}</p> : undefined}
              actions={
                <>
                  {r.isGate && <Badge tone="alert">昇格の必須要件</Badge>}
                  <Button onClick={() => move(i, -1)} disabled={i === 0} aria-label="1つ上へ">
                    ↑
                  </Button>
                  <Button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="1つ下へ">
                    ↓
                  </Button>
                  <Button onClick={() => setOpenId(openId === i ? null : i)}>{openId === i ? "閉じる" : "編集"}</Button>
                </>
              }
            />

            {openId === i && (
              <div className="field-grid mt-3 border-t border-[var(--line)] pt-3">
                <label className="md:col-span-2">
                  <span className="block text-[12px] text-[var(--ink-muted)]">設問文</span>
                  <input className="input mt-1 w-full" value={r.title} onChange={(e) => patch(i, { title: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="block text-[12px] text-[var(--ink-muted)]">補足（任意）</span>
                  <input
                    className="input mt-1 w-full"
                    value={r.helpText ?? ""}
                    onChange={(e) => patch(i, { helpText: e.target.value || null })}
                  />
                </label>
                <label>
                  <span className="block text-[12px] text-[var(--ink-muted)]">まとまり</span>
                  <select className="input mt-1 w-full" value={r.section} onChange={(e) => patch(i, { section: e.target.value })}>
                    {SECTION_ORDER.concat("free").map((sec) => (
                      <option key={sec} value={sec}>
                        {SECTION_LABEL[sec] ?? sec}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="block text-[12px] text-[var(--ink-muted)]">答え方</span>
                  <select
                    className="input mt-1 w-full"
                    value={r.questionType}
                    onChange={(e) => patch(i, { questionType: e.target.value })}
                  >
                    {Object.entries(TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {r.questionType === "number" && (
                  <>
                    <label>
                      <span className="block text-[12px] text-[var(--ink-muted)]">単位</span>
                      <input
                        className="input mt-1 w-full"
                        value={r.unit ?? ""}
                        onChange={(e) => patch(i, { unit: e.target.value || null })}
                      />
                    </label>
                    <label>
                      <span className="block text-[12px] text-[var(--ink-muted)]">入力できる最小値</span>
                      {/* 回答画面と同じ部品を使う。空欄のままにできる（＝下限を決めない）。
                          以前はここで打った文字をそのまま数値にしていたため、全角で打つと
                          「決めたつもりなのに決まっていない」状態になっていた。 */}
                      <NumberField
                        className="input input-num mt-1 w-24"
                        name={`validationMin_${i}`}
                        ariaLabel="入力できる最小値"
                        defaultValue={r.validationMin ?? null}
                        policy={{ allowNegative: true }}
                        onValueChange={(value) => patch(i, { validationMin: value })}
                      />
                    </label>
                    <label>
                      <span className="block text-[12px] text-[var(--ink-muted)]">小数の扱い</span>
                      {/* 「件」「人」のように数え上げるものは小数が意味を持たない。
                          止めるかどうかは設問ごとに決める（単位だけで決めると、%のように
                          小数が要るものまで巻き込む）。 */}
                      <span className="mt-1 flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={r.validationInteger}
                          onChange={(e) => patch(i, { validationInteger: e.target.checked })}
                        />
                        整数だけにする（小数を受け付けない）
                      </span>
                    </label>
                  </>
                )}
                {(r.questionType === "single" || r.questionType === "multi") && (
                  <div className="md:col-span-2">
                    <span className="block text-[12px] text-[var(--ink-muted)]">選択肢</span>
                    <div className="mt-1 grid gap-2">
                      {r.options.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            className="input flex-1"
                            value={o.label}
                            onChange={(e) =>
                              patch(i, {
                                options: r.options.map((x, xi) => (xi === oi ? { ...x, label: e.target.value } : x)),
                              })
                            }
                          />
                          <Button onClick={() => patch(i, { options: r.options.filter((_, xi) => xi !== oi) })}>
                            削除
                          </Button>
                        </div>
                      ))}
                      <div>
                        <Button
                          onClick={() =>
                            patch(i, {
                              options: [
                                ...r.options,
                                { value: String(r.options.length + 1), label: `選択肢${r.options.length + 1}` },
                              ],
                            })
                          }
                        >
                          選択肢を足す
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={r.required} onChange={(e) => patch(i, { required: e.target.checked })} />
                  回答を必須にする
                </label>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3">
                  <Button variant="danger-outline" onClick={() => remove(i)}>
                    この設問を削除する
                  </Button>
                  <span className="footnote">保存を押すまでは反映されません。</span>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <p className="section-heading m-0 mb-2">設問を足す</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => add("free", "yesno")}>はい / いいえ</Button>
          <Button onClick={() => add("free", "single")}>1つ選ぶ</Button>
          <Button onClick={() => add("free", "multi")}>いくつでも選ぶ</Button>
          <Button onClick={() => add("kpi", "number")}>数値を入れる</Button>
          <Button onClick={() => add("free", "text")}>文章で書く</Button>
        </div>
      </div>

      {/* 設問が増えるほど縦に伸びる画面。設問数と保存ボタンは画面下に固定する */}
      <StickyActionBar
        status={
          <>
            <span className="text-[13px] text-[var(--ink)]">
              設問 <span className="num font-bold">{rows.length}</span>
              <span className="unit"> 問</span>
            </span>
            <span className="mx-2 text-[var(--line)]">|</span>
            保存しても公開はされません。公開はアンケート一覧から行います。
          </>
        }
      >
        <Button variant="primary" onClick={save} disabled={busy}>
          {busy ? "保存しています…" : "設問を保存する"}
        </Button>
      </StickyActionBar>
    </>
  );
}

function QuestionList({ rows }: { rows: BuilderQuestion[] }) {
  return (
    <Card>
      {rows.map((r, i) => (
        <CardRow
          key={i}
          alignTop
          title={
            <>
              <span className="num mr-2 text-[var(--ink-muted)]">{i + 1}.</span>
              {r.title}
            </>
          }
          sub={
            <>
              {SECTION_LABEL[r.section] ?? r.section} ／ {TYPE_LABEL[r.questionType] ?? r.questionType}
              {r.unit ? ` ／ 単位 ${r.unit}` : ""} ／ {r.required ? "必須" : "任意"}
            </>
          }
          marks={r.isGate ? <Badge tone="alert">昇格の必須要件</Badge> : undefined}
        />
      ))}
    </Card>
  );
}

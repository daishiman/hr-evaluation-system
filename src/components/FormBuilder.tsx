"use client";

import { useSaveAction } from "@/lib/use-refresh";
import { saveFormQuestions } from "@/actions/forms";
import { useLayoutEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardHead, CardRow, ReasonNote } from "@/components/ui";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { NumberField } from "@/components/NumberField";
import { SECTION_LABEL, SECTION_ORDER } from "@/lib/view";
import {
  createBlankQuestion,
  insertBlankQuestionAfter,
  matchesSavedQuestions,
  nextOptionValue,
  optionKeys,
  reorderByKeys,
  withClientKeys,
  type BuilderQuestion,
  type BuilderQuestionDraft,
} from "@/components/form-builder-model";
import { RefreshStatus } from "@/components/RefreshStatus";
import { ReorderList } from "@/components/reorder/ReorderList";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ListAddRow, ListRowBody, ListRowNumber } from "@/components/ListRow";

export type { BuilderQuestion } from "@/components/form-builder-model";

/**
 * アンケートの設問をクリックで組み立てる画面。
 *
 * 設問文を打ち込む以外は、すべてボタンで完結するようにしている
 * （種類を選ぶ・並べ替える・選択肢を追加する）。並べ替えは共通の ReorderList（つまみの長押し・ドラッグ・
 * キーボード・矢印のボタン）で、設問と選択肢の両方に使う（S11）。並べ替えは手元の並びだけを変え、
 * 保存は今までどおり「設問を保存する」でまとめて行う。
 * 集計に使う紐づけ（等級要件・KPI項目）は編集させない。ここを人が触ると
 * 「何の実績としてカウントするか」が分からなくなるため、表示だけにとどめる。
 */

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
  const { save, saving } = useSaveAction(saveFormQuestions, { resource: "forms" });
  const [rows, setRows] = useState<BuilderQuestionDraft[]>(() => withClientKeys(initial));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const nextClientKey = useRef(0);
  const initialKey = JSON.stringify(initial);
  const [loadedKey, setLoadedKey] = useState(initialKey);
  const [dirty, setDirty] = useState(false);
  const latestInitial = useRef(initial);
  useLayoutEffect(() => { latestInitial.current = initial; }, [initial]);

  // 未編集の再取得だけを採用する。保存待ちの外部更新も、編集中の入力に上書きしない。
  if (loadedKey !== initialKey && !dirty) {
    setRows(withClientKeys(initial));
    setLoadedKey(initialKey);
    setDirty(false);
  }
  const conflict = dirty && loadedKey !== initialKey;

  const acceptLatest = () => {
    setRows(withClientKeys(initial));
    setLoadedKey(initialKey);
    setDirty(false);
    setOpenKey(null);
  };

  const newClientKey = () => `new:${nextClientKey.current++}`;

  const patch = (i: number, p: Partial<BuilderQuestion>) => {
    setDirty(true);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  };

  /* 並べ替えの部品が渡した並びで手元の設問を並べ直す。キーの集まりが食い違えば false（部品は置く前の並びへ戻す） */
  const reorderQuestions = (keys: string[]) => {
    const next = reorderByKeys(rows, keys, (r) => r.clientKey);
    const applied = next.map((r) => r.clientKey).join("\n") === keys.join("\n");
    if (applied) { setDirty(true); setRows(next); }
    return applied;
  };

  /* 選択肢も同じ。値が重なる選択肢があるときは並べ替えない（どれがどれか決められず、保存も重なりで断られる） */
  const reorderOptions = (i: number, keys: string[]) => {
    const options = rows[i]?.options ?? [];
    const current = optionKeys(options);
    if (current.some((key, oi) => key !== options[oi].value)) return false;
    const next = reorderByKeys(options, keys, (o) => o.value);
    const applied = next.map((o) => o.value).join("\n") === keys.join("\n");
    if (applied) patch(i, { options: next });
    return applied;
  };

  const remove = (i: number) => {
    setDirty(true);
    if (rows[i]?.clientKey === openKey) setOpenKey(null);
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const add = (section: string, questionType: string) => {
    setDirty(true);
    const clientKey = newClientKey();
    setRows((prev) => [...prev, createBlankQuestion(section, questionType, clientKey)]);
    setOpenKey(clientKey);
  };

  /* 一覧が長くなるほど、一覧の下の「＋ 設問を追加」まで押しに戻るのが遠くなる。
     いま見ている行のすぐ下に、同じまとまり・同じ答え方で1問差し込めるようにする。 */
  const addAfter = (i: number) => {
    setDirty(true);
    const clientKey = newClientKey();
    setRows((prev) => insertBlankQuestionAfter(prev, i, clientKey).rows);
    setOpenKey(clientKey);
  };

  const submit = async () => {
    if (conflict) return;
    const blank = rows.findIndex((r) => !r.title.trim());
    if (blank >= 0) {
      setError(`${blank + 1}問目の設問文が空です。入力してから保存してください。`);
      setOpenKey(rows[blank].clientKey);
      return;
    }
    setError(null);
    setMessage(null);
    // 保存の応答には保存後の画面が同梱される（サーバー側の refresh()）
    const sent = rows;
    const result = await save({
      formId,
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
    });
    // 失敗しても入力した設問は消さない（直してもう一度保存できるように）
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // useSaveActionは応答の画面が描き終わってから返る。成功と送信内容の一致を確認してから採番IDも採用する。
    const saved = latestInitial.current;
    if (matchesSavedQuestions(sent, saved)) {
      setRows(withClientKeys(saved).map((row, i) => ({ ...row, clientKey: sent[i]?.clientKey ?? row.clientKey })));
      setLoadedKey(JSON.stringify(saved));
      setDirty(false);
    }
    setMessage(result.message);
  };

  if (!editable) {
    return (
      <>
        <ReasonNote>{lockReason ?? "このアンケートは編集できません。"}</ReasonNote>
        <div className="mt-3">
          {/* 編集中の下書きは保持し、公開後の表示は最新の保存済み設問を使う。 */}
          <QuestionList rows={initial} />
        </div>
      </>
    );
  }

  return (
    <fieldset disabled={saving} aria-busy={saving} className="m-0 min-w-0 border-0 p-0">
      {error && <ReasonNote>{error}</ReasonNote>}
      {conflict && (
        <div className="mb-3">
          <ReasonNote>保存済みの設問が変わりました。未保存の入力は残していますが、古い内容で上書きしないよう保存を止めています。</ReasonNote>
          <ConfirmButton
            label="最新の設問を読み直す"
            confirm="未保存の変更を破棄して、最新の保存済み設問を読み直します。よろしいですか？"
            onConfirm={acceptLatest}
          />
        </div>
      )}
      <RefreshStatus message={message} refreshing={saving} target="画面" className="m-0 mb-3 text-sub text-brand-deep" />

      <Card>
      {/* 行の形はほかの一覧と同じ（番号・本文・札・補足／右端に行の操作。spec §28-14） */}
      {rows.length > 0 && (
      <ReorderList
        items={rows.map((r) => ({ id: r.clientKey, label: r.title || "（設問文が未入力です）" }))}
        label="設問の並び"
        className="reorder-in-card"
        busy={saving}
        onCommit={reorderQuestions}
        renderItem={(item, position) => {
          // position は表示の位置（動かしている最中も追いかける）。手元の設問は clientKey で引く
          const i = rows.findIndex((row) => row.clientKey === item.id);
          const r = rows[i];
          if (!r) return null;
          const open = openKey === r.clientKey;
          const keys = optionKeys(r.options);
          const title = r.title || <span className="text-ink-muted">（設問文が未入力です）</span>;
          const badge = r.isGate ? <Badge tone="alert">昇格の必須要件</Badge> : undefined;
          const sub = (
            <>
              {SECTION_LABEL[r.section] ?? r.section} ／ {TYPE_LABEL[r.questionType] ?? r.questionType}
              {r.unit ? ` ／ 単位 ${r.unit}` : ""} ／ {r.required ? "必須" : "任意"}
            </>
          );
          return (
          <>
            {/* 頭を固定するのは「編集を開いている設問」だけ。
                開くと選択肢の並びまで含めて縦に長くなり、下のほうを直しているときに
                「何問目を・どの答え方で・どの単位で」直しているのかが画面の外へ出てしまう。
                閉じている行は2行しかなく、固定しても貼り付く前に流れ去るため付けない
                （帯の見た目だけが増えて一覧が読みにくくなる）。
                集計との紐づけは一度読めば済むので帯には載せず、開いた本文の先頭に置く。
                番号は閉じた行と同じ列に置く（ListRowNumber）。 */}
            {open ? (
              <CardHead
                pinned
                lead={<ListRowNumber>{position + 1}</ListRowNumber>}
                title={<>{title}{badge && <> {badge}</>}</>}
                sub={sub}
                actions={
                  <Button variant="tertiary" onClick={() => setOpenKey(null)}>
                    閉じる
                  </Button>
                }
              />
            ) : (
              <ListRowBody
                number={position + 1}
                text={title}
                badges={badge}
                note={
                  <>
                    {sub}
                    {r.linkLabel && <><br />集計との紐づけ：{r.linkLabel}</>}
                  </>
                }
              />
            )}

            {open && (
              <div className="field-grid mt-3 ml-9">
                <p className="footnote m-0 md:col-span-2">
                  {r.linkLabel ? `集計との紐づけ：${r.linkLabel}` : "自由設問（評価集計には使いません）"}
                </p>
                <label className="md:col-span-2">
                  <span className="block text-note text-ink-muted">設問文</span>
                  <input className="input mt-1 w-full" value={r.title} onChange={(e) => patch(i, { title: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="block text-note text-ink-muted">補足（任意）</span>
                  <input
                    className="input mt-1 w-full"
                    value={r.helpText ?? ""}
                    onChange={(e) => patch(i, { helpText: e.target.value || null })}
                  />
                </label>
                <label>
                  <span className="block text-note text-ink-muted">まとまり</span>
                  <select className="input mt-1 w-full" value={r.section} onChange={(e) => patch(i, { section: e.target.value })}>
                    {SECTION_ORDER.concat("free").map((sec) => (
                      <option key={sec} value={sec}>
                        {SECTION_LABEL[sec] ?? sec}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="block text-note text-ink-muted">答え方</span>
                  <select
                    className="input mt-1 w-full"
                    value={r.questionType}
                    onChange={(e) => patch(i, {
                      questionType: e.target.value,
                      options: ["yesno", "single", "multi", "scale"].includes(e.target.value) ? r.options : [],
                    })}
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
                      <span className="block text-note text-ink-muted">単位</span>
                      <input
                        className="input mt-1 w-full"
                        value={r.unit ?? ""}
                        onChange={(e) => patch(i, { unit: e.target.value || null })}
                      />
                    </label>
                    <label>
                      <span className="block text-note text-ink-muted">入力できる最小値</span>
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
                      <span className="block text-note text-ink-muted">小数の扱い</span>
                      {/* 「件」「人」のように数え上げるものは小数が意味を持たない。
                          止めるかどうかは設問ごとに決める（単位だけで決めると、%のように
                          小数が要るものまで巻き込む）。 */}
                      <span className="mt-1 flex items-center gap-2 text-sub">
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
                    <span className="block text-note text-ink-muted">選択肢</span>
                    <div className="mt-1 grid gap-2">
                      {keys.some((key, oi) => key !== r.options[oi].value) && (
                        <p className="footnote m-0">
                          値が重なっている選択肢があるため、並べ替えられません。重なっている選択肢を削除してください。
                        </p>
                      )}
                      {r.options.length > 0 && (
                        /* 選択肢の行も同じ形（番号・本文／右端に行の操作）。入力欄1つの短い行なので、
                           広さが足りれば操作を本文の右に1段で並べる（reorder-inline） */
                        <ReorderList
                          items={r.options.map((o, oi) => ({ id: keys[oi], label: o.label || "（未入力の選択肢）" }))}
                          label={`「${r.title || `${position + 1}問目`}」の選択肢の並び`}
                          className="reorder-inline"
                          busy={saving}
                          onCommit={(order) => reorderOptions(i, order)}
                          renderItem={(option, at) => {
                            // 文言は打つたびに変わるので、選択肢はキー（値）で引く
                            const oi = keys.indexOf(option.id);
                            const o = r.options[oi];
                            if (!o) return null;
                            return (
                              <ListRowBody number={at + 1}>
                                <input
                                  className="input w-full"
                                  aria-label={`${at + 1}番目の選択肢の文言`}
                                  value={o.label}
                                  onChange={(e) =>
                                    patch(i, {
                                      options: r.options.map((x, xi) => (xi === oi ? { ...x, label: e.target.value } : x)),
                                    })
                                  }
                                />
                              </ListRowBody>
                            );
                          }}
                          renderActions={(option) => (
                            <Button
                              variant="tertiary"
                              aria-label={`選択肢「${option.label}」を削除`}
                              // 値が重なる選択肢を1件ずつ消せるよう、値ではなくキーの位置で消す
                              onClick={() => patch(i, { options: r.options.filter((_, xi) => xi !== keys.indexOf(option.id)) })}
                            >
                              削除
                            </Button>
                          )}
                        />
                      )}
                      <ListAddRow>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            // 件数＋1 ではなく今ある値の最大＋1にする（消してから足しても値が重ならない）
                            const value = nextOptionValue(r.options);
                            patch(i, { options: [...r.options, { value, label: `選択肢${value}` }] });
                          }}
                        >
                          ＋ 選択肢を追加
                        </Button>
                      </ListAddRow>
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sub">
                  <input type="checkbox" checked={r.required} onChange={(e) => patch(i, { required: e.target.checked })} />
                  回答を必須にする
                </label>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                  <Button variant="danger-outline" onClick={() => remove(i)}>
                    この設問を削除する
                  </Button>
                  <span className="footnote">保存を押すまでは反映されません。</span>
                </div>
              </div>
            )}
          </>
          );
        }}
        renderActions={(item) => {
          // 開いている設問は操作の列を作らず（null）、入力欄を行の幅いっぱいに使う。閉じるは固定する頭に置く
          const i = rows.findIndex((row) => row.clientKey === item.id);
          if (i < 0 || openKey === item.id) return null;
          return (
            <>
              <Button variant="tertiary" onClick={() => setOpenKey(item.id)}>
                内容を直す
              </Button>
              <Button onClick={() => addAfter(i)} aria-label="この下に自由設問を追加">
                この下に追加
              </Button>
            </>
          );
        }}
      />
      )}

      {/* 足すボタンは、どの一覧でも一覧の下の左端に置く（spec §28-14）。
          設問は答え方で入力欄が変わるので、「＋ 設問を追加」の後ろに答え方を並べ、1回押せば足せるようにする。
          設問が無いことは、別の段にせずその右に書く */}
      <div className={rows.length > 0 ? "card-pad border-t border-line" : "card-pad"}>
        <ListAddRow
          empty={rows.length === 0 && "設問はまだありません。"}
          note="押した答え方で、一覧の最後に1問足して入力欄を開きます。"
        >
          <div role="group" aria-label="設問を追加" className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="text-sub font-bold">＋ 設問を追加</span>
            <Button onClick={() => add("free", "yesno")}>はい / いいえ</Button>
            <Button onClick={() => add("free", "single")}>1つ選ぶ</Button>
            <Button onClick={() => add("free", "multi")}>いくつでも選ぶ</Button>
            <Button onClick={() => add("kpi", "number")}>数値を入れる</Button>
            <Button onClick={() => add("free", "text")}>文章で書く</Button>
          </div>
        </ListAddRow>
      </div>
      </Card>

      {/* 設問が増えるほど縦に伸びる画面。設問数と保存ボタンは画面下に固定する */}
      <StickyActionBar
        status={
          <>
            <span className="text-sub text-ink">
              設問 <span className="num font-bold">{rows.length}</span>
              <span className="unit"> 問</span>
            </span>
            <span className="mx-2 text-line">|</span>
            保存しても公開はされません。公開はアンケート一覧から行います。
          </>
        }
      >
        <Button variant="primary" onClick={() => submit()} disabled={saving || conflict}>
          {saving ? "保存しています…" : "設問を保存する"}
        </Button>
      </StickyActionBar>
    </fieldset>
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
              <span className="num mr-2 text-ink-muted">{i + 1}.</span>
              {r.title}
            </>
          }
          sub={SECTION_LABEL[r.section] ?? r.section}
          /* 答え方と必須かどうかは行の右端へ寄せる。左に詰めると、行の右側がまるごと空く（spec.md §28-9） */
          value={
            <>
              <p className="m-0 text-sub">
                {TYPE_LABEL[r.questionType] ?? r.questionType}
                {r.unit ? `（単位 ${r.unit}）` : ""}
              </p>
              <p className="footnote m-0">{r.required ? "必須" : "任意"}</p>
            </>
          }
          marks={r.isGate ? <Badge tone="alert">昇格の必須要件</Badge> : undefined}
        />
      ))}
    </Card>
  );
}

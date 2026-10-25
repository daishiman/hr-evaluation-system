# 設計のレビューの記録 — 行動指針と KPI・評価セットの画面・双方向の追従・見本・部品の手応え（2026-10-22）

## 対象

- Beads: `hr-6pi.3`。dev-graph node: `SYS-GUIDE-KPI-P03`。
- 見たもの: P02 で決めた [DD-026〜DD-030](../design-decisions.md) と [設定の写しの一覧](../settings-copy-ledger.md)。受領の記録は [仕様反映の受領書](./2026-10-22-guideline-kpi-ux-and-two-way-sync.md)。
- 反映のコミット: 未コミット（利用者の依頼で、commit・push・PR はまだ行わない。コミットしたときに sha をここへ足す）。

## 観点ごとの結論（5 件）

| # | 観点 | 結論 | 指摘 |
|---|---|---|---|
| 1 | 確定した時点の写しを変えない | 守られる。確定した評価は `FINALIZED_SKIP_MESSAGE` で飛ばし、回答の写し（`form_answers` の question_*）と締め切ったアンケートは追従させない。ただし確定前の評価の集計し直しで、上司が入れた列が消える穴があった。 | F4 |
| 2 | 断る保存が直す画面を示す | 決めの方向は合っているが、今の失敗の返事（`ActionFail`）は文しか返せず、直す画面を渡す形が無かった。 | F3 |
| 3 | 新しい色のトークンを足さず、テーマの契約テストを書き換えない | 方向は合っている。ただし「`.btn` の最小の高さを 44px にする」と「`Charts.tsx` を CSS 変数の経由に寄せる」の2文が、今のコードと契約テストに合っていなかった。 | F6・F7 |
| 4 | 見本が本物の会社の行に触れない | 守られる。`scripts/sample-data.mjs` の `assertSampleOnly`（他社 kyufu・sakura・mirai を指す文と、INSERT・DELETE 以外の文を拒む）と `buildRemoveSql`（`company_id='cmp_sample'` の DELETE）が、増える `form_responses`・`form_answers` にもそのまま効く（どちらも `company_id` を持つ）。DD-029 の3に、増える行を `tableRows` に入れて2つの検査を通すことを書き足した。 | なし（明確化だけ） |
| 5 | アンケートからの反映が、設定の保存と同じ権限を通る | 守られる。`system-spec/route-ledger.json` で `masters.save`（/admin/masters）・`scheme.save`（/admin/scheme）・`forms.saveQuestions`（/admin/forms/[id]）は、どれも minRole `COMPANY_ADMIN`。`runAction` が `minRoleFor(spec.operation)` で見るので、アンケートからの反映も同じ権限で止まる。`permissions-contract.test.ts` が台帳と `runAction` の operation を突き合わせている。 | なし |

## 指摘と反映（8 件）

| # | 指摘 | 反映した場所 |
|---|---|---|
| F1 | 一覧の 1 の form_questions の「書く関数」に、下書きの設問を保存する `saveFormQuestions` が抜けていた。 | 一覧の 1 |
| F2 | 写しを読む画面のうち、評価の一覧・詳細（`listEvaluations`・`getEvaluationDetail`）、回答の画面と見本（`toAnswerQuestions`・`toContentQuestions`）、回答の CSV の取り込み（`importResponsesCsv`）、版の設問の古さの検査（`loadStaleAsking`）が一覧に無かった。 | 一覧の 3（4行） |
| F3 | 断る保存の返事に、直す画面を渡す形が無い（`ActionFail` は `{ ok: false; message }` だけ）。そろえる操作の「そろえられなかった」にも直す画面が無い。 | DD-028 の2（省略できる `fixHref` を `ActionFail` と `HttpError` に足し、`run` が写す。画面はリンクを出す）、DD-028 の6、O27-1 の検査 |
| F4 | `buildEvaluationsForCycle` は評価の行を消して作り直すが、上司のコメントと判断（`evaluator_comment`・`raise_decision`・`raise_decision_reason`・`promotion_decision`・`promotion_decision_reason`・`decision_recorded_by`・`decision_recorded_at`）を新しい行へ写していない。設定を保存しただけで、下書きのコメントと、確定を取り消した評価に残る判断が消える。 | DD-028 の4、一覧の 5、O27-2 の検査 |
| F5 | 設定の保存と追従の書き込みの順番と、途中で失敗したときの扱いが決まっていなかった。 | DD-028 の4（設定の保存を先に1つの batch で確定し、追従はアンケートごとの batch と1人ごとの transaction。失敗は戻さず結果の文に出し、6と7で拾う） |
| F6 | `Charts.tsx` は今すでに `CHART_COLORS` で CSS 変数を経由しているのに、DD-030 が「JS の定数から寄せる」と書いていた。また、部品クラスのために新しい `--*` を足すと、`palette-contract.test.ts` の「どの系統も骨格の18個だけを入れ替える」に当たる。 | DD-030 の2の表と6（Charts は変えない。新しい `--*` を足さず、規則の中で `var()` と `color-mix(in srgb, …)` を直接使う） |
| F7 | DD-030 の4の「`.btn` の最小の高さを 44px にする」は、今の決め（`globals.css` の `@media (pointer: coarse)` のときだけ 44px。マウスでは一覧の密度を保つ）と、`ui-rules.test.ts` の「指で押す端末では、押せるものが44px以上になる」と食い違う。 | DD-030 の4（指で押す端末で 44px 以上のまま。部品クラスを付けた部品も同じ media の対象に入れる） |
| F8 | 「回答0件」の数え方が書かれていなかった（下書きの回答を数えるか、試しの回答を数えるか）。 | DD-028 の4（`form_responses` の行を状態を問わず数える。`formTransitions` の `hasResponses` と同じ。試しの回答は保存しないので数えない） |

見送った指摘は無い。

## grep の結果と分類

### 式1（写しの列）

```
grep -rln -E "scoring_mode_snapshot|required_kpi_points_snapshot|required_behavior_points_snapshot|options_json|question_options_json|scoringModeSnapshot|requiredKpiPointsSnapshot|requiredBehaviorPointsSnapshot|optionsJson|questionOptionsJson" src
```

25 ファイル。分類は一覧の 3 種類（参照・追従・確定時点の写し）と、それに当たらない「列の定義」「テスト」。

| ファイル | 何をしているか | 分類 |
|---|---|---|
| `src/actions/forms.ts` | `saveFormQuestions` が form_questions を書く | form_questions を書く（下書きは追従、回答のある公開中・締め切ったものは確定時点の写し） |
| `src/lib/form-build.ts` | `buildQuestionRows`・`syncFormQuestions` が form_questions を書く | 同上 |
| `src/app/admin/forms/[id]/page.tsx` | 設問を読んで編集の画面に出す | 参照 |
| `src/components/answer-questions.ts` | 設問を回答の画面の形にする | 参照 |
| `src/components/FormPreview.tsx` | 設問を見本の画面に出す | 参照 |
| `src/components/QuestionField.tsx` | 設問の選択肢を出す | 参照 |
| `src/lib/domain/form-visibility.ts` | 設問を見せる形にする | 参照 |
| `src/lib/import.ts` | CSV の列と選択肢を設問と照合する | 参照 |
| `src/lib/domain/answer-snapshot.ts` | 回答の時点の設問を form_answers に写す | 確定時点の写し |
| `src/lib/evaluate.ts` | 評価の写しの列と内訳4表を書く | 確定前は追従、確定後は確定時点の写し |
| `src/lib/export.ts` | 評価と回答の CSV を書き出す | 読む元の分け方に従う（評価は1の評価の内訳、回答の見出しは参照） |
| `src/lib/queries.ts` | 評価の一覧・詳細を読む | 1 の評価の内訳に従う |
| `src/lib/domain/evaluation-view.ts` | 評価の写しの列を画面の形にする | 1 の評価の内訳に従う |
| `src/components/EvaluationDetail.tsx` | 評価の詳細を出す | 1 の評価の内訳に従う |
| `src/db/schema.ts` | 列の定義 | 列の定義（写しの持ち主は一覧の 1） |
| `src/actions/forms-save-questions.test.ts` | テスト | 対象（`forms.ts`）の分類に従う |
| `src/components/form-freshness-regression.test.ts` | テスト | 対象（回答の画面）の分類に従う |
| `src/components/FormAnswer.test.ts` | テスト | 対象（回答の画面）の分類に従う |
| `src/components/FormPreview.test.ts` | テスト | 対象（`FormPreview.tsx`）の分類に従う |
| `src/lib/domain/answer-snapshot.test.ts` | テスト | 対象（`answer-snapshot.ts`）の分類に従う |
| `src/lib/domain/evaluation-view.test.ts` | テスト | 対象（`evaluation-view.ts`）の分類に従う |
| `src/lib/domain/form-visibility.test.ts` | テスト | 対象（`form-visibility.ts`）の分類に従う |
| `src/lib/evaluate.integration.test.ts` | テスト | 対象（`evaluate.ts`）の分類に従う |
| `src/lib/export.test.ts` | テスト | 対象（`export.ts`）の分類に従う |
| `src/lib/response-write.integration.test.ts` | テスト | 対象（回答の写し）の分類に従う |

未分類: 0 件。

### 式2（版の設問の古さの検査）

```
grep -rn -E "diffFormKpiItems|effectiveAskedItems|staleAskingItems" src
```

38 行・7 ファイル。どれも設定の表と form_questions を毎回読み比べてずれを見つけるもので、写しを持たない。

| ファイル | 行数 | 分類 |
|---|---|---|
| `src/lib/domain/form-sync.ts` | 3 | 参照（関数の定義） |
| `src/lib/stale-asking-loader.ts` | 2 | 参照 |
| `src/lib/comparison-gap-loader.ts` | 2 | 参照 |
| `src/lib/domain/comparison-gap.ts` | 5 | 参照 |
| `src/lib/domain/setup-gaps.ts` | 1 | 参照（注だけ） |
| `src/lib/domain/form-sync.test.ts` | 21 | テスト（対象の分類に従う） |
| `src/lib/comparison-gap-source.test.ts` | 4 | テスト（対象の分類に従う） |

未分類: 0 件。

### value_json を式から外した理由

`form_answers.value_json` は回答者の答え（複数選択で選んだ選択肢の value の配列）で、設定の写しではない。選択肢の言葉そのものは `question_options_json` に写っていて、式1はそちらを当てている。設定を直しても答えた事実は変わらないので追従させず、一覧にも入れない（一覧の 5 に理由を書いた）。`value_json` を式に入れると、回答を読む全ての場所が当たり、写しの分類と関係のない行で表が埋まる。

## 検証

- `pnpm run check:docs`: 結果は受領書の P03 の欄に書く。

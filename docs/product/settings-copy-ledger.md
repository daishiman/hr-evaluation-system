# 設定の写しの一覧（I30・DD-028）

設定（KPI の設問の文・評価セットの項目・行動指針の観点・等級要件・昇格要件）の文や値を、別の行・画面・書き出しへ写している場所を全て並べる。設定を保存したときに、それぞれが変わるのか、変わらないのかをここで決める。

- 決めた理由は [DD-028](./design-decisions.md) にある。この文書は「どこに写しがあるか」と「どう扱うか」だけを持つ。
- コードとの突き合わせは `src/lib/settings-copy-ledger.contract.test.ts` が行う（下の「契約テストが見ること」）。表の形を変えるときは、テストの読み方も一緒に直す。

## 分け方（3 種類）

| 分け方 | 意味 | 設定を保存したとき |
|---|---|---|
| 参照 | 表示や書き出しのたびに、設定かアンケートの設問を読み直す。写しを持たない。 | 次に開いたときに新しい内容で出る。 |
| 追従 | 写しを持つが、設定の保存に合わせて作り直す。 | 保存の処理が作り直す（下の「追従の関数」）。 |
| 確定時点の写し | ある時点の内容を残すための写し。設定を直しても変えない。 | 変わらない。 |

1つの表が、行の状態で分け方を変えることがある。そのときは「分け方」の欄に状態ごとに書く。

## 1. 写しを持つ表

設定の表を外部キーで指し、設定の文や値を自分の列に写している表。

| 表 | 写しの列 | 元の設定 | 分け方 | 書く関数 | 追従の関数 |
|---|---|---|---|---|---|
| form_questions | section, question_type, title, help_text, required, unit, options_json, validation_min, validation_max, validation_integer, is_gate | kpi_questions（text・unit・validation・input_type・required）、behavior_guidelines（aspect_name）、behavior_levels（score・label・text から options_json を生成）、grade_requirements（text・category）、promotion_requirements（text・kind・is_gate）。section・question_type・help_text などには設問生成規則の固定値も含む | 下書き（回答0件）は追従。回答のある公開中は確定時点の写し（次の版の下書きを作る）。回答のある下書き・回答0件の公開中・締め切ったもの・締め切った期のアンケートは確定時点の写し（変えない）。 | `buildQuestionRows`（`src/lib/form-build.ts`）、`saveFormQuestions`（`src/actions/forms.ts`） | `syncFormQuestions`（`src/lib/form-build.ts`）、`alignDraftForms`（`src/lib/form-align.ts`） |
| form_answers | question_title, question_type, question_section, question_unit, question_options_json, question_display_order | form_questions | 確定時点の写し（回答した時点の設問の文） | `questionSnapshot`（`src/lib/domain/answer-snapshot.ts`） | なし |
| evaluations | scoring_mode_snapshot, required_kpi_points_snapshot, required_behavior_points_snapshot | evaluation_schemes、昇格の必要点数 | 確定前（draft）は追従。確定後（finalized）は確定時点の写し。 | `buildEvaluationsForCycle`（`src/lib/evaluate.ts`） | `buildEvaluationsForCycle`（`src/lib/evaluate.ts`） |
| evaluation_items | item_name, category_name, unit, direction, threshold_label, threshold_lower, threshold_upper, max_points | kpi_items、kpi_categories、kpi_rank_criteria、scheme_items | 確定前は追従。確定後は確定時点の写し。 | `buildEvaluationsForCycle`（`src/lib/evaluate.ts`） | `buildEvaluationsForCycle`（`src/lib/evaluate.ts`） |
| evaluation_behaviors | aspect, aspect_name, level_label | 回答したアンケートの form_questions（title）と form_answers（value_text）。aspect だけは behavior_guidelines（観点の識別子） | 確定前も、評価を集計し直すたびに回答したアンケートの設問と回答の確定時点の写しから作り直す。行動指針の保存は評価を集計し直さないので、観点の名前と段階の名前は追従しない。aspect は集計のときに behavior_guidelines を参照する（識別子で、保存では変わらない）。確定後は確定時点の写し。 | `buildEvaluationsForCycle`（`src/lib/evaluate.ts`） | なし |
| evaluation_requirements | category, text | 回答したアンケートの form_questions（section・title） | 確定前も、評価を集計し直すたびに回答したアンケートの設問の確定時点の写しから作り直す。等級要件の保存は評価を集計し直さないので、文は追従しない。確定後は確定時点の写し。 | `buildEvaluationsForCycle`（`src/lib/evaluate.ts`） | なし |
| evaluation_gates | kind, text | 回答したアンケートの form_questions（section・title） | 確定前も、評価を集計し直すたびに回答したアンケートの設問の確定時点の写しから作り直す。昇格要件の保存は評価を集計し直さないので、文は追従しない。確定後は確定時点の写し。 | `buildEvaluationsForCycle`（`src/lib/evaluate.ts`） | なし |

- 確定前の評価を集計し直すとき、確定済みの評価は `FINALIZED_SKIP_MESSAGE`（`src/lib/domain/build-summary.ts`）で飛ばす。
- 評価の内訳4表は、評価1件ごとに消して作り直す。行の id は変わる。
- 等級要件・昇格要件・行動指針の3表は、設定の表を外部キーで指すが、文は回答したアンケートの設問から写す（`src/lib/evaluate.ts` の「等級要件・昇格要件・行動指針を回答から拾う」）。回答のあるアンケートの設問は確定時点の写しなので、評価を集計し直しても回答した時点の文のままになる。このため `FOLLOW_TARGETS`（`src/lib/domain/settings-follow.ts`）は、等級要件・昇格要件・行動指針の保存で評価を集計し直さない。振る舞いは `src/actions/settings-to-forms-sync.integration.test.ts` の「等級要件・行動指針の文を直しても、評価の内訳は回答した時点の文のまま」が確かめる（保存の後も、別の理由で集計し直した後も、回答した時点の文のまま）。

## 2. 設定そのものの表（写しではない）

設定の表を外部キーで指すが、それ自身が設定の一部で、文を写していない表。設定の保存はこれらを直接書く。

| 表 | 指す先 | 理由 |
|---|---|---|
| behavior_levels | behavior_guidelines | 観点ごとの段階の定義。行動指針の設定の一部。 |
| kpi_items | kpi_categories | KPI 項目そのもの。分類は id で指すだけ。 |
| kpi_rank_criteria | kpi_items | 項目ごとのランクの基準。KPI の設定の一部。 |
| kpi_reference_points | kpi_items | 項目ごとの参考値。KPI の設定の一部。 |
| kpi_questions | kpi_items | KPI の聞くこと（設問の元）。KPI の設定の一部。 |
| scheme_items | evaluation_schemes、kpi_items、kpi_categories | 評価セットの項目。評価セットの設定の一部。 |
| scheme_rank_ratios | evaluation_schemes | 評価セットのランクの比率。評価セットの設定の一部。 |
| evaluation_cycles | evaluation_schemes | 期の設定。使う評価セットを id で指すだけで、文を写さない。 |

## 3. 写しを読む画面と書き出し

表ではなく、上の表や設定を読んで出す場所。分け方は、読む元の表の分け方に従う。

| 場所 | 関数 | 読む元 | 分け方 |
|---|---|---|---|
| 設定とアンケートのズレの表 | `loadCycleComparisonGaps`・`loadFormComparisonGap`・`loadGroupComparisonGaps`（`src/lib/comparison-gap-loader.ts`） | 設定の表と form_questions を毎回読み比べる | 参照 |
| 評価の基準の画面（/criteria） | `listSelectableItemsByGroup`・`listQuestionsFor`・`listRankCriteriaFor`（`src/app/criteria/data.ts`） | 設定の表 | 参照 |
| 回答の CSV | `buildResponsesCsv`（`src/lib/export.ts`） | form_questions の title（列の見出し） | 参照（アンケートの設問を読む。設問の分け方は 1 の form_questions に従う） |
| 評価結果の CSV | `buildResultsCsv`（`src/lib/export.ts`） | evaluation_items・evaluation_gates | 1 の評価の内訳に従う（確定前は evaluation_items が追従、evaluation_gates は回答したアンケートの設問の写し。確定後はどちらも確定時点の写し） |
| KPI の明細の CSV | `buildKpiDetailCsv`（`src/lib/export.ts`） | evaluation_items | 1 の評価の内訳に従う |
| 評価レポート | `loadEvaluationReport`（`src/lib/report-data.ts`） | evaluations・evaluation_items | 1 の評価の内訳に従う（確定したレポートは変わらない） |
| 評価の一覧・詳細（上司と本人の画面） | `listEvaluations`・`getEvaluationDetail`（`src/lib/queries.ts`） | evaluations の写しの列と評価の内訳4表 | 1 の評価の内訳に従う |
| 回答の画面と見本 | `toAnswerQuestions`（`src/components/answer-questions.ts`）、`toContentQuestions`（`src/lib/domain/form-visibility.ts`） | form_questions | 参照（設問の分け方は 1 の form_questions に従う） |
| 回答の CSV の取り込み | `importResponsesCsv`（`src/lib/import.ts`） | form_questions の title・options_json（列と選択肢の照合） | 参照 |
| 版の設問の古さの検査 | `loadStaleAsking`（`src/lib/stale-asking-loader.ts`） | 設定の表と form_questions を毎回読み比べる | 参照 |

## 4. 記録（設定の保存で変えない）

変更や移行を後から説明し、戻すために残す行。分け方は全て「確定時点の写し」。

| 表 | 列 | 何の記録か |
|---|---|---|
| constitution_events | before_json, after_json | 制度の変更の記録（誰が・いつ・何を変えたか）。アンケートから設定への反映（DD-028）も同じ記録を通す。 |
| import_batches | before_json | CSV の取り込みを戻すための、取り込み前の行。 |
| display_name_rewrites | old_value, new_value | 0034 の呼び名の書き換えの記録（戻しに使う）。 |
| behavior_band_default_rewrites | old_value, new_value | 0040 の行動指針の割り当ての書き換えの記録（DD-026。戻しに使う）。 |

## 5. 一覧に入れないもの

- **form_answers の value_number・value_text・value_json**: 回答者の答えで、設定の写しではない。複数選択の value_json は選んだ選択肢の value の配列、value_text は選んだ言葉の控え。選択肢の言葉そのものは question_options_json（1 の form_answers）に写っている。設定を直しても答えた事実は変わらないので、追従させない。
- **forms の title・description**: 期と等級の名前から作る見出しで、I28・I29 の設定（KPI の設問・評価セット・行動指針・等級要件・昇格要件）の文を含まない。
- **evaluations の点数・理由の文（total_score・bonus_rationale・raise_reason など）**: 集計の結果で、設定の文の写しではない。確定前は `buildEvaluationsForCycle` が作り直し、確定後は変えない（1 の evaluations と同じ扱い）。
- **evaluations の人が入れた列（evaluator_comment・raise_decision・raise_decision_reason・promotion_decision・promotion_decision_reason・decision_recorded_by・decision_recorded_at）**: 上司が書いたコメントと判断で、設定の写しではない。確定前の評価を集計し直しても、元の行の値をそのまま新しい行へ写す（DD-028 の4）。下書きのコメントと、確定を取り消した評価に残る判断を、設定の保存で消さないため。

## 6. 保存の後の取り直し（§27）

- 画面からの保存は `useSaveAction`（`src/lib/use-refresh.ts`）を通す。保存が成功すると、そのタブは Server Action の応答で新しい画面を受け取る。
- 同時に `announceChange`（`src/lib/freshness.ts`）が同じブラウザの他のタブへ「保存した」と知らせ、`FreshnessSync`（`src/components/FreshnessSync.tsx`）が受けて取り直す。知らせは種類と時刻だけで、値は送らない。
- 名乗る種類は、アンケートから設定への保存が `forms`、設定の保存が `masters` か `scheme`。受け手は種類を区別せずに取り直すので、どの保存でも関係する画面（設定・アンケート・ズレの表・評価）が新しくなる。
- 別の利用者のブラウザへは知らせない（範囲の外 5）。開いている画面は、次に取り直したときに新しくなる。

## 契約テストが見ること

`src/lib/settings-copy-ledger.contract.test.ts` は、この文書の 1〜4 の表を読み、次を確かめる。

1. `src/db/schema.ts` で、設定の表（kpi_items・kpi_categories・kpi_questions・behavior_guidelines・grade_requirements・promotion_requirements・evaluation_schemes・scheme_items・form_questions）を外部キーで指す表の集合が、1 と 2 の表の集合と一致する。抜けも余りも 0。
2. 1 と 4 の各行に記載した写しの列が、`src/db/schema.ts` のその表に列としてある。列の記載漏れやコピー元の意味までは自動判定しないため、設問生成・評価集計を変えるときにこの一覧も照合する。
3. 1 と 3 の関数が、書いたファイルから export されている。
4. 1 と 4 の分け方の欄が、3 種類（参照・追従・確定時点の写し）の言葉だけで書かれている。

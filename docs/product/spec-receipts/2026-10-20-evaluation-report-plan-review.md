# 計画レビュー 受領書（評価レポートと上司の判断・13 task の読み替え）

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-20 |
| 対象 | feature `feature-evaluation-report-and-raise-judgment`（[文書](../../../features/evaluation-report-and-raise-judgment.md)）、task `SYS-EVAL-REPORT-P01`〜`P13`（`tasks/feature-evaluation-report-and-raise-judgment/`） |
| Beads | epic `hr-inn`、task `hr-inn.1`〜`hr-inn.13` |
| 計画パッケージ | `.dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/`（source_digest `sha256:63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5`） |
| 基準 sha | `dbe633361a7638c36360cde905a5b5c17822073d`（`main`、#95 のマージ） |
| 判定 | **読み替えて進める。task 仕様書と feature の文書は書き換えず、この受領書と DD-020〜DD-023 で読み替える。spec-state への反映は P12 で行う** |

## 1. 位置づけと読む順

計画パッケージの13 task を、実物（`.github/workflows/deploy.yml`・`src/db/schema.ts`・権限の関数・system-spec）と読み比べた。task 仕様書と feature の文書は生成物なので、食い違いはこの受領書と [DD](../design-decisions.md) で読み替える。決めた理由は DD に書き、ここでは場所と読み替えだけを書く。

読む順（上ほど優先する）:

1. この受領書と DD-020〜DD-023
2. task 仕様書（`tasks/feature-evaluation-report-and-raise-judgment/`）
3. system-spec の生成章（`00-requirements-definition.md`・`auth.md`・`backend.md` などの9つ）と、それを取り込んだ node（`architecture/system-spec-*.md` の8つと `specs/system-spec-requirements.md`）
4. system-spec の人の章（`release-and-forms.md`・`master-settings.md` など）
5. [製品仕様](../spec.md)（P05・P12 で追従する）

- 目標・受け入れ・実装の項目は、文を写さずに id（G17〜G24・O17〜O24・I18〜I25）で引く。本文は [要件定義書](../../../system-spec/00-requirements-definition.md) にある。
- P12 で §7 を spec-state に反映して compile したら、この受領書は履歴になる。以後は system-spec と DD を正とする。
- 評価を見る権限の入口（`canViewEvaluationOf`）の組・置き場所・使う場所は DD-021 にある。
- 全 task は、この受領書と DD-020〜DD-023 と §6 の直しを含む `main` から始める。この作業ツリーの変更は、P01 に入る前に1つの PR で `main` にマージする（§6）。
- 利用者の判断が要る事柄と、その期限は §9 にまとめた。
- （2026-10-21 追記。P10 の最終レビューの指摘12）この受領書の後に、P02 で DD-024 を決めた。読む順の1は「この受領書と DD-020〜DD-024」と読む。§2 の P05 の行にある「`canViewEvaluationOf` を使うのはレポートと評価の詳細だけ」は、DD-024 の5で「レポートの画面だけ」に改めた（評価の詳細の2画面は今の判定のまま。寄せるのは SECURITY-013 を決めるとき）。最終レビューは [2026-10-20-evaluation-report-final-review.md](./2026-10-20-evaluation-report-final-review.md)。

## 2. task ごとの読み替え

「P05:146」は `tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p05.md` の146行を指す。

| task | task の記述（ファイル:行） | 読み替え | 根拠 |
|---|---|---|---|
| 全 task | 「Feature:」の行（P01〜P04・P08・P13 は156行、P05 は159行、P06・P11 は154行、P07・P09・P12 は155行、P10 は153行）の `features/feature-evaluation-report-and-raise-judgment.md` | 実在する文書は `features/evaluation-report-and-raise-judgment.md`。context.json のパスはそのまま | `features/` の実物 |
| 全 task | 本番に触れない旨の記述（P05:105・P06:102・P07:103・P08:104・P09:103） | どの task の PR も、`main` へのマージで Deploy workflow が動き、本番に出る。migration を伴うのは P05（0038）と P08（0039）のマージだけで、ほかは migration なしで出る | DD-020、`deploy.yml:13-17`（`main` への push で動く。paths の絞りは無い） |
| P01 | P01:72・137（受け入れ10件を1行ずつ） | 対応表は「O × 検証の種類 × テストファイル」の形にする。1つの O に検証の種類が複数ある | `00-requirements-definition.md:75-82`（O17〜O24 の測り方） |
| P01 | P01:73・137（未決の事項3件） | migration の番号は 0038・0039 で決まった。静的検査（O17）が `drizzle/` を見ないことも決まった（P02:137 の行）。残る未決は、レポートの URL・テストファイル名・文書の側の除外の一覧（DD-020 の4の5つを P02 が確定する） | DD-020 の4・5 |
| P02 | P02:73（決めるもの） | P02 の DD は、qa の id と DD-020〜DD-023 を参照し、未決の事項（URL・順序・テストファイル名など）だけを書く。migration の2段と番号は決まっている | DD-020、§3 |
| P02 | P02:78・94（1回目の Deploy で読み書きの経路を消す。schema.ts の KGI の定義は P08 まで残す） | 1回目は P05 のマージ。evaluations の KGI の2列（`src/db/schema.ts:866・868`）と KGI の3つの表の定義も、1回目で schema.ts から外す。DB の表と列は 0039 まで残る。2回目は P08 のマージ（0039） | DD-020 |
| P02 | P02:91（2枚目は⑤から） | ui-ux の番号の⑤（その等級の推移） | §5 |
| P02 | P02:96・103・110（`canViewEvaluationOf` の組と置き場所） | 組は「会社が同じ ∧ (`canReviewEmployeeEvaluation` ∨ `canReadSelfResult`)」。純粋な判定は evaluation-authority.ts、会社を閉じる入口は session.ts に置く。P02 の DD は組ごとの単体テストのファイル名だけを決める | DD-021 |
| P02 | P02:137（静的検査の除外の一覧） | O17 の走査は src・docs・route-ledger・nav で、`drizzle/` と `scripts/` を見ないので、drizzle の側の除外は要らない。`drizzle/` の KGI の参照（migrations の SQL と 0039・`meta/` の snapshot と `_journal.json`・`drizzle/rollback/0039_*`）は履歴として残し、初期データの `drizzle/seed.sql` だけを P05 で作り直す（P05:112 の行）。schema.ts は src にあるので数える。文書の側の除外は、P02:137 の4つに `docs/deploy-notes.md` を足した5つで、P02 が一覧を確定する（deploy-notes には P08・P12・P13 が KGI の表の名前を書く） | DD-020 の4、`00-requirements-definition.md:75`、P04:103 |
| P02 | （記述なし）評価結果の CSV の昇給の列 | 今の CSV に昇給の列は無い（基準 sha の `src/lib/export.ts:102-107`。昇格は「昇格可否」がある）。backend の (20) の昇給の列をどう足すかは P02 で決める | `system-spec/backend.md:58` の (20) |
| P03 | P03:103（食い違いは DD を直す。system-spec は変えない） | DD-020〜DD-023 と system-spec の違いは、§1 の読む順で DD を正とし、直す対象にしない。system-spec へは P12 で反映する | §1、§7 |
| P04 | P04:118・143・149（P04 の PR を P05 の PR の土台にし、P04、P05 の順にマージ） | P04 の PR は作らない。テストは P05 のブランチの最初のコミットに入れる。完了の方針（linked_pr_merged_all）には P05 の PR を紐付ける。それまで `hr-inn.4` は in_progress のまま、コメントで状態を残す | DD-020 |
| P04・P06 | P04:119・P06:117（PR の本文に `dev-graph:SYS-EVAL-REPORT-P04`・`P06` を書く） | 自分の PR は作らないので、P05 の PR の本文に `dev-graph:SYS-EVAL-REPORT-P04`・`dev-graph:SYS-EVAL-REPORT-P06` も書く | DD-020 の6 |
| P05 | P05:74・97・104（`canViewEvaluationOf` をレポート・評価の詳細・CSV・メモで使う） | `canViewEvaluationOf` を使うのはレポートと評価の詳細だけ。CSV は上司側の判定（`canReviewEmployeeEvaluation`）だけを使い、§6 で直した形のままにする。メモは今の判定のまま（DD-021 の4）。同じ記述は、I20（`00-requirements-definition.md:178`）、qa-y13 の答えの (6)（`system-spec/auth.md:62`。DD-021 の6で改める）、qa-y16 の答えの (7)・(11)（`system-spec/maintenance-ops.md:1368`。DD-021 の6）を元に、生成章の qa の答えの写し・取り込んだ node・feature の文書と context.json に広く写っている。場所を数え上げず、`grep -rn 'canViewEvaluationOf\|メモの読み出し' system-spec architecture specs features` で出る行のうち、この関数を CSV かメモに使う、または使う側の全てをこの関数にそろえると書く行は、すべて「使うのはレポートの画面と評価の詳細だけ」と読む。O19 の測り方（`system-spec/auth.md:1212`・`architecture/system-spec-auth.md:141`）のうち、CSV の期待値は上司側の判定の範囲、メモの期待値は今の判定（公開範囲で絞る）とする。`specs/system-spec-requirements.md:149` は範囲だけを書き、使う場所を書かないので食い違わない | DD-021、§6 |
| P05 | P05:79・133（schema.ts の KGI の定義を P08 まで残す。表と列の削除は P08） | P05 で schema.ts から外す。P08 の担当は DB の表と列の削除（0039）だけ | DD-020 |
| P05 | P05:92・93（理由の欄の文。判断の検査） | 保存のときに、上司の理由と上司コメント（`evaluatorComment`）へ本人向けの漏れ検査を当て、引っかかった語を名指しして断る | DD-023 |
| P05 | P05:105・146（本番は P13 だけが触れる。P13 の1回目で本番に出す） | P05 の PR のマージで本番に出る（1回目。0038 を当てる） | DD-020 |
| P05 | P05:112（write scope） | 人の章の4つ（§4）と `drizzle/seed.sql` を足す。seed.sql は、`scripts/seed.mjs` の TABLES と `scripts/seed-data.mjs` から KGI を外したうえで、`node scripts/seed.mjs --generate-only` で作り直してコミットする | §4、DD-020 の4 |
| P05 | P05:140（KGI の静的検査が0件） | schema.ts も数える（除外しない）。`src/lib/domain/constitution-events.ts:26` の型の `"kgiCoefficient"` と `src/db/schema.ts:1262` の注釈も数え、P05 で外す。`constitution_events` に残る行は消さない。走査の外の `drizzle/seed.sql`・seed の元・`scripts/scan-rendered-text.mjs:50`（`/admin/kgi`）からも KGI を消す | DD-020 の4 |
| P05 | P05:141（自動のコマンド） | マージの前に、P05 の PR の上で P06 の自動テスト（P06:136 の4つ）と `pnpm cf:dry-run`・`pnpm check:bundle-size` を通す。P06 の直しは P05 のブランチにコミットする | DD-020 |
| P05 | （記述なし）アンケートの版を探す3か所（基準 sha の `src/actions/forms.ts:185-190`・`src/lib/form-build.ts:328-331`・`src/actions/cycles.ts:90-91・121-128`） | 計画レビューで会社の条件を足した。P05 は backend の (16) の規則を書くときに、この形を前提にする | §6 |
| P05 | P05:128（depends_on の完了を scheduler が確かめる） | P04 の完了は待たない。P04 は P05 のマージまで in_progress のままなので、scheduler の ready には出ない。P05 は手で claim する | DD-020 の6 |
| P05 | P05:147（この段のコミットを revert すれば戻る） | revert で戻してよいのは P08 のマージの前だけ。P08 のマージの後に revert すると、schema.ts に KGI の定義が戻り、消えた列を名前で指定する。その後の直しは前に進める PR で行う | DD-020 の9 |
| P06 | P06:72・81・108（P05 の後の `main` で流す。P05 がマージされている） | P05 の PR のブランチで、マージの前に流す | DD-020 |
| P06 | P06:141（直しは PR にして `main` にマージ） | 直しは P05 のブランチにコミットする。P06 の PR は作らない。完了の方針には P05 の PR を紐付け、それまで `hr-inn.6` は in_progress のまま、コメントで状態を残す | DD-020 |
| P06 | P06:76（既存の E2E が KGI の画面を前提にしている） | 基準 sha の `e2e/` に KGI の参照は0件。背景の例は当たらない | `e2e/` の実物 |
| P06 | P06:125（depends_on の完了を scheduler が確かめる） | P05 の完了（マージ）は待たない。P05 の PR のブランチで、マージの前に流すので、手で claim する | DD-020 の6 |
| P07 | P07:103（本番には出さない） | 確かめは preview で行う。この task の PR は、マージで migration なしで本番に出る | DD-020 |
| P07 | P07:109（P06 の後の `main`） | P05 のマージの後の `main`（P06 の直しを含む） | DD-020 |
| P07 | （記述なし）1回目の公開の確かめ | 受け入れの結果の節に、P05 のマージで動いた Deploy workflow の実行 id・結果・配った sha（P05 のマージの sha）と、そのログの「適用後の未適用マイグレーション確認」の段（未適用0件）を写す。本番に KGI の画面と操作が無いこと（`system-spec/infrastructure.md:40`・`system-spec/maintenance-ops.md:57` の (9)）は、その sha で O17 の静的検査が0件で、`system-spec/route-ledger.json` に KGI の行が無いことで示す。P07 は本番に問い合わせず、本番の画面も開かない（理由と、(9) の写しの読み方は DD-020 の7）。P08 はこれを入る条件として読む | DD-020、P08:83、`deploy.yml` の同じ段、`docs/deploy-notes.md` §9 |
| P07 | P07:131（本番 DB の確認は P13 の担当） | 本番 DB の中身の確認は P13 のまま。上の行の確かめは、Deploy のログと、配った sha の静的検査を写すだけなので、本番に触れず、範囲の外を取り込まない | DD-020 の7 |
| P08 | P08:61（lifecycle_role が audit） | 中身は migration（0039 と戻す SQL）として扱う | P08:73 |
| P08 | P08:72・92・98・109・111（schema.ts から KGI の定義を消す。Documentation は N/A。write scope に schema.ts） | P05 で済む。P08 は 0039（drop）と戻す SQL（`drizzle/rollback/`）と、deploy-notes の 0039 の節を担う。P08:98 の「Documentation: N/A」は、deploy-notes の 0039 の節を書く、と読む。P08 はコードを変えないので、write scope は schema.ts と `src/test-support/` を外し、`docs/deploy-notes.md` を足す | DD-020 の3・9、§3 |
| P08 | P08:83（入る条件：P07 の合格と、1回目に使う sha が決まっている） | 「P05 のマージの Deploy が success で、本番で 0038 が適用済み（未適用0件）、配った sha で KGI の参照が0件」と読む（P07 が受け入れの結果の節に書いたもの）。加えて、KGI の値の長期保管（DD-020 の9）と書き出しの置き場所（SECURITY-014）を利用者が決めていること、`drizzle/` の最新が 0038 のままであること（DD-020 の5）を入る条件にする | DD-020、§9 |
| P08 | （記述なし）2回目の前の本番 DB の数 | P08 の PR のマージを利用者に頼む前に、P08 が本番 DB を読み取り（`SELECT count(*)`・`PRAGMA table_info` だけ）、KGI の3つの表の行数と評価の2列の値の入った行数を PR の本文に書く。P13 はその数を deploy-notes の配布の記録に写す。P08 に入る条件に、本番 DB を読み取る経路が通ること（この計画レビューの時点では 7403 で読めなかった。[バックログ](../backlog.md) の OPS-017）を足す | `specs/system-spec-requirements.md:181`、`system-spec/maintenance-ops.md:57` の (9)、DD-020 |
| P08 | P08:132（本番への適用は P13 の担当） | 適用は P08 の PR のマージで Deploy workflow が行う。P08 も P13 も手で当てない | DD-020 の2・7 |
| P08 | P08:87（1回目の Deploy に 0039 が先に当たる risk） | 1回目は P05 のマージで済んでいるので起きない | DD-020 |
| P08 | P08:143（P13 の2回目で本番に出す） | P08 の PR のマージで本番に出る（2回目。0039 を当てる） | DD-020 |
| P08 | P08:105・144（`db:backup` は P13 が取る。revert すれば schema.ts と migration が戻る。backup.sql で戻す） | 書き出しは Deploy workflow が取る（`deploy.yml:139-153`。Artifact `d1-backup-<実行 id>`、保管14日）。backup.sql はこの Artifact と読む。schema.ts は P05 で変わっているので、P08 の revert では戻らない。戻すのは DB だけで、範囲・担当・手順は DD-020 の9のとおり | DD-020 の9 |
| P09 | P09:142（直しは PR にして `main` にマージ） | マージで migration なしで本番に出る | DD-020 |
| P09 | P09:137（`git diff --stat main -- …`） | `git diff --stat dbe6333 main -- …` で読む | DD-020 |
| P09 | P09:87・88（テーマの契約のファイルの差分が 0。`src/app/globals.css` を丸ごと見る） | 3つの試験ファイルは差分 0。`globals.css` は冒頭の宣言（`brand_color_*`・`aidd-color-migration`）と色の変数の定義に差分が無いことで見る。`globals.css` には、P05 で消したコメントの「KGI」の字（.css も静的検査の対象）と、P06 のレポートの CSS（既に定義された変数だけを使い、色を直に書かない）が入るので、ファイル全体の差分は空にならない | DD-024 の規範との関係（契約は `globals.css` 冒頭の宣言）、`src/lib/kgi-removal.static.test.ts:58` |
| P09 | P09:90（印刷の体裁を直す） | 直したら、P10 が A4 縦の印刷をもう一度確かめる | DD-020 |
| P10 | P10:72（P01〜P09 の突き合わせ） | P09 で印刷を直したときは、A4 縦の印刷（O18）を確かめ直す | DD-020 |
| P11 | P11:76（feature を done にする条件） | O17 の2件目の証跡（本番 DB の読み取り）は、[デプロイ時の注意](../../deploy-notes.md) の該当の節（P13 が書く）とし、feature の完了の判定に含める。feature の文書の111行と P13:150 も同じ | O17、P11:135 |
| P12 | P12:73・136（deploy-notes に2回の Deploy の手順） | 0038 の節は P05、0039 の節（中身・戻し方）は P08 の PR が書く（§3）。P12 は、2回のマージで Deploy workflow が流すことと、本番の読み取りの照会を足して整える。手で `db:migrate:remote`・`db:backup` を流す手順は書かない | DD-020 の9、§3 |
| P12 | P12:26・86・102・131（spec-state を含まない。system-spec は compile の経路だけ） | §7 の項目を P12 が spec-state に反映し、compile の経路で章に描く。章を直接書かないことは変わらない | §7 |
| P13 | P13:72・73・94・95・99・138（別の worktree から手で deploy・`db:migrate:remote`・`db:backup`。0038・0039 を本番に当てる・Worker と D1 に公開する・2回の Deploy を行う） | 使わない。2回の公開は P05・P08 のマージで Deploy workflow が行う。P13 は記録だけを担う（次の行） | DD-020 |
| P13 | P13:74・109・137・139（本番 DB の読み取り。公開の sha と時刻） | P13 は記録の役。Deploy workflow の2回の実行 id・sha・時刻・書き出しの Artifact の id と、本番 DB の読み取りの結果（表の名前と列の名前だけ）を deploy-notes に書く。読み取りは `SELECT`・`PRAGMA` だけ | DD-020 |
| P13 | P13:110（使うもの：P08 のマージより前の `main` の sha、P12 の後の `main`、deploy-notes の手順） | 使うのは、2回の Deploy の実行 id と sha と、P05・P08・P12 が書いた deploy-notes の 0038・0039 の節 | DD-020、§3 |
| P13 | （記述なし）保存済みの上司の文 | 同じ読み取りで、保存済みの昇給・昇格の理由と上司コメントのうち、本人向けの漏れ検査に引っかかる件数を数えて記録する（件数だけ。文は写さない） | DD-023 |
| P13 | P13:78・103（別の worktree から公開する。古いコードで 0039 を受けない） | 配るのは Deploy workflow のクリーン checkout（[release-and-forms §1-2](../../../system-spec/release-and-forms.md)）。古いコードが消した列を読まないことは、1回目で schema.ts から外すことで守る | DD-020 |
| P13 | P13:83・86・133・143（利用者が公開を承認している） | 2回の公開はマージで起きるので、P05・P08 の PR のマージを利用者が認めることを、公開の承認と読む | DD-020 |
| P13 | P13:105・144（戻すとき。2回目は backup.sql と rollback で戻し、1回目の sha を公開し直す） | 戻すのは、利用者の承認を得てから（外部への変更）。P08 のマージから14日の間は、P13 の claim を待たず、承認があればその時の作業者がすぐ戻す（P13 は P12 の後に始まる。P13:110）。2回目は DB だけを、KGI の3つの表と評価の2列に限って戻し、コードの revert と sha の公開し直しはしない。範囲・担当・手順・Artifact の保管の期限は DD-020 の9のとおり。1回目（0038 の列は NULL 可）は、P08 のマージの前に限り P05 の revert で戻せる（P05:147 の行） | DD-020 の9、`docs/deploy-notes.md` §8・§9 |
| P13 | P13:150（次に使う node） | P11 の行と同じ | P11:76 |

注記: 本人向けの昇格の理由の列は `promotionBlockedReasonEmployee`（`src/db/schema.ts:893`）、昇給は `raiseReasonEmployee`（884）。`promotionReasonEmployee` という列は無い。

## 3. 共有ファイルの節の担当

| ファイル | 節 | 担当 | 書くこと |
|---|---|---|---|
| `docs/product/design-decisions.md` | DD-020〜DD-023、DD-012 の注 | 計画レビュー（この受領書） | 公開の単位、警告を消さない範囲、本人に見せる上司の文 |
| 同 | DD-021 | 計画レビュー（この受領書） | 評価を見る権限の入口と、メモ・CSV の判定 |
| 同 | DD-023 の後に足す DD | P02 | P02:137 の受け入れの中身。qa の id と DD-020〜DD-023 を参照し、未決の事項だけを書く |
| 同 | P02 の DD の直し | P03 | 設計レビューで見つかった食い違い（P03:103） |
| 同 | 実装で決まったこと | P12 | P12:108 |
| `docs/deploy-notes.md` | KGI の記述 | P05 | 消す（P05:99） |
| 同 | 0038 の配布の節（新しく足す） | P05 | 中身と戻し方（P08 のマージの前だけ P05 の revert で戻せる） |
| 同 | 0039 の配布の節（新しく足す） | P08 | 中身と戻し方（DB だけを戻す。DD-020 の9）。マージの前にそろえる |
| 同 | 同じ2つの節に足すこと | P12 | Deploy workflow が流すこと・読み取りの照会を足して整える（P12:73・136） |
| 同 | 同じ節の「配布の記録」 | P13 | 実行 id・sha・時刻・Artifact の id・2回目の前の数（P08 の PR の本文から写す）・読み取りの結果・漏れ検査に引っかかる件数・§6 のメモの件数（§6 の PR で数えていないとき） |
| `docs/product/spec-receipts/2026-10-20-evaluation-report-and-raise-judgment.md` | 対応表・未決の事項・範囲の外 | P01 | P01:109 |
| 同 | 受け入れの結果の節 | P07 | P07:108 |
| 同 | 証跡の節 | P11 | P11:107 |

## 4. P05 の PR で一緒に直す人の章

[index](../../../system-spec/index.md) の更新ルール1（35行。画面・API・DB が変わる変更は、対応する system-spec を同じ PR で更新する）に従い、P05 の PR で次の4つを直す。KGI はまだコードにあるので、今は直さない。

| 章 | 今の記述 | P05 で直すこと |
|---|---|---|
| `system-spec/master-settings.md` | 24（`/admin/kgi` の行）・44（監視対象の KGI係数）・48（事業所KGI達成率の即時再計算）・55（KGI係数の表示と編集） | KGI の記述を消す |
| `system-spec/routes-and-access.md` | 9（47個すべての `page.tsx`）・37（47routeの完全性） | 画面の数を P05 の後の台帳に合わせる |
| `system-spec/release-and-forms.md` | §3〜§7 に、アンケートの状態の変更の規則が無い | `formTransitions` が関わる（P05:74・93）。backend の (16) の規則を足す |
| `system-spec/imports-and-readiness.md` | 11-17（readiness） | 評価セットを `resolveSchemeForCycle` の1つから得ること（backend の (14)）を足す |

`release-and-forms.md` の §1-5・§2-7 は、この計画レビューで DD-020 として足した。

## 5. レポートの節番号の対応

画面の節は ui-ux の7節（`system-spec/ui-ux.md:57` の (15)・(23)、1131 の答え）を正とする。backend の (13) の6項目（`system-spec/backend.md:58`）はデータの鍵として、この表で読む。I25 の「レポートの②」と O18 の「2枚目が⑤から」（P02:91 も）は ui-ux の番号である。

| ui-ux（画面の節） | 中身 | backend の (13)（データの鍵） | 印刷 |
|---|---|---|---|
| ① 見出し | 名前・今の等級・元にした評価期間・作った時刻 | （6項目の外） | 1枚目 |
| ② 評価に値するか | 昇給・昇格の判定、上司の判断と理由 | ① 今の判定 | 1枚目 |
| ③ 点数 | KPI評価点の合計と満点・等級要件の達成率・行動指針の点数 | ② 点数 | 1枚目 |
| ④ レーダー図 | KPI 項目が軸。軸が3未満なら棒グラフ | ③ 項目ごとの判定と点数 | 1枚目 |
| 上長からのコメント | — | （6項目の外） | 1枚目 |
| ⑤ その等級の推移 | その等級にいた期の点数と、同じ等級の平均と幅 | ④ その等級にいた期の点数と、同じ等級の平均・最小・最大（3人未満なら作らない） | 2枚目（頭に名前と評価期間） |
| ⑥ 等級ごとの点数 | 本人が経た等級ごとの平均と、会社の同じ等級の平均 | ⑤ 等級ごとの平均 | 2枚目 |
| ⑦ 過去の実績 | 期ごとの等級・点数・昇給・昇格 | ⑥ 期ごとの実績 | 2枚目 |

## 6. 先に直した既存の漏れ

計画レビューで、今のコードに見える範囲の漏れを3件見つけ、この作業ツリーで直した。この作業ツリーの変更すべて（この受領書・DD-020〜DD-023・3件の直しのほか、system-spec の章と取り込んだ node・feature と13 task・バックログ・製品仕様・route-ledger など）は、P01 に入る前に1つの PR で `main` にマージする。migration は無く、マージで本番に出る。PR は利用者の指示があってから出す。P05 は、回帰テストが通り続けることを確かめるだけにする。場所の行は基準 sha のもの。

| 漏れ | 場所 | 直した形 | 回帰テスト |
|---|---|---|---|
| マネージャーが、評価結果と KPI 明細の CSV で会社の全員分を取れる | `src/app/api/export/route.ts:59-60`（書き出しに見る人を渡していない）、`src/lib/export.ts` | 書き出す行を上司側の判定（`canReviewEmployeeEvaluation`）で絞る（`export.ts` の `inReviewScope`）。マネージャーは直属の部下の行だけを取れる。ファイル名に期の名前を入れ、行が0件でも入る | `src/app/api/export/route.integration.test.ts` |
| 管理者だけのメモ（公開範囲が「管理者のみ」）が、マネージャーに見える | `src/lib/queries.ts:637`（`listNotes` が公開範囲で絞らない）、`src/app/manager/members/[id]/page.tsx:28`（呼び出し）・101（「管理者のみ」の札） | 公開範囲ごとに読める最低の役割を決め、書ける段階＝読める段階にする（利用者の判断、2026-10-20。[製品仕様](../spec.md) §3 の11）。`listNotes` は見る人が読める公開範囲だけを返す。マネージャーには「管理者のみ」を出さず、保存でも 403 で断る（`readableNoteVisibilities`） | `src/lib/domain/evaluation-authority.test.ts`・`src/components/NoteForm.test.ts`・`src/actions/notes.integration.test.ts`・`src/lib/notes-visibility.integration.test.ts` |
| アンケートの版を探す3か所に、会社の条件が無い | `src/actions/forms.ts:185-190`（公開のときに締める版）、`src/lib/form-build.ts:328-331`（次の版の番号）、`src/actions/cycles.ts:90-91`（受付の開始のときに数える公開中の版）・121-128（締め切りのときに閉じる版と、期間の状態の更新） | 会社の条件を足した（backend の (16) と同じ形）。評価期間の id が会社ごとなので、振る舞いは変わらない | 既存のアンケートと評価期間のテスト |

- CSV は DD-021 のとおり上司側の判定だけを使い、メモは今の判定のままにする。評価が確定した後でも、社員本人は自分についてのメモと CSV を取れない（社員は個人詳細を開けない）。
- 本番への影響：マネージャーが既に「管理者のみ」で書いたメモは、書いた本人の画面から消え、管理者には見える。行も公開範囲の値も書き換えないので、件数で直し方は変わらない。件数は、本番 D1 が読めなかった（7403。[バックログ](../backlog.md) の OPS-017）ので数えていない。数えるのは、この作業ツリーの変更を `main` に出す PR の担当で、`employee_notes` を公開範囲と、書いた人のその会社での役割（`company_memberships.role`）で数える（読み取りだけ。利用者の確認を得てから）。OPS-017 が通る前に PR を出すときは、本文に「未計測（OPS-017）」と書いてマージしてよい。OPS-017 が通った後に数え、PR が開いていれば本文に追記する。マージ済みなら、P13 が本番の読み取りのときに数え、deploy-notes の配布の記録に件数だけを書く（§3）。
- 範囲の外：管理者とマネージャーが、自分についての評価者向けの情報（自分の確定前の評価の詳細・自分についてのメモ・CSV の自分の行・レポートの上司側の枝など）を見られること。上司側の判定（`canReviewEmployeeEvaluation`）は本人かどうかを見ず、個人詳細の入口（`canViewEmployee`）は本人を通すので、上の3件の直しでは閉じない。役割ごとの中身と、メモの見出しの注記「本人には表示されません」（今の `src/app/manager/members/[id]/page.tsx:94`。基準 sha では90）との食い違いは、DD-021 の「範囲の外」を正本にした。バックログの SECURITY-013（decision のまま）で、決めるなら P02 の前に決める（P02 の DD とテストの期待値が変わる）。

## 7. P12 で spec-state に反映する項目

| 項目 | 今の記述 | 反映すること |
|---|---|---|
| 公開の単位と列の外し方 | `system-spec/infrastructure.md:40`・`system-spec/maintenance-ops.md:57` の (9)・`specs/system-spec-requirements.md:181`（2回の Deploy を外部変更ガードを通して行う） | DD-020 |
| 評価を見る権限の入口 | `architecture/system-spec-auth.md:55・87・118`（メモと CSV にも使う。`session.ts` に置く）、qa-y13 の答えの (6)、§2 の P05:74・97・104 の行に挙げた箇所 | DD-021（組・置き場所の2つ・CSV は上司側だけ・メモは今の判定・qa-y13 の (6) の改め） |
| 警告を消さない範囲 | G22・I23・O22、backend の (15) | DD-022（新しい版が公開されたら、古い版には警告を出さない） |
| 本人に見せる上司の文 | I25、backend の (17) | DD-023（保存のときの検査と、上司コメントへの同じ検査） |
| レポートの節番号 | ui-ux の (15)・(23) と backend の (13) | §5 の対応 |
| O17 の走査の範囲 | `system-spec/00-requirements-definition.md:75`（src・docs・route-ledger・nav を探す。除外が無い） | DD-020 の4（文書の側の除外の5つ。P02 が確定した一覧） |
| O19 の見える範囲 | `system-spec/00-requirements-definition.md:77`（レポート・評価の中身・CSV・メモ。上司の判断が無い） | DD-021（CSV は上司側の判定だけ、メモは今の判定。上司の判断は確定前の評価の詳細と同じ範囲で見せる。自分についての情報は範囲の外） |
| I4 | `system-spec/00-requirements-definition.md:162` の「KGI 実績」 | KGI を消す |
| 資するゴールの抜け | `system-spec/index.md:54`（backend に G20 が無い）・51（ui-ux に G20・G23 が無い）・55（frontend に G19・G23 が無い） | 足す |
| index の説明と章の表 | `system-spec/index.md:27`（表示の鮮度だけを挙げる）・49-56 | 今の機能に合わせる |
| 画面の数 | `specs/system-spec-requirements.md:178`（47画面） | P05 の後の数にする |

compile すると、9 node（`spec-system-spec-requirements` と `arch-system-spec-*` の8つ）の取込元の digest が合わなくなる。digest は手で書き換えない。前例は [2026-10-14 の受領書](./2026-10-14-improvement-requests-final-review.md) の残課題1と、[バックログ](../backlog.md) の OPS-015 で、診断を残した。その後、9 node の `imported_at` は、次の機能の取り込みのたびに新しくなっている（#93 では 2026-10-13、基準 sha では 2026-10-15、この機能の取り込みで 2026-10-19）。今回も同じく、診断を残し、次の機能の取り込みで取り込み直す。

### P12 の結果（2026-10-21）

spec-state には writer（`apply-spec-transition.py chunk`）だけで書いた。2026-10-20 の利用者の判断を `qa-z03`（4問）・`qa-z04`（メモの公開範囲）として足し、主根拠の qa の問と答えは当時の逐語のまま、訂正（corrections）を追記した。compile の後、`validate-coverage-matrix.py --require-complete --require-basis --require-foundation` と `validate-source-citation.py` はどちらも OK。

| 項目 | 結果 |
|---|---|
| 公開の単位と列の外し方 | 反映した。`qa-x15`（infrastructure の主根拠）と `qa-y16`（maintenance-ops の主根拠）に DD-020 の読み方の訂正を追記した（qa-z03 の2問目） |
| 評価を見る権限の入口 | 反映した。`qa-y13`（auth）と `qa-z02`（security）に、DD-021 の4・6 と DD-024 の4・5 の読み方の訂正を追記し、メモの公開範囲は `qa-z04` で記録した |
| 警告を消さない範囲 | backend の (15) は `qa-z01` の訂正で DD-022 を記録した。G22・I23・O22 は上位概念で、変えるには set-foundation に利用者の全文の承認が要るので変えていない（§9 の承認待ち） |
| 本人に見せる上司の文 | backend の (17) は `qa-z01` の訂正で DD-023 を記録した（qa-z03 の4問目）。I25 は上位概念で承認待ち |
| レポートの節番号 | `qa-y10`（ui-ux）と `qa-z01`（backend）の訂正で、ui-ux の (15)・(23) の番号を正とし、backend の①〜⑥との対応を書いた |
| O17 の走査の範囲 | 上位概念で承認待ち。それまでは DD-020 の4 と静的検査（`src/lib/kgi-removal.static.test.ts`）が正本 |
| O19 の見える範囲 | 上位概念で承認待ち。それまでは DD-021 が正本 |
| I4 | 上位概念で承認待ち |
| I20（P10 の最終レビューで足した） | 上位概念で承認待ち。I20（`system-spec/00-requirements-definition.md:178`）は、見る権限の判定の関数をレポート・評価の詳細・CSV の書き出し・メモの読み出しで使うと書く。DD-021 の4 と DD-024 の2・5 で、使うのはレポートの画面だけに改めた（CSV とメモは今までの判定、評価の詳細の2画面は SECURITY-013 を決めるときに寄せる）。台帳にレポートのページを足すことは済んだ（`system-spec/route-ledger.json` の `/reports/[id]`）。それまでは DD-021・DD-024 が正本 |
| 資するゴールの抜け | frontend に G19 を足した（`qa-y11` の訂正と set-serves。根拠は frontend の (10)）。backend の G20、ui-ux の G20・G23、frontend の G23 は、それぞれの章の答えに対応する項目が無いので足さなかった。G20 は maintenance-ops と database、G23 は backend の (14) と database が担う（理由は `qa-z01`・`qa-y10`・`qa-y11` の訂正に書いた） |
| index の説明と章の表 | `system-spec/index.md` の人の節を今の機能に合わせて直し、評価レポートの現在の契約（qa-z03・qa-z04 と訂正を優先すること）の段落を足した。章の表は compile が作り、frontend に G19 が入った。直した後に compile をもう一度流し、index.md が変わらないことを確かめた |
| 画面の数 | 47 のまま正しい。P05 で `/admin/kgi` を消し、`/reports/[id]` を足したので、基準 sha と同じ数になる（`src/app` の `page.tsx` が47、`route-ledger.json` の routes が47） |

上位概念（O17・O19・I4・G22・I23・O22・I25）は、文を直す案に利用者の全文の承認を得てから set-foundation で変える。§9 に足した。I20 は P10 の最終レビュー（[受領書](./2026-10-20-evaluation-report-final-review.md)）の指摘で、表と §9 に足した。

compile の後の lineage の診断（`validate-source-lineage.py`、読むだけ）は `lineage_digest_mismatch` が8件で、auth・backend・database・frontend・infrastructure・maintenance-ops・security・ui-ux の章（`arch-system-spec-*` の取込元）。上の段落では9 node と見込んだが、`spec-system-spec-requirements` の取込元の要件定義書は、上位概念を変えていないので一致したまま。8 node は上の段落のとおり、次の機能の取り込みで取り込み直す。

## 8. harness に積む課題（記録だけ）

1. register-package に、作り直した package を登録し直す経路が無い。
2. R3-import に、取り込み済みの node を更新する経路が無い（§7 の lineage）。
3. task の「Feature:」の行のパスを、実在で確かめる検査が無い。型（system-dev-planner の `references/system-task-spec-template.md:103`）は graph_node_id を書く決まりだが、13 task は実在しないパスを書いた（§2 の全 task の行）。
4. planner の入力に `deploy.yml` と人の章が無い。マージで本番に出ることと、列を消す順序を知らないまま計画した（DD-020）。
5. write scope に人の章が自動で入らない（§4）。
6. 13 task に、テンプレートの決まり文句が繰り返し入る。
7. compile が qa の答えを逐語で写し、改めが章ごとに重なる。例：`system-spec/auth.md:999` の (11) と同じ文が7つの章にある。

7件は [バックログ](../backlog.md) の OPS-018（observe）に記録した。次の機能を dev-graph で計画するときに、直ったかを確かめる。

## 9. 判断が要る事柄

期限の近い順。どれも利用者の判断か操作が要り、この作業ツリーでは決めていない。

| 事柄 | 担当 | 期限 | 状態 | 参照 |
|---|---|---|---|---|
| Deploy workflow が Artifact に置く本番 D1 の全体の書き出し（Public のリポジトリ）。置き場所と、今ある2つを消すか | 利用者。消すのは外部への変更で、確認を得てから | 今ある2つは期限（2026-10-28・2026-10-30）の前。置き場所は P05 のマージの前 | 未決 | [バックログ](../backlog.md) の SECURITY-014、DD-020 の2・9 |
| この作業ツリーの変更を `main` に出す PR の時期 | 利用者（PR は指示があってから出す） | P01 の前 | 未決 | §1・§6 |
| 同じ等級がちょうど3人のとき、レポートの平均と幅（最小・最大）と本人の値から、残る2人の値を割り出せること | 利用者 | 評価レポートを `main` へ出す前 | 未決（今は3人以上で平均と幅を出す） | [バックログ](../backlog.md) の SECURITY-015、DD-024 の4。P10 の最終レビューで足した |
| qa-y13 の答えの (6) の改め（`canViewEvaluationOf` を CSV とメモに使わない） | 利用者の確認 | P02 の前 | 確認済み（2026-10-21、qa-z06 の問4。推奨の印の無い2択で「確認済みとして閉じる」。qa-y13 に前方参照の訂正を足した）。同じ中身の I20 の文は qa-z05 の問1で承認され、qa-z06 の問1で確定の条件を足して改めた | DD-021 の6、§2 の P05 の行 |
| 自分を評価する側にも立つ人が、自分についての評価者向けの情報を見られること | 利用者 | P02 の前 | 未決（今の振る舞いのまま固定する） | [バックログ](../backlog.md) の SECURITY-013、DD-021 の範囲の外 |
| 本番 D1 の読み取り（7403） | 利用者（token の権限か、読み取り専用の workflow） | P08 に入る前 | blocked | [バックログ](../backlog.md) の OPS-017 |
| KGI の値の長期保管 | 利用者 | P08 のマージの前 | 未決 | DD-020 の9 |
| 仕組みを消す前に確定した評価の詳細に、そのときの根拠の文（KGI と係数を書いた文）がそのまま出て、個人Pt の見出しと値が合わないこと | 利用者 | P08 のマージの前 | 未決（今はそのまま出す） | [バックログ](../backlog.md) の POLICY-011、spec.md §29-1、deploy-notes §14 の件数。P10 の最終レビューで足した |
| 上位概念（O17・O19・I4・I20・G22・I23・O22・I25）の文の直し | 利用者の全文の承認（set-foundation に要る） | 次の機能を dev-graph で取り込む前 | 承認済み（2026-10-21。qa-z05・appr-foundation-013）。成功基準のレポートの行もあわせて改め、spec-state に記録して compile した。同じ日の qa-z06・appr-foundation-014 で、I20・I23・成功基準のズレの警告の行・制約の KGI の削除の行を実装に合わせて改めた（appr-foundation-013 を置き換える）。さらに qa-z07・appr-foundation-015 で、G22・I23・成功基準のズレの警告の行・O22 の測り方に「今の設定と一致した新しい版」の条件を足した（appr-foundation-014 を置き換える） | §7 の P12 の結果、[最終レビューの受領書](./2026-10-20-evaluation-report-final-review.md) の「上位概念の承認と記録」 |
| I23 の例外を文に書くか（足りない項目に聞き方の決まっていないものがあるときは、「第N版の下書きを開く」より先に聞き方を決めるリンクが出る）。括弧書きで足すか、リンクの順は DD-012 の5・DD-016 に従うと明記するか | 利用者の全文の承認（set-foundation に要る） | 次に上位概念を承認し直すとき（急ぎではない） | 未決（実装の `pickFix` と DD はもうその順なので、どちらを選んでもコードは変わらない） | 評価 10-21-e の新しい low、[最終レビューの受領書](./2026-10-20-evaluation-report-final-review.md) の「上位概念の承認と記録」 |
| 「管理者のみ」のメモの件数 | `main` に出す PR の担当（読み取りは利用者の確認を得てから） | OPS-017 が通った後 | 未計測 | §6・§3 |

## 10. 検証の結果

この受領書・DD-020〜DD-023・§6 の直しは、2つの検証役（論理・構造と、システム・戦略。どちらも読むだけで、書き換えない）に4条件（矛盾なし・漏れなし・整合性あり・依存関係整合）を3回確かめさせ、指摘をそのつど直した。

| 回 | 判定 | 主な指摘 | 直した先 |
|---|---|---|---|
| 1回目 | FAIL | メモの判定の記述、`canViewEvaluationOf` を CSV とメモに使う箇所、0039 の戻し方、P07 の 0038 の確かめ、アンケートの版を探す3か所の会社の条件、O17 の除外 | DD-020 の3・4・9、DD-021 の4、§2・§3・§6 |
| 2回目 | 2つとも FAIL | 作業ツリーを `main` に出してから P01 に入る順序が無い（高）、`drizzle/seed.sql` の KGI の担当、qa-y13 の答えの (6) の写しの漏れ、P07 の行の食い違い、SECURITY-013 の範囲が DD-021 より狭い、本番 D1 の読み取りの担当 | §1・§2 の P05・P07 の行、DD-020 の4、DD-021 の範囲の外、OPS-017 |
| 3回目 | 論理・構造は FAIL（中2件）、システム・戦略は条件付きの PASS | 戻す担当の待機が DD-020 の9に無い、deploy-notes に書く KGI の表の名前が O17 の除外に無い、書き出しの Artifact の機密性、0039 を戻す範囲、(6) の改めの確認の期限、メモの件数と OPS-017 の期限のずれ、`constitution-events.ts:26` の `kgiCoefficient` | DD-020 の2・4・5・7・9、DD-021 の4・6・範囲の外、SECURITY-014・OPS-018、§2・§6・§7・§9 |

3回目の指摘を直した後は、4回目の検証を回していない（回数の上限）。直した後に流した検査の結果：

- `pnpm typecheck`：exit 0。
- `pnpm check:docs`：PASS（current backlog 106 件）。
- `pnpm test:coverage`：213 ファイル通過・1 スキップ、3384 件通過・1 スキップ。カバレッジは文・分岐・関数・行とも 100%。

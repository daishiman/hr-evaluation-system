# 仕様反映の受領書 — 評価レポートの入口と印刷（2026-10-21）

## 対象と判断

- Beads: `hr-inn.6`。dev-graph node: `SYS-EVAL-REPORT-P06`。関連: P05・P07・P09・P10。既存 feature の継続差分として扱う。
- 対象は[差分仕様 R1〜R6](../../../specs/report-access-print.md)。今回追加する業務上の挙動は、入口の明確化・回答と対応評価の接続・A3 と印刷準備待ち。
- **仕様・設計への影響あり**: 製品仕様 §29、DD-025、T2/T3/T4、差分仕様、差分設計と索引へ反映。システム仕様は C01 の単一 writer で補足根拠を接地し、C03 compile で再生成する。
- **追加影響なしの範囲**: 全体管理者の会社切替による全員閲覧、本人向け数値非表示、昇給・昇格の点数判定と上司の判断、コメント保存の役目は既存仕様を維持。空対象の修正は直属だけを集計する既存仕様への整合。新しい権限・表・列・migration は不要。
- 管理対象 feature/task の計画本文は再生成せず、既存索引から受領書へ接続する。新 package や重複タスクを追加しない。Beads の更新は親担当が実施する。

## 正規反映

| 段階 | 状態 |
|---|---|
| 製品仕様・設計 | §29、DD-025、T2/T3/T4 と specs/architecture の短い差分文書へ反映 |
| システム仕様 | C01 `chunk` で補足根拠 `qa-aa01-report-access-print` / `qa-aa02-empty-evaluation-scope` を既存確定セルに追記。C03 compile で10ファイルを生成。網羅性・出典・必須情報の接地ゲートはPASS |
| 機能・タスク | features/README と既存13タスクの README から本受領書へ接続 |
| backlog | UX-033 でpreview確認・公開判断を管理 |

### システム仕様の正規操作記録

- 正本入力: `system-spec/spec-state.json` と `system-spec/fetched-references.json`。元の作業ツリーを変更せず、今回の作業ツリー内の正本に反映。
- writer: `system-spec-harness/0.1.22/skills/run-system-spec-elicit/scripts/apply-spec-transition.py chunk`。確定状態・主根拠・過去の問答は保持し、補足の `qa_refs` だけを追加。追加質問の回答は捏造せず、可逆な実装設計を `agent-inference`、空対象の実DB試験を `observed-fact` として区別。
- compile: `system-spec-harness/0.1.22/skills/run-system-spec-compile/scripts/compile-spec-doc.py compile --spec system-spec/spec-state.json --references system-spec/fetched-references.json --out-dir system-spec`。
- `validate-coverage-matrix.py --require-complete --require-basis --require-foundation`、`validate-source-citation.py`、`validate-knowledge-graph.py --profile required-info` はPASS（未接地の必須項目0）。`validate-spec-doc-sync.py` もPASS。compile の受入テスト `test_compile_spec_doc.py` は pytest で47件PASS。`check:docs` と `git diff --check` もPASS。
- `route-ledger.json` は同じルート・同じ権限を維持して目的の用紙表記のみ更新。既存の生成済み dev-graph artifact の source lineage は手書き更新しない。

## 検証・公開の受領欄

- unit/integration: 全体1回で226ファイル・3,625件PASS、既存1件skip。計算対象のcoverageはstatement/branch/function/lineすべて100%。空対象の修正は修正前に実DBで再現し、関連5スイート129件PASS。導線・対応評価の権限13件PASS。
- 型検査: `cf-typegen`後の`typecheck` PASS。AIDDキット配置検査は全項目OK。既存task構造exact13ゲートも再実行して違反0（親担当ログ `/tmp/hr-report-plan-final.log`）。`check:docs`・`git diff --check` PASS。用紙/見出しの最終差分に対するReportTemplate16件PASS。
- Workers build: OpenNext build PASS。既知の依存コピー警告7件はあるがworker生成と実動を確認。bundleは2,081.2 KiB、上限3,072 KiBの67.7%。
- Workers preview: `http://localhost:8789`、専用のローカル見本DB `/tmp/hr-report-access-print-state`。元のpreview・既存DB・本番には書き込んでいない。
- Playwright: 4ファイル・setupを含む11件PASS。上長/本人の4幅、本人の点数非表示、上長の担当外404、全体管理者の会社切替と2社の閲覧/会社外404、点数25/100・昇給不可→理由付きで昇給あり→確定→レポートまで確認。点数判定・点数そのもの・会社所属の等級は不変。給与や社員等級の実変更はこの確定操作の責務に含まない。
- 印刷: 最終A3見出し幅の修正後、印刷3ケースとsetupの4件を再実行してPASS（`/tmp/hr-report-print-final.log`）。印刷用SVGを一時的に未準備にし、準備中は印刷が呼ばれず、描画後に呼ばれることを実証。フォントの準備が終わらない場合も15秒後に印刷を抑止し、再試行で印刷できることを実ブラウザで別途確認。
- PDF実物: 上長・本人でA4/A3標準2枚。別途採取したPDFは `/tmp/hr-report-access-print-evidence/reviewer-A4.pdf`（594.96×841.92 pt）と`reviewer-A3.pdf`（841.92×1191.12 pt）。画像化したpage1を目視し、図・本文の欠落やぼやけを認めず。`pdfimages -list`でラスタ画像0件、図はSVG由来のベクターを維持。
- 長文: `long-comment-A4.pdf`は3枚。`pdftotext`で同じコメント文70回と末尾の確認文すべてを確認し、追加ページで欠落しない。後半の見出しを「評価レポートの続き」にして物理ページ番号と混同しない。
- catalog: `migrate-legacy-colors.mjs src --json`は`report-only / external-brand / app-theme-contract`。既定profile未導入のためcatalog-default verifyのprofile未検出FAILを採用profile適合と偽らず、DD-003のREPORT_ONLYを継続。テーマ宣言・既存のテーマ契約テスト・配色を変更せず、4幅と印刷の実測を別途の受入証拠にする。
- 12ui: 既存の見本帳票のcaptureまで実行。draftは本人認証が必要で未実施。生成デザインが完成したとは扱わず、既存帳票の最小寸法・準備待ち修正として検証した。
- launch-security差分監査: 新規の未解決CRITICAL/HIGHは0。認証・会社境界・自己承認禁止を維持し、空対象による担当外更新を修正。新外部API・永続保存・権限系を追加せず、SQLは既存Drizzleのparameterized条件。`pnpm audit --prod`は既存lock由来のcritical0/high2/moderate3（better-auth経由のvitest/vite/source-map-js等）。開発サーバー・ソースマップ入力の経路で、生成したWorker handler/middlewareに該当ライブラリ名が含まれないことを確認。依存更新は今回の変更に混ぜず既存の依存監視を継続する。
- 本番反映: 未実施。既存のv1以降アプリに対するローカルpreviewの改善候補であり、新しい公開版としてのv0/v1タグは付けていない。利用者確認とPR後の公開判断を残す。
- 4条件の最終判定は[30手法レビュー](../../reviews/elegant-report-access-print-2026-10-21.md)へ接続する。既存の未決POLICY/SECURITY/OPS項目を本変更のPASSで解消と扱わない。

## 提出の記録

- baseは `main`（`4e5986c`）。`origin/main` → ローカルmain → 本ブランチの順に取り込み済み。
- `devgraph/SYS-EVAL-REPORT-P06`、実装commit `e911dbb` をoriginへpushし、[draft PR #98](https://github.com/daishiman/hr-evaluation-system/pull/98)を作成。対象40ファイルだけを選択し、機密検査・差分検査を通過。元の作業ツリーの無関係差分は含めていない。
- 主な追跡は Beads `hr-inn.6`、dev-graph `SYS-EVAL-REPORT-P06`。関連 `hr-inn.5`・`.7`・`.9`・`.10` と親 `hr-inn` へ結果とPRを記録する。本変更は本番未反映であり、テスト成功やdraft作成だけでタスクをcloseしない。GitHubのCI結果はPRへ記録する。

## 追加依頼による紙面の改訂 — A3 横1枚 / A4 縦複数枚

- **仕様・設計への影響あり**: A3 横は標準1枚に変更し、用紙の初期選択は従来どおり A4 縦を維持。左に①〜④と上長コメント、右に⑤〜⑦を並べる。A4 縦は前半と後半で区切り、長文は追加ページへ送り全文を残す。以前の A4/A3 縦・標準2枚の実測と採取済み PDF は改訂前の履歴であり、今回の印刷差分の合格証拠へ流用しない。
- **本文欠落を防ぐ設計**: A3 の長文を切り詰めたり極端に縮めたりしない。A3 に収まらない場合は印刷を開かず A4 への切替を案内する。図はベクターを継続し、準備待ち・15秒超過時の再試行も維持。
- **URL の扱い**: レポート本文へアプリのナビ・リンク先 URL を刷らず、`@page margin:0` と本文12mm余白のページごとの反復でネイティブな余白表示を避け。ブラウザ自身のネイティブなヘッダーとフッターは全環境で強制できないため、残るときは利用者が印刷設定でオフにする案内を出す。
- **反映先**: 製品仕様 §29・DD-025・T2/T3/T4・specs/report-access-print.md・architecture/report-access-print.md・features/tasks 索引。C01 writer で補足根拠を追記し、旧QA本文は変更せず C03 compile で現在の規範へ接続する。
- **追加影響なし**: 閲覧権限、会社境界、本人の数値非表示、上司の判断・計算・確定、スキーマ、外部公開範囲は変更しない。
- **改訂後の検証**: 実PDF・previewの実測は実装担当の採取待ち。A3 横標準1枚、A4 縦の区切りと全文、A3 過長の抑止、URL の不出力を確認後に追記する。本番反映は未実施。

### 同日の追加依頼 — KPI キー別点数と等級の推移

- **仕様・設計への影響あり**: KPI キー別の獲得点 / 配点・判定を評価者向けに示す。⑤の「その等級の推移」を全確定期の等級ラベルと達成率の推移へ広げ、折れ線と表を併記する。等級を連続数値にせず、評価の時点の等級と分母で読む。
- **追加影響なし**: 本人向けの点数非表示、会社・直属の境界、確定条件、計算と上司の判断、保存スキーマは維持する。
- **黒線の調査**: 評価詳細の `ThresholdBand` が呼ぶ `buildThresholdScale` は `actualValue` を数値軸へ置く。黒い縦線は実績値であり、獲得点の棒とは異なる。項目の基準・単位が異なれば A 判定内の位置が異なることは合理的。凡例・単位・端に寄せる範囲外の説明を補い、現在基準の参考図と保存した判定を混同させない。保存値は再計算しない。今回の説明・グラフ・表と改訂PDFの実測は実装担当の採取待ち。

- **改訂後の正規ゲート**: C01 writer で `qa-aa03`〜`qa-aa09` を追記し、既存QA本文を保持して C03 compile を実行。網羅性（complete/basis/foundation）・出典・必須情報接地（未接地0）・生成同期・check:docs・diff check はPASS。黒線調査の根拠追記後にも再生成して同じゲートを再実行しPASS。compile受入47件PASS、旧QA逐語と既存セル状態の保全も確認。新しい画面やAPIは追加せず、ルート台帳は用紙の目的表記だけを更新する。

### 黒線の説明・詳細の印刷の改訂

- 得点の棒は「得点の割合」、帯は「実績の位置（現在の基準）」、共通凡例は「黒線＝実績値の位置（得点ではありません）。」「帯は現在の基準、判定は集計時の記録です。」とする。現在基準の帯を保存ランクで着色せず、集計時の判定を別記する。範囲外は `markerClamped` の below/above から左端以下 / 右端以上を説明し、実績値と単位を代替テキストにも渡す。計算・保存値は変更しない。
- 依頼の画像が既存の評価詳細の印刷である可能性も考慮し、そちらは「評価の詳細を印刷」としてレポート印刷と区別する。未確定の評価の明細印刷は維持。詳細の named page にも本文余白の反復と URL・日時の余白対策を適用し、ブラウザ設定の補完案内を残す。実測結果は実装担当の採取待ち。

### 最終の実装整合 — 用紙の初期値と余白対策

- 利用者は A3 の既定化を指定していないため、用紙の初期選択は従来どおり A4 縦を維持する。A3 横を選んだ場合は標準1枚、収まらない場合は A4 へ案内する。初稿の A3 既定化は採用せず、現在の製品仕様・DD・T2/T3/T4・差分仕様を実装とそろえた。
- URL・日時の抑制は、実装された `@page margin:0` と本文の12mm余白、`box-decoration-break:clone`（webkit併記）だけを使う。追加の空 margin box 宣言は実装しない。旧QAの案は履歴として保持し、C01 の最終補足 `qa-aa09` で採用形を明確にして C03 へ投影する。
- 基準帯の黒線は実績値として説明し、得点の棒と区別する。評価詳細の保存操作などの action panel は紙へ出さず、印刷する本文と操作を分ける。最終PDFの実測は実装担当が追記する。

- 最終整合後も、C01→C03、complete/basis/foundation、出典、生成同期、check:docs、diff check はPASS。旧QA本文の不変を再確認。実装の最終PDFや通し試験の結果は本項の文書ゲートとは分けて追記する。


### 改訂後の実測と受領（A3 横1枚・KPI点数・等級推移）

- 対象の5スイート189件PASS、最終のテンプレート/UI規律104件PASS、型検査PASS。OpenNext build PASS。全量のローカル検査は繰り返さず、既存PR98のCIで最終全体を確認する。
- 最終Workers previewは `http://localhost:8789`。同じ専用persist DBの架空データだけを利用。本番・元の作業ツリー・従来のDBを変更していない。
- 最終E2Eは2ファイル＋setupの6件PASS（`/tmp/hr-report-onepage-final-e2e.log`）。上長/本人4幅、本人の点数非開示、紙用SVGの準備待ち、A3横1枚、A4の区切り、過長A3の抑止→「A4で全文を印刷する」で回復、を通した。
- 実物は `/tmp/hr-report-onepage-evidence/` の `e3-A3.pdf` / `e8-A3.pdf` / `e3-A4.pdf` / `e8-A4.pdf`。3項目と8項目の通常見本がともにA3横1枚（1191.12×841.92 pt）で、通常A4縦は2枚（594.96×841.92 pt）。極端な長文は3枚で、コメント70文と末尾の確認文を `pdftotext` ですべて確認した。
- 8項目の既存見本は等級5-1→5-2、KPI達成率86→100→92%を持つ。項目別得点/配点・判定、全確定期の当時等級と達成率、等級別平均、履歴が1枚の中で対応することをPDFの画像でも確認。等級の変化と得点の因果関係は主張しない。
- 全PDFはブラウザの自動ヘッダー/フッターを有効にした `displayHeaderFooter:true` で生成。レポートと旧評価詳細の双方で `localhost`・ブラウザURLが出ないことをテキスト抽出で確認した。旧詳細は帳票の外の確認/確定パネルが最後の既定ページに出ていたため、当該操作と次評価リンク・再集計案内を `no-print` にして除外。詳細の最終PDFは5枚、URLなし。
- `pdfimages -list` はラスタ画像0件。SVGの図を画像化せず、A3/A4の実寸で鮮明さ・本文と図の欠落がないことを確認。スクリーン用のグラフやナビゲーション・印刷操作は刷らない。
- 黒線は、ローカルの現在基準だけを一時変更する実証も実施。集計時のランクA/獲得点/実績83は不変、現在の帯に保存ランクの着色がないこと、実績の単位と左端以下の説明を確認し、現在基準を元へ復元した。上限なし/下限なし・境界・範囲内/外・低いほど良い基準はdomain検査で固定。計算値や保存ランクは一切書き換えない。
- 差分監査: 新しい公開API・外部送信・権限・永続保存はなし。紙面測定は同一originの既存CSSとレポートのSVG/文字だけを一時iframeへ複製して行い、成功/失敗にかかわらず破棄する。本人向けに点数のキーを生成しない設計は維持。今回差分の未解決CRITICAL/HIGHは0。既存の依存・運用リスクは継続管理する。
- ブラウザ差: Chrome/Chromiumの自動ヘッダー/フッターはpage marginへ置かれるため、余白を0にし本文で各頁余白を反復する。根拠は[Chrome公式の印刷余白の説明](https://developer.chrome.com/blog/print-margins?hl=en)。他ブラウザや利用者が変更した印刷設定では必要に応じ「ヘッダーとフッター」をオフにする。全ブラウザで強制除去したとは扱わない。
- 本番反映は未実施、既存draft PR98の継続修正。BeadsとPR/CIの最終記録は親担当へ引き渡す。

## 印刷準備の待ち時間への継続改善（P09）

- **対象と前提**: ユーザーは待機中に次の操作へ進めないと指摘。具体的な場面の回答は未着であり、直前の文脈からレポートの印刷準備と仮定して小さな可逆差分を作る。本番の長い待機は未再現。ローカル Workers のレポート GET 891ms は参考測定であり、本番の再現結果ではない。既存コードの図/文字の準備上限15秒、A3測定内フォント待ち上限3秒は実際の毎回の待機時間とは区別する。
- **仕様・設計への影響あり**: 表示後に図とフォントを背景準備し、A3 選択で紙面測定。同一レポートだけで再利用し、準備完了後の利用者の明示クリックで印刷を開く。用紙選択・別画面への移動は準備中も妨げず、取消・再試行を提供する。離脱、会社・社員・閲覧形・内容変更では古い結果を破棄し、遅れて印刷を開かない。ブラウザ・OSの印刷ダイアログ自体は背景化しない。
- **反映先**: 製品仕様 §29、DD-025、差分仕様/設計、features/tasks 索引。システム仕様は既存QAを保持し、C01補足→C03 compile の正規経路で反映する。
- **追加影響なし**: A3横標準1枚/A4区切り・全文、URL抑制、本人の点数非表示、会社と直属の境界、計算・保存・確定条件は維持。新API・スキーマ・永続ジョブ・外部送信は追加しない。
- **追跡**: Beads `hr-inn.9`、dev-graph `SYS-EVAL-REPORT-P09`、base `origin/main fb01b4d`。PR98はマージ済みであり、本継続差分は別途親担当がレビュー・PR化する。元の作業ツリーの無関係差分は対象外。
- **検証と公開**: 型検査、印刷準備と既存帳票の局所Vitest 20件、最終Workers build、bundle検査（gzip 2082.5 KiB / 上限3072 KiB）、テーマ契約ファイルの差分0を確認。最終Workers previewの印刷E2Eはsetup込み6件PASS。準備中の用紙変更、中止/再試行/画面離脱、準備後の同期クリック、A3測定の再利用と同じ画面の内容変更時の再測定、A3過長のA4回復、本人/評価者のA3標準1枚・A4標準2枚を確認した。会社切替そのものの追加試験と実機印刷は未実施。過去の自動印刷の試験結果は今回の証拠に流用していない。本番反映は未実施。新PRとCIの結果はPR/Beadsへ記録する。
- **今回の文書ゲート**: C01 writer の `chunk` で `qa-aa10-report-print-background-preparation` を ui-ux/frontend/maintenance-ops の既存確定セルへ補足し、C03 compile で生成。網羅性 complete/basis/foundation、生成同期、旧QA本文・セル状態の保全、`check:docs`、`git diff --check` はPASS。compiler受入の全量反復は行わず、実装の局所検証を待つ。

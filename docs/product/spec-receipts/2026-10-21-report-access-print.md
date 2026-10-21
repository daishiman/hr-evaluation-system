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

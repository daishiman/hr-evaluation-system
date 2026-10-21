# 評価レポートの仕様反映・最終レビュー受領書

日付: 2026-10-21。対象: Beads `hr-inn`、`hr-inn.1`〜`hr-inn.13`、dev-graph `feature-evaluation-report-and-raise-judgment`、`SYS-EVAL-REPORT-P01`〜`P13`。

## 差分と公開単位

- `git status`、作業差分とステージ差分を確認。基準は `origin/main`。リモートに `dev` はなく、ローカルmainで `origin/main` を取り込み、そのmainを作業ブランチへ取り込んだ。いずれも `dbe633361a7638c36360cde905a5b5c17822073d` で追加のマージ差分はなかった。
- 第1段は `devgraph/SYS-EVAL-REPORT-P05`。評価レポート、上司の判断、アンケート運用、権限・公開範囲、計算の整理、見本データ、0038と関連文書・テストを含む。
- 第2段は `devgraph/SYS-EVAL-REPORT-P08`。0039の移行とrollbackだけを別に保存する。第1段の本番稼働確認と、既存の公開前条件を満たすまでマージしない。2段階の理由と実行手順は [配布の正本](../../deploy-notes.md#14-評価レポートと上司の判断の配布移行-00380039) に従う。
- 別作業の `docs/handover-cloudflare-github.md`、`scripts/handover/`、READMEのその案内、生成した `docs/product/design-conformance.json` はコミットから除外する。main側にある既存の `.beads/interactions.jsonl` 差分も混ぜない。
- 本依頼はdraft PRの作成まで。マージ・本番migration・配布・本番DBの読み取りは実施しない。

## 仕様・設計への影響と反映経路

| 内容 | 影響と対応 |
|---|---|
| 評価レポート・上司の判断・削除する事業所の仕組み・公開範囲・アンケート状態・評価セットの選択 | 仕様・設計に影響あり。承認済みのG17〜G24・O17〜O24・I18〜I25、DD-020〜024、qa-z01〜z07と訂正が `system-spec/spec-state.json` に反映済み。今回も正規compile経路で10ファイルを再生成し、生成内容の一致まで検査した |
| 編集規則、確定コメントの実保存値の検査、図表枠・寸法、対象評価IDでの取得 | 新しい業務仕様への影響なし。既存の編集禁止・本人へ出す文の検査・凡例・閲覧範囲の契約を満たす実装修正と内部共通化。所有者・単位・状態遷移・公開条件・計算の決定を追加していない |
| `specs/`・`architecture/` | 既存の対応文書とDDの訂正を確認し、本機能の変更分を含める。今回の内部整理による追加の業務仕様はなく、同じ要件を別文書へ転記しない。取り込み時点の写しと現行正本の読み替えは [計画レビュー](./2026-10-20-evaluation-report-plan-review.md) に従う |
| `features/`・`tasks/` | featureと13 taskの生成物を含め、現在の受領書と読み替えへ辿れる索引を追加。生成物のmanaged本文を直接書き換えない。機能文書末尾の余分な空行1行だけは差分検査に従い除去し、意味内容・メタデータは維持 |

実行した正規フロー:

1. `validate-coverage-matrix.py --require-complete --require-basis --require-foundation`: PASS。
2. `validate-source-citation.py`: PASS（対応・必須項目・公式hostの検証。新たな出典取得は不要）。
3. `run-system-spec-compile/scripts/compile-spec-doc.py compile`: 要件定義・8技術章・indexの10ファイルを生成。
4. `validate-spec-doc-sync.py`: PASS。

取り込み元の記録は `validate-source-lineage.py` で9 nodeを確認し、9件とも `lineage_digest_mismatch`。旧受領書の「8件」はその時点の結果で、要件定義書の後日の更新により現在は9件である。既存nodeの `source_lineage` を更新する正規writerの経路がないため、手でdigestを書き換えていない。製品仕様の未反映とは区別し、[OPS-015](../backlog.md) に残す。

## task品質ゲートと状態

全13 taskの `Automated commands` を確認し、重なる検査は一度にまとめる。古いtaskの指示は [計画レビュー §2](./2026-10-20-evaluation-report-plan-review.md#2-task-ごとの読み替え) を優先する。

| task / Beads | 最終確認と扱い |
|---|---|
| P01〜03 / hr-inn.1〜3 | 要件・設計・設計レビューの受領書、DDと対応表、文書検査を確認 |
| P04〜06 / hr-inn.4〜6 | 機能の単体・結合・契約・静的検査、型・網羅率、見本データの冪等性を確認。REDの証跡は既存受領書を保全 |
| P07 / hr-inn.7 | ローカルpreviewの受入E2Eを確認。本番の読み取りはP13へ留保 |
| P08 / hr-inn.8 | 0039とrollbackは別の公開単位。ローカルの適用・形の復元はテストで確認。本番へ進む条件は未充足 |
| P09 / hr-inn.9 | Cloudflare build・容量・テーマ契約を確認。古い「globals.css全体の差分0」は印刷CSSの要件と両立しないため、テーマ宣言と契約テスト無改変・必要な印刷等のCSS差分を確認する |
| P10〜12 / hr-inn.10〜12 | 読み取り専用の最終コードレビューで新規修正必須事項なし。仕様反映・証跡・文書への入口をこの受領書に記録 |
| P13 / hr-inn.13 | 本番公開と読み取りの証跡がないため完了にしない。draft作成で閉じない |

構造ゲート `validate-system-plan.py` はexact-13・P01〜P13・共通feature/package・依存を検査しPASS（violations 0）。taskの完了は `linked_pr_merged_all` に従い、draft作成やテスト成功だけでBeadsを閉じない。

### 再実行の結果

| 検証 | 結果 |
|---|---|
| 第1段のステージ対象184ファイルだけを展開した検証用コピーでの `vitest run --coverage --maxWorkers=4` | 225ファイル・3,612件PASS、5件skip。skipは既存の1件と、分離した0039を必要とする4件。計算・ドメインの文／分岐／関数／行は100% |
| 同じコピーでの `typecheck` / `check:docs` | PASS。引き継ぎ手順書とそのテストに依存せず通過 |
| 0038・0039の適用とrollbackの結合検査 | 6件PASS。2段階を含む元の作業ツリーで実行。第2段のSQLはこの検証と同じファイルを別ブランチへコピー |
| `cf:dry-run` / `check:bundle-size` | 終了コード0でWorker生成完了。圧縮後2,082.3 KiBで上限3,072 KiB以内。依存コピー7件の非致命的なログは保全 |
| ローカルpreviewの対象E2E6本 | setupを含む19件PASS。4幅、本人・上長のA4縦2枚、確定・権限・アンケートの操作・見本データの網羅を確認。複製DBを使い、既存ローカルDBや本番に試験データを書いていない |
| テーマ契約 | 3契約テストの差分なし、冒頭のテーマ宣言を維持。全体テストにも含めて確認 |
| `git diff --cached --check` | featureの末尾空行1行を除去後PASS |

PRは2つともmainを向けるdraftとする。第2段は先行する第1段のマージ・配布・main取り込み・CI再確認が必要な依存待ちのPRであり、単独でリリース可能とは判定しない。

## 残課題

公開前の判断待ち SECURITY-013〜015、POLICY-011、OPS-017と保管期限の判断は [現在の残課題](../backlog.md) を正本とする。今回のdraft作成の依頼を公開の承認やリスク受容と解釈しない。

## commit・pushとPR作成の記録

| 対象 | 記録 |
|---|---|
| 第1段 | `b199bc73a8b937b56a047e96ddf6fda905ca02a8`、`devgraph/SYS-EVAL-REPORT-P05` をoriginへpush済み。184ファイルを明示的に選択 |
| 第2段 | `b71e039442123c03ce79af9fb967168e7173c174`、`devgraph/SYS-EVAL-REPORT-P08` をoriginへpush済み。2つのSQLだけを別の作業ツリーで保存 |
| draft PR | [第1段 #96](https://github.com/daishiman/hr-evaluation-system/pull/96)・[第2段 #97](https://github.com/daishiman/hr-evaluation-system/pull/97)を作成。両方OPEN・draft、baseはmain。#97の差分が2つのSQLだけであることをAPIとPR差分で確認 |
| PR本文 | 目的・平易な概要・技術説明・検証・仕様反映・Beads/dev-graph ID・残課題を記載。#97は#96の公開と稼働確認後に進める依存待ち |
| Beads | PRのURLと認証に関する訂正を追記し、公開未実施のためタスクは閉じない |

### 認証経路に関する訂正

当初の「本人の再ログインが必要」という判定は誤りだった。PATH先頭の `/usr/local/bin/gh` は2.20.0で古い認証を見ていたが、`/opt/homebrew/bin/gh` 2.96.0では `daishiman` としてkeyringで認証済みだった。新しいCLIでリポジトリ・main・既存PRを確認し、PRを作成した。接続済みGitHubアプリの403はその連携固有の作成権限の制限として残る。再ログインを求めたdevice flowは期限切れで終了し、新しい認証情報を読み出したり共有したりしていない。

push時にGitHubが既定ブランチの依存脆弱性14件（critical 1・high 4・moderate 6・low 3）を通知した。今回の依存変更によるものとは判定していない。公開前の確認事項として記録し、依存バージョンはこの作業で変更していない。

クローズ済みの別タスクの代表例も照合した。`hr-czp.13` はPR #90、`hr-s4s` は #92、`hr-wcv.12` は #93・#94の取り込み・配布の証跡で閉じている。これらを「閉じているから」という理由だけで除外したのではなく、mainに反映済みの同じ変更を再提出しない。今回の `hr-inn.1`〜`.13` は12件in_progress・1件openのままで別に扱う。

## PR #97のCI修正（2026-10-21追記）

この節は上記のPR作成時点からの更新記録。#96は `b2122a0a03965e2ba44d878faa76d578a287943c` としてmainへマージ済み。利用者から先行反映済みとの連絡を受けた。

- 原因: [失敗したCI](https://github.com/daishiman/hr-evaluation-system/actions/runs/39560115570) は、#96を含まない旧コードと0039の組み合わせだった。旧fixtureが削除済みの `kgi_coefficients` へ書き込み、`no such table` で失敗した。
- 対応: `origin/main` → ローカルmain → `devgraph/SYS-EVAL-REPORT-P08` の順に取り込んだ（merge `7fc0182`）。先行コードと0039の依存を満たす。テスト・網羅率の基準・SQLの内容は変更していない。
- 仕様反映の受領: 追加の業務仕様・設計への影響なし。DD-020・DD-024で定義済みの公開順にブランチを更新した対応であり、データの削除範囲・復元範囲・権限・計算・公開条件は変わらない。`system-spec/`・`specs/`・`architecture/` の既存反映をmainから受領し、生成文書の再生成は不要と判断した。`features/`・`tasks/` からは既存の索引で本受領書へ辿れる。
- 対象: Beads `hr-inn.8`、dev-graph `SYS-EVAL-REPORT-P08`。本番への0039適用・本番確認はこのCI修正では行わず、P13の完了とは扱わない。

### CI修正後の再検証

- #97専用の作業ツリーで `pnpm install --frozen-lockfile`、`check:docs`、キット配置検査、`cf-typegen`、`typecheck`、`test:coverage --maxWorkers=4` がすべてPASS。225ファイル・3,616件PASS、既存の1件skip。網羅率は文・分岐・関数・行すべて100%。0039が揃ったため、先行PRでskipだった4件も実行した。
- exact-13構造ゲートは計画メタデータを保持する元の作業ツリーで再実行しPASS（violations 0）。task本文に今回の差分はない。
- `git diff --check`、対象ファイルの機密検査を確認。追加の実装変更はなく、mainに対する差分は0039の2つのSQLとこの受領書だけ。
- #96のGitHub CIは成功を確認。Deploy run `39562261411` はこの記録時点では実行中であり、本番稼働の独自確認とは区別する。0039の配布時は既存の配布手順に従う。

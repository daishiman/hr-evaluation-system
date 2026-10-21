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

公開前の判断待ち SECURITY-013〜015、POLICY-011、OPS-017と保管期限の判断は [現在の残課題](../backlog.md) を正本とする。今回のdraft作成を公開の承認やリスク受容と解釈しない。GitHub CLIの認証は失効していたが、接続済みGitHub連携で対象リポジトリのadmin/push権限を確認できたため、PR操作はそちらを使う。認証情報を読み出したり共有したりしていない。

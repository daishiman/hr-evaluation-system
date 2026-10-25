# 行動指針・KPI改善の最終レビューと仕様反映受領書

## 対象と結論

- 日付: 2026-10-26。
- Beads: 親 `hr-6pi`、子 `hr-6pi.1`〜`hr-6pi.13`。P13 は本番適用待ち。
- dev-graph: `feature-guideline-kpi-ux-and-two-way-sync`、`SYS-GUIDE-KPI-P01`〜`P13`。
- ブランチ: `devgraph/feature-guideline-kpi-ux-and-two-way-sync`。基準は `main`（リモートに `dev` は無い）。
- 起点: `44a2e028c1b09d69a9933bee2c11f8e6e4e754c5`。`git fetch origin` の後、main の作業場所で `git merge --ff-only origin/main`、作業ブランチで `git merge main` を実行した。いずれも Already up to date で競合は無い。
- `git status`・追跡済み差分・未追跡ファイルを確認した。`.claude/state/` のキット改善提案は無関係なので含めない。main の別作業場所にある既存の `.beads/interactions.jsonl` も変更・コミットしない。
- ユーザーの今回の依頼を統合PR作成の承認として扱う。以前の「commit・push・PR はまだ行わない」は今回の明示依頼で更新された。段階別PRの先行マージを前提とする計画の読み替えは [tasks の入口](../../../tasks/feature-guideline-kpi-ux-and-two-way-sync/README.md) に記録した。

## 仕様・設計への影響と反映経路

**影響あり。** 設定と設問の双方向保存、状態別の自動追従、割り当ての移行、画面の分割、見本の受付中の期、部品の状態表現、暗号化バックアップが変わる。

要件の収集・承認済み `system-spec/spec-state.json` → `system-spec/` の要件定義と8章 → `specs/system-spec-requirements.md`・`architecture/system-spec-*.md` → feature・13 task、という既存の正規フローの成果物を照合した。新しい要件を作ったり、承認済みの判断を変更したりしていない。`validate-coverage-matrix.py`（complete・basis・foundation）、`validate-source-citation.py`、`validate-spec-doc-sync.py`、`validate-graph-schema.py` を再実行し、正本から章への投影と graph の整合を確認した。

| 影響 | 仕様・設計の反映先 | 実装・検証の主な対応先 |
|---|---|---|
| 行動指針の既定割り当て | 製品仕様§30、DD-026、database・backend、移行の手順§15 | 移行0040・戻しSQL・移行/新会社の試験 |
| 画面の情報量と4作業への分割 | DD-027、ui-ux・frontend、ルート台帳とアクセス契約 | SchemeHub・各作業画面・画面幅のE2E |
| 双方向保存・追従・整列 | DD-028、master-settings、写しの一覧、data-freshness | form-to-settings・follow-settings・form-align の単体/結合試験 |
| 見本の受付中の期 | 製品仕様§14、DD-029、maintenance-ops | sample-data の生成試験・評価作成E2E |
| テーマを保つ部品の状態 | DD-030、ui-ux・frontend | theme/palette/UI/キット境界契約・色の比・状態E2E |
| 暗号化した移行前バックアップ | DD-031、deploy-notes、release-and-forms の設計 | Deploy/Migrate workflow・暗号化スクリプト・契約試験 |

最終レビューで `system-spec/release-and-forms.md` §7 に、DD-028 適用前の説明が残っていることを発見し、現在の既存設問/新規設問の検査・原子的保存・追従の契約へ修正した。`architecture/release-and-forms.md` に責務分割と暗号化の設計を追記した。features・specs・tasks の入口から本記録を辿れるようにした。

## 品質ゲート

MVPとして既存の検査を再利用し、新しい評価の仕組みや網羅的な追加試験は作らない。P06の全E2E再実行は今回の変更に対応する4本に絞る。移行と戻しの振る舞いは既存の実SQLite結合試験で確認し、ローカルD1へのシードや移行SQLの手動再投入は繰り返さない。

| ゲート | 結果 |
|---|---|
| 型検査 | `pnpm run typecheck` 成功 |
| 文書drift・差分の空白 | `pnpm run check:docs`・`git diff --check` 成功。current backlog 114件 |
| 仕様の収集・出典・章の同期 | 全て成功 |
| graph schema | 成功、違反0件、23ノードのreadiness complete |
| feature context | sha256 `74772c910ff81b3a3c4c320fecd6850d4eb42c959c2860200158843573acbc7f` と一致 |
| テーマ保護 | 起点から保護対象4テスト・T2に差分なし。globals.css冒頭宣言も一致 |
| 全体試験とカバレッジ | `pnpm run test:coverage --maxWorkers=2` 成功。241ファイル・3,920件成功、1ファイル/1件スキップ。カバレッジ対象のdomainは statements/branches/functions/lines 全て100% |
| Cloudflare向けビルド | `pnpm run cf:dry-run` 成功（終了コード0） |
| 配布容量 | `pnpm run check:bundle-size` 成功。圧縮後2,138.8 KiB、Free上限3,072 KiBの69.6% |
| 対象4本のE2E | `E2E_BASE_URL=http://localhost:8792 pnpm exec playwright test e2e/guideline-kpi-screens.spec.ts e2e/settings-two-way-sync.spec.ts e2e/sample-open-cycle-evaluation.spec.ts e2e/component-states.spec.ts` 成功。認証準備を含む49件、1.0分。今回ビルドしたWorkerを専用ローカルpreviewで検査 |

通常スキップする1件は `production-bounds.check.test.ts` の本番実データを指定したときだけ行う検査。本番データは取得していない。ビルドは終了コード0でWorker生成まで成功したが、OpenNextが `js-tokens`・`strip-ansi` のコピー失敗をログに出した。ローカルWorkerの `/login` は200で応答した。画面試験の結果と合わせ、ログ上の制約として残す。

P04の「実装前に赤いこと」、P08の試験データ投入・整列・P09の過去の見た目等は既存の [受領書](./2026-10-22-guideline-kpi-ux-and-two-way-sync.md) と [2026-10-24のレビュー](../../reviews/elegant-review-2026-10-24.md) の履歴として残す。現在の再検証と混同しない。P13の本番コマンドは入口条件を満たしていないので実行しない。

## 残課題と公開条件

- SECURITY-014: 暗号化方式はDD-031で決定済み。利用者が秘密鍵を保管し、GitHub Variablesの `D1_BACKUP_AGE_RECIPIENT` を設定するまで、移行を伴うDeploy/Migrateは止まる。設定済みかは今回未確認。
- OPS-019 / P13: mainへのマージ後のDeploy結果、本番の読取、会社ごとの整列内容の提示と本番書込前の確認、見本の入れ直しは未実施。
- RELIABILITY-008: 更新時刻の送信は必須化済みだが、読取とbatchの間の競合を完全に防ぐ保証はない。既存バックログのobserveとして残す。
- PERFORMANCE-008: KPI入口で全下書きを解析するコストは実測後に判断する。
- PRはdraftのまま提出する。マージ・本番公開・本番データの変更を今回の完了には含めない。

BeadsはP01〜P12と親を `in_progress` として検証と受領書を記録し、P13は `open` のまま本番適用待ちを記録する。未マージのタスクをclosedにしない。

## 最終判定

今回の実装・文書に、draft PRへの提出を止める未解決指摘はない。旧契約の説明を是正し、必要な既存ゲートを再実行した。上記の残課題と本番適用条件をPRへ引き継ぐ。テストの画像・認証状態・D1データ・検証用ログはコミット対象に含めない。


## 提出結果

- 実装コミット: `ec4ad014937ffe386547520c17e17d1f93b1c82c`。新規feature文書の末尾の空行は追加コミット `40580bbcd59453e3d6c266a2bd9572df26f8a5bc` で整えた。最終の `git diff --check origin/main...HEAD` は成功した。
- `origin/devgraph/feature-guideline-kpi-ux-and-two-way-sync` へpush済み。
- 初回はdraft PRを作成できなかった。旧ghは認証失効、GitHub連携のcreate_pull_requestは403（Resource not accessible by integration）、Chromeは未ログインだった。ブラウザでもbase main・2 commits・174 changed files・Able to mergeを確認した。
- [PR本文](../../reviews/2026-10-26-guideline-kpi-pr-body.md) を保存した。作成時のコマンド（再実行してPRを重複作成しないこと）は次のとおり。

```bash
gh pr create --repo daishiman/hr-evaluation-system --draft --base main --head devgraph/feature-guideline-kpi-ux-and-two-way-sync --title 'feat: 行動指針とKPI設定を整理しアンケートと連動させる' --body-file docs/reviews/2026-10-26-guideline-kpi-pr-body.md
```

### 継続作業の提出結果

- **[draft PR #100](https://github.com/daishiman/hr-evaluation-system/pull/100) を作成済み**。baseは `main`、headは `devgraph/feature-guideline-kpi-ux-and-two-way-sync`。OPEN・draftをAPIで確認した。
- 認証失敗の原因はPATHで `/usr/local/bin/gh`（2.20.0、2022年版）が優先されていたこと。`/opt/homebrew/bin/gh`（2.96.0）はkeyringの保存済み認証で利用でき、再ログインは不要だった。認証設定とPATHは変更していない。
- mainとリモート作業ブランチを再確認し、起点とpush済みSHAが変わっていないことを確認した。実装は変更せず、既存の検証結果を引き継いだ。文書driftとPR差分の空白検査は再確認した。
- 完了管理consumerの `_linkage_decision` はPR本文のmarkerが `[node_id]` と完全一致することを求める。12行のmarkerでは紐付けが成立しないため、正規consumerに合わせ主担当 `dev-graph:SYS-GUIDE-KPI-P12` の1行に整理し、関連する全タスクIDは本文に残した。
- P01〜P12と親のBeadsにPRを記録する。draftのためclosedにはしない。P01〜P11の完了は統合PRのマージだけで自動投影されると保証せず、マージ後に各受領証跡と正規consumerの条件を確認する。P13の本番作業は未実施。
- 正規consumerの `reconcile-github-lifecycle.py --mode check --graph-node-id SYS-GUIDE-KPI-P12 --pr 100` で `marker_verified=true`・`eligible=true` を確認した。完了判定はdraft/未マージなので `pending`。graphとtask本文へ完了状態は書き込まない。

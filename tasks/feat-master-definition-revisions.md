# タスク仕様: feat-master-definition-revisions

| 項目 | 値 |
|---|---|
| graph_node_id | `feat-master-definition-revisions` |
| beads_id | `hr-2qk` |
| 種別 | feature / regression |
| 状態 | implemented（ローカル検証済み） |
| base branch | `main` |
| work branch | `devgraph/feat-master-definition-revisions` |

## 目的

等級要件・昇格要件の内容変更を追記型の版保存へ変え、停止・再開・過去内容の再採用を互いに混同しないAPIとUIにする。
同時に、行動指針の等級割当を各等級の行内編集へ統一し、サンプルseedと放置評価通知の境界を固定する。

## 受け入れ条件

1. `*Revise` は新idを作り、旧行を変更しない
2. `*Activation` は現行版の同じidで停止・再開する
3. `*RestoreContent` は過去版を直接再開せず、現行版の後続を作る
4. id指定操作の会社・等級・区分/種類はDBの対象行から導出する
5. active上限、`previous_version_id` の枝分かれ、競合、系譜削除を拒否できる
6. 新フォームのみ新版を採用し、既存フォーム・評価は不変
7. 等級要件・昇格要件をstale監視から除外する
8. 停止項目への常時到達導線、10件時の事前理由、反映時期をUIへ出す
9. 行動指針の等級割当を各等級行/カード内のselect + 保存へ一本化する
10. #33のサンプルを#38の問い合わせへ通して結果0件を固定する
11. 等級要件・昇格要件は `up` / `down` / `top` / `bottom` で並べ替えられ、境界・別区分/種類・過去版・重複/非連続 `seq` を安全に扱う

## 担当範囲

- DB/API/domain: `previous_version_id`、操作別command、利用・削除・上限・stale
- UI: 等級要件・昇格要件の停止/履歴、行動指針の等級行内割当
- 仕様: product / system / architecture / migration / feature / spec / task / receipt
- 回帰: `scripts/sample-data.test.mjs`

## 依存関係と順序

1. DB migrationと系譜関数
2. 操作別APIとサーバー不変条件
3. 新フォーム選択・利用/削除・stale境界
4. UIの停止/履歴/行動指針割当
5. 横断回帰、全テスト、typecheck、仕様同期

DBより先にUIだけを切り替えない。新commandが保存の正本になってからUIを接続する。
作成済みフォームへの反映は明示同期へ分離し、改訂保存から自動実行しない。

## 品質ゲート

| ゲート | コマンド | 実測 |
|---|---|---|
| Sample × stalled | `pnpm exec vitest run scripts/sample-data.test.mjs` | PASS（1 file / 22 tests） |
| Sample + impact focused | `pnpm exec vitest run scripts/sample-data.test.mjs src/lib/impact-contract.test.ts src/lib/impact.watched.test.ts src/lib/impact.integration.test.ts` | PASS（4 files / 44 tests） |
| Versioned + masters focused | `pnpm exec vitest run src/lib/domain/grade-requirements.test.ts src/app/api/masters/versioned-requirement-update.integration.test.ts src/app/api/masters/body-schema.test.ts src/components/versioned-master-editors.test.ts` | PASS（4 files / 43 tests） |
| Unit / integration | `pnpm test` | PASS（84 files / 1407 tests、1 file / 1 test skipped） |
| Typecheck | `pnpm typecheck` | PASS |
| 空白・リンク | `git diff --check` / 関連パスの存在確認 | PASS |

実測日: 2026-08-13（4方向並べ替え追加後に再実行）。skipは任意の本番スナップショットが無いときだけ外れる既存 `production-bounds.check.test.ts` で、今回の変更範囲ではない。

## 残課題（Beads）

| beads | 内容 |
|---|---|
| `hr-c76` | 利用者・権限操作および制度マスタの actor 監査証跡（E7）。版系譜とは別責務 |
| `hr-nm6` | 認証済みスモークで migration 漏れ検知（E8） |

## 非採用

- 全制度マスタのイベントストア化
- 過去版idの再active化
- 作成済みフォームへの自動反映
- クライアント本文の `gradeId` / `category` / `reqKind` をid指定操作の正本にすること

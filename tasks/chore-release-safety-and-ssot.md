# タスク仕様: chore-release-safety-and-ssot

| 項目 | 値 |
|---|---|
| graph_node_id | `chore-release-safety-and-ssot` |
| beads_id | `hr-0p4` |
| 種別 | chore / reliability / docs |
| 状態 | implemented（ローカル検証済み） |
| base branch | `main` |
| work branch | `devgraph/chore-release-safety-and-ssot` |

## 目的

配布・文書・保存・版分類の不変条件を機械的に強制し、説明と実装の drift を止める。

## 受け入れ条件

1. Deploy は `main` 限定、同一 checkout の `test:coverage` 必須、本番 D1 未適用 migration 0件必須
2. Migrate は `main` の SQL のみ適用し、適用後に未適用0件を再照会する
3. 複数等級のフォームと設問を1 D1 batch で保存し、版一意制約競合だけ1回再試行する
4. 現在版判定を `currentVersionRows` / `classifyVersionedRows` に統一する
5. `constitution_events` を監査ジャーナル契約として正本化する
6. backlog を current/history に分離し、`pnpm run check:docs` を CI/Deploy に入れる
7. 仕様・設計・feature/task/beads/受領書を同期する

## 担当範囲

- CI/CD: `.github/workflows/{ci,deploy,migrate}.yml`
- 保存: `src/lib/form-build.ts` / `src/app/api/forms/route.ts`
- 版分類: `src/lib/domain/versioned-master.ts` / UI ラッパ
- 監査契約: `src/db/schema.ts` / `src/lib/domain/constitution-events.ts`
- 文書: README / backlog / deploy-notes / system-spec / architecture / features / tasks / specs / beads

## 品質ゲート

| ゲート | コマンド | 実測 |
|---|---|---|
| Docs drift | `pnpm run check:docs` | PASS（current backlog 63 件） |
| Versioned focused | `pnpm exec vitest run src/lib/domain/versioned-master.test.ts src/components/VersionedMasterSections.test.ts` | PASS（2 files / 38 tests） |
| Form focused | `pnpm exec vitest run src/lib/form-build.test.ts src/lib/form-build.integration.test.ts scripts/verify-d1-migrations-list.test.mjs` | PASS（3 files / 17 tests） |
| 合計 focused | 上記をまとめて実行 | PASS（5 files / 55 tests） |
| Typecheck | `pnpm typecheck` | PASS |
| 空白 | `git diff --check` | PASS |

実測日: 2026-08-13（最終レビュー再実行）。MVP のため全量 coverage ではなく focused を正とする。

## 残課題（Beads）

| beads | 内容 |
|---|---|
| `hr-c76` | 利用者・権限操作の actor 監査証跡（E7） |
| `hr-nm6` | 認証済みスモークで migration 漏れ検知（E8）。今回の D1 list gate は未適用検出であり、認証付き操作確認は別 |

## 非採用

- 本番への自動 migration
- 監査記録の即時原子化（RELIABILITY-003 として backlog に残す）
- 全量イベントストア化

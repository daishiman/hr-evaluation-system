---
graph_node_id: chore-release-safety-and-ssot
artifact_kind: feature
project_id: hr-evaluation-system
title: 配布安全性・文書SSOT・フォーム原子化の再検証改善
status: implemented
beads_id: hr-0p4
created_at: 2026-08-13
updated_at: 2026-08-13
---

# 配布安全性・文書SSOT・フォーム原子化の再検証改善

## 目的

本番配布・文書管理・アンケート保存・版分類の「人が守る説明」を「機械が守る不変条件」に引き上げ、事故半径を小さくする。

## 到達状態

- 本番 Deploy は `main` の同一 checkout だけで、文書検査・型・カバレッジ付きテスト・ビルド・容量を確認し、必要ならバックアップ後にD1 migrationを自動適用してから配布する
- 適用後に同じ本番DBを再照会して未適用0件を確認し、復旧用Migrateと同時実行しない
- 複数等級のアンケート作成は1つの D1 batch で原子化し、フォーム版の一意制約競合だけ1回再試行する
- 現在版と履歴の分類は `versioned-master` ドメインだけが正本で、UI はそれを呼ぶ
- `constitution_events` は監査ジャーナルであり、現在状態の正本でもイベントストアでもない
- 残課題は current / history に分離し、`check:docs` が drift を止める

## スコープ

**含む**

- Deployの自動migrationとMigrate復旧workflowのfail-closedゲート
- D1 migration list の判定スクリプト
- フォーム複数等級の原子的保存と版競合再試行
- 版分類の domain 一本化
- 監査契約の明文化と関連仕様更新
- backlog current/history 分離と文書 drift 検査

**含まない**

- 本番への実際の migration / deploy 実行
- 監査記録と本体更新の同一 batch 化（RELIABILITY-003 / 将来）
- 認証付きスモーク自動化（hr-nm6）

## 受入

| # | 条件 |
|---|---|
| 1 | Deploy がmain以外・未テストcheckoutを拒否し、未適用migrationをバックアップ後に自動適用する |
| 2 | 適用後再照会とDeploy/Migrate間の排他で、migration → deployの順序を守る |
| 3 | 複数等級フォーム作成が部分成功せず、版競合は限定再試行する |
| 4 | UI と計算が同じ現在版判定を使う |
| 5 | 監査契約が仕様・schema コメント・実装コメントで一致する |
| 6 | `check:docs` が current backlog の安定 ID と主要文書リンクを検査する |

## 関連

- Beads: `hr-0p4`
- レビュー: `docs/reviews/elegant-review-2026-08-13.md`
- 製品残課題: `docs/product/backlog.md` / `docs/product/backlog-history-2026-08-13.md`
- システム仕様: `system-spec/master-settings.md` §7 / `system-spec/release-and-forms.md`
- 設計: `architecture/master-settings.md` / `architecture/release-and-forms.md`
- タスク: `tasks/chore-release-safety-and-ssot.md`
- 仕様メモ: `specs/release-safety-and-ssot.md`
- 受領書: `docs/product/spec-receipts/2026-08-13-release-safety-and-ssot.md`

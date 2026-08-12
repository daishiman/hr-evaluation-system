# 仕様反映 受領書

| 項目 | 内容 |
|---|---|
| 日付 | 2026-08-13 |
| graph_node_id | `chore-release-safety-and-ssot` |
| beads_id | `hr-0p4` |
| 判定 | **仕様・設計・運用・保存契約への影響あり → 正規フローで反映** |

## 受領した決定

1. 本番 Deploy は `main` の同一 checkout のみ。文書・型・coverage test・build・容量・D1 migration 未適用0件を配布前に強制する
2. Migrate は main 固定 checkout + バックアップ必須 + 適用後再照会
3. 複数等級のアンケート作成は1 D1 batch の原子的保存。版一意制約競合だけ1回再試行
4. 現在版/履歴の分類正本は `classifyVersionedRows`（`currentVersionRows` 起点）
5. `constitution_events` は監査ジャーナル。現在状態の正本は各制度マスタテーブル。原子性は現状保証しない
6. backlog は current（未解決）と history（完了/経緯）に分離し、`check:docs` で drift を止める
7. README / deploy-notes を現行の実装と workflow に合わせる

## 4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | イベントストア主張を監査ジャーナルへ統一。current backlog から完了項目を除去 |
| 漏れなし | PASS | Deploy/Migrate/form batch/版分類/docs gate を system-spec・architecture・feature/task に対応付け |
| 整合性あり | PASS | 運用文書・workflow・スクリプト・実装コメントが同じ不変条件を指す |
| 依存関係整合 | PASS | migration → deploy、prepare → batch、domain → UI の依存方向を固定 |

## 反映先

| 層 | パス |
|---|---|
| レビュー | `docs/reviews/elegant-review-2026-08-13.md` |
| 運用 | `docs/deploy-notes.md` / README / `.github/workflows/*` |
| 残課題 | `docs/product/backlog.md` / `docs/product/backlog-history-2026-08-13.md` / `docs/product/backlog-session-notes.md` |
| 製品仕様 | 画面仕様の変更なし。運用・信頼性境界のみ（本受領書と deploy-notes） |
| システム仕様 | `system-spec/release-and-forms.md` / `system-spec/master-settings.md` §7 / `system-spec/index.md` |
| 設計 | `architecture/release-and-forms.md` / `architecture/master-settings.md` / `architecture/index.md` |
| 機能/仕様/タスク | `features/chore-release-safety-and-ssot.md` / `specs/release-safety-and-ssot.md` / `tasks/chore-release-safety-and-ssot.md` |
| Beads | `hr-0p4` |

## 製品仕様（docs/product/spec.md）への影響

**画面・評価制度の振る舞い変更はない。**  
変更は運用ゲート、保存原子性、監査契約の正直化、文書SSOT に限る。したがって `docs/product/spec.md` の章追加は行わず、運用正本を `docs/deploy-notes.md` と system-spec に置く。

## 受領境界

4条件の PASS は、本変更の仕様とローカル focused 回帰の整合に対する判定である。  
本番 migration / deploy の実行証跡、監査原子化、認証付きスモークは含まない。

## ローカル証跡

- `pnpm run check:docs`: **PASS**（current backlog 63 件）
- focused tests: **5 files / 55 tests PASS**
  - `versioned-master` + `VersionedMasterSections`: 38 tests
  - `form-build` unit/integration + D1 list verifier: 17 tests
- `pnpm typecheck`: **PASS**
- `git diff --check`: **PASS**
- 本番 migration / deploy / 全量 coverage は MVP 範囲外（未実行）

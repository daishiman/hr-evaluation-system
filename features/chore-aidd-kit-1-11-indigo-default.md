---
graph_node_id: chore-aidd-kit-1-11-indigo-default
artifact_kind: feature
project_id: hr-evaluation-system
title: AIDDキット1.11.0への更新と、既定の配色インディゴ化
status: implemented
beads_id: hr-fo1
created_at: 2026-09-29
updated_at: 2026-09-29
---

# AIDDキット1.11.0への更新と、既定の配色インディゴ化

## 目的

開発に使うエージェントキットを最新にしつつ、キットの既定（既存アプリも平賀配色・明るいほうだけへ移す）でアプリの暗い表示と配色の選択・保存を失わないようにする。平賀配色は使いたいので、系統の1つとして取り込んで既定にする。

## 到達状態

- `aidd-agent-kit/` が 1.11.0 で、`.claude/` `.agents/skills/` `.codex/` の実配置と manifest が一致している
- キットの配色判定は `report-only`（別ブランド扱い）で、自動移行が起きない。宣言は T2 と `globals.css` の2か所にある
- 既定の系統は `indigo`（平賀配色の値を明るいほうに当てたもの）。`graphite` は選べる系統として残る
- 利用者の現在設定の保存（`theme_user_preferences`）が `indigo` を受け付ける（migration 0030）
- エージェント向けの規約の正本は `AGENTS.md` の1か所で、`CLAUDE.md` はそれを読み込む
- 外観の不変条件が system-spec と architecture にあり、画面・API・DB の許可値が一致することをテストが固定している

## スコープ

**含む**

- キットの差し替えと sync（PR #88）
- 配色の自動移行の停止と、その境界テスト
- 系統 `indigo` の追加と既定化、0030 migration（PR #88）
- 改善要望の手順（`improve-request.md` 手順5）と、キット更新時の受け入れ確認9の明確化
- system-spec / architecture / feature / spec / task / 受領書 / レビュー記録 / beads の同期

**含まない**

- アプリ全体の平賀配色への移行（DD-003 で採らない）
- 配布元への改善提案の提出（`hr-7nl`）
- ユーザー全体（`~/.claude` など）のキットの整理

## 受入

| # | 条件 |
|---|---|
| 1 | `verify-codex-layout.sh` が全項目 OK、`doctor-codex-layout.sh` が errors=0 |
| 2 | `migrate-legacy-colors.mjs src --json` の `eligibility.status` が `report-only` |
| 3 | 全系統を DB に保存でき、既存の行が 0030 で消えない |
| 4 | 全系統×明暗で WCAG AA を満たす |
| 5 | `check:docs` が通り、system-spec / architecture の索引から新しい章へ辿れる |

## 関連

- Beads: `hr-fo1`（残課題 `hr-46m` / `hr-7nl` / `hr-a7j` / `hr-fja`）
- 判断: `docs/product/design-decisions.md` DD-003
- 製品仕様: `docs/product/spec.md`「テーマ契約（全画面共通）」「配色（テーマの系統）」
- システム仕様: `system-spec/appearance-theme.md`
- 設計: `architecture/appearance-theme.md`
- 規約: `AGENTS.md`
- レビュー: `docs/reviews/aidd-kit-1.11-2026-09-29.md`
- タスク: `tasks/chore-aidd-kit-1-11-indigo-default.md`
- 仕様メモ: `specs/aidd-kit-1-11-indigo-default.md`
- 受領書: `docs/product/spec-receipts/2026-09-29-aidd-kit-1-11-indigo-default.md`

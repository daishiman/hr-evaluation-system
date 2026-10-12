---
graph_node_id: refactor-elegant-review-2026-09-29
artifact_kind: feature
project_id: hr-evaluation-system
title: 2026-09-29 レビューの改善（外観選択の共通化・マネージャー権限の記述・README・beads 設定）
status: implemented
beads_id: hr-s4s
created_at: 2026-10-13
updated_at: 2026-10-13
---

# 2026-09-29 レビューの改善

## 目的

2026-09-29 の30思考法レビュー（`docs/reviews/elegant-review-2026-09-29.md`）で見つかった、同じ処理の重複・使われていないコード・実際の権限と食い違う説明を直す。あわせて、利用者向けの使い方の入口を README に置き、課題管理 beads の設定を共有する。

## 到達状態

- 明るさと系統の切り替えが、共通の `useAppearanceChoice` で属性・保存値・記録を扱う。値の契約は各軸に残り、2軸は独立したまま
- 記録の送信先が同期的に例外を投げても、切り替えと初回表示が止まらない
- どこからも読み込まれていない `src/lib/ux-patterns.tsx` が無い（原本はキットの `ux-design` にある）
- マネージャーのホームのリンクと製品仕様の MANAGER 行が、本人と直属メンバーという実際の範囲を指す
- マネージャーが自分の個人詳細を開いたときの公開範囲が、未決事項 SECURITY-013 として残っている
- README から、役割ごとのホーム・最初のログイン・半期の評価の流れを辿れる
- `.beads/` の設定が共有され、端末だけの記録（`.artifact-delivery/`・`eval-log/`）は git の対象外

## スコープ

**含む**

- `src/lib/use-appearance-choice.ts` の追加と、`ThemeToggle` / `PaletteToggle` の置き換え
- `theme-usage.ts` の送信先の同期例外の扱い
- `src/lib/ux-patterns.tsx` の削除、`Segmented` と旧計測テーブルのコメントの修正
- `ManagerDashboard` の文言、`docs/product/spec.md` の MANAGER 行、`docs/product/backlog.md` の SECURITY-013
- README「使い方」、`.beads/` の設定、`.gitignore`
- system-spec / architecture / feature / spec / task / 受領書 / beads の同期

**含まない**

- SECURITY-013 の決定（本人の判断待ち）
- 描画前の初期化（`THEME_INIT_SCRIPT` / `PALETTE_INIT_SCRIPT`）の共通化（React の外で走るため）
- 権限そのものの変更（`system-spec/routes-and-access.md` の範囲は変えない）

## 受入

| # | 条件 |
|---|---|
| 1 | 同じ値の再選択で、属性・保存値・記録のどれも変わらない（`use-appearance-choice.test.ts`） |
| 2 | 送信先が同期的に例外を投げても `recordAppliedThemeChoice` が例外を出さない（`theme-usage.test.ts`） |
| 3 | テーマ・配色の契約テストと境界テストが変更なしで通る |
| 4 | 製品仕様の MANAGER 行が `system-spec/routes-and-access.md` の範囲と一致する |
| 5 | `pnpm typecheck`・`pnpm test`・`check:docs` が通る |

## 関連

- Beads: `hr-s4s`
- レビュー: `docs/reviews/elegant-review-2026-09-29.md`
- 製品仕様: `docs/product/spec.md`（ロールと権限の表）
- 残課題: `docs/product/backlog.md` SECURITY-013
- システム仕様: `system-spec/appearance-theme.md` §3 / `system-spec/routes-and-access.md`（変更なし）
- 設計: `architecture/appearance-theme.md`（切り替えと記録、設計判断4・7）
- タスク: `tasks/refactor-elegant-review-2026-09-29.md`
- 仕様メモ: `specs/elegant-review-2026-09-29.md`
- 受領書: `docs/product/spec-receipts/2026-10-13-elegant-review-2026-09-29.md`

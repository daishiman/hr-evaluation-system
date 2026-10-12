# タスク仕様: refactor-elegant-review-2026-09-29

| 項目 | 値 |
|---|---|
| graph_node_id | `refactor-elegant-review-2026-09-29` |
| beads_id | `hr-s4s` |
| 種別 | refactor / fix / docs / chore |
| 状態 | implemented（main へのマージ待ち） |
| base branch | `main` |
| work branch | `devgraph/refactor-elegant-review-2026-09-29` |

## 目的

2026-09-29 の30思考法レビューで見つかった重複・未使用コード・実際と食い違う説明を直し、README の使い方と beads の設定を共有する。

## 受け入れ条件

1. 明るさと系統の切り替えが `useAppearanceChoice` を通り、同じ値の再選択で属性・保存値・記録が変わらない
2. 記録の送信先が同期的に例外を投げても、切り替えと初回表示が止まらない
3. `src/lib/ux-patterns.tsx` を読み込む箇所が無く、削除しても型検査とテストが通る
4. マネージャーのホームの文言と製品仕様の MANAGER 行が、`system-spec/routes-and-access.md` の範囲と一致する
5. SECURITY-013 が backlog にあり、README が権限と判定条件を再掲せず正本へリンクする
6. `.artifact-delivery/`・`.dev-graph/`・`eval-log/` が git の対象外で、`.beads/` のデータベース本体も対象外のまま
7. system-spec / architecture / feature / spec / task / 受領書 / beads が同じ決定を指す

## 担当範囲

- 外観: `src/lib/use-appearance-choice.ts`（新規）/ `src/components/ThemeToggle.tsx` / `src/components/PaletteToggle.tsx` / `src/lib/theme-usage.ts`
- 整理: `src/lib/ux-patterns.tsx`（削除）/ `src/components/ui.tsx` / `src/db/schema.ts`（コメントのみ）
- マネージャー: `src/app/manager/ManagerDashboard.tsx` / `docs/product/spec.md` / `docs/product/backlog.md`（SECURITY-013）
- 文書: `README.md` / `docs/reviews/elegant-review-2026-09-29.md` / `system-spec/appearance-theme.md` / `architecture/appearance-theme.md` / features / specs / tasks / 受領書
- 運用: `.beads/`（設定のみ）/ `.gitignore`

## 品質ゲート

| ゲート | コマンド | 実測 |
|---|---|---|
| Typecheck | `pnpm typecheck`（新しいワークツリーでは先に `pnpm cf-typegen`） | PASS |
| 全量テスト | `pnpm test` | PASS（149 files / 2305 tests、skip 1） |
| 外観・マネージャー focused | `pnpm exec vitest run src/lib/use-appearance-choice.test.ts src/lib/theme-usage.test.ts src/components/theme-choice-ui.test.ts src/app/manager/ManagerDashboard.test.ts src/components/palette-contract.test.ts src/components/theme-contract.test.ts scripts/aidd-kit-boundary.test.mjs` | PASS（7 files / 41 tests） |
| Docs drift | `pnpm run check:docs` | PASS（current backlog 101 件） |
| 空白 | `git diff --check` | PASS |

実測日: 2026-10-13。MVP のため、e2e と本番の確認はしていない。テーマの契約テストと `globals.css` 冒頭の `brand_color_*` 宣言は変えていない。

## 残課題

| 置き場所 | 内容 |
|---|---|
| backlog SECURITY-013 | マネージャーが自分の個人詳細URLを開いたときの、確認中の評価・評価メモの公開範囲を決める |

## 非採用

- 描画前の初期化の共通化（React の外で、描画の前に走る必要がある）
- 明るさと系統を1つの値にまとめること（「暗いまま系統だけ変える」ができなくなる。設計判断1）

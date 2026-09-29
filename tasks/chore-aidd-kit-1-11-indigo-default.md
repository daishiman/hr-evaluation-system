# タスク仕様: chore-aidd-kit-1-11-indigo-default

| 項目 | 値 |
|---|---|
| graph_node_id | `chore-aidd-kit-1-11-indigo-default` |
| beads_id | `hr-fo1` |
| 種別 | chore / tooling / theme / docs |
| 状態 | implemented（キットと配色は PR #88 で main に取り込み済み。仕様・設計の反映はこのブランチ） |
| base branch | `main` |
| work branch | `devgraph/chore-aidd-kit-1-11-indigo-default` |

## 目的

エージェントキットを 1.11.0 にしても、アプリの暗い表示と配色の選択・保存を失わないようにする。平賀配色は系統 `indigo` として取り込み、既定にする。

## 受け入れ条件

1. `aidd-agent-kit/` が 1.11.0 で、実配置の検査が全項目 OK、doctor が errors=0
2. キットの配色判定が `report-only`（`source_theme: external-brand`）
3. 既定の系統が `indigo`。`graphite` を含む6系統を選べ、DB に保存できる
4. 0030 で既存の保存行が消えない
5. `AGENTS.md` が規約の正本で、改善要望の手順5と受け入れ確認9が明確
6. system-spec / architecture / feature / spec / task / 受領書 / レビュー記録 / backlog / beads が同じ決定を指す

## 担当範囲

- キット: `aidd-agent-kit/` と実配置（PR #88。直接は編集しない）
- 配色: `src/lib/palette.ts` / `src/app/globals.css` / `src/components/PaletteToggle.tsx`（PR #88）
- 保存: `src/db/schema.ts` / `drizzle/migrations/0030_theme_palette_indigo.sql`（PR #88）
- 規約・手順: `AGENTS.md` / `.claude/commands/improve-request.md`
- 文書: `system-spec/appearance-theme.md` / `architecture/appearance-theme.md` / 両索引 / `docs/product/backlog.md`（OPS-010〜013） / features / specs / tasks / 受領書 / `docs/reviews/aidd-kit-1.11-2026-09-29.md`

## 品質ゲート

| ゲート | コマンド | 実測 |
|---|---|---|
| Docs drift | `pnpm run check:docs` | PASS（current backlog 101 件） |
| 外観 focused | `pnpm exec vitest run scripts/aidd-kit-boundary.test.mjs src/components/palette-contract.test.ts src/components/theme-contract.test.ts src/db/theme-palette-migration.test.ts src/app/api/theme-choice/route.test.ts src/lib/theme-preferences.integration.test.ts` | PASS（6 files / 31 tests） |
| Typecheck | `pnpm typecheck` | PASS |
| キット配置 | `bash aidd-agent-kit/verify-codex-layout.sh` | PASS（9項目すべて OK、version 1.11.0） |
| キット診断 | `bash aidd-agent-kit/doctor-codex-layout.sh` | errors=0（warnings=34。ユーザー全体の同名スキル・エージェントとの重複） |
| 配色の判定 | `node aidd-agent-kit/skills/jp-web-design/scripts/migrate-legacy-colors.mjs src --json` | `report-only` / `external-brand` |
| 空白 | `git diff --check` | PASS |

実測日: 2026-09-29。MVP のため全量 coverage ではなく focused を正とする。全量テストと本番の配布は PR #88 の CI・Deploy で通過済み。

## 残課題（Beads）

| beads | 内容 |
|---|---|
| `hr-46m` | T2 の配色承認者を本人が追認する（backlog OPS-010） |
| `hr-7nl` | 配布元へ改善提案 U1〜U19 を出すか決める（OPS-011） |
| `hr-a7j` | 平賀向けの暫定配色の資料を公開リポジトリに置き続けるか（OPS-012） |
| `hr-fja` | キットの追従方針と、改善要望を backlog にも載せるか（OPS-013） |

## 非採用

- アプリ全体の平賀配色への移行（暗い表示と系統の選択・保存が消える。DD-003）
- キットの実配置からの平賀資料の削除（配置の検査が落ちる。配布元の対応を待つ）

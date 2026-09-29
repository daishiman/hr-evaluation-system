# 仕様メモ: AIDDキット1.11.0への更新と、既定の配色インディゴ化

- graph_node_id: `chore-aidd-kit-1-11-indigo-default`
- beads: `hr-fo1`
- 正本（製品）: `docs/product/spec.md`「テーマ契約（全画面共通）」「配色（テーマの系統）」 / `docs/product/design-decisions.md` DD-003
- 正本（システム）: `system-spec/appearance-theme.md`
- 正本（規約）: `AGENTS.md`「AIDD エージェントキット」「配色とテーマ」「キット更新時の受け入れ確認」

## 決定事項

1. キットはリポジトリの project scope に置く。編集元は `aidd-agent-kit/`、実配置は sync が作り、直接編集しない。
2. このアプリは平賀配色へ移行しない。`--apply`・`catalog-default apply`・`--eligibility=eligible` は使わず、判定の dry-run だけを使う。
3. 移行しない宣言は T2 §5 と `globals.css` 冒頭の2か所に置き、`scripts/aidd-kit-boundary.test.mjs` で固定する。
4. 平賀配色の値は系統 `indigo` の明るいほうとして取り込み、`indigo` を既定にする。暗いほうはこのアプリで作る。
5. 既定は保存値なしで表す。既定を変えると、保存値のない利用者全員の見た目が変わる。
6. 系統の許可値は `PALETTES` を正本とし、API（zod）と DB（CHECK）で同じ集合を検査する。DB 側は migration で合わせる（0030）。
7. エージェント向けの規約の正本は `AGENTS.md`。`CLAUDE.md` はそれを読み込むだけにする。
8. 改善要望は、preview で了承をもらったら確認依頼→取り込み→公開→本番確認→タグ→残課題の更新→完了報告まで進める。了承は1回だけ取る。
9. キット更新時は、キットが古くなくても doctor の WARN 一覧を本人に知らせる。ユーザー全体のファイルは勝手に消さない。

## 非決定 / 残すもの

- T2 の承認者の追認（`hr-46m`）
- 配布元への改善提案 U1〜U19 の提出（`hr-7nl`）
- 平賀向けの暫定配色の資料を公開リポジトリに置き続けるか（`hr-a7j`）
- キットの追従方針と、改善要望を backlog にも載せるか（`hr-fja`）
- 端末の「コントラストを強める」補正が既定の系統にしか当たらないこと（backlog UX-024）

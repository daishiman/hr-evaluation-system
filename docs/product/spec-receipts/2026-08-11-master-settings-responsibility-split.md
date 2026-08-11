# 仕様反映 受領書

| 項目 | 内容 |
|---|---|
| 日付 | 2026-08-11 |
| graph_node_id | `feat-master-settings-responsibility-split` |
| beads_id | `hr-hco` |
| 判定 | **仕様・設計への影響あり → 正規フローで反映** |

## 影響の有無と理由

**影響あり。** 旧 `/admin/masters` に集約していた制度設定を責務別の画面へ分け、設定変更後の評価再集計通知とダッシュボードの解決導線も変更したため、製品仕様・移行対応表・システム不変条件を同じ変更で同期する。

1. 等級、等級要件、昇格、行動指針、KPI・評価セット、KGI、昇給の編集場所が分かれた
2. KPIランク基準とKGI係数の変更画面でも、確認中評価の再集計要否を通知する
3. 確定済みしかない場合は、実行不能な再集計CTAを表示しない
4. 行動指針は公開時スナップショットであり、変更しても既存評価を stale にしない
5. 暫定の昇格条件と昇給額は別々に数え、それぞれ実際の解決画面へ案内する
6. KGI係数の表示範囲は数値境界から導出し、移行互換用ラベルを利用者が編集できないようにする

## 反映先

| 層 | パス | 内容 |
|---|---|---|
| 製品仕様 | `docs/product/spec.md` | 画面責務、サイドバー、用語、再集計とスナップショット |
| 残課題 | `docs/product/backlog.md` | 未確定値の実際の変更場所、行動指針編集の完了 |
| 移行対応 | `docs/migration-mapping.md` | 元機能から責務別画面への対応と再集計境界 |
| システム仕様 | `system-spec/index.md` / `system-spec/master-settings.md` | 権限、会社境界、変更影響、UI/API不変条件 |
| 機能 | `features/feat-master-settings-responsibility-split.md` | 到達状態・受入・スコープ外 |
| タスク | `tasks/feat-master-settings-responsibility-split.md` | 品質ゲート・作業ブランチ |
| 仕様メモ | `specs/master-settings-responsibility-split.md` | 画面責務と影響境界の要約 |
| 設計 | `architecture/master-settings.md` | 層分け・設計判断・ファイル分割 |

## 品質ゲート

- 全テスト `pnpm test`: **37 files / 475 tests PASS**（最終レビュー再実行・2026-08-11）
- `pnpm typecheck`: **PASS**
- `git diff --check`: PASS
- 500行超の対象ファイルを分割（`api/masters/*`・`import-members`・`csv-normalize`）
- 旧画面名・旧変更先を検索し、現行導線または明示した「旧・制度マスタ」の履歴記述だけであることを確認
- MVP のため E2E / 本番 build の再検証は必須としない（unit + typecheck で十分）

## 受領

上記の責務分割、再集計境界、解決導線を同一変更で同期し、本変更に起因する仕様ドリフトを解消したものとして受領する。

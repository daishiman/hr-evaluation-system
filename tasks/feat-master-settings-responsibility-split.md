# タスク仕様: feat-master-settings-responsibility-split

| 項目 | 値 |
|---|---|
| graph_node_id | `feat-master-settings-responsibility-split` |
| beads_id | `hr-hco` |
| 種別 | feature（MVP） |
| 状態 | implemented（最終レビュー通過） |
| base branch | `main` |
| work branch | `devgraph/feat-master-settings-responsibility-split` |

## 目的

制度設定を責務別画面に分け、変更影響（再集計・スナップショット）を正しく伝える。あわせて行動指針の編集と、社員CSV取込時の仮パスワード自動発行を入れる。

## 受け入れ条件

1. `/admin/masters` は等級設定のみ。昇格・行動指針・ランク基準・KGI係数は各専用画面
2. サイドバーとダッシュボードの導線が新画面に合う
3. 確認中評価が1件以上あるときだけ再集計 CTA を出す
4. 行動指針変更は既存評価を stale にしない
5. ランク基準・KGI係数の表示範囲は境界値から生成し、人が別文言を保存できない
6. 社員CSVの新規行は行ごとに異なる仮パスワードを発行し、画面に一度だけ出す
7. `pnpm test` / `pnpm typecheck` が通る

## 変更範囲（対象）

- `src/app/admin/**`（masters / promotion / behavior / scheme / kgi / setup / dashboard）
- `src/app/api/masters/**`（route 分割: body-schema / apply-master-update）
- `src/components/Behavior*` / `StaleCyclesNotice` / `MembersCsvImport` / `RecordForm` ほか
- `src/lib/domain/behavior*` / `initial-password*` / `scoring` / `kgi` / `impact` / `import*`
- `docs/` / `features/` / `system-spec/` / `architecture/` / `tasks/` / `specs/`

## 品質ゲート（再実行）

| ゲート | コマンド | 結果 |
|---|---|---|
| Unit / domain | `pnpm test` | **PASS** 37 files / 475 tests（2026-08-11） |
| Typecheck | `pnpm typecheck` | **PASS** |
| 空白 | `git diff --check` | **PASS** |
| E2E / 認証済みスモーク | — | MVP 対象外（`hr-nm6`） |

## 残課題

| beads | 内容 |
|---|---|
| `hr-c76` | 利用者・権限操作の監査証跡（E7）。制度マスタ全般の revision も同系 |
| `hr-nm6` | 認証済みスモークで migration 漏れ検知（E8） |

## 依存

- 既存 `requireRole` / `apiViewer` / `detectStaleCycles`
- D1 + Drizzle、Better Auth の credential ハッシュ

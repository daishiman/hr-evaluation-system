# タスク仕様: feat-profile-account-self-service

| 項目 | 値 |
|---|---|
| graph_node_id | `feat-profile-account-self-service` |
| beads_id | `hr-7i7` |
| 種別 | feature（MVP） |
| 状態 | implemented（最終レビュー通過） |
| base branch | `main` |
| work branch | `devgraph/feat-profile-account-self-service` |

## 目的

自分の登録内容を会社が許した範囲で変更できるようにし、システム全体管理者が利用者を安全に管理できるようにする。

## 受け入れ条件

1. 全ロールでサイドバーにアカウント項目が無い
2. 右上メニューから自分の情報・パスワード・ログアウトへ行ける
3. 本人編集は policy 解決結果と API が一致する
4. role / grade / manager / isActive は本人に開放できない
5. SUPER_ADMIN 向け利用者詳細と API がある
6. 上長循環・停止会社セッション・パスワード再発行セッション失効が効く
7. `pnpm test` / `pnpm typecheck` が通る

## 変更範囲（対象）

- `src/app/account/page.tsx`
- `src/app/admin/members/**`、`src/app/system/users/**`
- `src/app/api/account/profile/**`、`src/app/api/masters/profile-policy/**`、`src/app/api/system/users/**`、`src/app/api/members/route.ts`
- `src/components/AccountMenu.tsx` ほか関連 UI
- `src/lib/domain/profile-fields.*`、`src/lib/user-integrity.*`、`nav` / `session` / `queries` / `schema`
- `drizzle/migrations/0010_*`
- `docs/` / `features/` / `system-spec/` / `architecture/` / `tasks/` / `specs/`

## 品質ゲート（再実行結果）

| ゲート | コマンド | 結果 |
|---|---|---|
| Unit / domain | `pnpm test` | **PASS** 28 files / 412 tests（2026-08-11） |
| Typecheck | `pnpm typecheck` | **PASS** |
| E2E / 認証済みスモーク | — | MVP 対象外（`hr-nm6` / E8） |

## 残課題

| beads | 内容 |
|---|---|
| `hr-c76` | 利用者・権限操作の監査証跡（E7） |
| `hr-nm6` | 認証済みスモークで migration 漏れ検知（E8） |

## 依存

- 既存 Better Auth セッション / `requireRole` / `apiViewer`
- D1 + Drizzle マイグレーション運用

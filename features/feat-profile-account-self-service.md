---
graph_node_id: feat-profile-account-self-service
artifact_kind: feature
project_id: hr-evaluation-system
title: 自分の情報変更と利用者管理の整備
status: implemented
beads_id: hr-7i7
created_at: 2026-08-11
updated_at: 2026-08-11
---

# 自分の情報変更と利用者管理の整備

## 目的

パスワード以外の自分の登録内容（氏名など）を、会社が許した範囲で本人が直せるようにする。あわせて、システム全体管理者が全ロールの利用者を安全に直せる入口を用意し、役割・所属・上長まわりの壊れ方を防ぐ。

## 到達状態

- 全ロールが右上のアカウントメニューから「自分の情報」「パスワード」「ログアウト」に到達できる
- サイドバーにアカウント項目が重複して出ない
- 本人が変えられる項目は会社ごとに設定でき、画面と API が同じ許可表を使う
- 役割・等級・上長・在籍状態は本人に開放できない
- SUPER_ADMIN は `/system/users/[id]` から全利用者を変更できる
- 停止中の会社に属する利用者はログイン状態が残っていても通らない

## スコープ

**含む**

- ヘッダー右上 `AccountMenu`（アバター・氏名・役割・会社文脈・導線）
- `/account` 本人プロフィール表示・編集
- `/admin/members/policy` 本人編集ポリシー設定
- `profile_field_policies` テーブルと migration `0010`
- `/api/account/profile`、`/api/masters/profile-policy`
- `/system/users/[id]` と `/api/system/users`
- 上長循環チェック、パスワード再発行時のセッション失効、停止会社のセッション遮断
- 関連テスト・製品仕様・設計ドキュメント

**含まない**

- 操作監査テーブル（Beads `hr-c76` / backlog E7）
- 認証済みスモークによる migration 漏れ検知（Beads `hr-nm6` / backlog E8）
- アバター画像アップロード
- Google ログイン連携

## 受入（MVP）

| # | 条件 | 検証 |
|---|---|---|
| 1 | サイドバーに `/account*` が出ない | `nav.test.ts` |
| 2 | 氏名だけ既定で本人変更可 | `profile-fields.test.ts` |
| 3 | role 等は configurable=false | 同上 |
| 4 | 上長循環を拒否 | `user-integrity.test.ts` |
| 5 | typecheck / unit test 全件パス | `pnpm typecheck` / `pnpm test` |

## 関連

- Beads: `hr-7i7`（本体）、`hr-3b8`（仕様反映）、`hr-c76` / `hr-nm6`（残課題）
- 製品仕様: `docs/product/spec.md` §3-2
- システム仕様: `system-spec/account-and-users.md`
- 設計: `architecture/account-profile.md`
- タスク仕様: `tasks/feat-profile-account-self-service.md`

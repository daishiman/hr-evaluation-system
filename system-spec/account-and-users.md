# 利用者プロフィールとアカウント — システム仕様

- graph_node_id: `feat-profile-account-self-service`
- beads: `hr-7i7`
- 正本（製品）: `docs/product/spec.md` §3-2
- 実装入口: `src/lib/domain/profile-fields.ts` / `src/lib/user-integrity.ts`

## 1. ロールと画面境界

| 画面 / API | 最小ロール | 会社スコープ |
|---|---|---|
| `GET/PATCH` 相当の `/account`、`/api/account/profile` | EMPLOYEE（全ログイン利用者） | **実所属** `users.company_id`（操作対象会社ではない） |
| `/admin/members/policy`、`PUT /api/masters/profile-policy` | COMPANY_ADMIN | 自社、または SUPER_ADMIN の操作対象会社 |
| `/admin/members`、`/api/members` | COMPANY_ADMIN | 自社 / 操作対象会社の社員のみ |
| `/system/users`、`/system/users/[id]`、`/api/system/users` | SUPER_ADMIN | 全社・全ロール（評価の中身は出さない） |

## 2. 本人編集ポリシー

### データ

- 表: `profile_field_policies`
- 一意: `(company_id, field)`
- migration: `drizzle/migrations/0010_profile_field_policies.sql`

### 許可できる field

`name` / `department` / `employeeCode` / `hiredAt` のみ（`SELF_EDITABLE_FIELDS`）。

### 許可できない field（設定でも開放不可）

`role` / `gradeId` / `managerId` / `isActive`（`MANAGED_ONLY_FIELDS`）。

### 既定

- 行が無い項目: 氏名のみ `true`、他は `false`
- `company_id` が null（SUPER_ADMIN 本人など）: **会社向け既定も適用しない**（すべて false）
- 解決関数: `resolveSelfEditMap` / `resolveSelfEditMapForCompany` / `selfEditableFieldsForCompany`

### UI と API の一致

- `/account` の入力可否と `PATCH /api/account/profile` の受理可否は、同じ会社の同じ policy 解決結果を使う
- 禁止項目を 1 件でも含む要求は 403（部分適用しない）

## 3. 利用者保存の不変条件

保存後の合成状態で検証する（入力差分だけを見ない）。

1. **SUPER_ADMIN** は `companyId` / `gradeId` / `managerId` を持たない
2. それ以外は実在かつひな形でない会社への所属が必須。**利用中**アカウントは**有効な会社**にだけ所属できる
3. 等級・上長は同一会社。上長は有効な MANAGER 以上。自己上長・循環禁止（`assertNoManagerCycle`）
4. 上長として参照されている利用者を、上長資格を失う role / isActive / 会社変更へ進める前にブロック
5. 最後の有効 SUPER_ADMIN は降格・停止不可（UPDATE 条件付きで同時更新耐性）
6. パスワード再発行時は `mustChangePassword=true` とし、既存セッションを削除する（users / accounts / sessions を途中状態なく更新）
7. 自分自身を利用停止にできない。SUPER_ADMIN は自分の role を下げられない

## 4. セッション

- `getViewer`: 利用者本人が inactive なら null
- 非 SUPER_ADMIN は `companyId` が無い、または所属会社が inactive なら null
- SUPER_ADMIN の `viewer.companyId` は操作対象会社（所属ではない）

## 5. ナビ

- アカウント操作はサイドバーに置かない（`src/lib/nav.ts`）
- 右上 `AccountMenu` に集約

## 6. 評価確定後の次候補

- 確定済み評価から出す「次の未確定評価」は、現在の評価、確定済み、操作者本人の評価を除外する。
- MANAGER は `users.manager_id = viewer.id` の有効な直属メンバーだけを候補にする。COMPANY_ADMIN / SUPER_ADMIN は操作対象会社の候補を扱える。
- 候補選択は `selectNextActionableEvaluation` に集約し、画面ごとに `id/status` だけで会社全体から選ばない。

## 7. 操作対象会社の切り替え

- SUPER_ADMIN の会社選択欄は明示的な `label` と `select` の関連付けを持つ。`label` の内側へエラー表示用のブロック要素を入れない。
- 切り替え失敗は現在の会社を維持し、`role=alert` / `aria-live=assertive` で理由と再試行を伝える。

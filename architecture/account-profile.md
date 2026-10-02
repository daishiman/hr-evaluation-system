# アーキテクチャ: プロフィールと利用者管理

graph_node_id: `feat-profile-account-self-service`  
beads: `hr-7i7`

## 層分け

```
[画面]
  AccountMenu / SelfProfileEditor / ProfilePolicyEditor
  /account, /admin/members/policy, /admin/members/[id], /system/users/[id]
        │
        ▼
[サーバーアクション]（src/actions/。どれも runAction を通る）
  updateOwnProfile / changeOwnPassword        … 本人（EMPLOYEE 以上）
  saveProfilePolicy                           … COMPANY_ADMIN 以上
  createMember / updateMember                 … 自社社員（COMPANY_ADMIN 以上）
  createSystemUser / updateSystemUser         … SUPER_ADMIN のみ
  revealCredentialMemo（runRead）             … SUPER_ADMIN・同じ会社の COMPANY_ADMIN
        │
        ▼
[ドメイン]
  profile-fields.ts   … 項目定義・既定値・許可表の解決（画面/API共通）
  user-integrity.ts   … 上長循環・メールの重複・所属できない会社（ひな形・停止中）の拒否
  user-name-schema.ts … 氏名の検査（前後の空白を除いて必須・60文字。本人・社員・全体管理の3つの入口で共通）
        │
        ▼
[データ]
  users / accounts / sessions
  profile_field_policies (company_id + field UNIQUE)
  grades / companies
```

## 設計判断

### 1. 許可表をドメインモジュールに1つ置く

画面で入力欄を隠すだけでは API 直叩きで素通りする。  
`PROFILE_FIELDS` と `resolveSelfEditMap*` を画面と API の両方が読む。

### 2. 管理専用項目は設定テーブルに載せない

role / grade / manager / isActive を `profile_field_policies.field` に入れると、設定ミスで本人昇格の経路が生まれる。  
型上 `SELF_EDITABLE_FIELDS` に含めず、API スキーマにも出さない。

### 3. SUPER_ADMIN の操作スコープと所属を分離

- 所属: `users.company_id`（常に null）
- 操作対象: サイドバー選択 → session 側の scope（`viewer.companyId`）
- 本人の `/account` は **操作対象会社の policy を使わない**

### 4. パスワード再発行は原子的バッチ

利用者行の `mustChangePassword`、credential の hash 更新、sessions 削除、初期パスワードの控え（`initial_credential_memos`）の置き換えを `db.batch` でまとめる。
途中失敗で「新パスワードなのに古いセッションが生きる」「控えだけ古い」状態を避ける。
本人がパスワードを変えたときは、印を消すのと控えを消すのを同じ batch で書き、この端末以外のログインを切る（`revokeOtherSessions`）。

### 5. 等級 JOIN は会社も揃える

`grades` を `user.grade_id` だけで join すると、会社を跨いだゴミ参照で名前が混ざる可能性がある。  
`grade_id` かつ `grades.company_id = users.company_id` で join する。

## 主要ファイル

| 役割 | パス |
|---|---|
| 項目定義 | `src/lib/domain/profile-fields.ts` |
| 上長循環・メールの重複・所属会社 | `src/lib/user-integrity.ts` |
| 氏名の検査 | `src/lib/user-name-schema.ts` |
| スキーマ | `src/db/schema.ts` (`profileFieldPolicies`) |
| クエリ | `src/lib/queries.ts` (`listProfileFieldPolicies`, `getSelfProfile`, `listAllUsers`, `getAnyUser`) |
| ナビ | `src/lib/nav.ts` / `AppShell.tsx` / `AccountMenu.tsx` |

## マイグレーション

- `0010_profile_field_policies.sql` を local / remote の両方に適用すること
- 未適用だとログイン後の `/account` や policy 画面で `no such table` になる（backlog E8）

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
[API]
  /api/account/profile          … 本人（EMPLOYEE 以上）
  /api/masters/profile-policy   … COMPANY_ADMIN 以上
  /api/members                  … 自社社員（COMPANY_ADMIN 以上）
  /api/system/users             … SUPER_ADMIN のみ
        │
        ▼
[ドメイン]
  profile-fields.ts   … 項目定義・既定値・許可表の解決（画面/API共通）
  user-integrity.ts   … 上長循環の拒否
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

利用者行の `mustChangePassword`、credential の hash 更新、sessions 削除を `db.batch` でまとめる。  
途中失敗で「新パスワードなのに古いセッションが生きる」状態を避ける。

### 5. 等級 JOIN は会社も揃える

`grades` を `user.grade_id` だけで join すると、会社を跨いだゴミ参照で名前が混ざる可能性がある。  
`grade_id` かつ `grades.company_id = users.company_id` で join する。

## 主要ファイル

| 役割 | パス |
|---|---|
| 項目定義 | `src/lib/domain/profile-fields.ts` |
| 上長循環 | `src/lib/user-integrity.ts` |
| スキーマ | `src/db/schema.ts` (`profileFieldPolicies`) |
| クエリ | `src/lib/queries.ts` (`listProfileFieldPolicies`, `getSelfProfile`, `listAllUsers`, `getAnyUser`) |
| ナビ | `src/lib/nav.ts` / `AppShell.tsx` / `AccountMenu.tsx` |

## マイグレーション

- `0010_profile_field_policies.sql` を local / remote の両方に適用すること
- 未適用だとログイン後の `/account` や policy 画面で `no such table` になる（backlog E8）

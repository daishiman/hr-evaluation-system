# 利用者プロフィールとアカウント — システム仕様

- graph_node_id: `feat-profile-account-self-service`
- beads: `hr-7i7`
- 正本（製品）: `docs/product/spec.md` §3-2
- 実装入口: `src/lib/domain/profile-fields.ts` / `src/lib/user-integrity.ts`

会社ごとの役割・等級・事業所・上司・社員番号・部署・入社日・人物メモは `company_memberships` が正本。`users` の同じ列は元の所属の写しで、氏名・メール・利用状態・資格情報はアカウント全体の値として `users` が持つ。所属と会社選択の契約は [製品仕様 §28-4](../docs/product/spec.md#28-4-複数の会社への所属s7受入-a6)、実装の境界は [所属の設計](../architecture/improvement-requests-2026-10.md) を参照する。

## 1. ロールと画面境界

| 画面 / サーバーアクション | 最小ロール | 会社スコープ |
|---|---|---|
| `/account`、`updateOwnProfile`・`changeOwnPassword` | EMPLOYEE（全ログイン利用者） | 会社ごとの項目と本人編集ポリシーは選択した所属。会社所属を持たない SUPER_ADMIN 本人には会社ポリシーを適用しない。パスワードはアカウント全体 |
| `/admin/members/policy`、`saveProfilePolicy` | COMPANY_ADMIN | 自社、または SUPER_ADMIN の操作対象会社 |
| `/admin/members`、`createMember`・`updateMember` | COMPANY_ADMIN | 自社 / 操作対象会社の社員のみ |
| `/system/users`、`/system/users/[id]`、`createSystemUser`・`updateSystemUser` | SUPER_ADMIN | 全社・全ロール。利用者一覧は所属ごとに今の等級と確定した最新の点数を示す（[製品仕様 §28-3](../docs/product/spec.md#28-3-一覧の等級と点数s6受入-a5)） |
| 一覧の行の「控えを見る」、`revealCredentialMemo`（読むだけ） | COMPANY_ADMIN | SUPER_ADMIN は全社。COMPANY_ADMIN は選択会社だけに所属する利用者の控えを開ける。他社にも所属する利用者の控えは SUPER_ADMIN だけ |

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

- `/account` の入力可否と `updateOwnProfile` の受理可否は、同じ会社の同じ policy 解決結果を使う
- 禁止項目を 1 件でも含む要求は 403（部分適用しない）

## 3. 利用者保存の不変条件

保存後の合成状態で検証する（入力差分だけを見ない）。

1. **SUPER_ADMIN** は `companyId` / `gradeId` / `managerId` を持たない
2. それ以外は実在かつひな形でない会社への所属が必須。停止した会社の所属も履歴として残す。操作できるのは有効な会社の所属だけ
3. 等級・上長は同一会社。上長は有効な MANAGER 以上。自己上長・循環禁止（`assertNoManagerCycle`）
4. 上長として参照されている利用者を、上長資格を失う role / isActive / 会社変更へ進める前にブロック
5. 最後の有効 SUPER_ADMIN は降格・停止不可（UPDATE 条件付きで同時更新耐性）
6. パスワード再発行時は `mustChangePassword=true` とし、既存セッションを削除する（users / accounts / sessions を途中状態なく更新）
7. 自分自身を利用停止にできない。SUPER_ADMIN は自分の role を下げられない
8. 他社にも所属する利用者の氏名・メール・利用状態・資格情報を会社管理者が変更することは拒否する。自社の所属の値だけを変更できる

## 4. セッション

- `getViewer`: 利用者本人が inactive なら null
- 非 SUPER_ADMIN は有効な所属が1つも無ければ null。選択した所属の会社・役割・等級・上司を使う。会社を停止しても別の有効な所属が残る利用者はアカウントを停止しない
- SUPER_ADMIN の `viewer.companyId` は操作対象会社（所属ではない）

## 5. ナビ

- アカウント操作はサイドバーに置かない（`src/lib/nav.ts`）
- 右上 `AccountMenu` に集約

## 6. 評価確定後の次候補

- 確定済み評価から出す「次の未確定評価」は、現在の評価、確定済み、操作者本人の評価を除外する。
- MANAGER は選択会社の `company_memberships.manager_id = viewer.id` の有効な直属メンバーだけを候補にする。COMPANY_ADMIN / SUPER_ADMIN は操作対象会社の候補を扱える。
- 候補選択は `selectNextActionableEvaluation` に集約し、画面ごとに `id/status` だけで会社全体から選ばない。

## 7. 操作対象会社の切り替え

- 会社選択欄は全役割で使える（非 SUPER_ADMIN には有効な所属が2社以上あるときに表示）。明示的な `label` と `select` の関連付けを持つ。`label` の内側へエラー表示用のブロック要素を入れない。
- 切り替え失敗は現在の会社を維持し、`role=alert` / `aria-live=assertive` で理由と再試行を伝える。

## 8. 人の一覧の検索と並べ替え

製品の決まりは [製品仕様 §28-13](../docs/product/spec.md#28-13-人の一覧の検索と並べ替え2026-10-14-の追加要望)、判断の経緯は [DD-011](../docs/product/design-decisions.md)。

- `/system/users`・`/admin/members`・`/manager/members` は、どれも `PeopleList`（`src/components/PeopleList.tsx`）に行の配列を渡すだけにする。
  検索・並べ替え・URL の読み書きは `src/lib/domain/people-list.ts` の純粋関数が持ち、画面ごとに書き分けない。
- 行の配列には利用停止の人も入れ、`isActive` は行の値をそのまま渡す（`PeopleList` が札と `data-off` で沈める）。
  画面で在籍中の人に絞ったり、別の節に分けたりしない。対象は所属を持つ人で、所属の行を消した人は出ない（`src/components/PeopleList.test.ts`）。
- 人の一覧の検索は、ヘッダーの検索（`src/lib/domain/search.ts`・`normalizeKey`）と正規化を共有しない。
  共有するとヘッダーの検索の当たり方が変わるため、別の仕組みのままにする（2026-10-14 の利用者の判断）。
- 選べる並べ替えは、画面が `availableSortKeys({ acrossCompanies, gradeAndScore })` で決める。
  `acrossCompanies` は利用者一覧（`/system/users`）で会社をしぼらないときだけ true。`gradeAndScore` は `canViewGradeScore(viewer)`（台帳の `members.viewGradeScore`）で、利用者一覧を「会社に属さない」にしぼったときは false。
  URL の `sort` は `parsePeopleView` が選べるものに限って読み、ほかは既定に戻す。並べ替えの可否を UI の非表示だけに頼らない。
- 等級の並び（`gradeOrder`）は、等級名・点数と同じく `withGradeAndScore` か、全社の一覧では見てよい役割のときだけ行に入れる。
  一般の社員の応答には含めない（`src/lib/score-visibility.integration.test.ts`）。
- 検索の索引（`buildSearchIndex`）には、名前・メール・役割名・会社名・等級名・所属・社員番号を入れる。
  役割名・会社名・等級名・所属は札と同じ関数（`personLabels`）の文字を使い、描く文字と探す文字をそろえる。
  社員番号だけは生の値を入れる（札は「社員番号 X」だが、番号だけで探せるように）。
- 一覧の行はサーバーが一度に返し（多くて数百人）、検索と並べ替えのたびにサーバーへ問い合わせない。

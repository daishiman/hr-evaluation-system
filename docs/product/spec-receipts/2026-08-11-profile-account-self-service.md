# 仕様反映 受領書

| 項目 | 内容 |
|---|---|
| 日付 | 2026-08-11 |
| graph_node_id | `feat-profile-account-self-service` |
| Beads ID | `hr-7i7`（本体）/ `hr-3b8`（本ドキュメント反映） |
| 判定 | **仕様・設計への影響あり → 正規フローで反映済み** |

## 影響の有無と理由

**影響あり。** 本変更は画面追加・ナビ構造変更・新規テーブル・ロール境界の不変条件追加を含むため、製品仕様とシステム仕様の両方を更新する必要がある。

影響が無いとは言えない理由:

1. 画面一覧に `/account`、`/admin/members/policy`、`/system/users/[id]` が追加された
2. サイドバーからアカウント項目を外し、ヘッダー右上へ集約するナビ方針が変わった
3. `profile_field_policies` と本人編集の既定・禁止項目が業務ルールとして新規確定した
4. 利用者保存時の role/company/manager 不変条件と停止会社のセッション遮断が認証境界に効く

## 反映先

| 層 | パス | 内容 |
|---|---|---|
| 製品仕様 | `docs/product/spec.md` | §3 画面、§3-1 ナビ、§3-2 不変条件 |
| 残課題 | `docs/product/backlog.md` | E7 監査、E8 認証済みスモーク |
| 機能 | `features/feat-profile-account-self-service.md` | スコープ・受入 |
| システム仕様 | `system-spec/index.md` / `account-and-users.md` | ロール境界・許可表・セッション |
| 設計 | `architecture/index.md` / `account-profile.md` | 層分け・設計判断 |
| タスク | `tasks/feat-profile-account-self-service.md` | 品質ゲート結果 |
| 要約 | `specs/profile-account-self-service.md` | 利用者向け短文 |

## 品質ゲート再実行

- `pnpm test` → 28 files / 412 tests PASS
- `pnpm typecheck` → PASS

## 受領

上記パスへの反映を確認し、本変更分の仕様ドリフトは解消済みとする。  
残課題 E7 / E8 は backlog と Beads（`hr-c76` / `hr-nm6`）に明示し、本 PR の完了条件からは外す。

---
graph_node_id: feat-master-settings-responsibility-split
artifact_kind: feature
project_id: hr-evaluation-system
title: 制度設定の責務分割と行動指針編集
status: implemented
beads_id: hr-hco
created_at: 2026-08-11
updated_at: 2026-08-11
---

# 制度設定の責務分割と行動指針編集

## 目的

会社管理者が「直したい設定」を探す時間を減らす。1つの巨大な制度マスタ画面に詰め込んでいた等級・昇格・行動指針・KPIランク・KGI係数を、責務ごとの画面に分け、変更後の評価への影響（再集計の要否）も画面ごとに正しく伝える。

## 到達状態

- サイドバーが制度の依存順（等級 → 等級要件 → 昇格 → 行動指針 → KPI・評価セット）で並ぶ
- `/admin/masters` は等級そのものだけを編集する
- `/admin/masters/promotion` で昇格点数と点数外の昇格要件を編集できる
- `/admin/behavior` で行動指針の適用帯域・観点・段階文言を編集できる
- KPIランク基準は `/admin/scheme`、KGI係数は `/admin/kgi` で編集する
- 再集計可能な確認中評価があるときだけ「集計し直す」導線を出す
- 行動指針の変更は次に作るアンケートだけに反映し、既存評価を stale にしない
- 社員CSV取込では、新規利用者ごとに仮パスワードをサーバー側で自動発行する

## スコープ

**含む**

- 画面責務の分割とナビ・ダッシュボード・制度設定ガイドの導線更新
- 行動指針編集 UI / API（`behaviorGuideline` / `behaviorLevel`）
- 共通の再集計通知（`StaleCyclesNotice`）
- ランク基準・KGI係数の表示ラベルを境界値から自動生成
- 仮パスワード自動発行と一覧保存
- 関連テスト・製品仕様・システム仕様・設計ドキュメント

**含まない**

- 制度マスタ全般の監査ログ（Beads `hr-c76` / backlog E7）
- 認証済みスモークによる migration 漏れ検知（Beads `hr-nm6` / backlog E8）
- 閾値の制度妥当性の再検証（実運用データ待ち）

## 受入（MVP）

| # | 条件 | 検証 |
|---|---|---|
| 1 | ナビに昇格・行動指針が独立項目として出る | `nav.test.ts` |
| 2 | ダッシュボードの暫定件数は昇格と昇給を別案内する | `AdminDashboard.test.ts` |
| 3 | 行動指針は impact 監視対象に含めない | `impact-contract.test.ts` |
| 4 | 仮パスワードは共有入力せずサーバー発行 | `account-lifecycle.test.ts` / `initial-password.test.ts` |
| 5 | typecheck / unit test が通る | `pnpm typecheck` / `pnpm test` |

## 関連

- Beads: `hr-hco`
- 製品仕様: `docs/product/spec.md` §3, §5-1, §7
- システム仕様: `system-spec/master-settings.md`
- 設計: `architecture/master-settings.md`
- タスク仕様: `tasks/feat-master-settings-responsibility-split.md`
- 受領書: `docs/product/spec-receipts/2026-08-11-master-settings-responsibility-split.md`

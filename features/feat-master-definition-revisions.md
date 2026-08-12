---
graph_node_id: feat-master-definition-revisions
artifact_kind: feature
project_id: hr-evaluation-system
title: 等級要件・昇格要件の追記型版管理と再開導線
status: implemented
beads_id: hr-2qk
created_at: 2026-08-12
updated_at: 2026-08-12
---

# 等級要件・昇格要件の追記型版管理と再開導線

## 目的

管理者が「今後使わない」にした項目を迷わず再開でき、内容を直しても過去に使った定義を上書きしないようにする。
作成済みアンケートと評価を不変に保ちながら、次に作るアンケートだけを新しい内容へ進める。

## 到達状態

- 「今後使わない」は現行版の将来選択を止める可逆操作
- 停止中の現行版は、同じidの「もう一度使う」で再開
- 意味の変更は新idを作り、`previous_version_id` で直前の現行版へ接続
- 過去版の再採用は、旧idの再開ではなく現行版の後続となる新版
- `seq` / `is_active` は将来フォームの構成値として更新可能
- active上限10、会社・等級・区分、競合、系譜単位の削除可否をサーバーとDBで保証
- 等級要件・昇格要件の変更は既存評価のstale理由にしない
- 等級要件・昇格要件で同じ版ライフサイクルを共有し、他の全マスターへ過剰拡張しない
- 行動指針の等級割当は、各等級の行/カード内で選択・保存し、二重表示をなくす

## スコープ

**含む**

- 等級要件・昇格要件の版系譜、API command、削除・上限・競合境界
- 停止項目・履歴の表示と、反映時期を含むUI用語
- フォーム写しとstale判定の境界
- 行動指針の等級割当UIの単一所有
- PR #33のサンプルとPR #38の放置評価通知の横断回帰

**含まない**

- 全制度マスタのイベントストア化
- 金額・閾値・アカウント操作の横断監査ログ
- 作成済みフォームへの自動同期

## 受入

| # | 条件 |
|---|---|
| 1 | 内容改訂で旧行を変えず、新id + `previous_version_id` の新版ができる |
| 2 | 停止・再開は同じ現行版idで可逆、過去版は直接再開できない |
| 3 | 新フォームだけが新版を使い、過去フォーム・評価は旧版idと文言を保つ |
| 4 | 10件上限・会社境界・bucket・競合・削除をサーバー側で拒否できる |
| 5 | snapshot-fedの等級要件・昇格要件はstale監視外 |
| 6 | 行動指針の割当は等級ごとの行内select + 保存に一本化 |
| 7 | サンプルseedを `listStalledEvaluations()` で読むと0件 |

## 関連

- Beads: `hr-2qk`
- 製品仕様: `docs/product/spec.md` §7-8 / `docs/product/spec-master-definition-revisions.md`、§14、§17
- システム仕様: `system-spec/master-settings.md` §5〜6
- 設計: `architecture/master-settings.md` §7〜10
- タスク: `tasks/feat-master-definition-revisions.md`
- 仕様メモ: `specs/master-definition-revisions.md`
- 受領書: `docs/product/spec-receipts/2026-08-12-master-definition-revisions.md`

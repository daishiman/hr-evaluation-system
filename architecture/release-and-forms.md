# アーキテクチャ: 配布安全性とフォーム原子化

graph_node_id: `chore-release-safety-and-ssot`  
beads: `hr-0p4`

## 層分け

```
[運用入口]
  GitHub Actions Deploy（通常） / Migrate（復旧・先行適用）
        │
        ▼
[機械ゲート]
  check:docs
  typecheck / test:coverage / cf:dry-run / bundle-size
  verify-d1-migrations-list（本番 D1）
  backup → migrate → parity → deploy
        │
        ▼
[アプリ保存]
  createForms（サーバーアクション src/actions/forms.ts）
    → buildFormDrafts
      prepare(全等級) → 1 D1 batch → (版競合時のみ1回再準備)
        │
        ▼
[ドメイン正本]
  versioned-master.currentVersionRows / classifyVersionedRows
  constitution-events（監査ジャーナル。状態正本ではない）
```

## 設計判断

### 1. CI 成功を Deploy の前提にしない

main push で CI と Deploy が同時に走ると、CI 未完了の SHA を配りうる。配布 checkout 自身が test する。

### 2. migration 順序を prose から gate へ

Deploy自身が未適用状態を分類し、必要な場合だけバックアップしてmigrationを適用する。検査・ビルド → バックアップ → migration → parity確認 → deployを1つの直列フローにし、手動操作の抜けをなくす。復旧用Migrateとも同じconcurrency groupを共有する。

### 3. フォームは等級横断で原子化

等級ループの逐次保存は、途中失敗で前半だけ残る。準備と batch を分離し、書き込み単位をリクエスト全体にする。

### 4. 版分類の正本は1つ

画面用と計算用で同じ判定を二重実装すると静かにずれる。domain helper を唯一の正本にし、UI は互換名で呼ぶ。

### 5. 監査は正直な契約

完全性を保証できない記録をイベントストアと名乗らない。現在状態は各マスタテーブル、監査は補助ジャーナル。

## 主要ファイル

| 役割 | パス |
|---|---|
| Deploy gate | `.github/workflows/deploy.yml` |
| Migrate recovery gate | `.github/workflows/migrate.yml` |
| Deploy workflow契約 | `scripts/deploy-workflow-contract.test.mjs` |
| D1 list 判定 | `scripts/verify-d1-migrations-list.mjs` |
| 文書 drift | `scripts/check-docs-drift.mjs` |
| フォーム原子化 | `src/lib/form-build.ts` |
| 版分類 | `src/lib/domain/versioned-master.ts` |
| 監査契約 | `src/lib/domain/constitution-events.ts` / `src/db/schema.ts` |

## 設定と設問の双方向保存（DD-028・DD-031）

設問から設定への保存は `planFormToSettings` で検査・計画し、`writeFormToSettings` が設問・設定・制度変更記録を同じ D1 batch に書く。設定保存後は `followSettings` が下書きと確定前評価へ追従させ、追従失敗を保存結果へ明記する。復旧は `alignDraftForms` の事前確認と planKey 照合を通す。公開・確定履歴の写しは残す。

本番移行前の書き出しは `.github/scripts/encrypt-d1-backup.sh` が age で暗号化し、Artifact には暗号化済みファイルだけを置く。公開鍵が未設定なら移行を止める。今回のPRでは本番移行を実行しない。

検証と仕様反映の記録: [2026-10-26 最終受領書](../docs/product/spec-receipts/2026-10-26-guideline-kpi-pr-review.md)。

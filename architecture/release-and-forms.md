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
  POST /api/forms
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

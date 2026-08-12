# 仕様メモ: 配布安全性・文書SSOT・フォーム原子化

- graph_node_id: `chore-release-safety-and-ssot`
- beads: `hr-0p4`
- 正本（運用）: `docs/deploy-notes.md` / `.github/workflows/deploy.yml` / `.github/workflows/migrate.yml`
- 正本（残課題）: `docs/product/backlog.md`（current） / `docs/product/backlog-history-2026-08-13.md`（history）
- 正本（システム）: `system-spec/release-and-forms.md` / `system-spec/master-settings.md` §7

## 決定事項

1. 本番配布の入口は Deploy workflow のみ。`main` 以外は拒否する。
2. Deploy は CI 成功を信頼せず、配布する同一 checkout で `check:docs`・typecheck・`test:coverage`・build・bundle・D1 migration parity を再実行する。
3. migration 未適用がある間は Deploy を fail-closed で止める。Migrate 後も同じ DB を再照会する。
4. 複数等級アンケート作成は準備完了後に1 batch で書き、途中失敗で部分成功しない。
5. フォーム版の一意制約競合だけを1回再試行し、他の一意制約や通信エラーは再試行しない。
6. 版の現在/履歴分類は domain helper が唯一の正本。
7. `constitution_events` は監査ジャーナル。現在状態の正本は各制度マスタテーブル。
8. backlog は未解決だけを current に置き、完了履歴は history へ移す。`check:docs` が混在を止める。

## 非決定 / 残すもの

- 本体更新と監査 INSERT の同一 batch 化
- 認証付きスモークの自動化
- 分散 rate limit

# T4. リリース判定書 — 画面内改善要望 Slice 1

**判定**: Go（ローカル縦切り）/ production公開は未判定・未実施 / **判定日**: 2026-08-14

## 1. ゲート結果

| ゲート | 結果 | 備考 |
|---|---|---|
| CI機械ゲート | ✅ | typecheck、check:docs、Vitest/coverage 100%、Next build、OpenNext dry-run、D1 local migration、tenant/role/API統合 |
| 体験QAウォークスルー | ⚠️ | preview実HTTP縦切りPASS。組み込みブラウザ接続先0のため今回の実画面操作は未確認。Blocker 0 / Critical 0 |
| ux-psychology.md | ✅ | その場で完結、空欄理由+focus、失敗入力保持、画像なしの回復導線を静的契約で確認 |
| performance.md | ⚠️ | bundle 2,632.0KiB（上限85.7%）。CWVはブラウザ未接続で未実測。撮影ライブラリは操作時dynamic import |
| accessibility-jp.md | ⚠️ | native dialog/Esc/autoFocus/aria-invalid/role alert/canvas label/44px既存契約はPASS。今回のTab・読み上げ実測は未確認 |
| risk.md | ✅ | body/shot上限、内容非ログ、rate-limit、冪等、rollback、tenant 404、物理削除なしを確認 |
| launch-security | ✅ | Critical 0 / High 0。`pnpm audit` moderate 1は既存の開発時限定依存。security headersをpreview実応答で確認 |

## 2. リスク受容

| 項目 | 理由 | 依頼者説明済み | 解消予定Slice |
|---|---|---|---|
| 4幅/Light-Dark/keyboard/reduced-motionの今回実ブラウザ確認なし | in-app Browserの接続先が0。静的UI契約と過去画像は履歴証跡に留めた | 最終報告で明示 | production公開前 |
| bundle警告85.7% | 上限内だが余白が小さい | backlog PERFORMANCE-004へ記録 | 次の機能追加前 |
| D1画像保存 | R2 bindingは今回の契約境界外 | bytes/p95 triggerをPERFORMANCE-005へ記録 | trigger到達時 |
| isolate内rate-limit | 既存仕組み再利用の指定。分散防御は別設計 | SECURITY-002/003で管理 | 認証/運用強化Slice |

## 3. 最終確認

- [ ] 成功指標イベントの本番発火（production非公開。画像総bytes/p95計測はR2移行前に追加）
- [x] D1 batch rollbackを失敗注入統合テストで確認
- [ ] 依頼者のpreview実操作確認（browser接続待ち）
- [ ] リリース後レビュー日（未公開）
- [x] 単一障害点メモ: D1が停止した場合→入力をdialog内に保持し、固定の500エラー文から再送へ案内する

## 4. Apple基準の最終問診

「この体験を、明日の全社デモで自分が操作して見せられるか?」 → **No（実ブラウザ4幅・キーボードの今回実測が未完）**。コード/データ/APIのローカルgateはGoだが、production公開はこの確認と依頼者承認後に判断する。

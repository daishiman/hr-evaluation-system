# T3. 機能分解・実装計画 — 画面内改善要望

## 1. 最リスク仮説

> 機微な画面画像を扱っても、再送・失敗・会社境界を破らず、問題発生ページから管理レビューまで1本で完了できる。

検証方法: 実D1互換SQLiteへの失敗注入、API統合、4ロール/他社、4幅ブラウザ / 検証Slice: 1。
**成果物先行の1本目**: `/f/acme-token`から文章+任意画像を投稿し、会社管理者が一覧→詳細→状態/メモを更新する。
**他候補より先に作る理由**: 依頼の価値と最大のデータリスクを同じ縦切りで検証できる。

## 2. ストーリーマップ

背骨: [その場で開く] → [本文/画像を整える] → [安全に保存] → [管理者が対応]

| Slice | その場で開く | 本文/画像を整える | 安全に保存 | 管理者が対応 |
|---|---|---|---|---|
| 0 骨格 | AppShell共通FAB | 自動撮影/注釈 | 2表保存 | 一覧/詳細/4状態 |
| 1 MVP | route ledger SSOT | 画像削除、貼付、黒塗り、下書き保持 | bounded JSON、厳密画像、rate-limit、batch、冪等 | route集約、tenant WHERE、同状態メモ、見送り理由 |
| 2 磨き | 4幅/テーマ/keyboard | inline回復文、reduced-motion | 内容非ログ、413/429回復 | 空/エラー/404、文書/巡回同期 |

## 3. スライス実装順と見積り

| Slice | 含むストーリー | 依存 | 検証すること | 状態 |
|---|---|---|---|---|
| 0 既存骨格監査 | Widget、管理2画面、schema | 既存feat/page-feedback | ギャップと維持対象 | 完了 |
| 1A Route契約 | ledger label、`routeIdentityOf`、`route_pattern` migration | 0 | 動的URL集約、実URL保持、44route一致 | 実装済み |
| 1B 保存境界 | bounded reader、shot magic、rate、submission key、D1 batch | 1A | 413/429、rollback、並行再送 | 実装済み |
| 1C UI/管理 | 下書き/画像なし/黒塗り/inline focus、メモ規則 | 1A/1B | 文章のみ/画像あり、メモ空化、他社404 | 実装済み |
| 2 文書/品質 | T1/T2/T3、system-spec、full tests/build/browser | 1A〜1C | 4条件と公開可否 | ローカル完了（実ブラウザのみ公開前gate） |

## 4. 判断記録(RICE採点・却下した代替案)

| 案 | Reach | Impact | Confidence | Effort | 判断 |
|---|---:|---:|---:|---:|---|
| 既存Widgetを閉鎖パッチ | 44 route台帳の業務画面 | 高 | 高 | 中 | 採用 |
| 各pageへ個別配置 | 同等 | 中 | 低 | 大 | SSOTを失うため却下 |
| 即時R2 | 管理保存のみ | 中 | 中 | 大 | 計測triggerまで保留 |
| 投稿者ポータル/Jira化 | 全投稿者 | 中 | 低 | 特大 | 今回の課題を越えるためNon-Goal |

## 5. 変更ログ

| 日付 | 要望 | 判断 | 成果物での検証結果 |
|---|---|---|---|
| 2026-08-14 | 各ページから画像注釈付き改善要望 | Slice 0〜1へ | 既存骨格を維持し閉鎖パッチへ収束 |
| 2026-08-14 | 動的URL、原子性、冪等性、安全弁、メモ規則 | Slice 1A〜1Cへ | targeted unit/integrationでGREEN |
| 2026-08-14 | migration backfillと会社間ID境界の独立再監査 | Slice 1A/1Bを追加RED | 全動的routeとcompany境界を固定してfull gate再PASS |
| 2026-08-14 | R2/投稿者通知/全画面スクロール | backlog/Non-Goal | 実装せず境界を明記 |

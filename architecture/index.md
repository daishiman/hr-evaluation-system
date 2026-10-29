# アーキテクチャ索引

| 文書 | 内容 |
|---|---|
| [account-profile.md](./account-profile.md) | プロフィール編集・利用者管理の層分けとデータフロー |
| [master-settings.md](./master-settings.md) | 制度設定の責務分割・版ライフサイクル・再集計境界・仮パスワード発行・監査ジャーナル |
| [release-and-forms.md](./release-and-forms.md) | 配布ゲート、D1 migration 順序、フォーム原子化、文書 SSOT |
| [appearance-theme.md](./appearance-theme.md) | 明るさと配色の2軸、既定の表し方、現在設定の記録、開発キット（aidd-agent-kit）との境界 |
| [data-freshness.md](./data-freshness.md) | 保存の入口（サーバーアクション）と描き直し、タブ間の知らせ、応答の保存指示、書きかけの取り消し、同時保存、初期パスワードの控え |
| [improvement-requests-2026-10.md](./improvement-requests-2026-10.md) | 等級の呼び名の関数、複数の会社への所属、権限の台帳とそれを読む入口、並べ替えの hook、権限一覧、一覧の等級と点数、提出状況、設定不足の型、移行 0033・0034 |

製品仕様: `docs/product/spec.md`  
システム仕様: `system-spec/`  
機能: `features/`

- [report-access-print.md](./report-access-print.md): 評価レポートの入口、回答と評価の対応、印刷準備と A4/A3 の差分設計。

## 派生説明資料の更新経路

[打ち合わせ資料](../打ち合わせ資料/README.md)は、正本→原稿→構成JSON・HTML/CSS→PNG/WebP→単一HTMLの順で更新する。資料内の共通CSSは3系統に集約し、アプリの実行時構成・テーマ契約とは独立している。今回の整理はアプリ設計を変更しない。[仕様・設計影響の判断](../specs/meeting-briefing-documents.md)と[受領書](../docs/product/spec-receipts/2026-10-29-meeting-briefing-documents.md)を参照。

PR #104のCI監査対応ではbetter-authと関連依存を更新する。既存のDrizzle/D1アダプター、メール/パスワード、セッション・権限の構成は維持する。[変更範囲と仕様判断](../specs/meeting-briefing-documents.md#ci失敗への追補2026-10-29)を参照。

---
kind: index
---
# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

人事評価管理システムの**実装に直結するシステム仕様**の入口。

製品側の読みやすい仕様メモは `docs/product/spec.md` を正とする。

ここに置くのは、ロール境界・データ制約・API 契約など、コードが守るべき不変条件の要約である。

## 領域別の仕様文書

| 文書 | 内容 |
|---|---|
| [account-and-users.md](./account-and-users.md) | 本人プロフィール・編集ポリシー・利用者管理の不変条件 |
| [master-settings.md](./master-settings.md) | 制度設定画面の責務・会社境界・スナップショット・再集計・等級/昇格要件の版ライフサイクル・監査ジャーナル契約 |
| [release-and-forms.md](./release-and-forms.md) | 本番Deployの自動migrationとfail-closedゲート、複数等級フォームの原子的作成 |
| [routes-and-access.md](./routes-and-access.md) | 全44画面の目的・対象、ロール×状態×結果、4幅の受入契約 |
| [imports-and-readiness.md](./imports-and-readiness.md) | CSV一括取込の原子性・復元点、評価セット/期間/アンケートの共通readiness |
| [improvement-requests.md](./improvement-requests.md) | 画面内改善要望のroute identity、API/DB、原子保存、冪等、管理更新契約 |
| [appearance-theme.md](./appearance-theme.md) | 明るさ・配色の値集合（画面/API/DBで一致）、既定の表し方、現在設定の記録API、開発キットとの配色境界 |

書き込み後の表示鮮度（作成・変更・削除の結果がすぐ見えること）の仕様は、下の「要件定義書」と「章一覧と集約状態」にある。これらは system-spec-harness が `spec-state.json` と `fetched-references.json` から生成する章で、集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値（真理値表で導出）。

機械可読なルート正本は [`route-ledger.json`](./route-ledger.json)。`page.tsx` との完全一致を `pnpm run check:docs` で検査する。

## 更新ルール

1. 画面・API・DB のどれかが変わる変更は、対応する system-spec を同じ PR で更新する。
2. 製品向けの言い回しは `docs/product/spec.md` に書き、ここには判定条件と境界を書く。
3. 反映したら `docs/product/spec-receipts/` に受領書を残す。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 利用者が作成・変更・削除した結果を、成功表示の直後の画面・再読み込み・他のタブと画面復帰のどれでも必ず確認できるようにし、『本当に保存できたのか』を疑わずに次の作業へ進める状態をシステムとして保証する。
- **ゴール (U3)**: G1=書き込み成功を表示した時点で、同じタブの一覧・件数・ナビゲーション（会社切替など）がすべてその結果を含んでいる。, G2=通常・強制の再読み込みや URL の直接表示は、直前の書き込み結果を必ず含む。, G3=同じ利用者の他のタブや、スマホ・タブレットでの画面復帰（bfcache 復元・タブ復帰）でも、古い一覧のまま操作を続けない。, G4=画面や書き込み API を追加しても、鮮度の保証が個別実装に頼らず共通契約として適用され、適用漏れは検査で落ちる。, G5=一つの操作で複数の表を書く書き込みが途中で失敗しても、一部だけ反映された中途状態（会社はあるが管理者が無い等）を残さない。取り消し・やり直しの処理まで失敗したときは、その事実が記録に残って検知でき、手作業で直せる。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G2 G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G3 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G2 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G2 G4 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 G4 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G2 G4 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)

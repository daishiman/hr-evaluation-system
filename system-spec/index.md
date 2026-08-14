# システム仕様（system-spec）索引

人事評価管理システムの**実装に直結するシステム仕様**の入口。

製品側の読みやすい仕様メモは `docs/product/spec.md` を正とする。  
ここに置くのは、ロール境界・データ制約・API 契約など、コードが守るべき不変条件の要約である。

| 文書 | 内容 |
|---|---|
| [account-and-users.md](./account-and-users.md) | 本人プロフィール・編集ポリシー・利用者管理の不変条件 |
| [master-settings.md](./master-settings.md) | 制度設定画面の責務・会社境界・スナップショット・再集計・等級/昇格要件の版ライフサイクル・監査ジャーナル契約 |
| [release-and-forms.md](./release-and-forms.md) | 本番Deployの自動migrationとfail-closedゲート、複数等級フォームの原子的作成 |
| [routes-and-access.md](./routes-and-access.md) | 全44画面の目的・対象、ロール×状態×結果、4幅の受入契約 |
| [imports-and-readiness.md](./imports-and-readiness.md) | CSV一括取込の原子性・復元点、評価セット/期間/アンケートの共通readiness |
| [improvement-requests.md](./improvement-requests.md) | 画面内改善要望のroute identity、API/DB、原子保存、冪等、管理更新契約 |

機械可読なルート正本は [`route-ledger.json`](./route-ledger.json)。`page.tsx` との完全一致を `pnpm run check:docs` で検査する。

## 更新ルール

1. 画面・API・DB のどれかが変わる変更は、対応する system-spec を同じ PR で更新する。
2. 製品向けの言い回しは `docs/product/spec.md` に書き、ここには判定条件と境界を書く。
3. 反映したら `docs/product/spec-receipts/` に受領書を残す。

# システム仕様（system-spec）索引

人事評価管理システムの**実装に直結するシステム仕様**の入口。

製品側の読みやすい仕様メモは `docs/product/spec.md` を正とする。  
ここに置くのは、ロール境界・データ制約・API 契約など、コードが守るべき不変条件の要約である。

| 文書 | 内容 |
|---|---|
| [account-and-users.md](./account-and-users.md) | 本人プロフィール・編集ポリシー・利用者管理の不変条件 |

## 更新ルール

1. 画面・API・DB のどれかが変わる変更は、対応する system-spec を同じ PR で更新する。
2. 製品向けの言い回しは `docs/product/spec.md` に書き、ここには判定条件と境界を書く。
3. 反映したら `docs/product/spec-receipts/` に受領書を残す。

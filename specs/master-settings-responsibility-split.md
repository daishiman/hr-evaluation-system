# 仕様メモ: 制度設定の責務分割

- graph_node_id: `feat-master-settings-responsibility-split`
- beads: `hr-hco`
- 正本（製品）: `docs/product/spec.md`
- 正本（システム）: `system-spec/master-settings.md`

## 画面責務

| 画面 | 所有 |
|---|---|
| `/admin/masters` | 等級の名前・水準・目標上限 |
| `/admin/masters/requirements` | 等級要件（支援・運営） |
| `/admin/masters/promotion` | 昇格点数・昇格要件 |
| `/admin/behavior` | 行動指針の適用・観点・段階文言 |
| `/admin/scheme` | 評価項目・配点・ランク割合・KPIランク基準 |
| `/admin/kgi` | 事業所KGI達成率・達成係数 |
| `/admin/raises` | 昇給方針・金額 |

## 影響境界

1. 確認中評価のみ再集計対象。確定済みはスナップショット据え置き。
2. 行動指針はフォーム公開時の写しを評価する。マスタ変更は次フォームから。
3. 表示ラベル（ランク範囲・KGI範囲）は境界数値から生成する。

## 付随

- 社員CSV取込: 新規利用者の仮パスワードをサーバーが自動発行し、レスポンスで一度だけ返す。

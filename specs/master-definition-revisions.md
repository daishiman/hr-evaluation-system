# 仕様メモ: 等級要件・昇格要件の版管理

- graph_node_id: `feat-master-definition-revisions`
- beads: `hr-2qk`
- 正本（製品）: `docs/product/spec.md` §7-8 / `docs/product/spec-master-definition-revisions.md`
- 正本（システム）: `system-spec/master-settings.md` §5〜6

## 状態モデル

| 状態 | 判定 | 許す操作 |
|---|---|---|
| 使用中の現行版 | 後続版なし、`is_active=true` | 内容を直す、今後使わない、並べ替え |
| 停止中の現行版 | 後続版なし、`is_active=false` | もう一度使う |
| 過去版 | 別行の `previous_version_id` から参照される | 閲覧、この内容をもとに新版を作る |

## command契約

| 等級要件 | 昇格要件 | 入力 |
|---|---|---|
| `gradeRequirementCreate` | `promotionRequirementCreate` | `gradeId`、区分/種類、内容 |
| `gradeRequirementRevise` | `promotionRequirementRevise` | `id`、意味フィールド |
| `gradeRequirementActivation` | `promotionRequirementActivation` | `id`, `isActive` |
| `gradeRequirementRestoreContent` | `promotionRequirementRestoreContent` | `id`, `sourceVersionId` |
| `gradeRequirementOrder` | `promotionRequirementOrder` | `id`, `direction` |

id指定commandで `gradeId` / `category` / `reqKind` を送らない。
会社、等級、区分、種類は対象idからサーバーが導出する。

## 不変条件

1. 意味変更はINSERTのみ。旧版は `is_active` / `seq` を含む全列を変更しない。
2. `previous_version_id` は一意で、系譜は一本道。
3. 過去版をactiveにしない。再採用は現行版の後続となる新id。
4. 等級要件は `company + grade + category` ごとにactive 10件以下。
5. 作成済み・公開済みフォームと評価は自動更新しない。
6. snapshot-fedの定義変更は既存評価をstaleにしない。
7. 系譜内の1版でも使用済みなら、系譜の完全削除を拒否する。

## UI契約

- `内容を直す`: 新版を作る操作
- `今後使わない`: 現行版を次のフォームから外す操作
- `もう一度使う`: 停止中の現行版を同じidで再開する操作
- `この内容をもとに新版を作る`: 過去内容を現行版の後続へコピーする操作
- 成功時は `次に作るアンケートから反映します。作成済みのアンケートと評価は変わりません` を伝える

行動指針の等級割当は、各等級の行/カード内に `この等級に出す行動指針`、`出さない`、行内保存を置く。
上部read-only一覧と下部の単一編集フォームは併存させない。

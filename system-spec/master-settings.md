# 制度設定と評価への反映 — システム仕様

- graph_node_id: `feat-master-settings-responsibility-split` / `feat-master-definition-revisions` / `chore-release-safety-and-ssot`
- beads: `hr-hco` / `hr-2qk` / `hr-0p4`
- 正本（製品）: `docs/product/spec.md` §3、§5-1、§7 / `docs/product/spec-master-definition-revisions.md`
- 実装入口: `src/app/admin/` / `src/app/api/masters/` / `src/lib/impact.ts`

## 1. 権限と会社境界

- 制度設定画面と更新APIの最小ロールは `COMPANY_ADMIN`。
- COMPANY_ADMIN は所属会社、SUPER_ADMIN は選択中の操作対象会社だけを扱う。
- ID指定更新は、更新前に `id + viewer.companyId` で対象の存在を確認する。他社IDを受け取っても更新しない。
- ナビゲーションの非表示は認可の代わりにしない。画面は `requireRole`、APIは `apiViewer` で同じ境界を強制する。

## 2. 画面の単一責務

| 画面 | 所有する設定 |
|---|---|
| `/admin/masters` | 等級の名前・水準・半期の目標設定上限数 |
| `/admin/masters/requirements` | 等級要件（支援・運営） |
| `/admin/masters/promotion` | 昇格に必要な点数・点数外の昇格要件 |
| `/admin/behavior` | 行動指針の等級適用・観点・段階文言 |
| `/admin/scheme` | 等級区分ごとの評価項目・配点・ランク割合・KPIランク基準 |
| `/admin/kgi` | 事業所別KGI達成率・達成係数 |
| `/admin/raises` | 昇給方針・等級別金額・事業所調整・改定履歴 |

ダッシュボードの暫定件数は昇格条件と昇給額を別々に数え、前者を `/admin/masters/promotion`、後者を `/admin/raises` へ案内する。合算件数から1画面だけへ案内してはならない。

### KPI項目選択の不変条件

1. 固定の No.1（等級要件達成率）以外は、操作対象会社に登録されたKPI全項目から自由に選べる。
2. `kpi_reference_points` の行の有無、カテゴリ、`is_monetary`、ランク基準の `target_grades` は選択可否の制約にしない。`target_grades` が対象外なら保存を許し、基準が厳しすぎる可能性を警告する。
3. 拘束する正本は `grade_point_rules`。等級区分ごとの件数（1 / 3 / 6 / 7 / 8）、固定・重い・通常の各枠数と配点、合計100点、項目IDの重複禁止を画面とAPIで共有する。8件はManagerだけである。

## 3. 変更の反映とスナップショット

1. KPIランク基準、評価項目・配点、ランク割合、昇格点数、KPI計算式、KGI係数は `src/lib/impact.ts` の監視対象とする。更新時刻が評価の `computedAt` より新しい場合、確認中評価を再集計対象として扱う。等級要件・昇格要件・行動指針はフォームへ写した定義を評価するため、監視対象に含めない。
2. `evaluations.status = finalized` は再集計しない。判定時の配点・閾値・根拠を保存したまま据え置く。
3. 再集計可能件数が1件以上なら `/manager/cycles?cycle=...` への導線を出す。0件ならリンクを出さず、確定済みが当時の基準のまま残ることだけを説明する。
4. 行動指針の観点名・段階文言・選択肢は、アンケート作成時に `form_questions` と選択肢へ写す。評価はその写しを使うため、行動指針の変更を既存評価の stale 判定へ含めない。
5. 事業所KGI達成率は保存時に、同じ事業所・評価期間の確認中評価の賞与欄だけを即時再計算する。達成率自体は全サイクル再集計の監視対象に含めない。KGI係数の変更は監視対象とする。

## 4. UI・API整合

- 画面に表示する現在値と送信値を一致させる。対象を切り替えるフォームは、切替後のレコードの値で入力を初期化する。
- 行動指針の `isActive=false` は、次に作るアンケートの設問から除外する。
- KPIランク基準は `/admin/scheme` から遅延取得し、保存後はキャッシュを破棄して再取得する。
- KGI係数は `/admin/kgi` で表示・編集する。利用者へ見せる適用範囲は `lowerBound` / `upperBound` から `kgiRangeLabel` で導き、移行互換用の `label` を表示・編集の正本にしない。適用範囲の抜けや重なりは既存の coverage 検査結果を表示する。

## 5. 等級要件・昇格要件の版ライフサイクル

### 5-1. データ不変条件

- `grade_requirements` と `promotion_requirements` は、意味のある内容を直すたびに新しい `id` の行をINSERTする。改訂時は旧行を1列もUPDATEせず、旧版の `is_active` / `seq` も改訂時点の履歴値として残す。
- 新版の `previous_version_id` は、その時点の現行版を指す。過去版の内容を再採用するときも、過去版をactiveにせず、現行版を `previous_version_id` とする新しい行を作る。
- `previous_version_id` は一意。1つの版から複数の後続版を作れない。競合はサーバーが `409` として返す。
- 現行版は、別行の `previous_version_id` から指されていない系譜末尾。過去版は履歴として返すが、future formの候補にはしない。
- `seq` と現行版の `is_active` は将来フォームの構成値としてUPDATEできる。後続版ができた旧版は値にかかわらず現行候補から外す。現行版の `is_active=false` は可逆で、同じ現行版idを `true` に戻す。
- 等級要件のactive上限10は `company_id + grade_id + category` で数える。追加・再開と件数確認は同一の原子的保存単位で行う。
- id指定操作の会社・等級・区分・種類は保存済み行から導出する。リクエスト本文で対象範囲を上書きできない。
- 完全削除は同じ系譜の全版について利用実績を確認する。`form_questions` または評価スナップショットが1件でも参照する系譜は削除しない。

### 5-2. API command

`PUT /api/masters` は操作の意味を `kind` で分離する。

| 対象 | 新規 | 意味の改訂 | 使用停止・再開 | 過去内容の再採用 | 並べ替え |
|---|---|---|---|---|---|
| 等級要件 | `gradeRequirementCreate` | `gradeRequirementRevise` | `gradeRequirementActivation` | `gradeRequirementRestoreContent` | `gradeRequirementOrder` |
| 昇格要件 | `promotionRequirementCreate` | `promotionRequirementRevise` | `promotionRequirementActivation` | `promotionRequirementRestoreContent` | `promotionRequirementOrder` |

- Createだけが `gradeId` と区分/種類を受け取る。
- Reviseは `id` と意味フィールド、Activationは `id + isActive`、RestoreContentは `id + sourceVersionId`、Orderは `id + direction` を受け取る。Order の `direction` は `up` / `down` / `top` / `bottom` の4値だけを許す。
- id指定commandは `gradeId` / `category` / `reqKind` を受け取らない。
- 一覧は `previousVersionId` を含む全版を返す。画面と削除判定は同じ系譜関数で現行・履歴を分類する。
- Order は対象idから同じ会社・等級・区分/種類の使用中の現行版を導き、`up` / `down` は隣と交換、`top` / `bottom` は間を詰めて先頭/末尾へ移す。別区分・別種類・過去版を更新しない。
- 先頭で `up` / `top`、末尾で `down` / `bottom` は `400` とし、DBへ変更を残さない。旧データに重複 `seq` がある場合は同じ並び替え単位を1始まりへ正規化する。

### 5-3. フォーム・評価・stale境界

- 新規フォームはactiveな現行版だけを読み、版idと文言を `form_questions` に保存する。
- 作成済みフォームは自動更新しない。下書きへの明示同期は、回答なし等の既存安全条件を満たす場合だけ許可する。
- 評価はフォームの写しを読み、等級要件・昇格要件の新版作成やactive変更をstale理由にしない。
- 公開済みフォーム、回答、評価、および過去版の行は変更しない。

## 6. 行動指針の等級割当UI

- `/admin/behavior` は、各等級を同じ行またはカードで表示し、その中に `この等級に出す行動指針` のselect、`出さない`、行内保存を置く。
- 上部の読み取り専用一覧と下部の単一等級編集フォームを併存させない。表示値と編集値の所有場所は1つにする。
- `適用` という抽象語は使わず、`Beginnerのアンケートにこの行動指針を出す` のように、等級・対象・結果を明記する。
- 保存後は `次に作るアンケートから反映します。作成済みのアンケートと評価は変わりません` と表示する。
- 保存APIの権限・会社境界・基準セットの存在/active検査は従来どおりサーバーで行う。

## 7. 制度マスタの変更監査

- 現在状態の正本は各制度マスタテーブルとし、`constitution_events` は変更履歴表示・障害調査用の append-only 監査ジャーナルとする。
- 監査記録の再生結果を画面・計算・復旧の正本にしない。監査欠落または同一 `seq` があっても現在状態の読み取りへ波及させない。
- 現状は本体更新と監査 INSERT が同じ D1 batch ではない。完全な監査証跡を要件化するときは、全更新 command を同一 batch に統合し、同一実体の順序をDB制約で保証してから利用する。

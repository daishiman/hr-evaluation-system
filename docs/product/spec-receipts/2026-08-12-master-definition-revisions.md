# 仕様反映 受領書

| 項目 | 内容 |
|---|---|
| 日付 | 2026-08-12 |
| graph_node_id | `feat-master-definition-revisions` |
| beads_id | `hr-2qk` |
| 判定 | **仕様・DB・API・UI・回帰への影響あり → 正規フローで反映** |

## 受領した決定

1. 「今後使わない」は現行版のfuture selectionを止める可逆操作。過去フォーム・評価は不変
2. 停止中の現行版は同じidで「もう一度使う」
3. 意味変更は上書きせず、新id + `previous_version_id` の新版。旧行は全列不変
4. 過去内容の再採用は、旧idのactive化ではなく現行版の後続となる新版
5. `seq` / `is_active` はfuture configurationとして更新可能
6. active上限、会社・等級・区分/種類、競合、削除条件はサーバーとDBで保証
7. snapshot-fedの等級要件・昇格要件はstale対象外。下書きは明示同期、新フォームだけ新版採用
8. UIは `内容を直す` / `今後使わない` / `もう一度使う` / `この内容をもとに新版を作る` と反映時期を明示
9. grade/promotionは共通ライフサイクルを使い、全masterのイベントストア化はしない
10. 行動指針の等級割当は、各等級の行/カード内select + 保存へ一本化
11. #33の現在値は5期closed。結果あり4期はfinalized、2026h1は回答・評価なしで#38の放置一覧0件

## 30思考法による設計判断（コンパクト記録）

| 思考法 | 観測から採用した判断 |
|---|---|
| 批判的思考・演繹思考・帰納的思考・アブダクション・垂直思考 | 表示スナップショットだけでは定義の同一性を守れない。ユーザーが復活を見つけられない主因は末尾Disclosureと曖昧な「戻す」。意味変更はnew id、復活は上部導線に分離 |
| 要素分解・MECE・2軸思考・プロセス思考 | 定義、現行版、active、順序、利用実績、フォーム写しを分離。操作×未使用/使用済みで保存規則を固定し、改訂→新フォーム→評価の順で旧版不変を検証 |
| メタ思考・抽象化思考・ダブル・ループ思考 | 「編集=UPDATE」という前提を外し、共通化単位を全masterではなくsnapshot-fedなgrade/promotionの版ライフサイクルに限定 |
| ブレインストーミング・水平思考・逆説思考・類推思考・if思考・素人思考 | ゴミ箱、旧版再active、イベントストア、root+revision表も比較。10件満杯、同時編集、古い画面、初見利用者を想定し、一本道 + 明示command + 具体語を採用 |
| システム思考・因果関係分析・因果ループ | 同一row UPDATE→master identity変化→監査不能、global updatedAt→偽stale→無意味な再集計という連鎖を切る。form snapshotを依存境界の正本にした |
| トレードオン思考・プラスサム思考・価値提案思考・戦略的思考 | new idで履歴を守りつつ、`seq/is_active` は軽い更新を維持。既存FKと画面を大改造せず、利用者の安心・監査性・実装量を同時改善 |
| why思考・改善思考・仮説思考・論点思考・KJ法 | 真の論点を「戻せるか」と「過去を上書きしないか」に集約。版管理、復活UX、stale、sample回帰、行動指針UIの5群へ分け、P0境界から実装 |

## 4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | 意味変更/new id、停止/same id、過去再採用/new idを操作別に定義。次フォーム反映とstale対象外も一致 |
| 漏れなし | PASS | active上限、会社/bucket、競合、削除、draft同期、UI用語、sample横断回帰まで受入へ対応 |
| 整合性あり | PASS | grade/promotionで同じcommandと系譜語彙を使用。行動指針も等級行内編集へ揃え、抽象語「適用」を廃止 |
| 依存関係整合 | PASS | DB→API→form snapshot→evaluation、UI→API、sample seed→stalled queryの順序と所有を明示 |

## 反映先

| 層 | パス |
|---|---|
| 製品仕様 | `docs/product/spec.md` §7-8 / `docs/product/spec-master-definition-revisions.md` |
| 残課題 | `docs/product/backlog.md` / `docs/product/backlog-session-notes.md` |
| システム仕様 | `system-spec/master-settings.md` |
| 設計 | `architecture/master-settings.md` |
| 移行対応 | `docs/migration-mapping.md` / `docs/migration-mapping-requirement-revisions.md` |
| 機能/仕様/タスク | `features/feat-master-definition-revisions.md` / `specs/master-definition-revisions.md` / `tasks/feat-master-definition-revisions.md` |
| 横断回帰 | `scripts/sample-data.test.mjs` |

## 受領境界

4条件のPASSは、本受領書に列挙した仕様とローカル回帰の整合に対する判定である。
全制度マスタのactor監査、実運用での文言評価、production migration/deployは別の証跡を必要とする。

## ローカル証跡

- focused（sample / impact / versioned / masters）: **11 files / 86 tests PASS**
- `pnpm test`: **72 files / 1269 tests PASS、1 file / 1 test skipped**
- `pnpm typecheck`: **PASS**
- `git diff --check`: **PASS**
- skipは任意の本番スナップショットが無いときだけ外れる既存 `production-bounds.check.test.ts` で、今回の変更範囲ではない

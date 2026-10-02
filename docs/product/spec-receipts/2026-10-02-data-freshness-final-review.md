# 仕様反映 受領書（最終レビュー）

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-02 |
| graph_node_id | `feat-data-freshness`（task は `SYS-DF-P01`〜`SYS-DF-P13`。仕様・設計のノードは `spec-data-freshness`・`arch-data-freshness`） |
| beads_id | `hr-czp`（task は `hr-czp.1`〜`hr-czp.13`） |
| 判定 | **影響あり → 抜けていた2か所を反映した**（それ以外は反映済みを確認した） |

## 確かめたこと

[2026-10-01 の受領書](./2026-10-01-data-freshness.md) より後に作業ツリーへ入った変更を、仕様と設計に照らした。同じ機能の仕上げで、内容は[ワークツリーの再検証](../../reviews/elegant-review-2026-10-02.md)に記録がある。

| 変更 | 仕様・設計への影響 | 反映先 |
|---|---|---|
| 下書きの自動保存を送った順に保存し、「保存済み」は最新の入力の成功だけで出す。提出が先に済んだ下書きの保存は 409 | **あり**（利用者に見えるふるまい） | システム仕様 [release-and-forms §6](../../../system-spec/release-and-forms.md) と [設計](../../../architecture/data-freshness.md) は反映済み。**製品仕様 §27-4 に無かったので足した** |
| 氏名（前後の空白を除いて必須）と所属会社（ひな形・停止中は不可）の検査を、3つの入口で共有 | 製品仕様は変わらない（§3「システム全体の利用者管理」の決まりを、入口ごとの抜けなく守るようにした） | **[設計 account-profile](../../../architecture/account-profile.md) の部品の役割が古かったので直した** |
| 要件編集の保存・削除の共通 hook（`use-master-action.ts`） | なし（画面のふるまいは同じ） | 契約試験が共通 hook と利用側を追う |
| 画面離脱後に届く応答の待機を終える。読み取り表示は最新の値を使う | 設計のみ | [設計](../../../architecture/data-freshness.md) は反映済み |
| 承認の原文を章から1か所へ集めた | なし（原文は変えず、現行の契約は各章が正） | [共通承認証跡](./2026-10-02-shared-approval-evidence.md) |
| サーバーアクションの本文上限を 8MB に広げた（`next.config.ts`） | なし（受け付ける大きさの上限は、各入力の上限が決める） | 設定の注釈に理由を書いた |
| next 16.3.8・`@vitest/coverage-v8` 4.1.11 へ更新、`@playwright/test` を追加 | なし | — |

## 4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | 製品仕様 §27-4・システム仕様 release-and-forms §6・設計が、自動保存の順序と 409 を同じ言葉で指す。account-profile の部品の役割がコードと一致する |
| 漏れなし | PASS | 上の表の変更すべてに、反映先か「影響なし」の理由がある。見送った整理は W5 として[セッション記録](../backlog-session-notes.md)に残した |
| 整合性あり | PASS | system-spec の4つの検証（網羅・出典・文書同期・必須情報）がすべて exit 0。`pnpm run check:docs` が PASS |
| 依存関係整合 | PASS | `pnpm typecheck` と `pnpm test`（148 files・2297 tests、skip は任意の本番検査1件）が PASS |

## 反映先

| 層 | パス |
|---|---|
| 製品仕様 | `docs/product/spec.md` §27-4（自動保存の順序・「保存済み」・409） |
| 設計 | `architecture/account-profile.md`（`user-integrity.ts`・`user-name-schema.ts` の役割と主要ファイル） |
| 残課題 | `docs/product/backlog-session-notes.md`（W5） |
| タスク | `tasks/feat-data-freshness.md`（受入 19・20、変更範囲、品質ゲート、W5） |

## 受領境界

判定の対象は、draft PR に入れる差分と、ローカルで測った検証である。Workers のビルドと画面の通し試験は、同じ日の再検証の値を引いた（最終レビューでは測り直していない）。本番での確認（W2）と本番の `CREDENTIAL_ENC_KEY`（W3）は含まない。

## ローカル証跡

- `pnpm typecheck`: **PASS**
- `pnpm test`: **148 files passed・1 skipped / 2297 tests passed・1 skipped**
- `pnpm run check:docs`: **PASS**
- `git diff --check`: **PASS**
- system-spec の決定論ゲート（網羅・出典・文書同期）: **すべて exit 0**。必須情報の接地は `ungrounded_blocking_items` が空
- 引用（同じ日の再検証）: `pnpm run cf:dry-run` exit 0・圧縮後 1997.1 KiB（上限の 65.0%）、専用のローカル D1 で `pnpm test:e2e` 14件 PASS

# タスクの状態: feature-improvement-requests-2026-10

| 項目 | 値 |
|---|---|
| graph_node_id | `feature-improvement-requests-2026-10`（task は `SYS-IR-P01`〜`SYS-IR-P13`） |
| beads_id | `hr-wcv`（task は `hr-wcv.1`〜`hr-wcv.13`） |
| 状態 | review。11項目の PR [#93](https://github.com/daishiman/hr-evaluation-system/pull/93) は 2026-10-14 に main へマージし（squash `03787cb`）、Deploy run 38509015552 で本番へ配布した。追加要望 A〜C は main 向けの draft PR [#94](https://github.com/daishiman/hr-evaluation-system/pull/94)。マージと本番への配布のあと done |
| base branch | `main`（追加要望の PR は `03787cb`＝#93 のマージ後の上に載せる。dev ブランチは無い） |
| work branch | `devgraph/feature-improvement-requests-2026-10` |
| 仕様反映 | [2026-10-13 の受領書](../docs/product/spec-receipts/2026-10-13-improvement-requests.md) / [最終レビューの受領書](../docs/product/spec-receipts/2026-10-14-improvement-requests-final-review.md) / [追加要望の受領書](../docs/product/spec-receipts/2026-10-14-improvement-requests-additional.md) |

各 task の仕様の正本は `tasks/feature-improvement-requests-2026-10/sys-ir-p01.md`〜`sys-ir-p13.md`（system-dev-planner の exact-13 package）。そちらは package の digest に結び付いているので、状態はこの文書と Beads に書き、task の仕様書は書き換えない。範囲 S1〜S14・受入 A1〜A13 の番号と証跡の場所は [仕様メモ](../specs/improvement-requests-2026-10.md) が正本。

## task ごとの状態（2026-10-14）

| task | Beads | 状態 | 閉じる条件 |
|---|---|---|---|
| P01 仕様の受領 | `hr-wcv.1` | closed。最終レビューで DD-009 の2点を受領し直した | — |
| P02 設計 | `hr-wcv.2` | closed。最終レビューで DD-009 を足した | — |
| P03 設計の見直し | `hr-wcv.3` | closed | — |
| P04 赤の試験 | `hr-wcv.4` | closed。最終レビューで所属・提出対象・画面の操作の試験を足した | — |
| P05 実装と移行 | `hr-wcv.5` | closed。draft PR #93 を出した | — |
| P06 緑の確認 | `hr-wcv.6` | closed。#93 のマージ後の Deploy は run 38509015552 で成功 | — |
| P07 preview での受入 | `hr-wcv.7` | 確認済み（E2E 53 件成功。追加要望の2件を含む） | P06 のあと（Beads の依存） |
| P08 移行の予行 | `hr-wcv.8` | closed。0033・0034・0035 を2回流した。対応表は [migration-mapping-grade-display-names.md](../docs/migration-mapping-grade-display-names.md) | — |
| P09 漏れ・権限・a11y | `hr-wcv.9` | 確認済み。他社の既存アカウントへの所属追加を全体管理者だけにした（DD-009） | P06 のあと（P08 は閉じた） |
| P10 突き合わせ | `hr-wcv.10` | 範囲14件・受入13項目・変えてはいけないものを突き合わせた | P07・P09 のあと |
| P11 証跡のまとめ | `hr-wcv.11` | 仕様メモの受入の表にまとめた | P10 のあと |
| P12 文書 | `hr-wcv.12` | 製品仕様 §28・機能の地図・運用の文書・README をそろえた | P10 のあと |
| P13 配布 | `hr-wcv.13` | PR #93 の `gh:pr` ゲートを付けた。配布の準備まで（[デプロイ時の注意](../docs/deploy-notes.md)、戻す手順は `drizzle/rollback/`）。#93 のマージ後、Deploy run 38509015552 が 0034・0035 を適用し（0033 は適用済み）、Worker を配布した。本番の画面を確かめた記録はまだ | マージのあと、0033 → 0034 → 0035 と Worker を配布し、本番の画面を確かめて記録を残したとき |

## 追加要望（2026-10-14、本番を見て受けた3件）

#93 を本番へ配布したあとに受けた。draft PR #94 で出す。範囲 S1〜S14・受入 A1〜A13 の番号の外に置く。task は増やさず、P04（試験）・P05（実装）・P07（preview での受入）・P12（文書）の中で扱った。

| 記号 | 要望 | 状態 | 反映先 |
|---|---|---|---|
| 追加A | 並べ替えの行の釣り合い。持ち上げて動かす操作 | 実装・E2E・撮影まで済み | 製品仕様 §28-11 |
| 追加B | 人の一覧の検索と並べ替え（名前・会社・役割・点数・等級。権限で選べるものを変える） | 実装・E2E・撮影まで済み | 製品仕様 §28-13・DD-011・システム仕様 account-and-users §8 |
| 追加C | 行動指針の分け方（続いた等級にだけ同じセットを出す） | 実装・試験・撮影まで済み。本番は管理者の1手で直す（D1 には書いていない） | 製品仕様 §28-12・DD-010・システム仕様 master-settings §6 |

## 品質ゲート（追加要望 A〜C を含めた作業ツリー、2026-10-14）

| ゲート | 結果 |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 180 ファイル成功・1 スキップ、2728 件成功・1 件スキップ |
| `pnpm test:coverage`（domain） | 100%（文 2550・分岐 2017・関数 679・行 2082） |
| `pnpm check:docs` | PASS |
| `pnpm cf:dry-run` | exit 0 |
| E2E（`e2e/improvement-*.spec.ts`・`e2e/reorder-data-flow.spec.ts` ほか） | 53 件成功 |
| system-spec（coverage・citation・spec-doc-sync） | OK |
| dev-graph（schema / lineage） | pass / fail（3 node の digest が古い。OPS-015。追加要望で増えていない） |

## 残課題

- OPS-015: graph の取込元の digest が古い3 node。dev-graph の writer に取り込み直しの操作が入ったら、R0 からやり直す
- FEATURE-005（行動指針の並べ替え）・OPS-014（見本データの締切が固定の日付）・`/criteria` の網羅率 42% は範囲外のまま

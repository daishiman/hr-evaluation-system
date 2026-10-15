# タスクの状態: feature-improvement-requests-2026-10

| 項目 | 値 |
|---|---|
| graph_node_id | `feature-improvement-requests-2026-10`（task は `SYS-IR-P01`〜`SYS-IR-P13`） |
| beads_id | `hr-wcv`（task は `hr-wcv.1`〜`hr-wcv.13`） |
| 状態 | merged・配布済み。11項目の PR [#93](https://github.com/daishiman/hr-evaluation-system/pull/93) は 2026-10-14 に main へマージし（squash `03787cb`）、Deploy run 38509015552 で本番へ配布した。追加要望 A〜C の PR [#94](https://github.com/daishiman/hr-evaluation-system/pull/94) も同じ日にマージし（squash `42b7f6b`）、Deploy run 38560660381 で配布した。本番の画面の確認（P13）と本番の行動指針の直し（追加C の残り）が済んだら done |
| base branch | `main`（追加要望の PR は `03787cb`＝#93 のマージ後の上に載せる。dev ブランチは無い） |
| work branch | `devgraph/feature-improvement-requests-2026-10` |
| 仕様反映 | [2026-10-13 の受領書](../docs/product/spec-receipts/2026-10-13-improvement-requests.md) / [最終レビューの受領書](../docs/product/spec-receipts/2026-10-14-improvement-requests-final-review.md) / [追加要望の受領書](../docs/product/spec-receipts/2026-10-14-improvement-requests-additional.md) |

各 task の固定された計画は `tasks/feature-improvement-requests-2026-10/sys-ir-p01.md`〜`sys-ir-p13.md`（system-dev-planner の exact-13 package）。そちらは package の digest に結び付いているので、状態はこの文書と Beads に書き、task の仕様書は書き換えない。範囲 S1〜S14・受入 A1〜A13 の番号・担当・証跡の場所は [仕様メモ](../specs/improvement-requests-2026-10.md) の照合表から辿る。現行の振る舞い・契約・構成の優先順位は [README「文書の入口」](../README.md#文書の入口) に従う。

## task ごとの状態（2026-10-14）

| task | Beads | 状態 | 閉じる条件 |
|---|---|---|---|
| P01 仕様の受領 | `hr-wcv.1` | closed。最終レビューで DD-009 の2点を受領し直した | — |
| P02 設計 | `hr-wcv.2` | closed。最終レビューで DD-009 を足した | — |
| P03 設計の見直し | `hr-wcv.3` | closed | — |
| P04 赤の試験 | `hr-wcv.4` | closed。最終レビューで所属・提出対象・画面の操作の試験を足した | — |
| P05 実装と移行 | `hr-wcv.5` | closed。draft PR #93 を出した | — |
| P06 緑の確認 | `hr-wcv.6` | closed。#93 のマージ後の Deploy は run 38509015552 で成功 | — |
| P07 preview での受入 | `hr-wcv.7` | 確認済み（E2E 57 件成功。追加要望と共通化レビューの試験を含む） | P06 のあと（Beads の依存） |
| P08 移行の予行 | `hr-wcv.8` | closed。0033・0034・0035 を2回流した。対応表は [migration-mapping-grade-display-names.md](../docs/migration-mapping-grade-display-names.md) | — |
| P09 漏れ・権限・a11y | `hr-wcv.9` | 確認済み。他社の既存アカウントへの所属追加を全体管理者だけにした（DD-009） | P06 のあと（P08 は閉じた） |
| P10 突き合わせ | `hr-wcv.10` | 範囲14件・受入13項目・変えてはいけないものを突き合わせた | P07・P09 のあと |
| P11 証跡のまとめ | `hr-wcv.11` | 仕様メモの受入の表にまとめた | P10 のあと |
| P12 文書 | `hr-wcv.12` | 製品仕様 §28・機能の地図・運用の文書・README をそろえた | P10 のあと |
| P13 配布 | `hr-wcv.13` | PR #93 の `gh:pr` ゲートを付けた。配布の準備まで（[デプロイ時の注意](../docs/deploy-notes.md)、戻す手順は `drizzle/rollback/`）。#93 のマージ後、Deploy run 38509015552 が 0034・0035 を適用し（0033 は適用済み）、Worker を配布した。#94 は run 38560660381 で配布だけを流した（未適用の移行 0 件）。配布の記録は [デプロイ時の注意 §9](../docs/deploy-notes.md)。本番の画面を確かめた記録はまだ | マージのあと、0033 → 0034 → 0035 と Worker を配布し、本番の画面を確かめて記録を残したとき |

## 追加要望（2026-10-14、本番を見て受けた3件）

#93 を本番へ配布したあとに受けた。PR #94 で出し、2026-10-14 にマージして配布した。範囲 S1〜S14・受入 A1〜A13 の番号の外に置く。task は増やさず、P04（試験）・P05（実装）・P07（preview での受入）・P12（文書）の中で扱った。

| 記号 | 要望 | 状態 | 反映先 |
|---|---|---|---|
| 追加A | 並べ替えの行の釣り合い。持ち上げて動かす操作 | 実装・E2E・撮影まで済み | 製品仕様 §28-11 |
| 追加B | 人の一覧の検索と並べ替え（名前・会社・役割・点数・等級。権限で選べるものを変える） | 実装・E2E・撮影まで済み | 製品仕様 §28-13・DD-011・システム仕様 account-and-users §8 |
| 追加C | 行動指針の分け方 | 実装・試験・撮影まで済み。本番の直しは下の task | 製品仕様 §28-12・DD-010・システム仕様 master-settings §6 |

### 本番の行動指針を直す（追加C の残り）

| 項目 | 内容 |
|---|---|
| 誰が | その会社の管理者（利用者本人） |
| 何を | `/admin/behavior` で 等級1 を 等級2 と同じ行動指針へ戻す |
| いつ | PR #94 のマージと本番への配布のあと（2026-10-14 に配布済みなので、今できる） |
| 確認（閉じる条件） | 飛び飛びの警告が消え、枠が「等級1・等級2」「等級3・等級4-1・等級4-2」になる |
| しないこと | D1 へ直接書かない（DD-010） |

この手は新しい判定でも通る（上の層のセットから 等級1 が抜けて 等級2 が挟まらなくなる、挟まる等級が減る手のため。製品仕様 §28-12）。

### エレガントレビュー（2026-10-14、PR #94 に含める）

判定の規則の一般化・使用中の等級の定義の統一・人の一覧の呼び方と全社の等級順・版を持つ行の部品化・等級名の言い換え（「等級未設定」）の一本化・文書の層分けを整理した。

利用者の判断に回した2点は、同じ日に決まった（原文は [追加要望の受領書](../docs/product/spec-receipts/2026-10-14-improvement-requests-additional.md)）。

- 人の一覧の検索は、ヘッダーの検索と別の仕組みのままにする（コードは変えない）。
- 社員の一覧に利用停止の人も含める（メンバー一覧・利用者一覧とそろえた。PR #94 に含める）。

### 共通化レビュー（2026-10-14、PR #94 に含める）

[共通化レビュー](../docs/reviews/elegant-review-2026-10-14-refactor.md) で、会社全体の割り当ての同時保存を 409 で止める照合（`grade-assignment-guard.ts`）、4つの制度編集画面の送信と結果の表示の共通化（`useMasterAction`）、等級ごとの下書きの寿命（`key={grade.id}`）、人の一覧の移動と履歴の復元（`syncPeopleUrl`）、同名の会社の区別を足した。仕様と設計への影響は [追加要望の受領書](../docs/product/spec-receipts/2026-10-14-improvement-requests-additional.md) の「共通化レビュー」に記録した。task は増やさず、P04（試験）・P05（実装）・P07（受入）・P12（文書）の中で扱った。

## 品質ゲート（追加要望 A〜C と共通化レビューを含めた作業ツリー、2026-10-14）

重複整理と境界修正の経緯は [共通化レビュー](../docs/reviews/elegant-review-2026-10-14-refactor.md)。typecheck・test・check:docs は最終レビューで流し直した。

| ゲート | 結果 |
|---|---|
| `pnpm typecheck` | exit 0（最終レビューで再実行） |
| `pnpm test` | 182 ファイル成功・1 スキップ、2781 件成功・1 件スキップ（最終レビューで再実行） |
| `pnpm test:coverage`（domain） | 100%（文 2563・分岐 2050・関数 681・行 2094） |
| `pnpm check:docs` | PASS（current backlog 103 件。最終レビューで再実行） |
| `pnpm cf:dry-run` / `check:bundle-size` | exit 0 / PASS（bundle は無料プランの上限の 66.7%） |
| E2E（`e2e/` の全 spec） | Chromium 57 件成功（隔離した DB。`E2E_PERSIST_TO`） |
| system-spec（coverage・citation・spec-doc-sync） | OK |
| dev-graph（schema / lineage） | pass / fail（3 node の digest が古い。OPS-015。追加要望で増えていない） |

### 再確認（2026-10-15、`153b41a`）

#94 のマージ後の main（`42b7f6b`）の上に、このツリーの修正（D-009 の更新・社員CSV の所属・全体管理者を会社の役割へ下げる保存・権限の監査記録・ログイン後のスモーク）を載せて測り直した。P10（突き合わせ）と P11（証跡）は、この値で読み直してよい。

| ゲート | 結果 |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 191 ファイル成功・1 スキップ、2973 件成功・1 件スキップ |
| `pnpm test:coverage`（domain） | 100%（文 2626・分岐 2117・関数 693・行 2149） |
| `pnpm run check:docs` | PASS（current backlog 103 件） |
| `pnpm run cf:dry-run` / `check:bundle-size` | exit 0 / PASS（上限の 66.9%） |
| `git diff --check` | PASS |
| E2E（`e2e/` の全 spec） | Chromium 57 件成功（`7040c10`、隔離した DB） |
| ログイン後のスモーク | 14 件中 14 件 OK（ローカルの preview） |
| dev-graph（schema / lineage） | このツリーの graph（2026-10-15 に作り直した 23 node。IR の node を含まない）は pass / pass。IR の node を持つ別のツリーの graph は、今も 3 node が `lineage_digest_mismatch`（OPS-015 のまま） |

## 残課題

- OPS-016: 通し試験が作る会社がローカル DB にたまり、利用者一覧の余白の検査（40%）が前提ごと崩れる。同じ DB で通し試験を繰り返す前に、試験の会社を片付けるか隔離した DB で流す
- OPS-015: graph の取込元の digest が古い3 node。dev-graph の writer に取り込み直しの操作が入ったら、R0 からやり直す
- FEATURE-005（行動指針の並べ替え）・OPS-014（見本データの締切が固定の日付）・`/criteria` の網羅率 42% は範囲外のまま
- 等級の並び順（`displayOrder`）が同着のとき、等級の一覧・書き出しなどの読み出し（`src/lib/queries.ts` の `listGrades` ほか10か所余り）は並びが決まらない。前からの挙動で、今回の範囲外。行動指針の判定は `bandLine` が id で決めている

# 仕様反映 受領書

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-13 |
| graph_node_id | `feature-improvement-requests-2026-10` |
| beads_id | `hr-wcv`（task は `hr-wcv.1`〜`hr-wcv.13`） |
| 判定 | **製品仕様・システム仕様・設計・データ・権限のすべてに影響あり → 正規フローで反映。範囲 S1〜S14 と受入 A1〜A13 を保留・対象外なしで受領する** |

## 受領した決定

利用者の決定（user-decision）は次の5件。どれも `system-spec/spec-state.json` に記録があり、要件定義（`system-spec/00-requirements-definition.md`）の各章の要件はこれを根拠にしている。

| 決定 | 記録 | 内容 |
|---|---|---|
| qa-v02 問1 | 2026-10-12T21:54:08Z | 等級名を編集できるのは、システム全体管理者と会社の管理者 |
| qa-v02 問2 | 同上 | 一覧の点数は KPI評価点と等級要件の達成率の両方を並べる |
| qa-v02 問3 | 同上 | 一覧に出す評価は確定済みだけ |
| qa-v02 問4 | 同上 | 既存の会社の等級名は、全社を一律に書き換える |
| D-004（qa-v12） | 2026-10-12T23:30:32Z | 所属は自前の表を作り、選んでいる会社を cookie（`hr_company`）で持つ（better-auth の organization plugin と URL に会社を入れる案は採らない） |
| D-005（qa-v13） | 同上 | 長押しドラッグは Pointer Events で共通の hook を自作する（HTML の Drag and Drop API と dnd-kit は採らない） |
| D-006（qa-v14） | 同上 | 権限一覧は1つの表に役割のタブでの絞り込みを足し、スマホの幅ではページごとのカードに切り替える（利用者の回答から足した組み合わせの案） |
| D-007（qa-v25） | 2026-10-13T03:40:15Z | 権限の定義（各ページでできる操作と説明）は `system-spec/route-ledger.json` に足す（DB の表と TS のモジュールの案は採らない） |

あわせて、利用者の指示「保留事項にしないで、今回の内容全て対応」（2026-10-13）により、範囲と受入のどれも保留・対象外にしない。

## 影響の判定

| 層 | 影響 | 理由 |
|---|---|---|
| 製品仕様 | **あり** | 等級の呼び名・権限一覧・一覧の等級と点数・複数の会社への所属・提出状況・設定不足の形・画面名・並べ替え・選択肢・余白の10点が観測できる振る舞いを変える。`docs/product/spec.md` §28 に S1〜S14・A1〜A13 と同じ番号で書いた。§1 の「評価の中身は表示しない」と §2-1 の区分名の表記は P12 で §28 にそろえる |
| システム仕様 | **あり** | 要件は `system-spec/00-requirements-definition.md` の database・auth・ui-ux・security・infrastructure・backend・frontend・maintenance-ops の各章に確定済み。権限の正本 `routes-and-access.md`・`account-and-users.md`・`master-settings.md` の文面と、`route-ledger.json`（46→47画面、各ページの操作と説明）は P05・P12 で実装に合わせて改める |
| 設計 | **あり** | 所属の表と会社の解決、等級の呼び名の関数、権限の台帳からの派生、点数の可視範囲、並べ替えの hook、設定不足の構造化の6点を `architecture/improvement-requests-2026-10.md` と DD-004〜DD-008 に残す（P02） |
| データ | **あり** | 移行 0033（所属の表と既存の利用者の所属）・0034（等級名の一律の書き換えと書き換え前の値の記録）。どちらも冪等で、戻す手順を持つ（P02・P05・P08） |
| 権限 | **あり（等級名の変更だけ）** | 等級名の変更を全体管理者と自社の会社管理者に絞る。それ以外の役割ごとの権限の中身は変えない。役割の種類も増やさない |
| 配色・テーマ | なし | テーマ契約・DD-003・`globals.css` の `brand_color_*` は変えない。余白の対応も共通の最大幅とテーマを変えない |
| 依存 | なし | 並べ替えは Pointer Events で自作し、新しい依存を足さない |

## 4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | §28 の各節と仕様メモの S・A は、`features/feature-improvement-requests-2026-10.context.json` の scope_in・acceptance と同じ番号・同じ意味で、要件定義の G6〜G15・I7〜I16 と各章の要件 (1)〜(12) に食い違いが無い。変えないもの（テーマ・役割の種類・§27 の保存の経路・`pointGroup`）は全文書で同じ |
| 漏れなし | PASS | 範囲 S1〜S14 のそれぞれに担当の task が1件以上あり、受入 A1〜A13 のそれぞれに検証のコマンドと証跡の場所がある（仕様メモの2つの表）。保留・対象外は0件 |
| 整合性あり | PASS | 受入は試験のファイルに対応させた（P04 で赤、P06 で緑）。要件定義の決定（qa-v02・D-004〜D-007）は §28 の該当節に1対1で現れる |
| 依存関係整合 | PASS | task の依存は P01→P02→P03→P04→P05→{P06・P08}→…→P13 の1本の DAG で、仕様の受領（P01）が設計（P02）より先にある |

## 反映先

| 層 | パス |
|---|---|
| 製品仕様 | `docs/product/spec.md` §28 |
| 仕様メモ（S・A の番号の正本） | `specs/improvement-requests-2026-10.md` |
| 要件定義 | `system-spec/00-requirements-definition.md`（G6〜G15・O6〜O15・I7〜I16、各章の要件） |
| 実装要件 | `docs/requirements/feature-improvement-requests-2026-10.md` |
| 機能 | `features/improvement-requests-2026-10.md`・`features/feature-improvement-requests-2026-10.context.json` |
| タスク | `tasks/feature-improvement-requests-2026-10/`（`sys-ir-p01.md`〜`sys-ir-p13.md`） |
| 設計（P02 で作る） | `architecture/improvement-requests-2026-10.md`、`docs/product/design-decisions.md` DD-004〜DD-008 |
| Beads | `hr-wcv`、`hr-wcv.1`〜`hr-wcv.13` |

## 受領境界

この受領は、範囲と受入の番号と意味、利用者の決定の反映先を固めるところまで。実装・試験・移行のリハーサル・preview での確認は P04〜P11 の各 task が証跡を残す。本番への配布・commit・push・PR は今回の依頼に含めない（P13 は配布の準備まで）。

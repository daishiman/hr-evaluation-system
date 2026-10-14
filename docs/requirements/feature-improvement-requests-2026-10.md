# 要件定義書: 等級名の統一・権限一覧・一覧の等級と点数・複数の会社への所属・提出状況・設定不足のリンク・改名・並べ替え・選択肢・余白（feature-improvement-requests-2026-10）

dev-graph の requirements が、確定済みの system-spec・設計・feature と、system-dev-planner の13件の実行 package から導いた実装要件をまとめたものです。この文書は実装のコードを含みません。実装は下の「引き渡し」にある build の経路が受け持ちます。

## 固定した版

この要件は、次の版の組み合わせにだけ当てはまります。どれかの digest が変わったら、この文書と引き渡しは古くなったものとして扱い、requirements をやり直します。

| 対象 | パス | digest |
|---|---|---|
| graph（rev4、23ノード） | `.dev-graph/state/graph.json` | canonical `f4e37ba1db4d4c72ceb6d4d1259cef3a38d5b6618b07d168b082e77cfe88c3a2` |
| 実行 package（canonical digest） | `.dev-graph/plans/feature-package-feature-improvement-requests-2026-10/staging-manifest.json` | canonical `71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe` |
| build への引き渡し（package 側） | `.dev-graph/plans/feature-package-feature-improvement-requests-2026-10/system-build-handoff.json` | `0cda5132fdb17229acfdfac400d5cdec20bbf206dc5c0afddbef7bd15199437e` |
| feature の文脈 | `features/feature-improvement-requests-2026-10.context.json` | `ec74c5b258527ed1c43c00c4c50900d3b0f6357cfc10d38948a3f96d76e81b0c` |
| feature の文書 | `features/improvement-requests-2026-10.md` | `e8a48be0ba3bbf2d05cc5eb1b4238431e359e80d97133fddaf8139dd046de48c` |
| system-spec の索引 | `system-spec/index.md` | `493312299f9182393f50aaa5095f5bdf650e0bc9348d9ae43da9733419abe1ea` |
| system-spec の要件定義 | `system-spec/00-requirements-definition.md` | `ab8facee57d0e3d9fb4b61b116663cc9f29c44bd12c14a7c9419bb9909a27480` |

graph の digest は、`validate-readiness-binding.py` と `guard-requirements-handoff.py` が同じ値を見たことを確かめたもの（guard の digest_match が true）です。

## 上位の目的

正本は `system-spec/00-requirements-definition.md` の G6〜G15 と I7〜I16 です。この feature はその10個のゴールと、U5 に足した成功基準を受け持ちます。

- 目的: 等級の呼び名・役割ごとにできること・各人の等級と確定済みの評価・アンケートの提出状況・設定の不足を、どの画面でも同じ言葉で、見てよい人にだけ示し、並べ替え・選択・配置の使いにくさを取り除く（G6〜G15、U5）
- ゴール: 等級名を『等級4-1』の形に変えると行動指針・評価セット・昇格の要件・警告・アンケートのタイトル・ボタンのすべてがその名前で出て、権限一覧のページとモーダル、一覧の等級と点数、2社目への所属、提出状況の一覧、リンク付きの設定不足の表示、『Claude Code連携（システム開発者専用）』への改名、長押しドラッグでの並べ替え、押せる選択肢、右側の余白の解消がそろっている

## 範囲と受入から、出典と担当 task への追跡

範囲（S1〜S14）は `features/feature-improvement-requests-2026-10.context.json` の scope_in、受入（A1〜A13）は acceptance を、そのまま載せています。ゴールの列は、出典の番号にある I7〜I16 を `00-requirements-definition.md` の対応（I7→G6 … I16→G15）で引いたもので、I の番号を持たない行は「—」です。

| 番号 | 内容 | 出典の番号 | ゴール | 担当 task |
|---|---|---|---|---|
| S1 | 等級の呼び名を作る共通の関数を置いて全表示をそこから作り、既定の等級名を『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』にする（FR-004、I7） | FR-004・I7 | G6 | P04 P05 P07 |
| S2 | 既存の会社の等級名と、行動指針の区分名など等級名を含む表示名を、D1 のマイグレーション（0033 以降）で一律に書き換え、英語の区分名を残さない（FR-004、I7） | FR-004・I7 | G6 | P05 P08 |
| S3 | 等級名を変えられる役割を全体管理者と会社の管理者に限り、画面とサーバー処理の両方で判定する（FR-005、I8） | FR-005・I8 | G7 | P04 P05 P09 |
| S4 | route-ledger.json の各ページに accessClass・ページ名・主な操作・役割ごとの可否・説明を置き、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の判定・権限一覧がこの台帳だけを読む（D-007） | D-007 | — | P04 P05 P09 |
| S5 | システム管理のサイドバーに権限一覧のページを足し、利用者一覧のトグルで開くモーダルと同じ部品で、表・役割のタブ・スマホのカードと、ポインター・フォーカス・タップで出る説明を見せる（D-006、I9） | D-006・I9 | G8 | P04 P05 P07 |
| S6 | 3つの一覧に今の等級と確定済みの最新評価点を出し、マネージャー・会社の管理者・全体管理者以外には画面にも応答にも含めない（FR-005） | FR-005 | — | P04 P05 P09 |
| S7 | 所属の表と cookie で選ぶ会社の切り替えで、1つのアカウントが複数の会社に所属でき、既存の利用者には今の値どおりの所属を作る（D-004） | D-004 | — | P05 P08 P09 |
| S8 | アンケートの一覧と結果一覧に、対象者全員の提出済み・未提出がわかる提出状況の一覧を足す（FR-005） | FR-005 | — | P04 P05 P07 |
| S9 | 設定不足の表示（#8・#13）を『何が足りない・どう直す・直す画面へのリンク』の簡潔な形にする（FR-005） | FR-005 | — | P04 P05 P07 |
| S10 | 『Claude Code連携の鍵』の画面名を『Claude Code連携（システム開発者専用）』に変える（FR-005） | FR-005 | — | P05 P12 |
| S11 | 全ての並べ替えに、Pointer Events で自作する長押しドラッグとキーボード操作の共通部品を入れ、並び順を全体で保存する（D-005） | D-005 | — | P04 P05 P09 |
| S12 | アンケートの入力と結果で選択肢を押しても選べない不具合を直し、選択肢の値の重複を拒否する（FR-005） | FR-005 | — | P04 P05 P07 |
| S13 | 右側の余白が目立つ画面（#14）の配置を見直す（FR-005） | FR-005 | — | P05 P07 |
| S14 | Next.js を 16.3.8 へ上げ、ルート台帳を権限一覧のページを足した47画面にする（互換性・移行・リリース） | — | — | P05 P13 |
| A1 | 等級名を変える結合テストで全表示が新しい名前になり、英語の区分名の静的検査が0件である（O6） | O6 | — | P05 P07 P08 |
| A2 | 等級名の変更は、全体管理者と会社の管理者以外では画面とサーバーの両方が拒否する（O7） | O7 | — | P05 P07 P09 |
| A3 | ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストが通る（O8） | O8 | — | P05 P07 P09 |
| A4 | 権限一覧の表とカードが同じ内容を出し、説明がポインター・フォーカス・タップのどれでも出る | — | — | P07 |
| A5 | 評価確定の直後に3つの一覧へ最新の点数が出て、一般の社員の応答には等級と点数が含まれない | — | — | P05 P07 P09 |
| A6 | 2社目への所属ができ、所属していない会社への切り替えと操作は拒否される | — | — | P05 P07 P08 P09 |
| A7 | 提出状況の一覧に対象者全員が提出済み・未提出つきで出る | — | — | P05 P07 |
| A8 | 設定不足の全件に、何が足りないか・どう直すかと直す画面へのリンクがある | — | — | P05 P07 |
| A9 | 画面名が『Claude Code連携（システム開発者専用）』になっている | — | — | P05 P07 P12 |
| A10 | 並べ替えはポインター・タッチ・キーボードの3操作で同じ結果になり、全体保存の競合は 409 を返す | — | — | P05 P07 |
| A11 | 選択肢を押すと選べ、選択肢の値の重複は拒否される | — | — | P05 P07 |
| A12 | 4つの幅の撮影で右側だけが空く画面が無い | — | — | P07 |
| A13 | pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ | — | — | P01 P06 P10 P12 |

27件（範囲 14・受入 13）のすべてに担当の task が1件以上あり、担当の無いものは0件です。

## 13件の task と受け持つ番号

task の正本は `tasks/feature-improvement-requests-2026-10/sys-ir-p01.md`〜`sys-ir-p13.md` と `.dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/` の13件で、この文書は中身を写さず番号だけを引きます。

| task | 題名 | 依存 | 受け持つ番号 |
|---|---|---|---|
| SYS-IR-P01 | 改善要望の範囲14件と受入13項目を、製品仕様と specs の正本へ同じ番号で写す | なし | A13 |
| SYS-IR-P02 | 等級の呼び名・所属・権限の台帳・並べ替え・権限の見せ方・点数の可視範囲の設計を決めて文書に残す | P01 | （全体の検証） |
| SYS-IR-P03 | 設計を、範囲の取りこぼし・他社と点数の漏れ・アクセシビリティ・テーマの契約に照らして見直す | P02 | （全体の検証） |
| SYS-IR-P04 | 受入13項目を、実装の前に単体・結合・契約・画面の試験にして、赤になることを確かめる | P03 | S1 S3 S4 S5 S6 S8 S9 S11 S12 |
| SYS-IR-P05 | 14件の改善を実装し、移行 0033・0034 を書く | P04 | S1 S2 S3 S4 S5 S6 S7 S8 S9 S10 S11 S12 S13 S14 A1 A2 A3 A5 A6 A7 A8 A9 A10 A11 |
| SYS-IR-P06 | P04 で赤だった試験を全部緑にし、型検査・文書の検査・domain のカバレッジ 100% を確かめる | P05 | A13 |
| SYS-IR-P07 | ローカルの preview で、受入 A1〜A12 を役割ごと・4つの幅で確かめる | P06 | S1 S5 S8 S9 S12 S13 A1 A2 A3 A4 A5 A6 A7 A8 A9 A10 A11 A12 |
| SYS-IR-P08 | 移行 0033・0034 を、多様な見本のデータで2回流して確かめ、移行の対応表を残す | P05 | S2 S7 A1 A6 |
| SYS-IR-P09 | 他社のデータ・等級・点数の漏れと、権限の判定とアクセシビリティを、攻撃と利用の側から確かめる | P06 P08 | S3 S4 S6 S7 S11 A2 A3 A5 A6 |
| SYS-IR-P10 | 最終の状態で、範囲14件・受入13項目・変えてはいけないものを突き合わせる | P07 P09 | A13 |
| SYS-IR-P11 | 受入の証跡を1つの記録にまとめる | P10 | （全体の検証） |
| SYS-IR-P12 | 製品仕様・機能の地図・運用の文書を、実装の最終の形にそろえる | P10 | S10 A9 A13 |
| SYS-IR-P13 | 本番への配布の結果を確かめて配布の記録と戻し方を残し、利用者の確認のあと本番の画面を確かめて改善要望を対応済みにする | P11 P12 | S14 |

依存は package の中だけの 15 本で、根は P01 です（`task-graph.json`）。

## 準備ができているかの判定

引き渡しの前に、次の3つを同じ digest で確かめました。結果の表は `.dev-graph/handoffs/feature-improvement-requests-2026-10/readiness-matrix.json` にあります。

1. graph の検査（`validate-graph-schema.py`）: 違反0件。closure の 23 ノードがすべて ready。
2. graph に保存した状態（`validate-readiness-binding.py`）: pass・違反0件。graph は登録時の rev3より後の rev4（relation は later_revision）で、13件の task の readiness・evaluation・confirmation と出典の digest が登録時と一致する。
3. system-dev-planner の検査（`validate-system-plan.py`）: pass。P01〜P13 がちょうど1件ずつ、違反0件。

feature は 2026-10-13 に、利用者が graph.json の直接の確定を明示に選んだうえで、証跡（decompose の integrity-auditor の記録と feature 文書の sha256）付きで confirmed・pass にしました。C02 に feature を確定する操作が無いためで、受領書は `.dev-graph/state/receipts/node-r000004-confirm-feature.json` です。

## 引き渡し

- 引き渡し先: build の経路（capability-build / task-graph build）。このリポジトリでは `system-build-handoff.json` の execution_tasks が実行の正本で、実行の手順は `/improve-app` と通常の開発の手順です。
- 引き渡しの記録: `.dev-graph/handoffs/feature-improvement-requests-2026-10/capability-build-handoff.json`。この文書と readiness matrix の sha256 を持ち、最後に書く（この記録があって digest が合うときだけ、引き渡しが成立したとみなす）。
- task の完了は「既定のブランチへ PR がマージされた時点」です。PR を出すまでは13件とも作業中のままです。

## 範囲外

`features/feature-improvement-requests-2026-10.context.json` の scope_out のとおりです。

- 別の利用者が開いている画面への即時配信（WebSocket 等の push）
- オフライン編集と同期
- 配色・テーマの変更（AGENTS.md と DD-003）
- 等級名の一律の書き換えと所属の作成を除く本番データの移行・修正
- 役割の種類の追加（『システム開発者』の役割は作らない）
- 等級名の変更権限を除く役割ごとの権限の中身の変更
- 保存結果の鮮度の保証（G1〜G5）の作り直し（feat-data-freshness で実装済み）

## 確かめ直す方法

リポジトリの直下で次を回し、上の「固定した版」の digest と見比べます。

```bash
shasum -a 256 features/feature-improvement-requests-2026-10.context.json features/improvement-requests-2026-10.md system-spec/index.md system-spec/00-requirements-definition.md
python3 -c "import json;print(json.load(open('.dev-graph/plans/feature-package-feature-improvement-requests-2026-10/staging-manifest.json'))['canonical_digest'])"
```

graph の版が後の作業で進んだときは、`graph_revision` が変わっていても、closure の各ノードの readiness・evaluation・confirmation・出典の digest が上と同じなら要件は変わっていません。違っていれば requirements をやり直します。

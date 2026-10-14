# 仕様メモ: 2026-10 の改善要望（等級名・権限一覧・等級と点数・所属・提出状況・設定不足・改名・並べ替え・選択肢・余白）

- graph_node_id: `feature-improvement-requests-2026-10`（task は `SYS-IR-P01`〜`SYS-IR-P13`）
- beads: `hr-wcv`（task は `hr-wcv.1`〜`hr-wcv.13`）
- 正本（製品）: `docs/product/spec.md` §28
- 正本（システム）: `system-spec/00-requirements-definition.md`（G6〜G15・O6〜O15・I7〜I16、決定 D-004〜D-007、qa-v02）
- 正本（feature）: `features/improvement-requests-2026-10.md`・`features/feature-improvement-requests-2026-10.context.json`
- 要件定義（実装要件）: `docs/requirements/feature-improvement-requests-2026-10.md`
- 受領: `docs/product/spec-receipts/2026-10-13-improvement-requests.md`（範囲と受入）、`docs/product/spec-receipts/2026-10-14-improvement-requests-final-review.md`（最終レビュー。DD-009 による会社選択の戻り先と所属追加の主体の訂正）、`docs/product/spec-receipts/2026-10-14-improvement-requests-additional.md`（本番を見て受けた追加要望3件。製品仕様 §28-11〜§28-13。範囲 S1〜S14・受入 A1〜A13 の番号の外に置く）

この文書は、範囲 S1〜S14 と受入 A1〜A13 の番号の正本です。番号と意味は `features/feature-improvement-requests-2026-10.context.json` の scope_in・acceptance と同じで、製品仕様 §28 も同じ番号を使います。どの項目も「保留」「対象外」にしていません（利用者の指示「保留事項にしないで、今回の内容全て対応」）。

## 上位の目的からの辿り方

要件定義の I7〜I16 は、そのままゴール G6〜G15 に対応します（I7→G6 … I16→G15）。

| ゴール | 内容（要約） | 実装要件 | 範囲 |
|---|---|---|---|
| G6 | 等級の呼び名はその会社の等級名だけ。英語の区分名を出さない | I7 | S1・S2 |
| G7 | 等級名を変えられるのは全体管理者と自社の会社管理者だけ | I8 | S3 |
| G8 | 役割ごとにできること・できないことを、ページ名の単位で確かめられる | I9 | S4・S5・S10 |
| G9 | 見てよい人だけが、今の等級と確定した最新の評価を一覧で見られる | I10 | S6 |
| G10 | 1つのアカウントのまま複数の会社に所属できる | I11 | S7 |
| G11 | アンケートの提出状況（提出済み・入力途中・未回答）が一覧でわかる | I12 | S8 |
| G12 | 設定不足は、何が足りない・どう直す・直す画面へのリンクで示す | I13 | S9 |
| G13 | 並び順を持つ全ての編集画面で、長押しのドラッグとキーボードでも並べ替えられる | I14 | S11 |
| G14 | 押しても何も起きない選択肢を無くす | I15 | S12 |
| G15 | 右側の余白だけが目立つ画面を無くす | I16 | S13 |
| （互換性・移行・リリース） | Next.js の版と、ルート台帳の画面数 | — | S14 |

## 範囲（S1〜S14）と受け持つ task

| 番号 | 内容 | 出典 | 受け持つ task |
|---|---|---|---|
| S1 | 等級の呼び名を作る共通の関数を置いて全表示をそこから作り、既定の等級名を『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』にする | FR-004・I7 | SYS-IR-P04・P05・P07 |
| S2 | 既存の会社の等級名と、行動指針の区分名など等級名を含む表示名を、D1 のマイグレーション（0033 以降）で一律に書き換え、英語の区分名を残さない | FR-004・I7 | SYS-IR-P05・P08 |
| S3 | 等級名を変えられる役割を全体管理者と会社の管理者に限り、画面とサーバー処理の両方で判定する | FR-005・I8 | SYS-IR-P04・P05・P09 |
| S4 | route-ledger.json の各ページに accessClass・ページ名・主な操作・役割ごとの可否・説明を置き、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の判定・権限一覧がこの台帳だけを読む | D-007 | SYS-IR-P04・P05・P09 |
| S5 | システム管理のサイドバーに権限一覧のページを足し、利用者一覧のトグルで開くモーダルと同じ部品で、表・役割のタブ・スマホのカードと、ポインター・フォーカス・タップで出る説明を見せる | D-006・I9 | SYS-IR-P04・P05・P07 |
| S6 | 3つの一覧に今の等級と確定済みの最新評価点を出し、マネージャー・会社の管理者・全体管理者以外には画面にも応答にも含めない | FR-005 | SYS-IR-P04・P05・P09 |
| S7 | 所属の表と cookie で選ぶ会社の切り替えで、1つのアカウントが複数の会社に所属でき、既存の利用者には今の値どおりの所属を作る | D-004 | SYS-IR-P05・P08・P09 |
| S8 | アンケートの一覧と結果一覧に、対象者全員の提出済み・未提出がわかる提出状況の一覧を足す | FR-005 | SYS-IR-P04・P05・P07 |
| S9 | 設定不足の表示（#8・#13）を『何が足りない・どう直す・直す画面へのリンク』の簡潔な形にする | FR-005 | SYS-IR-P04・P05・P07 |
| S10 | 『Claude Code連携の鍵』の画面名を『Claude Code連携（システム開発者専用）』に変える | FR-005 | SYS-IR-P05・P12 |
| S11 | 全ての並べ替えに、Pointer Events で自作する長押しドラッグとキーボード操作の共通部品を入れ、並び順を全体で保存する | D-005 | SYS-IR-P04・P05・P09 |
| S12 | アンケートの入力と結果で選択肢を押しても選べない不具合を直し、選択肢の値の重複を拒否する | FR-005 | SYS-IR-P04・P05・P07 |
| S13 | 右側の余白が目立つ画面（#14）の配置を見直す | FR-005 | SYS-IR-P05・P07 |
| S14 | Next.js を 16.3.8 へ上げ、ルート台帳を権限一覧のページを足した47画面にする | 互換性・移行・リリース | SYS-IR-P05・P13 |

担当の無い項目は0件です。

## 受入（A1〜A13）と、検証のコマンド・証跡の場所

| 番号 | 内容 | 出典 | 受け持つ task | 検証のコマンド | 証跡の場所 |
|---|---|---|---|---|---|
| A1 | 等級名を変える結合テストで全表示が新しい名前になり、英語の区分名の静的検査が0件である | O6 | SYS-IR-P05・P07・P08 | `pnpm test`（`src/lib/domain/grade-label.test.ts`・`src/lib/grade-label-static.test.ts`・`src/actions/grade-names.integration.test.ts`） | `eval-log/feature-improvement-requests-2026-10-implementation.json`、`eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json` |
| A2 | 等級名の変更は、全体管理者と会社の管理者以外では画面とサーバーの両方が拒否する | O7 | SYS-IR-P05・P07・P09 | `pnpm test`（`src/actions/grade-names.integration.test.ts`） | `eval-log/feature-improvement-requests-2026-10-security-review.json` |
| A3 | ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストが通る | O8 | SYS-IR-P05・P07・P09 | `pnpm test`（`src/lib/permissions-contract.test.ts`・`scripts/route-ledger.test.mjs`） | `eval-log/feature-improvement-requests-2026-10-security-review.json` |
| A4 | 権限一覧の表とカードが同じ内容を出し、説明がポインター・フォーカス・タップのどれでも出る | — | SYS-IR-P07 | `pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts` | `eval-log/feature-improvement-requests-2026-10-acceptance.json` |
| A5 | 評価確定の直後に3つの一覧へ最新の点数が出て、一般の社員の応答には等級と点数が含まれない | — | SYS-IR-P05・P07・P09 | `pnpm test`（`src/lib/score-visibility.integration.test.ts`） | `eval-log/feature-improvement-requests-2026-10-security-review.json`、`eval-log/feature-improvement-requests-2026-10-acceptance.json` |
| A6 | 2社目への所属ができ、所属していない会社への切り替えと操作は拒否される | — | SYS-IR-P05・P07・P08・P09 | `pnpm test`（`src/actions/memberships.integration.test.ts`） | `eval-log/feature-improvement-requests-2026-10-security-review.json`、`eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json` |
| A7 | 提出状況の一覧に対象者全員が提出済み・未提出つきで出る | — | SYS-IR-P05・P07 | `pnpm test`（`src/lib/domain/submission-status.test.ts`） | `eval-log/feature-improvement-requests-2026-10-acceptance.json` |
| A8 | 設定不足の全件に、何が足りないか・どう直すかと直す画面へのリンクがある | — | SYS-IR-P05・P07 | `pnpm test`（`src/lib/domain/setup-gaps-links.test.ts`） | `eval-log/feature-improvement-requests-2026-10-acceptance.json` |
| A9 | 画面名が『Claude Code連携（システム開発者専用）』になっている | — | SYS-IR-P05・P07・P12 | `pnpm test`（`src/lib/nav.test.ts`）、`pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts` | `eval-log/feature-improvement-requests-2026-10-acceptance.json` |
| A10 | 並べ替えはポインター・タッチ・キーボードの3操作で同じ結果になり、全体保存の競合は 409 を返す | — | SYS-IR-P05・P07 | `pnpm test`（`src/components/reorder/useLongPressReorder.test.ts`・`src/lib/domain/reorder.test.ts`） | `eval-log/feature-improvement-requests-2026-10-acceptance.json` |
| A11 | 選択肢を押すと選べ、選択肢の値の重複は拒否される | — | SYS-IR-P05・P07 | `pnpm test`（`src/components/FormAnswer.test.ts`・`src/lib/form-build.test.ts`） | `eval-log/feature-improvement-requests-2026-10-acceptance.json` |
| A12 | 4つの幅の撮影で右側だけが空く画面が無い | — | SYS-IR-P07 | `pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts` | `eval-log/feature-improvement-requests-2026-10-acceptance.json` |
| A13 | pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ | — | SYS-IR-P01・P06・P10・P12 | `pnpm test`・`pnpm run check:docs`・`pnpm test:coverage` | `eval-log/feature-improvement-requests-2026-10-implementation.json`、`eval-log/feature-improvement-requests-2026-10-final-review.json` |

## 13件の task

| task | Beads | 題名 | 依存 |
|---|---|---|---|
| SYS-IR-P01 | hr-wcv.1 | 改善要望の範囲14件と受入13項目を、製品仕様と specs の正本へ同じ番号で写す | なし |
| SYS-IR-P02 | hr-wcv.2 | 等級の呼び名・所属・権限の台帳・並べ替え・権限の見せ方・点数の可視範囲の設計を決めて文書に残す | P01 |
| SYS-IR-P03 | hr-wcv.3 | 設計を、範囲の取りこぼし・他社と点数の漏れ・アクセシビリティ・テーマの契約に照らして見直す | P02 |
| SYS-IR-P04 | hr-wcv.4 | 受入13項目を、実装の前に単体・結合・契約・画面の試験にして、赤になることを確かめる | P03 |
| SYS-IR-P05 | hr-wcv.5 | 14件の改善を実装し、移行 0033・0034 を書く | P04 |
| SYS-IR-P06 | hr-wcv.6 | P04 で赤だった試験を全部緑にし、型検査・文書の検査・domain のカバレッジ 100% を確かめる | P05 |
| SYS-IR-P07 | hr-wcv.7 | ローカルの preview で、受入 A1〜A12 を役割ごと・4つの幅で確かめる | P06 |
| SYS-IR-P08 | hr-wcv.8 | 移行 0033・0034 を、多様な見本のデータで2回流して確かめ、移行の対応表を残す | P05 |
| SYS-IR-P09 | hr-wcv.9 | 他社のデータ・等級・点数の漏れと、権限の判定とアクセシビリティを、攻撃と利用の側から確かめる | P06・P08 |
| SYS-IR-P10 | hr-wcv.10 | 最終の状態で、範囲14件・受入13項目・変えてはいけないものを突き合わせる | P07・P09 |
| SYS-IR-P11 | hr-wcv.11 | 受入の証跡を1つの記録にまとめる | P10 |
| SYS-IR-P12 | hr-wcv.12 | 製品仕様・機能の地図・運用の文書を、実装の最終の形にそろえる | P10 |
| SYS-IR-P13 | hr-wcv.13 | 本番への配布の結果を確かめて配布の記録と戻し方を残し、利用者の確認のあと本番の画面を確かめて改善要望を対応済みにする | P11・P12 |

## 変えないもの

- 配色・テーマ（`docs/product/spec.md` のテーマ契約、DD-003、AGENTS.md）。テーマの契約テストと `globals.css` 冒頭の `brand_color_*` の宣言。
- 役割の種類（4つのまま。『システム開発者』の役割は作らない）。
- 等級名の変更権限を除く、役割ごとの権限の中身。
- 保存結果の鮮度の仕組み（§27。書き込みは `runAction` を通す）。
- 等級の `pointGroup`（結合キー）と id の値。

## 範囲外

- 別の利用者が開いている画面への即時配信（WebSocket 等の push）
- オフライン編集と同期
- 等級名の一律の書き換えと所属の作成を除く本番データの移行・修正

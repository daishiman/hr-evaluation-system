# 仕様反映 受領書

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-01 |
| graph_node_id | `feat-data-freshness` |
| beads_id | `hr-czp`（2026-10-01 の記録時は未採番。後で採番） |
| 判定 | **製品仕様・システム仕様・設計への影響あり → 正規フローで反映** |

## 受領した決定

1. 画面からの書き込みは、すべてサーバーアクション（入口は `runAction` の1つ）。成功したときだけ `refresh()` で描き直し、その画面を保存の応答に同梱する（D-002）
2. 他のタブへは `BroadcastChannel` で知らせ、画面復帰・通信復帰でも取り直す。別の利用者・別の端末へは押し出さない（D-001）
3. ログイン後の画面と `/api/*` の応答は成功・失敗とも `private, no-store`
4. 1つの操作で複数の表を書く保存は1回の D1 batch。入らないのは2つだけで、会社の追加は失敗したら逆順に消し（`withCompensation`）、取り消せない認証ライブラリの書き込みを含むパスワード変更は続きをやり直す（`rollForward`）（D-003＝案A＋rollForward）。どちらも失敗したら記録に残す（G5 を改めた）。別々の `await` で書いていた4か所も batch にし、端末の承認の同時引き換えは1回だけ通す
5. 制度マスタは本体と監査記録を同じ batch で書き、同時保存の後のほうを 409 で断る（0032）
6. 初期パスワードの控えは暗号化して残し、開ける人を限り、本人のパスワード変更で消す（0031）。控えは発行から14日で開けなくなり（410）、次の発行で消える（R3）
7. 成功の知らせは、新しい画面が描き終わってから出す（O1。`createCommitGate`）。bfcache から戻った画面は、ルーターが画面を戻し終えた後に取り直す
8. 成功・失敗の応答に生成時刻 `x-generated-at` を付け（101 など作り直せない応答は除く）、「反映されない」の報告をキャッシュかどうかで切り分ける（deploy-notes §7）
9. 連続作成の画面では、一覧の新しい行 ＞ 成功の知らせ ＞ 控え の順にし、発行した控えは成功の知らせの後ろに畳む（ui-ux (2)、qa-u19）
10. 別のサイトからの書き込みと読み出しは、Next.js の検査と `assertSameOrigin` の二重で断り、`allowedOrigins` は足さない（R3。`action-origin.test.ts` で固定）
11. アカウント設定と会社管理の保存を監査し、認可・本人の行への限定・仮パスワードの非開示・想定外の失敗の伏せ方を結合テストで固定した（backlog SECURITY-001 を閉じた）
12. 要件定義の U5 (5)・U7 対象 (3)・U8 (6)・G5・O5・I4 と8章の文面を、実装に合わせて改めた（R3・R4）

## 影響の判定

| 層 | 影響 | 理由 |
|---|---|---|
| 製品仕様 | **あり** | 保存のふるまい（描き直し・他のタブ・同時保存の断り・控え）が利用者に見える形で変わった。`docs/product/spec.md` §27 を追加 |
| システム仕様 | **あり** | 書き込みの `/api/*` が無くなり、DB に表（0031）と一意制約（0032）が加わった。上位概念（U1・G1〜G5）と8章を system-spec-harness の正規フローで確定した |
| 設計 | **あり** | 保存の入口・描き直し・タブ間の知らせ・取り消しの層分けが文書になかった。既存の3文書も `/api` の記述をサーバーアクションへ改めた |
| 残課題 | あり | W1〜W4 をセッション記録に、SECURITY-005（仮パスワードそのものの失効）・UX-030 を backlog に置いた。SECURITY-001 は監査試験を足して閉じた |

## 4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | architecture・features・specs・tasks は spec.md §27 と system-spec を正本として参照し、決定の値（間引き1.5秒・409・鍵の名前・移行番号）が実装と一致する |
| 漏れなし | PASS | 画面（spec.md）・API と DB（system-spec）・設計（architecture）・運用（deploy-notes §6・§7）・残課題（backlog・セッション記録）に対応先がある |
| 整合性あり | PASS | 契約テストが入口の通し方・送信元の検査・書き込みの型を、結合テストが取り消し・やり直し・同時保存・控えの寿命・評価の流れ・アカウント設定と会社管理の認可を、画面の通し試験が4つの経路での反映と控えの置き方（パソコン・375px・768px）を固定し、どれも通る |
| 依存関係整合 | PASS | 部品 → `useSaveAction` → サーバーアクション → `runAction` → 書き込み、の向きがそろい、逆向きの参照（部品からの書き込みの `fetch`）は契約テストが落とす |

## 反映先

| 層 | パス |
|---|---|
| 製品仕様 | `docs/product/spec.md` §27 |
| 残課題 | `docs/product/backlog.md`（SECURITY-005・UX-030。SECURITY-001 は削除） / `docs/product/backlog-session-notes.md`（W1〜W4） |
| システム仕様 | `system-spec/00-requirements-definition.md` / 8章 / `system-spec/index.md` |
| 設計 | `architecture/data-freshness.md` / `architecture/index.md` / `architecture/account-profile.md` / `architecture/master-settings.md` / `architecture/release-and-forms.md` |
| 運用 | `docs/deploy-notes.md` §6・§7 |
| 画面の通し試験 | `playwright.config.ts` / `e2e/data-freshness.spec.ts`（`pnpm test:e2e`） |
| 機能/仕様/タスク | `features/feat-data-freshness.md` / `specs/data-freshness.md` / `tasks/feat-data-freshness.md` |

## 受領境界

4条件の PASS は、未コミットの作業ツリーの文書と実装の整合と、ローカルの検証に対する判定である。本番での作成直後の確認（W2）と、本番の `CREDENTIAL_ENC_KEY` の設定（W3）は含まない。

## ローカル証跡

- `pnpm typecheck`: **PASS**
- `pnpm test`: **140 files passed・1 skipped / 2221 tests passed・1 skipped**
- `pnpm test:e2e`（ローカル preview）: **12/12 を3回続けて PASS**。反映までの時間は他タブ 16〜20ms・画面復帰 131〜172ms・bfcache 121〜165ms。この3回の前に1回、ローカルの `wrangler dev` が途中で落ちた（アプリの例外は記録になし。上げ直した後は続けて通った）
- `pnpm run check:docs`: **PASS**
- `pnpm run cf:dry-run`: **PASS**（bundle 2004.8 KiB、65.3%）
- ローカル preview の応答の保存指示: ログイン後の HTML と `/api/*` は `no-store` を含み、`/api/*` は `private, no-store`。CSV と Claude Code 向けは `no-store`
- ローカル preview で会社の追加をサーバーアクションとして呼び、応答と直後の再読み込みの両方に新しい会社が出ることを確認
- system-spec の決定論ゲート（網羅・出典・文書同期・必須情報）: **すべて exit 0**

# タスク仕様: feat-data-freshness

| 項目 | 値 |
|---|---|
| graph_node_id | `feat-data-freshness` |
| beads_id | `hr-czp`（task は `hr-czp.1`〜`hr-czp.13`） |
| 種別 | feat / reliability / security / docs |
| 状態 | review（draft PR。default branch へ merge されたら done） |
| base branch | `main`（`580ec2d`。origin/main と同じで、dev ブランチは無い） |
| work branch | `devgraph/feat-data-freshness` |
| 仕様反映 | [2026-10-01 の受領書](../docs/product/spec-receipts/2026-10-01-data-freshness.md) / [最終レビューの受領書](../docs/product/spec-receipts/2026-10-02-data-freshness-final-review.md) |

## 目的

作る・変える・消す操作の結果が、成功表示の直後の画面・再読み込み・他のタブ・画面復帰のどれでも必ず見えるようにする。画面ごとの呼び忘れを直すのではなく、保存の入口を1つにして共通の契約にする。

## 受け入れ条件

1. 画面からの書き込みがすべてサーバーアクションで、`runAction` か `runRead` を通る。画面の部品に書き込みの `fetch` が無い
2. 成功した保存だけが描き直し、その画面は保存の応答に同梱される。断られた保存は1行も書かず描き直さない
3. ログイン後の画面と `/api/*` の応答が成功・失敗とも `private, no-store`
4. 他のタブ・画面復帰・通信復帰で取り直し、取り直しは1.5秒に1回へ間引かれる
5. 会社の追加の書きかけが残らない。取り消しも失敗したら記録に残る
6. 制度マスタの本体と監査記録が同じ batch で書かれ、同時保存の後のほうが 409
7. 初期パスワードの控えが暗号化して残り、開ける人が限られ、本人のパスワード変更で消える
8. 製品仕様 §27・system-spec（要件定義と8章）・architecture・backlog・デプロイ時の注意が同じ決定を指す
9. 成功の知らせは新しい画面が描き終わってから出る。知らせが出た瞬間の画面に、新しい行・1つ増えた件数・会社切替の選択肢がある（O1。待機なし）
10. bfcache から戻った画面は、ルーターが画面を戻し終えた後に取り直す（先に出した取り直しが捨てられない）
11. 成功・失敗の応答に生成時刻 `x-generated-at` が付く（101 など作り直せない応答は除く）
12. 連続作成の画面では、発行した控えを成功の知らせの後ろに畳んで置く。控えを保存できなかったときだけ最初から開く
13. 2つ以上の表を書く関数は、1回の batch・`withCompensation`・`rollForward` のどれかに入る（`write-atomicity-contract.test.ts`）。パスワード変更の続きが2回とも失敗しても「変更済み」と伝え、`rollforward_failed` を残す。端末の承認を同時に2回引き換えても1回だけ通る
14. 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。`allowedOrigins` を足していない（`action-origin.test.ts`）
15. 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 で再発行を頼み、次の発行で消える
16. 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。本人の登録内容は本人の行と会社が開放した項目だけ。応答に仮パスワードが無い（backlog SECURITY-001 を閉じる）
17. スマホ（375px）・タブレット（768px）の幅でも、会社の追加の反映と控えの置き方が同じに通る
18. 下書きの自動保存は、保存が済んだ瞬間も打っている途中の値を消さず、再読み込み・画面の行き来のあとも保存した値が出る。まとめ処理は、結果の知らせと同じ描画のうちに一覧と件数が新しくなり、表示中を全て処理して0件になっても結果の表が消えない
19. 下書きの自動保存は送った順に1件ずつ保存し、「保存済み」は最新の入力の成功だけで出る。提出が先に済んだ下書きの保存は本文も状態も書かず 409（`system-spec/release-and-forms.md` §6）
20. 氏名（前後の空白を除いて必須）と所属会社（ひな形・停止中の会社は不可）の検査を、本人・社員・全体管理の3つの入口で同じ関数が行う

## 変更範囲

- 入口: `src/lib/action.ts` / `src/lib/action-result.ts` / `src/lib/use-refresh.ts`（`createCommitGate` で、成功の結果を新しい画面が描き終わってから返す）
- サーバーアクション: `src/actions/*.ts`（19 ファイル）と、画面側の呼び出し（`src/app/**` の部品）
- 旧 API: 書き込みの `src/app/api/**` 33 ファイルと `src/components/master-delete-request.ts` を削除
- API の出口: `src/lib/api.ts`
- タブ間: `src/lib/freshness.ts`（`watchFreshness`）/ `src/components/FreshnessSync.tsx` / `AppShell`
- 応答の生成時刻: `worker.ts` / `src/lib/generated-at.ts`
- 書き込み: `src/lib/compensation.ts`（`withCompensation` / `rollForward`）/ `src/lib/masters/`（`src/app/api/masters/` から移動、`write-batch.ts` を追加）/ `src/lib/write-atomicity-contract.test.ts`
- batch 化: `src/lib/improvement-agent-write.ts` / `src/lib/agent-device.ts`（条件付きの更新）/ `src/lib/usage.ts`（記録と掃除）
- 送信元の検査: `src/lib/action-origin.test.ts`
- 控え: `src/lib/credential-vault.ts`（`MEMO_TTL_DAYS`）/ `src/lib/credential-issue.ts` / `src/components/CredentialMemoButton.tsx` / `src/components/RecordForm.tsx`（発行直後の控えを畳む。作成の3アクションは `memoStored` を返す）
- 監査試験: `src/actions/account-and-company-admin.integration.test.ts`（backlog SECURITY-001）
- 移行: `drizzle/migrations/0031_initial_credential_memos.sql` / `0032_constitution_events_seq_unique.sql`
- 画面の通し試験: `playwright.config.ts` / `e2e/auth.setup.ts` / `e2e/support.ts` / `e2e/data-freshness.spec.ts`（経路の一覧の正本） / `e2e/data-freshness-component-types.spec.ts`（下書きの自動保存・まとめ処理） / `package.json`（`test:e2e`）/ `.gitignore`
- 回答の保存: `src/lib/response-write.ts`（下書きの条件付き置換と 409）/ `src/components/FormAnswer.tsx`（送信順の直列化・保存済みの表示）/ `src/components/FormBuilder.tsx`
- 利用者の検査: `src/lib/user-integrity.ts`（`assertCompanyAssignable`）/ `src/lib/user-name-schema.ts` / 要件編集の共通 hook `src/components/use-master-action.ts`
- 設定と依存: `next.config.ts`（サーバーアクションの本文上限 8MB）/ `wrangler.jsonc`（入口を `worker.ts` へ）/ `.dev.vars.example`（`CREDENTIAL_ENC_KEY`）/ `package.json`・`pnpm-lock.yaml`（`@playwright/test` 1.63.0 を追加、next 16.3.8・`@vitest/coverage-v8` 4.1.11 へ更新）
- 試験の共通部品: `src/test-support/source-code.ts`（注釈を除いた本文・関数ごとの切り出し）/ `src/test-support/action-mocks.ts`（`sessionAs`）
- 通し試験で見つけて直した既存の不具合: `src/components/ImprovementBulkTable.tsx` と `src/app/admin/improvements/page.tsx`（0件になっても部品を外さず、結果の表を残す）/ `src/app/me/forms/[id]/page.tsx`（注記を操作の帯より前へ。帯の下に隠れて押せなかった）。どちらも `ui-rules.test.ts`・`improvement-ux-contracts.test.ts` で固定
- 文書: `docs/product/spec.md` §27 / `system-spec/`（要件定義・8章・索引・`spec-state.json`・`fetched-references.json`） / `architecture/data-freshness.md` と索引・`account-profile.md`・`master-settings.md`・`release-and-forms.md` / `docs/product/backlog.md` / `docs/product/backlog-session-notes.md` / `docs/deploy-notes.md` §6・§7（「反映されない」の切り分け・取り消しの失敗・画面の通し試験） / features / specs / tasks / 受領書

## 品質ゲート

| ゲート | コマンド | 実測 |
|---|---|---|
| Typecheck | `pnpm typecheck` | PASS |
| テスト全量 | `pnpm test` | PASS（148 files passed・1 skipped / 2297 tests passed・1 skipped。skip は任意の本番検査1件） |
| 画面の通し試験 | `E2E_BASE_URL=http://localhost:8788 pnpm test:e2e`（ローカル preview） | PASS（14/14 を3回続けて。準備1件、経路の一覧11件（パソコン幅の7件に、375px・768px の 6-1・6-5）、部品の型2件（下書きの自動保存・まとめ処理）。3回目は要望の送信の上限に当たり、待ってから通った（58.5秒）。反映までの時間は 2026-10-01 の測定で他タブ 16〜20ms・画面復帰 131〜172ms・bfcache 121〜165ms。その日は3回の前に1回、ローカルの `wrangler dev` が「Network connection lost」で落ちた（アプリの例外は記録になし））。2026-10-02 の再検証では、専用のローカル D1（移行 0000〜0032 と匿名のデモデータ）で上げた preview に対して、自動保存の直列化の追加後も14件 PASS） |
| Docs drift | `pnpm run check:docs` | PASS |
| Workers ビルド | `pnpm run cf:dry-run` / `pnpm run check:bundle-size` | PASS（bundle 1997.1 KiB、上限 3072 KiB の 65.0%。next 16.3.8 で測定） |
| 応答の保存指示 | ローカル preview の全画面・`/api/*` を node fetch で取得 | ログイン後の HTML は `private, no-cache, no-store, max-age=0, must-revalidate`、`/api/*`（`handle`・`jsonError`）は成功・失敗とも `private, no-store`、CSV の書き出しと Claude Code 向けは `no-store`。すべての応答に `x-generated-at` |
| 保存直後の反映 | ローカル preview（`localhost:8788`）で会社の追加をサーバーアクションとして呼ぶ | 応答 200・`ok:true`・応答に新しい会社名あり。直後と1秒後の再読み込みの一覧にも新しい会社あり |
| システム仕様 | `validate-coverage-matrix.py --require-complete --require-basis --require-foundation` / `validate-source-citation.py` / `validate-spec-doc-sync.py` / `validate-knowledge-graph.py --profile required-info` | すべて exit 0。必須情報の未接地 0 |
| 空白 | `git diff --check` | PASS |

実測日: 2026-10-02。最終レビューで Typecheck・テスト全量・Docs drift・空白・システム仕様の4つの検証を測り直した（すべて PASS）。node_modules が x64 で入れ直されていたため、x64 の node（Rosetta）で実行した。Workers ビルドと画面の通し試験は、同じ日の再検証（`docs/reviews/elegant-review-2026-10-02.md`）の値で、最終レビューでは測り直していない（同じツリーで別のエージェントの preview が `.open-next` を使っていたため）。応答の保存指示と保存直後の反映は、2026-10-02 の前半の測定。

## 残課題

| # | 内容 | 置き場所 |
|---|---|---|
| W1 | 別の利用者・別の端末の画面へは押し出さない | `docs/product/backlog-session-notes.md` |
| W2 | 本番で作成直後の ⌘+Shift+R を確かめる（配布後） | 同上 |
| W3 | 本番の `CREDENTIAL_ENC_KEY` を設定する（外部への変更なので利用者の確認を通す） | 同上 / `docs/deploy-notes.md` §6 |
| W4 | 仮パスワードそのものの失効（控えの14日は入れた。失効の日数と期限切れの人の見分け方は事業側が決める） | backlog SECURITY-005 |
| W5 | 最終レビューで見送った整理（発行と再発行の共通化・パスワード上限の不一致・自動保存とまとめ処理の取り直しの知らせ・`/api/improvements` の書き込み口・未使用の `SignOutButton`） | `docs/product/backlog-session-notes.md` |
| — | 楽観更新（実測値を取ってから） | backlog UX-030 |

## 非採用

- 画面ごとの `router.refresh()` の呼び忘れを1件ずつ直す（新しい画面で同じ漏れが起きる）
- 一定間隔での取り直し（他のタブへ1秒以内に届けるには間隔を1秒にする必要があり、1画面で1日86,400要求になる。D-001）
- 常時接続での押し出し（WebSocket・Durable Objects。月5 USD〜と新しい部品が要り、同じ画面を複数人で同時に触る使い方ではない。D-001）
- 同時保存の自動やり直し（先の人の変更を黙って上書きする）
- 初期パスワードの控えを平文で保存する

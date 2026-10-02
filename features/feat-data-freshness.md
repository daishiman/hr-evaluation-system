---
graph_node_id: "feat-data-freshness"
artifact_kind: "feature"
artifact_subtypes: []
title: "保存した結果が、どの画面・タブ・端末でもすぐ見える"
project_id: "hr-evaluation-system"
domain: "data-freshness"
status: "active"
priority: null
start_date: "2026-09-30"
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "server-actions", "d1-batch", "credential-memo", "macro-feature"]
file_path: "features/feat-data-freshness.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "dev-graph:dev-graph-integrity-auditor", "evidence_ref": "eval-log/run-dev-graph-decompose-audit.json", "evaluated_digest": "5a8b6bd16ce2830e8031277d293eaeb258d6df1427de5dff716dda584ea6b1ad"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "system-spec/index.md", "source_version": "0.1.11", "source_digest": "da48a1cd06eb32de04462b01fbe6884c2d11e10691ad5417dff46b00fbcd2de0", "imported_at": "2026-10-01T11:50:00Z"}
created_at: "2026-10-01T11:50:00Z"
updated_at: "2026-10-01T12:04:00Z"
depends_on: []
related_nodes: ["spec-data-freshness", "arch-data-freshness"]
resource_scope: ["features/feat-data-freshness.md", "features/feat-data-freshness.json"]
purpose: "「会社を追加したと出たのに、一覧に出ない。再読み込みしても出ない」を、会社の追加だけでなく作る・変える・消す操作の全部で起きない作りにする。画面ごとの呼び忘れを1件ずつ直すのではなく、保存の入口を1つにして、鮮度の保証を共通の契約にする。"
goal: "画面からの書き込みはすべてサーバーアクションの入口 runAction を通り、成功した保存の応答に新しい画面が同梱され、成功の知らせは新しい一覧が描き終わってから出る。別のタブ・画面復帰・戻る・bfcache の復元・通信復帰でも画面を取り直し、応答は private, no-store と生成時刻 x-generated-at を持つ。複数の表を書く保存は3つの書き込みの型のどれかに入り、片方だけが残る状態を作らない。連続作成で消える初期パスワードは暗号化した控えとして14日だけ開き直せる。これらを単体・結合テストと画面の通し試験（パソコン・375px・768px）が固定している。"
scope_in: ["画面から使っていた Route Handler 22本（FR-014）をサーバーアクションへ移し、付随する部品と試験の11ファイルを src/lib/masters/・src/actions/ へ移す（旧ファイルは作業ツリーの外へ退避。退避した経路は 404）", "runAction / runRead / useSaveAction / useReadAction と、その契約テスト", "成功の結果を新しい画面が描き終わってから返す createCommitGate", "API の共通出口（handle / jsonError）での Cache-Control: private, no-store", "FreshnessSync と watchFreshness（BroadcastChannel・visibilitychange・pageshow・online）", "応答の生成時刻 x-generated-at（worker.ts / src/lib/generated-at.ts）", "withCompensation（会社の追加）・rollForward（パスワードの変更）・writeMasterBatch（制度マスタ、移行 0032）と書き込みの型の契約テスト", "別々の await で2つの表を書いていた4か所の batch 化と、端末の承認の引き換えの条件付き更新", "送信元の二重の検査を固定する試験（action-origin.test.ts。allowedOrigins は足さない）", "初期パスワードの控え（AES-GCM、表 initial_credential_memos、移行 0031、14日の期限）とパスワード変更時の他端末ログアウト", "連続作成の画面（RecordForm）で、発行した控えを成功の知らせの後ろに畳む", "アカウント設定と会社管理の保存の監査（SECURITY-001）", "画面の通し試験（Playwright。ローカルの preview だけを相手にする。パソコン・375px・768px）", "製品仕様 §27・system-spec・architecture・backlog・デプロイ時の注意の同期"]
scope_out: ["別の利用者・別の端末の画面へ保存を押し出すこと（W1）", "本番での作成直後の ⌘+Shift+R の確認（W2。配布後に行う）", "本番の CREDENTIAL_ENC_KEY の設定（W3。外部への変更なので利用者の確認を通す）", "仮パスワードそのものの失効（W4 / SECURITY-005。控えの14日の期限は含む）"]
acceptance: ["画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）", "成功した保存だけが1回描き直し、断られた保存は1行も書かず描き直さない", "ログイン後の画面と /api/* の応答が private, no-store", "保存の知らせが他のタブに届き、送ったタブには届かない。取り直しは1.5秒に1回へ間引かれる", "会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない", "制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない", "控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える", "ローカルの preview で、会社の追加の応答に新しい会社が載り、直後の再読み込みにも出る", "check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる", "成功の知らせが出た瞬間の画面に、新しい会社の行・1つ増えた件数・会社切替の選択肢がある（E2E 1。待機なし）", "作成直後のキャッシュを使わない再読み込みで新しい会社が出て、応答の x-generated-at が作成より後（E2E 2）", "他のタブ・画面復帰・戻る・bfcache の復元で、新しい会社が1秒以内に出る（E2E 3a・3b・4a・4b）", "発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・RecordForm.test.ts）", "別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る", "別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。allowedOrigins を足していない（action-origin.test.ts）", "発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える", "会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。応答に仮パスワードが無い（SECURITY-001）", "スマホ（375px）・タブレット（768px）の幅でも、E2E 1 と 5 が同じに通る（E2E 6-1・6-5）"]
architecture_refs: ["arch-data-freshness"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "C14（run-dev-graph-decompose）の macro contract が、確定済み（evaluator PASS）の spec-data-freshness と arch-data-freshness から分解した機能単位で、種別は feature と明示されている。本文は feature テンプレートの必須7節（目的・到達状態・スコープ・受入・アーキテクチャ参照・機能間依存・Handoff）を持ち、phase の task は含まない。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-data-freshness.md"}, {"artifact_kind": "specification", "confidence": 0.05, "candidate_path": "specs/data-freshness.md"}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp", "linked_at": "2026-10-01T12:03:16Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-10-01T12:04:00Z"}
---

# 保存した結果が、どの画面・タブ・端末でもすぐ見える

## 目的

「会社を追加したと出たのに、一覧に出ない。再読み込みしても出ない」を、会社の追加だけでなく作る・変える・消す操作の全部で起きない作りにする。画面ごとの呼び忘れを1件ずつ直すのではなく、保存の入口を1つにして、鮮度の保証を共通の契約にする。

利用者（人事・会社の管理者）の仕事は「登録したものを、すぐ次の作業に使う」こと。保存の直後に一覧へ出ないと、二重に登録したり、保存できたのかを疑って作業が止まったりする。

## 到達状態

- 画面からの書き込みは、すべて `src/actions/` のサーバーアクションで、入口は `runAction` の1つ。成功した保存の応答に新しい画面が同梱される
- 成功の知らせは、新しい一覧が描き終わってから出る（`createCommitGate`）。知らせが出た時点で、一覧・件数・会社切替に新しい行がある
- 画面の保存に使う書き込みの `/api/*` は残っていない。残る `/api/*` は外から読む口と画面の外の相手（Claude Code の端末と作業結果、公開前の確かめ、外観と利用状況の記録、Better Auth）だけで、応答は成功・失敗とも `private, no-store`。一覧は [製品仕様 §27-2](../docs/product/spec.md) が正本
- 別のタブ・戻るボタンで開き直した画面・タブ復帰・通信復帰・bfcache からの復元で、画面を取り直す（`FreshnessSync` → `watchFreshness`）
- 成功・失敗の応答に生成時刻（`x-generated-at`）が付き、「反映されない」の報告をキャッシュの問題かどうかで切り分けられる（101 など作り直せない応答は除く）
- 1つの操作で複数の表を書く保存は、3つの型（1回の batch・会社の追加の取り消し `withCompensation`・パスワード変更の続きのやり直し `rollForward`）のどれかに入り、片方だけが残る状態を作らない。別々の `await` で書いていた4か所も1回の batch にした
- 別のサイト（ポートだけ違う場合を含む）からの書き込みと読み出しは、Next.js の検査と `assertSameOrigin` の二重で断る
- 制度マスタの本体と監査記録が同じ batch で書かれ、同じ項目の同時保存は後のほうが 409 で断られる
- 連続作成で消える初期パスワードは、暗号化した控えとして残り、一覧の行から開き直せる。発行した直後の控えは成功の知らせの後ろに畳んで置き、一覧の新しい行を押し下げない。控えは発行から14日で開けなくなり、次の発行で消える
- 入口の通し方・送信元の検査・書き込みの型・応答の保存指示・タブ間の知らせ・取り消し・同時保存・控えの寿命・アカウント設定と会社管理の認可を単体・結合テストが、各経路での反映と控えの置き方、下書きの自動保存とまとめ処理の型を画面の通し試験（`e2e/data-freshness.spec.ts`・`e2e/data-freshness-component-types.spec.ts`。経路の一覧は前者の冒頭の注釈が正本）が固定している。テストの一覧は [アーキテクチャ「テスト」](../architecture/data-freshness.md#テスト)

## スコープ

- スコープ内:
  - 画面から使っていた Route Handler 22本（`specs/data-freshness.md` の FR-014）をサーバーアクションへ移し、付随する部品と試験の11ファイルを `src/lib/masters/`・`src/actions/` へ移す（旧ファイルは作業ツリーの外へ退避。退避した経路は 404）
  - `runAction` / `runRead` / `useSaveAction` / `useReadAction` と、その契約テスト
  - 成功の結果を新しい画面が描き終わってから返す `createCommitGate`
  - API の共通出口（`handle` / `jsonError`）での `Cache-Control: private, no-store`
  - `FreshnessSync` と `watchFreshness`（BroadcastChannel・visibilitychange・pageshow・online。bfcache の復元はルーターが画面を戻し終えた後に、間引かずに取り直す）
  - 応答の生成時刻 `x-generated-at`（`worker.ts` / `src/lib/generated-at.ts`）
  - `withCompensation`（会社の追加）・`rollForward`（パスワードの変更）・`writeMasterBatch`（制度マスタ、移行 0032）と、書き込みの型の契約テスト（`write-atomicity-contract.test.ts`）
  - 別々の `await` で2つの表を書いていた4か所（改善要望の書き込み・端末の承認の引き換え・利用状況の記録と掃除）の batch 化。引き換えは条件付きの更新で、同時に2回でも1回だけ通る
  - 送信元の二重の検査を固定する試験（`action-origin.test.ts`。`allowedOrigins` は足さない）
  - 初期パスワードの控え（AES-GCM、表 `initial_credential_memos`、移行 0031）と、パスワード変更時の他端末ログアウト。作成の結果は控えを保存できたか（`memoStored`）だけを返し、値は返さない。控えは発行から14日（`MEMO_TTL_DAYS`）で開けなくなり、発行の batch の先頭で期限切れを消す
  - 連続作成の画面（`RecordForm`）で、発行した控えを成功の知らせの後ろに畳む
  - アカウント設定と会社管理の保存の監査（backlog SECURITY-001。`account-and-company-admin.integration.test.ts`）
  - 画面の通し試験（Playwright。`playwright.config.ts` / `e2e/`、`pnpm test:e2e`。ローカルの preview だけを相手にする。パソコン・375px・768px）
  - 製品仕様 §27・system-spec の要件定義と8章・architecture・backlog・デプロイ時の注意の同期
- スコープ外:
  - 別の利用者・別の端末の画面へ保存を押し出すこと（W1）
  - 本番での作成直後の ⌘+Shift+R の確認（W2。配布後に行う）
  - 本番の `CREDENTIAL_ENC_KEY` の設定（W3。外部への変更なので利用者の確認を通す）
  - 仮パスワードそのものの失効（W4 / SECURITY-005。ログインの可否が変わるので事業側の判断を待つ。控えの14日の期限は含む）

## 受入

- [ ] 1. 画面の部品に書き込みの `fetch` が無く、どのサーバーアクションも `runAction` か `runRead` を通る（契約テスト）
- [ ] 2. 成功した保存だけが1回描き直し、断られた保存は1行も書かず描き直さない
- [ ] 3. ログイン後の画面と `/api/*` の応答が `private, no-store`
- [ ] 4. 保存の知らせが他のタブに届き、送ったタブには届かない。取り直しは1.5秒に1回へ間引かれる
- [ ] 5. 会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない
- [ ] 6. 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない
- [ ] 7. 控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える
- [ ] 8. ローカルの preview で、会社の追加の応答に新しい会社が載り、直後の再読み込みにも出る
- [ ] 9. `check:docs` が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる
- [ ] 10. 成功の知らせが出た瞬間の画面に、新しい会社の行・1つ増えた件数・会社切替の選択肢がある（E2E 1。待機なし）
- [ ] 11. 作成直後のキャッシュを使わない再読み込みで新しい会社が出て、応答の `x-generated-at` が作成より後（E2E 2）
- [ ] 12. 他のタブ・画面復帰・戻る・bfcache の復元で、新しい会社が1秒以内に出る（E2E 3a・3b・4a・4b）
- [ ] 13. 発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・`RecordForm.test.ts`）
- [ ] 14. 別々の `await` で2つ以上の表を書く関数が無い（`write-atomicity-contract.test.ts`）。パスワード変更の続きが2回とも失敗しても「変更済み」と伝え、`rollforward_failed` を残す。端末の承認を同時に2回引き換えても1回だけ通る
- [ ] 15. 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。`allowedOrigins` を足していない（`action-origin.test.ts`）
- [ ] 16. 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える
- [ ] 17. 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。本人の登録内容は本人の行と会社が開放した項目だけ。応答に仮パスワードが無い（SECURITY-001）
- [ ] 18. スマホ（375px）・タブレット（768px）の幅でも、E2E 1 と 5 が同じに通る（E2E 6-1・6-5）

4 の間引き（1.5秒）と 12 の1秒の関係は [製品仕様 §27-3](../docs/product/spec.md) を見る。

チェックは、後段の plan（system-dev-planner）が作る13件の作業が閉じるときに付ける。各作業が何をするかは plan が決める。dev-graph の完了の検査（`validate-graph-schema.py`）は、この機能を done にするとき P07・P10・P11 の `completion_evidence` を求めるので、実装と検証の証跡はその3件のどれかに結び付ける。

## アーキテクチャ参照

- `architecture_refs`: arch-data-freshness（`architecture/data-freshness.md`。部品表・層分け・ADR）
- 部品と依存のグラフ: `architecture/graph.json`（10部品・11辺。決定 D-001〜D-003・ADR-004〜ADR-008）
- 仕様: spec-data-freshness（`specs/data-freshness.md`。サーバーアクションと残した Route Handler の API 契約）
- 上位の目的: `system-spec/00-requirements-definition.md`（U1〜U9・G1〜G5）と `system-spec/index.md`（8章）
- 記号（U・G・O・D・ADR・W など）の読み方: [仕様メモ「ID の読み方」](../specs/data-freshness.md#id-の読み方)
- 計画への入力: `features/feat-data-freshness.json`（目的・到達状態・スコープ・受入・参照の9項目。plan の feature-context）

## 機能間依存

- `depends_on`: なし（他の feature に依存しない）
- 依存理由: 保存の入口・応答の保存指示・タブ間の知らせ・書き込みの型は、どれもこの機能の中で閉じている。既存の機能（会社管理・利用者・アンケート・制度マスタなど）はこの機能が作った共通の入口を使う側で、この機能がそれらの完了を待つことはない
- 仕様とアーキテクチャへの関係は `related_nodes`（spec-data-freshness・arch-data-freshness）で持ち、機能間の依存には数えない

## Handoff

- per-feature planning: `/dev-graph plan --feature-id feat-data-freshness --feature-context features/feat-data-freshness.json` で `run-system-dev-plan` を起動する。手動の `/system-dev-plan` の結果も同じ登録経路（C02 `register-package`）で受け付け、`graph_node_id` と `source_digest` で同じ1組に収束させる
- 生成物: P01〜P13 のちょうど13件の実行可能なタスク仕様書と、package の中だけで閉じた13ノードの依存グラフ
- 登録先: 同じ `parent_feature`（feat-data-freshness）と `feature_package_id` で、C02 を通して一括登録する。expected と applied がどちらも13のときだけ成功とする。Beads へは bd-bridge が epic の下に13件の task と blocks の辺を作る
- 完了rollup: 13件すべてが done で、P07・P10・P11 の `completion_evidence` に証跡があり、それがこの機能の受入を満たすときだけ、この機能を done にする（P07・P10・P11 を求めるのは dev-graph の完了の検査で、この文書の決めではない）

## 関連

- Beads: epic は decompose の投影で採番する（残課題は backlog SECURITY-005 / UX-030 と、セッション記録の W1〜W4。SECURITY-001 はこの作業で閉じた）
- 製品仕様: `docs/product/spec.md` §27
- 運用: `docs/deploy-notes.md` §6（鍵の設定）・§7（「反映されない」の切り分け・取り消しの失敗・画面の通し試験）
- 記録: `docs/product/backlog-session-notes.md`「保存した結果がすぐ見えるようにした回（2026-10-01）」
- 作業の記録: `tasks/feat-data-freshness.md`

---
graph_node_id: "SYS-DF-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "保存の入口・同梱・知らせ・書き込みの型を全機能に実装する"
project_id: "feature-package-feat-data-freshness"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "implementation"]
file_path: "tasks/feat-data-freshness/sys-df-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P04"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["src/actions/", "src/lib/", "src/components/", "src/db/", "src/app/admin/", "src/app/manager/", "src/app/system/", "src/app/globals.css", "src/app/api/", "worker.ts", "wrangler.jsonc", "next.config.ts", "drizzle/migrations/0031_initial_credential_memos.sql", "drizzle/migrations/0032_constitution_events_seq_unique.sql"]
purpose: "runAction・runRead・useSaveAction・useReadAction と createCommitGate、FreshnessSync と watchFreshness、x-generated-at、withCompensation・rollForward・writeMasterBatch、初期パスワードの控え（AES-GCM・14日）を実装し、画面から使っていた Route Handler 22本を同じ変更の束で退避して、会社だけでなく作る・変える・消す操作の全部で、保存の直後に新しい画面が出る状態にする。"
goal: "保存の入口・同梱・知らせ・書き込みの型を全機能に実装する。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["src/lib/action.ts（runAction・runRead）と src/lib/action-result.ts", "src/lib/freshness.ts と src/components/FreshnessSync.tsx（BroadcastChannel・visibilitychange・pageshow・online）", "src/lib/generated-at.ts と worker.ts（x-generated-at）、src/lib/api.ts（private, no-store）", "src/lib/compensation.ts（withCompensation・rollForward）と src/lib/masters/write-batch.ts（writeMasterBatch）。同時保存の試験 src/lib/masters/master-concurrent-save.integration.test.ts もこの phase が持ち、A5 をここで満たす", "src/app/api/masters/ に付随していた部品と試験の10ファイル（apply-master-update.ts・body-schema.ts・delete-master-item.ts・versioned-requirement-update.ts・apply-behavior-master-update.ts とその試験）を src/lib/masters/ へ移し、writeMasterBatch を使う形に書き換える。src/actions/masters.ts と同時保存の試験がこれを import するので、この phase の中で済ませる", "src/lib/credential-vault.ts と src/actions/credential-memos.ts（控えの暗号化と14日の期限）。src/db/schema.ts に表 initial_credential_memos を足し、src/app/globals.css には控えの表示の部品だけを足す（冒頭の brand_color_* の宣言は変えない）", "src/actions/ のサーバーアクション一式と src/components/RecordForm.tsx（控えを畳む）", "src/components/ の画面の部品と、src/app/admin/・src/app/manager/・src/app/system/ の page を、fetch と router.refresh の組から useSaveAction・useReadAction へ移す", "src/lib/domain/ の制度マスタの番号の採番と、その試験・src/lib/ の書き込みの部品（取り込み・改善要望・使用量など）を、3つの書き込みの型に合わせて追従させる", "画面から使っていた Route Handler 22本と、その経路の結合試験1本（src/app/api/agent-keys/route.integration.test.ts）を作業ツリーの外へ退避する（経路は 404）。古い経路が残ると P04 の契約テストと off-state の試験が落ちるので、移す作業と同じこの phase で済ませる", "外から読む口として残す9本（agent/device・agent/token・auth/[...all]・export・improvements・improvements/[id]・search・theme-choice・usage）を、共通の出口 handle・jsonError の private, no-store にそろえる", "next.config.ts の experimental.serverActions.bodySizeLimit を 8mb に広げ（CSV の貼り付けの取り込みと、改善要望のスクリーンショットが既定の1MBを超えうるため。個々の操作は src/lib/action.ts の maxBytes と zod の max でさらに絞る）、wrangler.jsonc の main を worker.ts にする", "drizzle/migrations/0031_initial_credential_memos.sql（表 initial_credential_memos）と 0032_constitution_events_seq_unique.sql（制度マスタの番号の一意の索引）。A5・A13・A15 が頼る形を、受入の確認より前のこの phase で揃える"]
scope_out: ["別の端末の画面へ保存を押し出すこと（W1）", "仮パスワードそのものの失効（W4 / SECURITY-005）", "P04 の契約テストの期待を書き換えること（実装を契約に合わせる）", "テーマの契約テストと src/app/globals.css 冒頭の brand_color_* の宣言を書き換えること"]
acceptance: ["A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）", "A1: 成功した保存だけが1回描き直し、断られた保存は1行も書かず描き直さない", "A2: ログイン後の画面と /api/* の応答が private, no-store", "A3: 保存の知らせが他のタブに届き、送ったタブには届かない。取り直しは1.5秒に1回へ間引かれる", "A4: 会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない", "A5: 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない", "A6: 控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える", "A12: 発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・RecordForm.test.ts）", "A13: 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る", "A15: 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える", "A16: 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。応答に仮パスワードが無い（SECURITY-001）", "会社・利用者・アンケートなど全ての作成・変更・削除が src/actions/ の runAction を通る", "退避した22本の route.ts が src/app/api/ に残っておらず、それを呼ぶ画面の部品と試験が0件である"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P05（implementation）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p05.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.5", "linked_at": "2026-10-01T13:15:38Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 保存の入口・同梱・知らせ・書き込みの型を全機能に実装する

## 目的

runAction・runRead・useSaveAction・useReadAction と createCommitGate、FreshnessSync と watchFreshness、x-generated-at、withCompensation・rollForward・writeMasterBatch、初期パスワードの控え（AES-GCM・14日）を実装し、画面から使っていた Route Handler 22本を同じ変更の束で退避して、会社だけでなく作る・変える・消す操作の全部で、保存の直後に新しい画面が出る状態にする。

## 背景

会社の追加・利用者の登録・アンケートの作成など全ての新規作成で、リロードしてもしばらく反映されなかった。入口を1つにし、成功の応答に新しい画面を同梱すれば、画面ごとの呼び忘れが起きない。古い経路を残したままだと、P04 の契約テスト（書き込みの原子性）と off-state の試験が落ち、src/app/api/masters/route.ts は移した部品を import できず型検査も通らないことを、作業ツリーの写しで型検査と試験を回して確かめた。だから退避は実装と切り離せず、この phase で済ませる。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: architecture/data-freshness.md、src/actions/server-actions-contract.test.ts、src/lib/write-atomicity-contract.test.ts、src/lib/action-origin.test.ts
- 前提: 依存タスク（SYS-DF-P04）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: src/lib/action.ts（runAction・runRead）と src/lib/action-result.ts
- 生成物: src/lib/freshness.ts と src/components/FreshnessSync.tsx（BroadcastChannel・visibilitychange・pageshow・online）
- 生成物: src/lib/generated-at.ts と worker.ts（x-generated-at）、src/lib/api.ts（private, no-store）
- 生成物: src/lib/compensation.ts（withCompensation・rollForward）と src/lib/masters/write-batch.ts（writeMasterBatch）。同時保存の試験 src/lib/masters/master-concurrent-save.integration.test.ts もこの phase が持ち、A5 をここで満たす
- 生成物: src/app/api/masters/ に付随していた部品と試験の10ファイル（apply-master-update.ts・body-schema.ts・delete-master-item.ts・versioned-requirement-update.ts・apply-behavior-master-update.ts とその試験）を src/lib/masters/ へ移し、writeMasterBatch を使う形に書き換える。src/actions/masters.ts と同時保存の試験がこれを import するので、この phase の中で済ませる
- 生成物: src/lib/credential-vault.ts と src/actions/credential-memos.ts（控えの暗号化と14日の期限）。src/db/schema.ts に表 initial_credential_memos を足し、src/app/globals.css には控えの表示の部品だけを足す（冒頭の brand_color_* の宣言は変えない）
- 生成物: src/actions/ のサーバーアクション一式と src/components/RecordForm.tsx（控えを畳む）
- 生成物: src/components/ の画面の部品と、src/app/admin/・src/app/manager/・src/app/system/ の page を、fetch と router.refresh の組から useSaveAction・useReadAction へ移す
- 生成物: src/lib/domain/ の制度マスタの番号の採番と、その試験・src/lib/ の書き込みの部品（取り込み・改善要望・使用量など）を、3つの書き込みの型に合わせて追従させる
- 生成物: 画面から使っていた Route Handler 22本と、その経路の結合試験1本（src/app/api/agent-keys/route.integration.test.ts）を作業ツリーの外へ退避する（経路は 404）。古い経路が残ると P04 の契約テストと off-state の試験が落ちるので、移す作業と同じこの phase で済ませる
- 生成物: 外から読む口として残す9本（agent/device・agent/token・auth/[...all]・export・improvements・improvements/[id]・search・theme-choice・usage）を、共通の出口 handle・jsonError の private, no-store にそろえる
- 生成物: next.config.ts の experimental.serverActions.bodySizeLimit を 8mb に広げ（CSV の貼り付けの取り込みと、改善要望のスクリーンショットが既定の1MBを超えうるため。個々の操作は src/lib/action.ts の maxBytes と zod の max でさらに絞る）、wrangler.jsonc の main を worker.ts にする
- 生成物: drizzle/migrations/0031_initial_credential_memos.sql（表 initial_credential_memos）と 0032_constitution_events_seq_unique.sql（制度マスタの番号の一意の索引）。A5・A13・A15 が頼る形を、受入の確認より前のこの phase で揃える
- 更新対象: src/actions/、src/lib/、src/components/、src/db/、src/app/admin/、src/app/manager/、src/app/system/、src/app/globals.css、src/app/api/、worker.ts、wrangler.jsonc、next.config.ts、drizzle/migrations/0031_initial_credential_memos.sql、drizzle/migrations/0032_constitution_events_seq_unique.sql

## 依存関係

- `depends_on`: ["SYS-DF-P04"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: 対象。useSaveAction・useReadAction・FreshnessSync・RecordForm
- Backend/API: 対象。runAction・runRead と3つの書き込みの型 ／ 対象。/api/* の共通出口で private, no-store
- Database/Data: 対象。D1 の batch と、表 initial_credential_memos
- Infrastructure: N/A: この phase（implementation）は Infrastructure を変えない
- Security/Privacy: 対象。控えの AES-GCM と、パスワード変更時の他端末ログアウト、SECURITY-001 の監査
- Documentation: N/A: この phase（implementation）は Documentation を変えない

## Write scope と競合制約

- `touches`: `src/actions/`、`src/lib/`、`src/components/`、`src/db/`、`src/app/admin/`、`src/app/manager/`、`src/app/system/`、`src/app/globals.css`、`src/app/api/`、`worker.ts`、`wrangler.jsonc`、`next.config.ts`、`drizzle/migrations/0031_initial_credential_memos.sql`、`drizzle/migrations/0032_constitution_events_seq_unique.sql`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P05）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P05 の形で割り当てる
- worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- completion projection: 作業のブランチでは保留の記録だけを残し、既定のブランチ main へマージされた時点の reconciliation で done を書く

## GitHub publication

- Mode: local_only（追跡は Beads。GitHub の Issue は作らない）
- Project aliases: N/A: Beads に束ねるので GitHub Projects は使わない
- Issue labels/milestone: N/A: GitHub の Issue を作らないため
- Initial Project fields: N/A: GitHub Projects を使わないため
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Failure policy: 外部の失敗は対象の操作だけを pending_retry にし、ローカルの promote 済み task は戻さない
- Completion policy: linked_pr_merged_all
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P05` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P04）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P05 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm db:migrate:local
4. 検証のコマンドを実行する: pnpm typecheck
5. 検証のコマンドを実行する: pnpm test
6. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
7. /dev-graph worktree release SYS-DF-P05 で lease を返す

## 受入条件

- [ ] A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）
- [ ] A1: 成功した保存だけが1回描き直し、断られた保存は1行も書かず描き直さない
- [ ] A2: ログイン後の画面と /api/* の応答が private, no-store
- [ ] A3: 保存の知らせが他のタブに届き、送ったタブには届かない。取り直しは1.5秒に1回へ間引かれる
- [ ] A4: 会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない
- [ ] A5: 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない
- [ ] A6: 控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える
- [ ] A12: 発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・RecordForm.test.ts）
- [ ] A13: 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る
- [ ] A15: 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える
- [ ] A16: 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。応答に仮パスワードが無い（SECURITY-001）
- [ ] 会社・利用者・アンケートなど全ての作成・変更・削除が src/actions/ の runAction を通る
- [ ] 退避した22本の route.ts が src/app/api/ に残っておらず、それを呼ぶ画面の部品と試験が0件である

## 検証方法

- 自動検証: `pnpm db:migrate:local`、`pnpm typecheck`、`pnpm test`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: src/lib/action.test.ts、src/lib/freshness.test.ts、src/lib/compensation.test.ts、src/lib/credential-vault.test.ts、src/actions/companies.integration.test.ts、src/lib/masters/master-concurrent-save.integration.test.ts、src/actions/server-actions-contract.test.ts と src/lib/write-atomicity-contract.test.ts（P04 で赤だったものがこの phase で緑になる）

## リスクとロールバック

- リスク: 別の端末の画面へ保存を押し出すこと（W1） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: Worker を1つ前の版へ戻す（退避した経路もそこで戻る）。移行 0031 は表の追加、0032 は一意の索引の追加なので、前の版のコードと並べても壊れない。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P06、SYS-DF-P08
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: 対象。useSaveAction・useReadAction・FreshnessSync・RecordForm
- Backend: 対象。runAction・runRead と3つの書き込みの型
- API: 対象。/api/* の共通出口で private, no-store
- Data: 対象。D1 の batch と、表 initial_credential_memos
- Infrastructure: N/A: この phase（implementation）の責務に Infrastructure の変更は含まれない
- Security: 対象。控えの AES-GCM と、パスワード変更時の他端末ログアウト、SECURITY-001 の監査
- Quality: N/A: この phase（implementation）の責務に Quality の変更は含まれない
- Documentation: N/A: この phase（implementation）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（implementation）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）

## Verification and evidence

- コマンド: pnpm db:migrate:local
- コマンド: pnpm typecheck
- コマンド: pnpm test
- 証跡: src/lib/action.test.ts
- 証跡: src/lib/freshness.test.ts
- 証跡: src/lib/compensation.test.ts
- 証跡: src/lib/credential-vault.test.ts
- 証跡: src/actions/companies.integration.test.ts
- 証跡: src/lib/masters/master-concurrent-save.integration.test.ts
- 証跡: src/actions/server-actions-contract.test.ts と src/lib/write-atomicity-contract.test.ts（P04 で赤だったものがこの phase で緑になる）

## Rollout and rollback

- Rollout: 1つの Worker として配布する。移行 0031・0032 を先に当ててから Worker を差し替える（P13）。退避した経路はこの Worker から消える。
- Rollback: Worker を1つ前の版へ戻す（退避した経路もそこで戻る）。移行 0031 は表の追加、0032 は一意の索引の追加なので、前の版のコードと並べても壊れない。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-05-implementation.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

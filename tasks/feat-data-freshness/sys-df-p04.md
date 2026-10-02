---
graph_node_id: "SYS-DF-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "受入を先に試験の形にする（契約テストと画面の通し試験の設計）"
project_id: "feature-package-feat-data-freshness"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "test-design"]
file_path: "tasks/feat-data-freshness/sys-df-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P03"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["src/actions/server-actions-contract.test.ts", "src/lib/write-atomicity-contract.test.ts", "src/lib/action-origin.test.ts", "e2e/", "playwright.config.ts", "package.json", "pnpm-lock.yaml", ".gitignore", "eval-log/feat-data-freshness-test-design.json"]
purpose: "受入18項目を、実装の前に契約テスト（サーバーアクションの入口・書き込みの型・送信元の検査）と画面の通し試験（E2E 1〜6、パソコン・375px・768px）の形にして、実装が満たすべき線を先に固定する。この時点では実装が無いので、契約テストが期待どおり赤になることまでを確かめて記録する。"
goal: "受入を先に試験の形にする（契約テストと画面の通し試験の設計）。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["src/actions/server-actions-contract.test.ts（どのアクションも runAction か runRead を通る）", "src/lib/write-atomicity-contract.test.ts（別々の await で2つ以上の表を書く関数が無い）", "src/lib/action-origin.test.ts（別のサイト・ポート違いを、ログインを確かめる前に断る）", "e2e/data-freshness.spec.ts（E2E 1〜6）と、ログインの下準備 e2e/auth.setup.ts・e2e/support.ts、playwright.config.ts の LOCAL_HOSTS", "package.json の devDependencies に @playwright/test 1.63.0 と scripts の test:e2e を足し、next を 16.3.8 にそろえる（pnpm-lock.yaml も合わせて更新する）", ".gitignore に test-results・playwright-report・e2e/.auth の3行を足す（試験の生成物とログインの状態をコミットしない）", "eval-log/feat-data-freshness-test-design.json（実装前に契約テスト3本が赤になったことの記録）"]
scope_out: ["本番やローカル以外へ向けた E2E（LOCAL_HOSTS で止める）", "実装（P05）。この phase の時点では契約テストを緑にしない"]
acceptance: ["A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）", "A9: 成功の知らせが出た瞬間の画面に、新しい会社の行・1つ増えた件数・会社切替の選択肢がある（E2E 1。待機なし）", "A10: 作成直後のキャッシュを使わない再読み込みで新しい会社が出て、応答の x-generated-at が作成より後（E2E 2）", "A11: 他のタブ・画面復帰・戻る・bfcache の復元で、新しい会社が1秒以内に出る（E2E 3a・3b・4a・4b）", "A12: 発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・RecordForm.test.ts）", "A13: 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る", "A14: 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。allowedOrigins を足していない（action-origin.test.ts）", "A17: スマホ（375px）・タブレット（768px）の幅でも、E2E 1 と 5 が同じに通る（E2E 6-1・6-5）", "E2E 1〜6 が、ローカル以外の相手では始まらない", "実装の前に契約テスト3本が赤になったことが eval-log/feat-data-freshness-test-design.json に残っている"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P04（test-design）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.4", "linked_at": "2026-10-01T13:15:37Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 受入を先に試験の形にする（契約テストと画面の通し試験の設計）

## 目的

受入18項目を、実装の前に契約テスト（サーバーアクションの入口・書き込みの型・送信元の検査）と画面の通し試験（E2E 1〜6、パソコン・375px・768px）の形にして、実装が満たすべき線を先に固定する。この時点では実装が無いので、契約テストが期待どおり赤になることまでを確かめて記録する。

## 背景

画面ごとの直しでは、新しい画面を足したときに同じ漏れが戻る。入口と書き込みの型を契約テストで縛れば、漏れは試験の失敗として見える。契約テストは実装（P05 の src/lib/action.ts）を import するので、P05 より前は赤が正しい状態になる。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: specs/data-freshness.md、architecture/data-freshness.md
- 前提: 依存タスク（SYS-DF-P03）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: src/actions/server-actions-contract.test.ts（どのアクションも runAction か runRead を通る）
- 生成物: src/lib/write-atomicity-contract.test.ts（別々の await で2つ以上の表を書く関数が無い）
- 生成物: src/lib/action-origin.test.ts（別のサイト・ポート違いを、ログインを確かめる前に断る）
- 生成物: e2e/data-freshness.spec.ts（E2E 1〜6）と、ログインの下準備 e2e/auth.setup.ts・e2e/support.ts、playwright.config.ts の LOCAL_HOSTS
- 生成物: package.json の devDependencies に @playwright/test 1.63.0 と scripts の test:e2e を足し、next を 16.3.8 にそろえる（pnpm-lock.yaml も合わせて更新する）
- 生成物: .gitignore に test-results・playwright-report・e2e/.auth の3行を足す（試験の生成物とログインの状態をコミットしない）
- 生成物: eval-log/feat-data-freshness-test-design.json（実装前に契約テスト3本が赤になったことの記録）
- 更新対象: src/actions/server-actions-contract.test.ts、src/lib/write-atomicity-contract.test.ts、src/lib/action-origin.test.ts、e2e/、playwright.config.ts、package.json、pnpm-lock.yaml、.gitignore、eval-log/feat-data-freshness-test-design.json

## 依存関係

- `depends_on`: ["SYS-DF-P03"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: 対象。成功の知らせの瞬間の画面と、控えの畳み方を E2E で縛る
- Backend/API: 対象。入口と書き込みの型を契約テストで縛る
- Database/Data: N/A: この phase（test-design）は Database/Data を変えない
- Infrastructure: N/A: この phase（test-design）は Infrastructure を変えない
- Security/Privacy: 対象。送信元の検査の試験
- Documentation: N/A: この phase（test-design）は Documentation を変えない

## Write scope と競合制約

- `touches`: `src/actions/server-actions-contract.test.ts`、`src/lib/write-atomicity-contract.test.ts`、`src/lib/action-origin.test.ts`、`e2e/`、`playwright.config.ts`、`package.json`、`pnpm-lock.yaml`、`.gitignore`、`eval-log/feat-data-freshness-test-design.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P04）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P04 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P04` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P03）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P04 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm exec playwright test --list（E2E 1〜6 がパソコン・375px・768px の3つの幅で列挙される）
4. 検証のコマンドを実行する: pnpm vitest run src/actions/server-actions-contract.test.ts src/lib/write-atomicity-contract.test.ts src/lib/action-origin.test.ts（実装の前に回し、期待どおり赤になることを記録する）
5. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
6. /dev-graph worktree release SYS-DF-P04 で lease を返す

## 受入条件

- [ ] A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）
- [ ] A9: 成功の知らせが出た瞬間の画面に、新しい会社の行・1つ増えた件数・会社切替の選択肢がある（E2E 1。待機なし）
- [ ] A10: 作成直後のキャッシュを使わない再読み込みで新しい会社が出て、応答の x-generated-at が作成より後（E2E 2）
- [ ] A11: 他のタブ・画面復帰・戻る・bfcache の復元で、新しい会社が1秒以内に出る（E2E 3a・3b・4a・4b）
- [ ] A12: 発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・RecordForm.test.ts）
- [ ] A13: 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る
- [ ] A14: 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。allowedOrigins を足していない（action-origin.test.ts）
- [ ] A17: スマホ（375px）・タブレット（768px）の幅でも、E2E 1 と 5 が同じに通る（E2E 6-1・6-5）
- [ ] E2E 1〜6 が、ローカル以外の相手では始まらない
- [ ] 実装の前に契約テスト3本が赤になったことが eval-log/feat-data-freshness-test-design.json に残っている

## 検証方法

- 自動検証: `pnpm exec playwright test --list（E2E 1〜6 がパソコン・375px・768px の3つの幅で列挙される）`、`pnpm vitest run src/actions/server-actions-contract.test.ts src/lib/write-atomicity-contract.test.ts src/lib/action-origin.test.ts（実装の前に回し、期待どおり赤になることを記録する）`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feat-data-freshness-test-design.json（契約テスト3本の赤と、E2E の列挙の結果）、e2e/data-freshness.spec.ts、playwright.config.ts

## リスクとロールバック

- リスク: 本番やローカル以外へ向けた E2E（LOCAL_HOSTS で止める） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: 試験・playwright.config.ts・package.json の test:e2e と @playwright/test・.gitignore の3行を git revert で戻す。実装の契約を外すことになるので、P05 と同時にだけ戻す。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P05
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: 対象。成功の知らせの瞬間の画面と、控えの畳み方を E2E で縛る
- Backend: 対象。入口と書き込みの型を契約テストで縛る
- API: N/A: この phase（test-design）の責務に API の変更は含まれない
- Data: N/A: この phase（test-design）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（test-design）の責務に Infrastructure の変更は含まれない
- Security: 対象。送信元の検査の試験
- Quality: 対象。試験の設計そのもの
- Documentation: N/A: この phase（test-design）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（test-design）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）

## Verification and evidence

- コマンド: pnpm exec playwright test --list（E2E 1〜6 がパソコン・375px・768px の3つの幅で列挙される）
- コマンド: pnpm vitest run src/actions/server-actions-contract.test.ts src/lib/write-atomicity-contract.test.ts src/lib/action-origin.test.ts（実装の前に回し、期待どおり赤になることを記録する）
- 証跡: eval-log/feat-data-freshness-test-design.json（契約テスト3本の赤と、E2E の列挙の結果）
- 証跡: e2e/data-freshness.spec.ts
- 証跡: playwright.config.ts

## Rollout and rollback

- Rollout: 試験と試験の道具の追加なので、マージした時点で CI とローカルの試験に入る。契約テストは P05 と同じ変更の束で緑になる。
- Rollback: 試験・playwright.config.ts・package.json の test:e2e と @playwright/test・.gitignore の3行を git revert で戻す。実装の契約を外すことになるので、P05 と同時にだけ戻す。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-04-test-design.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

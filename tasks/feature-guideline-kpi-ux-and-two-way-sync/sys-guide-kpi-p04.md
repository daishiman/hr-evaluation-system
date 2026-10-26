---
graph_node_id: "SYS-GUIDE-KPI-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "テストを先に書く（移行・結合・サーバー処理・画面・契約・E2E・コントラスト）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p04", "test-first"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P03"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/db/behavior-band-default-migration.test.ts", "src/lib/domain/behavior-default-assignment.test.ts", "src/actions/behavior-default-company.integration.test.ts", "src/components/guideline-kpi-disclosure.test.ts", "e2e/guideline-kpi-screens.spec.ts", "src/actions/form-to-settings-sync.test.ts", "src/actions/settings-to-forms-sync.integration.test.ts", "src/lib/settings-copy-ledger.contract.test.ts", "e2e/settings-two-way-sync.spec.ts", "scripts/sample-data.test.mjs", "e2e/sample-open-cycle-evaluation.spec.ts", "src/lib/form-align.integration.test.ts", "src/components/component-classes.static.test.ts", "src/components/gradient-contrast.test.ts", "e2e/component-states.spec.ts", "src/actions/forms-save-questions.test.ts", "src/lib/domain/form-sync.test.ts"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.4", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: テストを先に書く（移行・結合・サーバー処理・画面・契約・E2E・コントラスト）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P04
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p04, test-first
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P04
- lifecycle_role: test-design
- workstream_kind: quality（secondary: backend, frontend, security）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P03
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- 受け入れ 10 件と、ずれた下書きをそろえる操作（src/lib/form-align.ts）を固めるテスト 15 件（新しいファイル 14 件と、既存の scripts/sample-data.test.mjs への追加 1 件）を、実装の前に書く。
- DD-015・DD-016 の前提（アンケートから設定へ戻さない・設定の保存で下書きを作り直さない）を固めている既存のテスト（src/actions/forms-save-questions.test.ts、src/lib/domain/form-sync.test.ts）の期待を、P02 の DD に合わせて改める。
- テーマの契約テスト（theme-contract・palette-contract・ui-rules・aidd-kit-boundary）は書き換えず、そのまま緑であることを確かめる。

## 背景

- P01 の対応表で、受け入れごとにテストの種類と置き場所が決まっている。
- 見本のアンケートは締切が過ぎていることがあり（form_deadline_extensions で開ける）、受付中の期の E2E は締切を流した日から数えるデータで書く。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P03
- Entry gate: P03 のレビューの記録がマージされている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: E2E の一部はデータに依存して揺れる（/system/users の管理者が溜まるなど）。新しい spec は見本の会社の中だけで閉じ、他の spec の数に依らないようにする

## Workstream applicability

- Frontend: 適用: 画面のテストと E2E（入口と 4 つの作業の画面・段階的な開示・部品の状態）を書く
- Backend: 適用: サーバー処理と結合のテスト（双方向の追従・断る保存・確定前の評価の集計し直し）を書く
- API: N/A: この段では API の成果物を作らない
- Data: 適用: 0040 の移行のテスト（書き換えた行の updated_at が移行の時刻であることを含む）・見本の生成のテスト・src/lib/form-align.integration.test.ts（sqlite-d1 の結合で、dry-run と本流しが実際に動くこと）を書く
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: アンケートからの反映と、ずれた下書きをそろえる操作が、管理者だけ・自社だけに効き、409 と制度の変更の記録を通ることをテストにする
- Quality: 適用: 新しいテストが正しい理由で赤であることを記録する
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: P01 の対応表と P02 の DD のテストの名前に従う。テストは src の中の vitest と e2e の Playwright に分け、テーマの契約テストには触れない
- Deploy unit/environment: N/A: テストだけ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: テストだけを足す。データの移行は無い

## 成果物

- Produced artifacts: テストファイル 15 件（src/db/behavior-band-default-migration.test.ts（移行（O25 の 1 件目）と、移行の後に会社が変えた割り当てを正として残すこと（I26）と、書き換える前の値が behavior_band_default_rewrites に残り、戻しの SQL が今の値が移行の書いた値のままの行だけを戻すこと）、src/lib/domain/behavior-default-assignment.test.ts（既定の割り当てと初期設定の説明の生成（O25 の 2 件目の単体））、src/actions/behavior-default-company.integration.test.ts（新しい会社が既定で始まる結合（O25 の 2 件目）: 雛形の会社（src/lib/template.ts の findTemplateCompany が返す is_template の会社）を 0040 の後の割り当てにして、copyCompanyMasters で作った会社が既定の割り当てで始まること）、src/components/guideline-kpi-disclosure.test.ts（初期表示の説明文の数・40 字・重複なしと、既定との違いの表示（O26 の 1 件目・O25 の 2 件目の画面））、e2e/guideline-kpi-screens.spec.ts（入口から 4 つの作業の画面・等級区分のカード・聞くことの 1 行ずつ・スマホとタブレットの幅（O26 の 2 件目）と、入口の「設定とずれた下書きのアンケート」の知らせから内容を見て、確認してそろえ、知らせが消えるまで（I30））、src/actions/form-to-settings-sync.test.ts（下書きのアンケートから設定への反映と、合わない保存を断ること（O27 の 1 件目））、src/actions/settings-to-forms-sync.integration.test.ts（設定の保存からアンケートと確定前の評価への追従（O27 の 2 件目））、src/lib/settings-copy-ledger.contract.test.ts（写しを持つ場所の一覧とコードの一致（O27 の 3 件目の契約））、e2e/settings-two-way-sync.spec.ts（保存の直後に関係する画面と他のタブが新しい内容で出ること（O27 の 3 件目・製品仕様 §27））、scripts/sample-data.test.mjs（見本の受付中の期・提出済みと下書きと未回答の混ざり・評価はまだ無い・見本の印・他社の行に触れない（O28。既存のファイルに足す））、e2e/sample-open-cycle-evaluation.spec.ts（手元の見本で提出済みの回答から評価を作り、評価の一覧と詳細まで進むこと（O28）と、見本でないデモの会社の管理者で開いた未回答の一覧と提出状況、全体管理者で見本でない会社へ切り替えて開いた未回答の一覧と提出状況のどちらにも、見本の人が本物の未回答者に混ざって出ないこと（会社の絞り込み。I31 の影響））、src/lib/form-align.integration.test.ts（ずれた下書きをそろえる操作の結合（sqlite-d1。src/test-support/sqlite-d1.ts の createTestDatabase と evaluation-fixture.ts の seedCompany・seedResponse）: 冪等性（本流しの後の 2 回目の dry-run が 0 件）・dry-run が書き込まないこと・下書きが新しければ設定へ、設定が新しければ下書きへ、と両方向で更新時刻の新しい方が勝つこと・締め切ったアンケートと確定した評価に触れないこと・見本の会社と他社の行を取り違えないこと・会社の管理者より下の権限は断られ、古い版からの保存は 409 になり、制度の変更の記録が残ること（I28・I29・I30））、src/components/component-classes.static.test.ts（共通部品が新しい部品クラスを使い TSX に色を書いていないこと（O29 の 1 件目））、src/components/gradient-contrast.test.ts（全ての系統と明暗のコントラスト・focus-visible・動きを止める設定・印刷・使えない状態・コントラストを強くする設定（O29 の 2 件目））、e2e/component-states.spec.ts（押す・選ぶ・開く部品の状態の見分けと、主要な画面の明暗の見た目の記録（O29 の 2 件目）））と、期待を改めた既存のテスト 2 件
- Consumed artifacts: docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md、docs/product/design-decisions.md、docs/product/settings-copy-ledger.md
- Write scope/touches: src/db/behavior-band-default-migration.test.ts, src/lib/domain/behavior-default-assignment.test.ts, src/actions/behavior-default-company.integration.test.ts, src/components/guideline-kpi-disclosure.test.ts, e2e/guideline-kpi-screens.spec.ts, src/actions/form-to-settings-sync.test.ts, src/actions/settings-to-forms-sync.integration.test.ts, src/lib/settings-copy-ledger.contract.test.ts, e2e/settings-two-way-sync.spec.ts, scripts/sample-data.test.mjs, e2e/sample-open-cycle-evaluation.spec.ts, src/lib/form-align.integration.test.ts, src/components/component-classes.static.test.ts, src/components/gradient-contrast.test.ts, e2e/component-states.spec.ts, src/actions/forms-save-questions.test.ts, src/lib/domain/form-sync.test.ts

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: P04 は PR を作らない。claim のブランチ devgraph/SYS-GUIDE-KPI-P04 でテストをコミットし、P05 はそのコミットを含めて devgraph/SYS-GUIDE-KPI-P05 から PR を 1 本出す（DD-020 の 6）。P04 の完了は P05 の PR のマージで、それまで Beads は in_progress のままコメントで状態を残す
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P04 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P04 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 実装（P05 の担当）
- 範囲の外を取り込まない: テーマの契約テスト（src/components/theme-contract.test.ts・src/components/palette-contract.test.ts・src/components/ui-rules.test.ts・scripts/aidd-kit-boundary.test.mjs）の書き換え

## Verification and evidence

- Acceptance: 受け入れ 10 件が、それぞれ 1 件以上のテストに対応している ／ 新しい vitest のテスト（E2E 以外の 11 件。新しいファイル 10 件と、既存の scripts/sample-data.test.mjs への追加 1 件）が正しい理由（未実装）で赤で、既存のテストは緑である ／ 見本でないデモの会社の管理者と、見本でない会社へ切り替えた全体管理者の、未回答の一覧と提出状況に見本の人が出ないことを確かめるテストがある ／ src/lib/form-align.integration.test.ts が、冪等性（2 回目の dry-run が 0 件）・dry-run が書かないこと・両方向で新しい方が勝つこと・締め切ったアンケートと確定した評価に触れないこと・見本の会社と他社の取り違えが無いこと・権限と 409 を確かめている ／ 新しい E2E の 4 本が Playwright に集められている（E2E は preview が要るので、この段では流さない） ／ テーマの契約テストのファイルに差分が無い
- Automated commands: pnpm vitest run（include は src/**/*.test.ts と scripts/**/*.test.mjs。新しいテストが赤である理由を記録し、既存のテストが緑であることを確かめる） ／ pnpm exec playwright test e2e/guideline-kpi-screens.spec.ts e2e/settings-two-way-sync.spec.ts e2e/sample-open-cycle-evaluation.spec.ts e2e/component-states.spec.ts --list（4 本が集められていることを確かめる） ／ git diff --stat 44a2e028c1b09d69a9933bee2c11f8e6e4e754c5 -- src/components/theme-contract.test.ts src/components/palette-contract.test.ts src/components/ui-rules.test.ts scripts/aidd-kit-boundary.test.mjs（起点の sha からの差分。出力が空）
- Required evidence: 赤のテストの一覧と理由、既存のテストの結果、playwright の --list の出力、git diff の出力

## Rollout and rollback

- Rollout: テストは P05 のブランチの最初のコミットに入れ、P04 の PR は作らない（DD-020 の 6。main に赤のテストだけを入れない）。完了の方針（linked_pr_merged_all）には P05 の PR を紐付け、マージまで Beads は in_progress のままコメントで状態を残す。claim のブランチは devgraph/SYS-GUIDE-KPI-P04 で、P05 はこのコミットを含めて PR を出す。P05 の PR のマージの後に P04 → P05 → P06 の順に close する
- Rollback trigger and steps: ロールバック: P05 のブランチのこのコミットを revert すればテストが消える。コードと DB は変わらない

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 15 件のテストがそろい、vitest の 11 件が正しい理由で赤で、E2E の 4 本が集められている
- 次に利用するノード: SYS-GUIDE-KPI-P05

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P03

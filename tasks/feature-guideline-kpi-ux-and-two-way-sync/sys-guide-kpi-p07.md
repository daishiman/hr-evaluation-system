---
graph_node_id: "SYS-GUIDE-KPI-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "受け入れ（O25〜O29 を preview で確かめる）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p07", "acceptance"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P06"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p07.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.7", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 受け入れ（O25〜O29 を preview で確かめる）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P07
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p07, acceptance
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P07
- lifecycle_role: acceptance
- workstream_kind: quality（secondary: frontend, security）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P06
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- preview で受け入れ 10 件を利用者の目で確かめ、結果を受領記録に書く。手元の見本で、提出済みの回答から評価を作り、評価の一覧と詳細まで進む。

## 背景

- P06 で全てのテストは緑だが、2 つの画面の読み量・カードの見やすさ・色の手応えは画面で見ないと決まらない。
- P05 の PR のマージで、コードと 0040 はすでに本番に出ている（DD-020 の 1・6）。受け入れは手元の preview と見本の会社で行い、本番のデータには触れない。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P06
- Entry gate: P05 の PR がマージされ、その Deploy workflow の実行が成功している（P06 の 6 つのコマンドは P05 の PR の上で緑）
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: preview のポートと .dev.vars の送り元が違うとログインが落ちる。8787 で起動し、送り元をそろえる。不合格が出たら、前へ進める PR で直す（P05 は本番に出ているので revert では 0040 が戻らない。0040 を戻すかは利用者が決め、P05 の rollback に従う）

## Workstream applicability

- Frontend: 適用: スマホ・タブレット・広い幅と、明暗と系統の切り替えで 2 つの画面と共通部品を見る
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: 管理者でない利用者がアンケートから設定を変えられないことを見る
- Quality: 適用: 受け入れ 10 件の結果を書く
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: N/A: 設計は変えない
- Deploy unit/environment: N/A: preview（ローカルの 8787）だけで確かめる。本番には出さない
- Compatibility/migration/backfill: N/A: データの移行は無い

## 成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md の受け入れの結果の節
- Consumed artifacts: P06 の結果、preview
- Write scope/touches: docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の前の段の完了（その段の PR のマージ。PR を作らない段は、紐付けた P05 の PR のマージ）を待って着手する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P07 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P07 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 本番での確認（P13 の担当）
- 範囲の外を取り込まない: 受け入れで見つけた新しい要望の実装（follow-up の候補として返す）

## Verification and evidence

- Acceptance: 受け入れ 10 件の全てに結果（合格・不合格と理由）がある ／ 提出済みの回答から評価を作り、評価の一覧と詳細まで進めた
- Automated commands: pnpm run preview（8787） ／ pnpm exec playwright test e2e/guideline-kpi-screens.spec.ts e2e/settings-two-way-sync.spec.ts e2e/sample-open-cycle-evaluation.spec.ts e2e/component-states.spec.ts（この feature の 4 本）
- Required evidence: 受領記録の受け入れの節、E2E の結果

## Rollout and rollback

- Rollout: 文書のコミットだけ。main へのマージで有効になる
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば受け入れの節が消える

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 受け入れ 10 件が全て合格である
- 次に利用するノード: SYS-GUIDE-KPI-P08

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P06

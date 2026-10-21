---
graph_node_id: "SYS-EVAL-REPORT-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "文書と運用（製品仕様・DD・公開の手順）"
project_id: "feature-package-feature-evaluation-report-and-raise-judgment"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["evaluation-report", "p12", "documentation", "operations"]
file_path: "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-20T00:08:11Z", "origin_kind": "system-dev-planner", "source_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "source_path": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-12-documentation-operations.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-20T00:08:11Z"
updated_at: "2026-10-20T00:08:11Z"
depends_on: ["SYS-EVAL-REPORT-P11"]
related_nodes: ["feature-evaluation-report-and-raise-judgment", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/spec.md", "docs/product/design-decisions.md", "docs/deploy-notes.md", "docs/product/backlog.md", "README.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-evaluation-report-and-raise-judgment"
feature_package_id: "feature-package/feature-evaluation-report-and-raise-judgment"
phase_ref: "P12"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p12.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-inn.12", "linked_at": "2026-10-20T02:41:20.053935Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-20T00:03:13Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 文書と運用（製品仕様・DD・公開の手順）

## Machine-readable registration fields

- id: SYS-EVAL-REPORT-P12
- feature_package_id: feature-package/feature-evaluation-report-and-raise-judgment
- owners: daishiman
- tags: evaluation-report, p12, documentation, operations
- related_nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-evaluation-report-and-raise-judgment
- phase_ref: P12
- lifecycle_role: documentation-sync
- workstream_kind: documentation（secondary: operations）
- build_target_kind: application-code
- depends_on: SYS-EVAL-REPORT-P11
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- 製品仕様（docs/product/spec.md）にレポート・上司の判断・見る権限の説明を足し、DD に実装で決まったことを足す。
- docs/deploy-notes.md に 2 回の Deploy の手順（0038 と 0039・backup・本番の読み取り）を書く。

## 背景

- P05 では今の説明から KGI を消しただけで、新しい機能の説明はまだ無い。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-EVAL-REPORT-P11
- Entry gate: P11 の証跡の節がマージされている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:b459beab111355c3b2d815db1360a4010e54eac5216a37f9a8ffd0ecb8d81775
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: system-spec の章は compile の経路だけで書く。ここで直接書き換えない

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: N/A: この段では Security の成果物を作らない
- Quality: N/A: この段では Quality の成果物を作らない
- Documentation: 適用: 製品仕様と DD を書く
- Operations: 適用: 公開の手順と戻し方を書く

## Architecture and deploy unit

- Architecture decisions: system-spec の章を変える必要が出たときは、run-system-spec-compile の経路で行い、この task では書かない
- Deploy unit/environment: N/A: 文書のみ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: 文書だけ

## 成果物

- Produced artifacts: docs/product/spec.md、docs/product/design-decisions.md、docs/deploy-notes.md、README.md の更新
- Consumed artifacts: P05〜P11 の結果
- Write scope/touches: docs/product/spec.md, docs/product/design-decisions.md, docs/deploy-notes.md, docs/product/backlog.md, README.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-EVAL-REPORT-P12 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-EVAL-REPORT-P12 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: system-spec の章を直接書き換えること
- 範囲の外を取り込まない: コードの変更

## Verification and evidence

- Acceptance: 製品仕様に新しい機能の説明があり、deploy-notes に 2 回の Deploy の手順と戻し方がある
- Automated commands: pnpm run check:docs
- Required evidence: 文書の path とコミットの sha、check:docs の出力

## Rollout and rollback

- Rollout: 文書のコミットだけ
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば文書の更新が消える

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 文書がマージされ、P13 の手順がそろっている
- 次に利用するノード: SYS-EVAL-REPORT-P13

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/feature-evaluation-report-and-raise-judgment.md、features/feature-evaluation-report-and-raise-judgment.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-EVAL-REPORT-P11

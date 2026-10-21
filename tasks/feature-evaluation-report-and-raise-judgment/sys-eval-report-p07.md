---
graph_node_id: "SYS-EVAL-REPORT-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "受け入れ（O17〜O24 を preview で確かめる）"
project_id: "feature-package-feature-evaluation-report-and-raise-judgment"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["evaluation-report", "p07", "acceptance"]
file_path: "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-20T00:08:11Z", "origin_kind": "system-dev-planner", "source_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "source_path": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-20T00:08:11Z"
updated_at: "2026-10-20T00:08:11Z"
depends_on: ["SYS-EVAL-REPORT-P06"]
related_nodes: ["feature-evaluation-report-and-raise-judgment", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/spec-receipts/2026-10-20-evaluation-report-and-raise-judgment.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-evaluation-report-and-raise-judgment"
feature_package_id: "feature-package/feature-evaluation-report-and-raise-judgment"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p07.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-inn.7", "linked_at": "2026-10-20T02:41:20.053935Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-20T00:03:13Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 受け入れ（O17〜O24 を preview で確かめる）

## Machine-readable registration fields

- id: SYS-EVAL-REPORT-P07
- feature_package_id: feature-package/feature-evaluation-report-and-raise-judgment
- owners: daishiman
- tags: evaluation-report, p07, acceptance
- related_nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-evaluation-report-and-raise-judgment
- phase_ref: P07
- lifecycle_role: acceptance
- workstream_kind: quality（secondary: frontend, security）
- build_target_kind: application-code
- depends_on: SYS-EVAL-REPORT-P06
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- 受け入れ 10 件のうち、本番の読み取り（O17 の 2 件目、P13 の担当）を除く 9 件を、preview（8787）と見本のデータで確かめる。
- 4 つの幅（375・768・1280・1600）と A4 縦の印刷で、図と表が途中で切れず、ナビとボタンが出ず、1 人分が 2 ページで 2 枚目が ⑤ から始まることを確かめる。

## 背景

- 自動のテストが通っても、印刷の改ページや暗い表示のときの刷り色は、目で確かめないと抜けやすい。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-EVAL-REPORT-P06
- Entry gate: P06 の 4 つのコマンドが緑である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:b459beab111355c3b2d815db1360a4010e54eac5216a37f9a8ffd0ecb8d81775
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: preview は build を挟まないと古い成果物を配る。ポートは .dev.vars の送り元と合わせる

## Workstream applicability

- Frontend: 適用: 4 つの幅と印刷を確かめる
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: 見る人の組ごとに、見える・404 を確かめる
- Quality: 適用: 受け入れ 9 件の判定を受領記録に書く
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: P01 の対応表の行ごとに、合格・不合格と確かめた手段を書く
- Deploy unit/environment: N/A: preview（ローカルの 8787）だけで確かめる。本番には出さない
- Compatibility/migration/backfill: N/A: データの移行は無い

## 成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-20-evaluation-report-and-raise-judgment.md の受け入れの結果の節
- Consumed artifacts: P06 の後の main、見本のデータ（シード）
- Write scope/touches: docs/product/spec-receipts/2026-10-20-evaluation-report-and-raise-judgment.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-EVAL-REPORT-P07 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-EVAL-REPORT-P07 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 本番 DB の確認（P13 の担当）
- 範囲の外を取り込まない: 実データでの確認

## Verification and evidence

- Acceptance: 受け入れ 9 件がすべて合格で、受領記録に判定と手段がある
- Automated commands: pnpm run preview ／ pnpm run test:e2e（印刷と 4 つの幅の spec）
- Required evidence: 受け入れの結果の表、見本のデータで刷った PDF のページ数

## Rollout and rollback

- Rollout: 受領記録のコミットだけ
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば受け入れの結果の節が消える

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 受け入れ 9 件が合格である
- 次に利用するノード: SYS-EVAL-REPORT-P08

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/feature-evaluation-report-and-raise-judgment.md、features/feature-evaluation-report-and-raise-judgment.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-EVAL-REPORT-P06

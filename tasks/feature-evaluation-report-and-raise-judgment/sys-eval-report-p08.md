---
graph_node_id: "SYS-EVAL-REPORT-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "KGI の表と列の削除（schema.ts と migration 0039）"
project_id: "feature-package-feature-evaluation-report-and-raise-judgment"
domain: "data"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["evaluation-report", "p08", "migration", "kgi-removal"]
file_path: "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-20T00:08:11Z", "origin_kind": "system-dev-planner", "source_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "source_path": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-20T00:08:11Z"
updated_at: "2026-10-20T00:08:11Z"
depends_on: ["SYS-EVAL-REPORT-P07"]
related_nodes: ["feature-evaluation-report-and-raise-judgment", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/db/schema.ts", "src/test-support/", "drizzle/migrations/", "drizzle/rollback/"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-evaluation-report-and-raise-judgment"
feature_package_id: "feature-package/feature-evaluation-report-and-raise-judgment"
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p08.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-inn.8", "linked_at": "2026-10-20T02:41:20.053935Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-20T00:03:13Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: KGI の表と列の削除（schema.ts と migration 0039）

## Machine-readable registration fields

- id: SYS-EVAL-REPORT-P08
- feature_package_id: feature-package/feature-evaluation-report-and-raise-judgment
- owners: daishiman
- tags: evaluation-report, p08, migration, kgi-removal
- related_nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-evaluation-report-and-raise-judgment
- phase_ref: P08
- lifecycle_role: audit
- workstream_kind: data（secondary: backend, quality）
- build_target_kind: application-code
- depends_on: SYS-EVAL-REPORT-P07
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- schema.ts から kgiCoefficients・officeKgiResults・officeKgiRevisions の表の定義と、evaluations の officeAchievementRate・kgiCoefficient を消す。
- migration 0039 でこの 3 つの表と 2 列を消し、drizzle/rollback に戻す SQL を置く。

## 背景

- 1 回目の Deploy で KGI を読み書きするコードは本番から消えている。表と列を消すのはその後にする。
- SQLite の ALTER TABLE DROP COLUMN は、索引や外部キーが付いた列を消せない。2 列には索引が無い（idx_kgi_company は kgi_coefficients の表の索引）。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-EVAL-REPORT-P07
- Entry gate: P07 の受け入れが合格で、P13 の 1 回目の Deploy に使う main の sha が決まっている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:b459beab111355c3b2d815db1360a4010e54eac5216a37f9a8ffd0ecb8d81775
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: このコミットを含む main を 1 回目の Deploy に使うと、0039 が先に当たる。P13 は P08 のマージより前の sha から 1 回目を出す

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: 適用: schema.ts とテストの支えから KGI の表の参照を消す
- API: N/A: この段では API の成果物を作らない
- Data: 適用: 0039 と戻す SQL を書き、ローカルで当てて戻せることを確かめる
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: N/A: この段では Security の成果物を作らない
- Quality: 適用: 全体のテストと型の検査を流す
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: 表と列の削除は 2 回目の Deploy だけで当てる。0039 は 1 回目より後に当てる前提で書く
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: 0039 を当てる前に pnpm db:backup を取る（P13）。戻すときは drizzle/rollback/0039 で空の表と NULL の列を作り直す。消した値は backup.sql から戻す

## 成果物

- Produced artifacts: schema.ts の変更、drizzle/migrations/0039_drop_office_kgi.sql、drizzle/rollback/0039_drop_office_kgi_rollback.sql
- Consumed artifacts: P07 の後の main
- Write scope/touches: src/db/schema.ts, src/test-support/, drizzle/migrations/, drizzle/rollback/

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-EVAL-REPORT-P08 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-EVAL-REPORT-P08 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 本番への適用（P13 の担当）
- 範囲の外を取り込まない: KGI に代わる仕組みを作ること

## Verification and evidence

- Acceptance: ローカルで 0039 を当てると 3 つの表と 2 列が無く、戻す SQL で作り直せる ／ pnpm test と typecheck が通る
- Automated commands: pnpm db:migrate:local ／ pnpm test ／ pnpm run typecheck
- Required evidence: ローカルの sqlite_master と PRAGMA table_info(evaluations) の出力（当てる前・後・戻した後）

## Rollout and rollback

- Rollout: main へのマージの後、P13 の 2 回目の Deploy で本番に出す
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば schema.ts と migration が戻る。本番に当てた後は drizzle/rollback/0039 と backup.sql で戻す

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 0039 を当てて戻すことをローカルで確かめた
- 次に利用するノード: SYS-EVAL-REPORT-P09

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/feature-evaluation-report-and-raise-judgment.md、features/feature-evaluation-report-and-raise-judgment.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-EVAL-REPORT-P07

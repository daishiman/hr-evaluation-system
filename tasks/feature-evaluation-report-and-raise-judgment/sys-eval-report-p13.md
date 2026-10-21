---
graph_node_id: "SYS-EVAL-REPORT-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "リリース（2 回の Deploy と本番 DB の読み取りでの確認）"
project_id: "feature-package-feature-evaluation-report-and-raise-judgment"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["evaluation-report", "p13", "release", "deploy"]
file_path: "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-20T00:08:11Z", "origin_kind": "system-dev-planner", "source_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "source_path": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-13-release-deploy.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-20T00:08:11Z"
updated_at: "2026-10-20T00:08:11Z"
depends_on: ["SYS-EVAL-REPORT-P12"]
related_nodes: ["feature-evaluation-report-and-raise-judgment", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/deploy-notes.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-evaluation-report-and-raise-judgment"
feature_package_id: "feature-package/feature-evaluation-report-and-raise-judgment"
phase_ref: "P13"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p13.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-inn.13", "linked_at": "2026-10-20T02:41:20.053935Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-20T00:03:13Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: リリース（2 回の Deploy と本番 DB の読み取りでの確認）

## Machine-readable registration fields

- id: SYS-EVAL-REPORT-P13
- feature_package_id: feature-package/feature-evaluation-report-and-raise-judgment
- owners: daishiman
- tags: evaluation-report, p13, release, deploy
- related_nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-evaluation-report-and-raise-judgment
- phase_ref: P13
- lifecycle_role: release
- workstream_kind: operations（secondary: quality, data）
- build_target_kind: application-code
- depends_on: SYS-EVAL-REPORT-P12
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- 1 回目の Deploy：P08 のマージより前の main の sha を、別の worktree から公開し、0038 を当てる。
- 2 回目の Deploy：pnpm db:backup を取ってから、P08 を含む main を公開し、0039 を当てる。
- 本番 DB を読み取りだけで確かめる（O17 の 2 件目）。

## 背景

- KGI の表を消す前に、表を読み書きするコードを本番から消す。共有の worktree には他の作業の未コミットのコードがあるので、公開は別の worktree から行う。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-EVAL-REPORT-P12
- Entry gate: P12 の文書がマージされ、利用者が公開を承認している
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:b459beab111355c3b2d815db1360a4010e54eac5216a37f9a8ffd0ecb8d81775
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: 公開は利用者に確かめてから行う
- Open risk: 本番 D1 に読めない（7403）ときは、権限を確かめてから読み取りをやり直す

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: 適用: 0038 と 0039 を本番に当て、当てる前に backup を取る
- Infrastructure: 適用: Cloudflare Worker と D1（hr-evaluation-db）に公開する
- Security: N/A: この段では Security の成果物を作らない
- Quality: 適用: 公開の後に本番 DB を読み取りで確かめる
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: 適用: 2 回の Deploy を行い、deploy-notes に記録する

## Architecture and deploy unit

- Architecture decisions: 1 回目と 2 回目の間で、本番が古いコードで 0039 を受けないようにする
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system と D1 hr-evaluation-db（本番）
- Compatibility/migration/backfill: 0039 の前に pnpm db:backup を取る。戻すときは drizzle/rollback/0039 と backup.sql を使い、1 回目の sha に戻す

## 成果物

- Produced artifacts: 本番の 2 回の公開、docs/deploy-notes.md の公開の記録、本番 DB の読み取りの結果
- Consumed artifacts: P08 のマージより前の main の sha、P12 の後の main、docs/deploy-notes.md の手順
- Write scope/touches: docs/deploy-notes.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-EVAL-REPORT-P13 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-EVAL-REPORT-P13 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 本番 DB へのシードの投入
- 範囲の外を取り込まない: 利用者の承認の無い公開

## Verification and evidence

- Acceptance: 本番 DB に KGI の 3 つの表と評価の 2 列が無いことを、読み取りで確かめた ／ 2 回の公開の sha と時刻が deploy-notes にある
- Automated commands: pnpm run deploy（1 回目は P08 のマージより前の sha の別の worktree から） ／ pnpm db:migrate:remote（1 回目は 0038、2 回目は 0039） ／ pnpm db:backup（2 回目の前） ／ wrangler d1 execute hr-evaluation-db --remote --command で sqlite_master と PRAGMA table_info(evaluations) を読む
- Required evidence: 公開の sha と時刻、本番 DB の読み取りの出力（表の名前と列の名前だけ）

## Rollout and rollback

- Rollout: 利用者に確かめてから、1 回目、2 回目の順に公開する
- Rollback trigger and steps: ロールバック: 2 回目に問題があれば backup.sql と drizzle/rollback/0039 で戻し、1 回目の sha を公開し直す。1 回目に問題があれば、前の公開の sha に戻す（0038 の列は残しても古いコードは動く）

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 本番 DB の読み取りで受け入れを確かめた
- 次に利用するノード: feature-evaluation-report-and-raise-judgment（13 task がすべて done で、P07・P10・P11 の証跡が受け入れを満たすときに done にする）

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/feature-evaluation-report-and-raise-judgment.md、features/feature-evaluation-report-and-raise-judgment.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-EVAL-REPORT-P12

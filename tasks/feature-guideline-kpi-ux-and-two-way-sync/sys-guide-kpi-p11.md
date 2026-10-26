---
graph_node_id: "SYS-GUIDE-KPI-P11"
artifact_kind: "task"
artifact_subtypes: []
title: "証跡（受け入れとテストと品質の結果をまとめる）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p11", "evidence"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p11.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-11-evidence.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P10"]
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
phase_ref: "P11"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p11.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.11", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 証跡（受け入れとテストと品質の結果をまとめる）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P11
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p11, evidence
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P11
- lifecycle_role: evidence
- workstream_kind: quality（secondary: documentation）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P10
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p11.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- 受け入れ 10 件ごとに、通ったテストの名前・コマンドの出力・見た目の記録の置き場を受領記録の証跡の節に 1 行ずつまとめる。

## 背景

- P06〜P10 の結果はばらばらの場所にある。リリースの後に、何で確かめたかを 1 か所で辿れるようにする。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P10
- Entry gate: P10 の最終のレビューで P13 の本番への書き込みを止める指摘が 0 件である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: 見た目の記録に本物のデータが写ると公開リポジトリに出てしまう。記録は手元の見本の会社の画面だけで、置き場は test-results/（.gitignore 済み）にする。証跡の節には置き場とファイル名だけを書き、画像はコミットしない

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: N/A: この段では Security の成果物を作らない
- Quality: 適用: 受け入れごとの証跡を 1 行ずつまとめる
- Documentation: 適用: 受領記録の証跡の節を書く
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: N/A: 設計は変えない
- Deploy unit/environment: N/A: 文書のみ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: データの移行は無い

## 成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md の証跡の節
- Consumed artifacts: P06〜P10 の結果
- Write scope/touches: docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の前の段の完了（その段の PR のマージ。PR を作らない段は、紐付けた P05 の PR のマージ）を待って着手する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P11 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P11 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 新しいテストの追加

## Verification and evidence

- Acceptance: 受け入れ 10 件の全てに証跡が 1 行以上ある ／ 証跡に本物の会社のデータが含まれていない
- Automated commands: pnpm run check:docs
- Required evidence: 受領記録の証跡の節

## Rollout and rollback

- Rollout: 文書のコミットだけ。main へのマージで有効になる
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば証跡の節が消える

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 証跡の節がそろっている
- 次に利用するノード: SYS-GUIDE-KPI-P12

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P10

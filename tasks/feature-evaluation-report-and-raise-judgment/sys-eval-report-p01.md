---
graph_node_id: "SYS-EVAL-REPORT-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "要件のベースライン（受け入れ 10 件とテスト・担当 phase の対応表）"
project_id: "feature-package-feature-evaluation-report-and-raise-judgment"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["evaluation-report", "p01", "requirements", "baseline"]
file_path: "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-20T00:08:11Z", "origin_kind": "system-dev-planner", "source_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "source_path": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-20T00:08:11Z"
updated_at: "2026-10-20T00:08:11Z"
depends_on: []
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
phase_ref: "P01"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p01.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-inn.1", "linked_at": "2026-10-20T02:41:20.053935Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-20T00:03:13Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 要件のベースライン（受け入れ 10 件とテスト・担当 phase の対応表）

## Machine-readable registration fields

- id: SYS-EVAL-REPORT-P01
- feature_package_id: feature-package/feature-evaluation-report-and-raise-judgment
- owners: daishiman
- tags: evaluation-report, p01, requirements, baseline
- related_nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-evaluation-report-and-raise-judgment
- phase_ref: P01
- lifecycle_role: preparation
- workstream_kind: documentation（secondary: quality）
- build_target_kind: application-code
- depends_on: なし（鎖の先頭）
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- feature の受け入れ 10 件（O17 が 2 件・O18 が 2 件・O19〜O24 が各 1 件）を、テストの種類・置き場所・確かめる phase に 1 行ずつ対応付けた基準表にする。
- 未決の事項（レポートの URL・migration の番号・テストファイル名と静的検査の除外の一覧）に、決める phase（P02）を付ける。

## 背景

- system-spec の G17〜G24・I18〜I25 は確定し、完成度の評価（eval-log/system-spec-completeness-2026-10-20-z.json）は PASS している。
- 受け入れは features/feature-evaluation-report-and-raise-judgment.context.json にあるが、何で確かめるかが決まっていない。先に 1 枚にそろえないと、P04 のテストと P07 の受け入れがずれる。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- Entry gate: feature の context.json の sha256 が 0c36bb81e9f554b7dd2d868d02894601d62b7aa246b24e851c046df34d70cee8 と一致し、system-spec の完成度の評価が PASS である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:b459beab111355c3b2d815db1360a4010e54eac5216a37f9a8ffd0ecb8d81775
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: 受け入れの文が長く、1 行に収めるときに条件を落としやすい。原文を引用して対応表の列に分ける

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: N/A: この段では Security の成果物を作らない
- Quality: 適用: 受け入れごとにテストの種類と置き場所を決める
- Documentation: 適用: 受領記録に対応表と範囲の外を書く
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: 受け入れと system-spec の章（ui-ux・frontend・backend・auth・security・database・infrastructure・maintenance-ops）の対応を表にする。設計の判断はしない（P02 の担当）
- Deploy unit/environment: N/A: 文書のみ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: 文書だけを足す。データの移行は無い

## 成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-20-evaluation-report-and-raise-judgment.md（受け入れの対応表・未決の事項と担当 phase・範囲の外）
- Consumed artifacts: features/feature-evaluation-report-and-raise-judgment.context.json、system-spec/index.md、specs/system-spec-requirements.md
- Write scope/touches: docs/product/spec-receipts/2026-10-20-evaluation-report-and-raise-judgment.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-EVAL-REPORT-P01 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-EVAL-REPORT-P01 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 設計の判断（関数の境界・URL・migration の中身）は P02 で行う
- 範囲の外を取り込まない: テストのコードは書かない（P04 の担当）

## Verification and evidence

- Acceptance: 受け入れ 10 件それぞれに、テストの種類（単体・結合・契約・静的・E2E・本番の読み取り）・置き場所・確かめる phase が 1 行ずつある ／ 未決の事項 3 件に担当 phase（P02）が付いている ／ context.json の scope_out 9 件が範囲の外として写されている
- Automated commands: pnpm run check:docs
- Required evidence: 受領記録の path とコミットの sha、check:docs の出力

## Rollout and rollback

- Rollout: 文書のコミットだけ。main へのマージで有効になる
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば受領記録が消える。コードと DB は変わらない

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 受領記録がマージされ、対応表の 10 行がそろっている
- 次に利用するノード: SYS-EVAL-REPORT-P02

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/feature-evaluation-report-and-raise-judgment.md、features/feature-evaluation-report-and-raise-judgment.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: なし

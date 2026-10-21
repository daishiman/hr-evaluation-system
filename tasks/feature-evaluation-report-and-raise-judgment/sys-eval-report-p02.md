---
graph_node_id: "SYS-EVAL-REPORT-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "設計（関数の境界・データの形・レポートの URL・migration の 2 段・依存関係の図）"
project_id: "feature-package-feature-evaluation-report-and-raise-judgment"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["evaluation-report", "p02", "design", "design-decision"]
file_path: "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-20T00:08:11Z", "origin_kind": "system-dev-planner", "source_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "source_path": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-20T00:08:11Z"
updated_at: "2026-10-20T00:08:11Z"
depends_on: ["SYS-EVAL-REPORT-P01"]
related_nodes: ["feature-evaluation-report-and-raise-judgment", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/design-decisions.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-evaluation-report-and-raise-judgment"
feature_package_id: "feature-package/feature-evaluation-report-and-raise-judgment"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p02.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-inn.2", "linked_at": "2026-10-20T02:41:20.053935Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-20T00:03:13Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 設計（関数の境界・データの形・レポートの URL・migration の 2 段・依存関係の図）

## Machine-readable registration fields

- id: SYS-EVAL-REPORT-P02
- feature_package_id: feature-package/feature-evaluation-report-and-raise-judgment
- owners: daishiman
- tags: evaluation-report, p02, design, design-decision
- related_nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-evaluation-report-and-raise-judgment
- phase_ref: P02
- lifecycle_role: preparation
- workstream_kind: documentation（secondary: backend, frontend, data）
- build_target_kind: application-code
- depends_on: SYS-EVAL-REPORT-P01
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- docs/product/design-decisions.md に新しい DD を足し、実装の前に境界と順序を固定する。
- 決めるもの：buildEvaluationReport・ReportTemplate・canViewEvaluationOf・canActOnEmployeeEvaluation・finalDecision・resolveSchemeForCycle・formTransitions の入出力、レポートの URL と台帳の行、migration の 2 段、依存関係の図、テストファイル名、静的検査の除外の一覧。

## 背景

- 評価セットの決め方が formSyncGaps・comparison-gap-loader・form-build・evaluate で別々にあり、アンケートの状態の規則も画面とサーバーで別々にある。
- KGI の 3 つの表と評価の 2 列は、読み書きの経路を先に消し（1 回目の Deploy）、表と列は後で消す（2 回目の Deploy）。この順序を設計で固定しないと、古いコードが消した列を読む。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-EVAL-REPORT-P01
- Entry gate: P01 の受領記録がマージされている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:b459beab111355c3b2d815db1360a4010e54eac5216a37f9a8ffd0ecb8d81775
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: レポートの URL を本人用と上司・管理者用で分けるかどうかで、台帳の行と権限の検査の数が変わる

## Workstream applicability

- Frontend: 適用: ReportTemplate の部品の分け方、レーダー図と棒グラフの切り替え（軸が 3 未満なら棒）、印刷の 2 枚組（2 枚目は ⑤ から）を決める
- Backend: 適用: buildEvaluationReport・finalDecision・resolveSchemeForCycle・formTransitions の入出力と置き場所を決める
- API: N/A: この段では API の成果物を作らない
- Data: 適用: migration 0038（判断の 6 列を NULL 可で足す）と 0039（KGI の 3 つの表と評価の 2 列を消す）の順序と、schema.ts の KGI の表の定義を P08 まで残すことを決める
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: canViewEvaluationOf の組（全体管理者・会社の管理者・直属の上司・本人・他の社員）と、本人向けに点数の数値を返さないことを決める
- Quality: N/A: この段では Quality の成果物を作らない
- Documentation: 適用: 新しい DD と依存関係の図（Mermaid）を書く
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: 評価セットは resolveSchemeForCycle の 1 つから得る。見る権限は canViewEvaluationOf、記録する権限は canActOnEmployeeEvaluation の 1 つずつにまとめる。最終の可否は列に保存せず finalDecision で出す
- Deploy unit/environment: N/A: 文書のみ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: 文書だけ。migration の中身を決めるが、ここでは当てない

## 成果物

- Produced artifacts: docs/product/design-decisions.md の新しい DD（関数の境界・データの形・URL・migration の 2 段・依存関係の図・テストファイル名・静的検査の除外の一覧）
- Consumed artifacts: docs/product/spec-receipts/2026-10-20-evaluation-report-and-raise-judgment.md、system-spec の各章、src/lib/domain/evaluation-authority.ts、src/lib/route-access.ts、system-spec/route-ledger.json
- Write scope/touches: docs/product/design-decisions.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-EVAL-REPORT-P02 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-EVAL-REPORT-P02 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: コードは書かない
- 範囲の外を取り込まない: 配色とテーマは決めない（DD-003 により対象外）

## Verification and evidence

- Acceptance: 新しい DD に、7 つの関数の入出力、レポートの URL と台帳の行、migration 0038 と 0039 の中身と順序がある ／ 依存関係の図に、resolveSchemeForCycle を使う 4 か所（ズレの比較・アンケートの作成・点数の計算・レポート）が描かれている ／ テストファイル名の一覧と静的検査の除外の一覧（spec-receipts・backlog-history・elegant-review・DD の履歴）が確定している
- Automated commands: pnpm run check:docs
- Required evidence: DD の節の path とコミットの sha、check:docs の出力

## Rollout and rollback

- Rollout: 文書のコミットだけ
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば DD が消える。コードと DB は変わらない

## Handoff

- Executor: task-graph build（application-code）
- Ready when: DD がマージされ、P03 のレビューの入力がそろっている
- 次に利用するノード: SYS-EVAL-REPORT-P03

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/feature-evaluation-report-and-raise-judgment.md、features/feature-evaluation-report-and-raise-judgment.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-EVAL-REPORT-P01

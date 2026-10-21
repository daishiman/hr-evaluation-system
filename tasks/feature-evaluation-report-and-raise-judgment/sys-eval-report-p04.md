---
graph_node_id: "SYS-EVAL-REPORT-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "テストを先に書く（単体・契約・静的・結合・E2E）"
project_id: "feature-package-feature-evaluation-report-and-raise-judgment"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["evaluation-report", "p04", "test-design", "tdd"]
file_path: "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-20T00:08:11Z", "origin_kind": "system-dev-planner", "source_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "source_path": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-20T00:08:11Z"
updated_at: "2026-10-20T00:08:11Z"
depends_on: ["SYS-EVAL-REPORT-P03"]
related_nodes: ["feature-evaluation-report-and-raise-judgment", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/lib/domain/final-decision.test.ts", "src/lib/domain/report.test.ts", "src/lib/domain/evaluation-authority.test.ts", "src/lib/domain/form-transitions.test.ts", "src/lib/domain/comparison-gap.test.ts", "src/lib/domain/bonus.test.ts", "src/lib/scheme-resolution.contract.test.ts", "src/lib/report-visibility.contract.test.ts", "src/lib/kgi-removal.static.test.ts", "src/actions/raise-decision.integration.test.ts", "src/actions/forms-transitions.integration.test.ts", "scripts/seed-idempotent.test.mjs", "e2e/evaluation-report.spec.ts", "e2e/report-print.spec.ts", "e2e/report-visibility.spec.ts", "e2e/raise-decision.spec.ts", "e2e/forms-audit.spec.ts"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-evaluation-report-and-raise-judgment"
feature_package_id: "feature-package/feature-evaluation-report-and-raise-judgment"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-inn.4", "linked_at": "2026-10-20T02:41:20.053935Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-20T00:03:13Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: テストを先に書く（単体・契約・静的・結合・E2E）

## Machine-readable registration fields

- id: SYS-EVAL-REPORT-P04
- feature_package_id: feature-package/feature-evaluation-report-and-raise-judgment
- owners: daishiman
- tags: evaluation-report, p04, test-design, tdd
- related_nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-evaluation-report-and-raise-judgment
- phase_ref: P04
- lifecycle_role: test-design
- workstream_kind: quality（secondary: backend, frontend, security）
- build_target_kind: application-code
- depends_on: SYS-EVAL-REPORT-P03
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- 受け入れ 10 件それぞれを、P02 の DD で確定したテストファイルで先に表す。
- 新しいテストが『関数が無い』『KGI が残っている』という正しい理由で赤になることを確かめる。

## 背景

- finalDecision の 5 通り（可→見送り・否→認める・判定どおり（可）・判定どおり（否）・判断の記録なしの古い確定）や、見る権限の組は、テストで先に固定しないと実装の都合で崩れやすい。
- domain のカバレッジは vitest.config.ts の CALC_FILES で 100% に保っている。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-EVAL-REPORT-P03
- Entry gate: P03 の受領記録がマージされ、直すと判定した指摘が残っていない
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:b459beab111355c3b2d815db1360a4010e54eac5216a37f9a8ffd0ecb8d81775
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: E2E は見本のデータ（シード）に頼るので、シードの形が P05 で決まるまで一部の待ち合わせが仮になる

## Workstream applicability

- Frontend: 適用: レポートの図・印刷・4 つの幅の E2E を書く
- Backend: 適用: finalDecision・buildEvaluationReport・formTransitions・resolveSchemeForCycle の単体と結合のテストを書く
- API: N/A: この段では API の成果物を作らない
- Data: 適用: シードを 2 回流しても結果が同じになるテストを書く
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: 見る・404 の組の結合テストと、本人向けの応答に点数のキーが無い契約テストを書く
- Quality: 適用: 受け入れとテストの対応を受領記録の対応表と一致させる
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: テストは DD のファイル名の一覧どおりに置く。静的検査は src・route-ledger・nav・今の説明の文書を見て、過去の記録（DD の除外の一覧）を除く
- Deploy unit/environment: N/A: テストだけ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: テストを足すだけ

## 成果物

- Produced artifacts: テストファイル 17 件（src/lib/domain/final-decision.test.ts、src/lib/domain/report.test.ts、src/lib/domain/evaluation-authority.test.ts、src/lib/domain/form-transitions.test.ts、src/lib/domain/comparison-gap.test.ts、src/lib/domain/bonus.test.ts、src/lib/scheme-resolution.contract.test.ts、src/lib/report-visibility.contract.test.ts、src/lib/kgi-removal.static.test.ts、src/actions/raise-decision.integration.test.ts、src/actions/forms-transitions.integration.test.ts、scripts/seed-idempotent.test.mjs、e2e/evaluation-report.spec.ts、e2e/report-print.spec.ts、e2e/report-visibility.spec.ts、e2e/raise-decision.spec.ts、e2e/forms-audit.spec.ts）
- Consumed artifacts: docs/product/design-decisions.md の新しい DD、docs/product/spec-receipts/2026-10-20-evaluation-report-and-raise-judgment.md
- Write scope/touches: src/lib/domain/final-decision.test.ts, src/lib/domain/report.test.ts, src/lib/domain/evaluation-authority.test.ts, src/lib/domain/form-transitions.test.ts, src/lib/domain/comparison-gap.test.ts, src/lib/domain/bonus.test.ts, src/lib/scheme-resolution.contract.test.ts, src/lib/report-visibility.contract.test.ts, src/lib/kgi-removal.static.test.ts, src/actions/raise-decision.integration.test.ts, src/actions/forms-transitions.integration.test.ts, scripts/seed-idempotent.test.mjs, e2e/evaluation-report.spec.ts, e2e/report-print.spec.ts, e2e/report-visibility.spec.ts, e2e/raise-decision.spec.ts, e2e/forms-audit.spec.ts

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-EVAL-REPORT-P04 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-EVAL-REPORT-P04 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 実装は書かない（P05 の担当）
- 範囲の外を取り込まない: テストに実データ（社員名・評価値）を入れない

## Verification and evidence

- Acceptance: 受け入れ 10 件のそれぞれに、少なくとも 1 つのテストが対応している ／ 新しいテストが正しい理由で赤になり、既存のテストは緑のままである ／ テストのデータは見本の名前と値だけである
- Automated commands: pnpm vitest run（新しいテストが赤である理由を記録し、既存のテストが緑であることを確かめる）
- Required evidence: 赤になったテストの一覧と理由、既存のテストの結果

## Rollout and rollback

- Rollout: P04 の PR は P05 の PR の土台にし、P05 で緑になってから P04、P05 の順に続けてマージする（main に赤のテストだけを入れない）
- Rollback trigger and steps: ロールバック: この段のコミットを revert すればテストが消える。実装と DB は変わらない

## Handoff

- Executor: task-graph build（application-code）
- Ready when: テストが DD の一覧どおりにそろい、P05 の PR の土台になっている
- 次に利用するノード: SYS-EVAL-REPORT-P05

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/feature-evaluation-report-and-raise-judgment.md、features/feature-evaluation-report-and-raise-judgment.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-EVAL-REPORT-P03

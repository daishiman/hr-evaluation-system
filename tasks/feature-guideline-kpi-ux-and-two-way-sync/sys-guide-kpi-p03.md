---
graph_node_id: "SYS-GUIDE-KPI-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "設計のレビュー（DD と写しの一覧を要件と既存の決めに照らす）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p03", "design-review"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P02"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/spec-receipts/2026-10-22-guideline-kpi-design-review.md", "docs/product/design-decisions.md", "docs/product/settings-copy-ledger.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p03.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.3", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 設計のレビュー（DD と写しの一覧を要件と既存の決めに照らす）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P03
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p03, design-review
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P03
- lifecycle_role: design-review
- workstream_kind: quality（secondary: security, documentation）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P02
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- P02 の DD と写しの一覧を、G25〜G29・I26〜I33、既存の DD（DD-003・DD-010・DD-015・DD-016・DD-025）、製品仕様（§14・§22・§27）、AGENTS.md の配色とテーマの規範に照らして読み、食い違いと抜けを指摘して直させる。
- レビューの観点を 5 つに絞る: 確定した時点の写しを変えない / 断る保存が直す画面を示す / 新しい色のトークンを足さずテーマの契約テストを書き換えない / 見本が本物の会社の行に触れない / アンケートからの反映が設定の保存と同じ権限を通る。

## 背景

- 双方向の追従は、確定した評価・評価レポート・締め切ったアンケートを変えないことが要で、抜けると過去の結果が変わる。
- 配色は DD-003 で平賀配色へ移さないと決めており、グラデーションは既存の意味のトークンから作る。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P02
- Entry gate: P02 の DD と写しの一覧がマージされている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: 写しの一覧の抜けはコードを読まないと見えない。src のコードは drizzle の camelCase で列を読み、snake_case は schema.ts などにしか出ないので、両方で grep し、当たったファイルを一覧の分類と突き合わせる。手がかりは写しの列（scoring_mode_snapshot・required_kpi_points_snapshot・required_behavior_points_snapshot・options_json・question_options_json・scoringModeSnapshot・requiredKpiPointsSnapshot・requiredBehaviorPointsSnapshot・optionsJson・questionOptionsJson）と追従の関数（diffFormKpiItems・effectiveAskedItems・staleAskingItems）で、置き場は src/db/schema.ts・src/lib/domain/form-sync.ts・src/lib/form-build.ts・src/actions/forms.ts から始める。value_json（valueJson）は回答の値で設定の写しではないので、式から外す

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: 権限・会社の絞り込み・見本の書き込みの範囲の抜けを見る
- Quality: 適用: 観点ごとの結論をレビューの記録に書く
- Documentation: 適用: 指摘を DD と写しの一覧に反映させる
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: 観点 5 つに照らして DD を読む。設計そのものは変えず、食い違いは P02 の DD を直して閉じる
- Deploy unit/environment: N/A: 文書のみ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: 文書だけを足す。データの移行は無い

## 成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-22-guideline-kpi-design-review.md（観点ごとの結論・指摘と反映の記録・写しの数の突き合わせ）
- Consumed artifacts: docs/product/design-decisions.md、docs/product/settings-copy-ledger.md、docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md、AGENTS.md
- Write scope/touches: docs/product/spec-receipts/2026-10-22-guideline-kpi-design-review.md, docs/product/design-decisions.md, docs/product/settings-copy-ledger.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の前の段の完了（その段の PR のマージ。PR を作らない段は、紐付けた P05 の PR のマージ）を待って着手する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P03 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P03 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: テストと実装（P04 以降）
- 範囲の外を取り込まない: 新しい要件の追加（system-spec の外の変更は follow-up の候補として返す）

## Verification and evidence

- Acceptance: 観点 5 つそれぞれに結論がある ／ 指摘が全て DD か写しの一覧に反映されたか、見送りの理由がある ／ grep で当たったファイルごとに、参照・追従・確定した時点の写しのどれかに分類済みで、未分類が 0 件である ／ value_json（valueJson）を式から外した理由（回答の値で設定の写しではない）が記録にある
- Automated commands: pnpm run check:docs ／ grep -rln -E "scoring_mode_snapshot|required_kpi_points_snapshot|required_behavior_points_snapshot|options_json|question_options_json|scoringModeSnapshot|requiredKpiPointsSnapshot|requiredBehaviorPointsSnapshot|optionsJson|questionOptionsJson" src（写しの列が出るファイル。式と、ファイルごとの分類を記録に残す） ／ grep -rn -E "diffFormKpiItems|effectiveAskedItems|staleAskingItems" src（追従の関数の呼び出し元。式と件数を記録に残す）
- Required evidence: レビューの記録の path、grep の式と、当たったファイルごとの分類、反映のコミットの sha

## Rollout and rollback

- Rollout: 文書のコミットだけ。main へのマージで有効になる
- Rollback trigger and steps: ロールバック: この段のコミットを revert すればレビューの記録が消える。コードと DB は変わらない

## Handoff

- Executor: task-graph build（application-code）
- Ready when: レビューの記録がマージされ、未反映の指摘が 0 件である
- 次に利用するノード: SYS-GUIDE-KPI-P04

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P02

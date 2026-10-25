---
graph_node_id: "SYS-GUIDE-KPI-P09"
artifact_kind: "task"
artifact_subtypes: []
title: "品質（テーマの契約・コントラスト・a11y・動き・印刷・明暗の記録・bundle）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p09", "quality", "theme-contract"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p09.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-09-quality-assurance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P08"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/app/globals.css", "src/components/", "docs/product/design-decisions.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P09"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p09.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.9", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 品質（テーマの契約・コントラスト・a11y・動き・印刷・明暗の記録・bundle）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P09
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p09, quality, theme-contract
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P09
- lifecycle_role: quality-assurance
- workstream_kind: quality（secondary: security, frontend）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P08
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- テーマの契約テスト（src/components/theme-contract.test.ts・src/components/palette-contract.test.ts・src/components/ui-rules.test.ts・scripts/aidd-kit-boundary.test.mjs）が書き換えなしで緑で、globals.css 冒頭の brand_color_* の宣言に差分が無いことを確かめる。
- 全ての系統と明暗で、グラデーションの両端と文字の色の比が 4.5:1 以上（大きな文字と部品の縁は 3:1 以上）、focus-visible の印が見える、動きを止める設定で動きが止まり、印刷・使えない状態・コントラストを強くする設定で平らな面に戻ることを確かめる。
- 押せる面が 44px 四方以上で、1 つの面で主の操作が 1 つであることと、bundle の大きさと Cloudflare の build を確かめ、主要な画面の明暗の見た目を記録する。

## 背景

- 配色は DD-003 で平賀配色へ移さないと決めており、AGENTS.md は移行のための契約テストの書き換えを禁じている。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P08
- Entry gate: P08 の片付けがマージできる状態で、全てのテストが緑である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: グラデーションは系統ごとに両端の色が違い、暗い表示で比が足りなくなりやすい。全ての系統と明暗の組を表で確かめる

## Workstream applicability

- Frontend: 適用: 足りない比や見えない印を、部品クラスの最小の修正で直す
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: 見た目の記録は手元の preview の見本の会社だけで撮り、本物の会社のデータが写らないことを確かめる。記録はコミットしない（Public）
- Quality: 適用: テーマの契約・コントラスト・a11y・動き・印刷・bundle・build を確かめて記録する
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: N/A: 設計は変えない。修正は既存の意味のトークンと color-mix の範囲に収める
- Deploy unit/environment: N/A: build と preview（ローカルの 8787）での確認だけ。本番には出さない
- Compatibility/migration/backfill: N/A: データの移行は無い

## 成果物

- Produced artifacts: 品質の確認の結果、主要な画面の明暗の見た目の記録（test-results/ の画像。コミットしない）、最小の修正のコミット
- Consumed artifacts: P08 までのコード、テーマの契約テスト
- Write scope/touches: src/app/globals.css, src/components/, docs/product/design-decisions.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の前の段の完了（その段の PR のマージ。PR を作らない段は、紐付けた P05 の PR のマージ）を待って着手する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P09 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P09 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 平賀配色への移行と新しい色のトークンの追加
- 範囲の外を取り込まない: テーマの契約テストの書き換え
- 範囲の外を取り込まない: toHaveScreenshot の基準画像（e2e/ の下の -snapshots）を作ってコミットすること

## Verification and evidence

- Acceptance: テーマの契約テストが書き換えなしで緑である ／ globals.css 冒頭の brand_color_* の宣言と契約テストに、起点の sha 44a2e028c1b09d69a9933bee2c11f8e6e4e754c5 からの差分が無い ／ 全ての系統と明暗でコントラストの比が基準を満たす ／ 主要な画面の明暗の見た目が、手元の見本の会社で page.screenshot により test-results/（.gitignore 済み）へ記録されている ／ git status に見た目の画像が出ない ／ check:bundle-size と cf:dry-run が通る
- Automated commands: pnpm run check:bundle-size ／ pnpm run cf:dry-run ／ pnpm vitest run src/components/theme-contract.test.ts src/components/palette-contract.test.ts src/components/ui-rules.test.ts scripts/aidd-kit-boundary.test.mjs src/components/gradient-contrast.test.ts src/components/component-classes.static.test.ts ／ pnpm exec playwright test e2e/component-states.spec.ts（preview の 8787 の見本の会社で、page.screenshot で test-results/ へ明暗の見た目を書く） ／ test "$(git show 44a2e028c1b09d69a9933bee2c11f8e6e4e754c5:src/app/globals.css | awk 'NR==1,/= \*\/$/')" = "$(awk 'NR==1,/= \*\/$/' src/app/globals.css)"（終了コード 0。1 行目から冒頭の宣言のブロックの終わりまでが起点と同じ） ／ git diff --stat 44a2e028c1b09d69a9933bee2c11f8e6e4e754c5 -- src/components/theme-contract.test.ts src/components/palette-contract.test.ts src/components/ui-rules.test.ts scripts/aidd-kit-boundary.test.mjs（起点の sha からの差分。出力が空） ／ git status --short（画像が出ないこと）
- Required evidence: 各コマンドの出力、系統と明暗のコントラストの表、見た目の記録の置き場（test-results/ の下のファイル名だけ。画像はコミットしない）

## Rollout and rollback

- Rollout: 修正のコミットだけ。main へのマージで有効になる
- Rollback trigger and steps: ロールバック: この段の修正のコミットを revert する

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 品質の確認が全て通り、記録がそろっている
- 次に利用するノード: SYS-GUIDE-KPI-P10

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P08

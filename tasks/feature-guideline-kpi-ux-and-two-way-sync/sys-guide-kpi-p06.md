---
graph_node_id: "SYS-GUIDE-KPI-P06"
artifact_kind: "task"
artifact_subtypes: []
title: "テストの実行（単体・型・カバレッジ・E2E）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p06", "test-run"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p06.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-06-test-run.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P05"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/app/admin/behavior/", "src/app/admin/scheme/", "src/app/admin/masters/", "src/app/admin/forms/", "src/app/admin/setup/page.tsx", "src/app/admin/AdminDashboard.tsx", "src/app/admin/cycles/page.tsx", "src/app/manager/cycles/", "src/app/globals.css", "src/actions/scheme.ts", "src/actions/masters.ts", "src/actions/forms.ts", "src/actions/evaluations.ts", "src/lib/domain/", "src/lib/masters/", "src/lib/form-build.ts", "src/lib/template.ts", "src/lib/freshness.ts", "src/lib/nav.ts", "src/lib/route-access.ts", "src/lib/permission-rows.ts", "src/lib/use-refresh.ts", "src/lib/stale-asking-loader.ts", "src/components/", "src/db/schema.ts", "src/test-support/", "drizzle/migrations/0040_behavior_band_defaults.sql", "drizzle/rollback/0040_behavior_band_defaults_rollback.sql", "src/lib/form-align.ts", "src/actions/form-align.ts", "scripts/sample-data.mjs", "scripts/seed-data.mjs", "scripts/seed-sample.mjs", "scripts/seed.mjs", "drizzle/seed.sql", "system-spec/route-ledger.json", "system-spec/routes-and-access.md", "docs/product/settings-copy-ledger.md", "docs/deploy-notes.md", "docs/product/design-decisions.md", "src/db/behavior-band-default-migration.test.ts", "src/lib/domain/behavior-default-assignment.test.ts", "src/actions/behavior-default-company.integration.test.ts", "src/components/guideline-kpi-disclosure.test.ts", "e2e/guideline-kpi-screens.spec.ts", "src/actions/form-to-settings-sync.test.ts", "src/actions/settings-to-forms-sync.integration.test.ts", "src/lib/settings-copy-ledger.contract.test.ts", "e2e/settings-two-way-sync.spec.ts", "scripts/sample-data.test.mjs", "e2e/sample-open-cycle-evaluation.spec.ts", "src/lib/form-align.integration.test.ts", "src/components/component-classes.static.test.ts", "src/components/gradient-contrast.test.ts", "e2e/component-states.spec.ts", "src/actions/forms-save-questions.test.ts", "src/lib/domain/form-sync.test.ts"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P06"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p06.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.6", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: テストの実行（単体・型・カバレッジ・E2E）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P06
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p06, test-run
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P06
- lifecycle_role: test-run
- workstream_kind: quality（secondary: backend, frontend）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P05
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p06.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- P05 の PR の上で、全てのテスト・型の検査・カバレッジ・E2E・Cloudflare の build・bundle の大きさの 6 つを流し、落ちたものを最小の修正で直す。直しは P05 のブランチにコミットする（DD-020 の 6）。

## 背景

- P05 で P04 のテストは緑になったが、既存のテストと E2E の全体はまだ流していない。網羅率は全てのテストが通らないと判定されない。
- P05 の PR のマージで Deploy workflow が 0040 を本番に当てて配るので、6 つはマージの前に P05 の PR の上で緑にする。P06 だけの PR を作ると、緑でないコードが先に main に入る。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P05
- Entry gate: P05 の PR があり、P04 のテストが緑である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: E2E の途中で preview が止まると接続拒否が続く。preview を起動し直して全体を流し直す。E2E のブラウザの置き場は PLAYWRIGHT_BROWSERS_PATH で指す

## Workstream applicability

- Frontend: 適用: 画面と E2E の落ちを直す
- Backend: 適用: サーバー処理と結合のテストの落ちを直す
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: 適用: Cloudflare の build（cf:dry-run）と bundle の大きさを確かめる
- Security: N/A: この段では Security の成果物を作らない
- Quality: 適用: 6 つのコマンドを流して結果を記録する
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: N/A: 設計は変えない。落ちの修正は P02 の DD の範囲に収める
- Deploy unit/environment: N/A: テストの実行と build の確認だけ。本番には出さない（配るのは P05 の PR のマージで動く Deploy workflow）
- Compatibility/migration/backfill: N/A: データの移行は無い

## 成果物

- Produced artifacts: P05 の PR の上の 6 つのコマンドの結果と、P05 のブランチへの最小の修正のコミット
- Consumed artifacts: P04 のテスト、P05 の実装と PR
- Write scope/touches: src/app/admin/behavior/, src/app/admin/scheme/, src/app/admin/masters/, src/app/admin/forms/, src/app/admin/setup/page.tsx, src/app/admin/AdminDashboard.tsx, src/app/admin/cycles/page.tsx, src/app/manager/cycles/, src/app/globals.css, src/actions/scheme.ts, src/actions/masters.ts, src/actions/forms.ts, src/actions/evaluations.ts, src/lib/domain/, src/lib/masters/, src/lib/form-build.ts, src/lib/template.ts, src/lib/freshness.ts, src/lib/nav.ts, src/lib/route-access.ts, src/lib/permission-rows.ts, src/lib/use-refresh.ts, src/lib/stale-asking-loader.ts, src/components/, src/db/schema.ts, src/test-support/, drizzle/migrations/0040_behavior_band_defaults.sql, drizzle/rollback/0040_behavior_band_defaults_rollback.sql, src/lib/form-align.ts, src/actions/form-align.ts, scripts/sample-data.mjs, scripts/seed-data.mjs, scripts/seed-sample.mjs, scripts/seed.mjs, drizzle/seed.sql, system-spec/route-ledger.json, system-spec/routes-and-access.md, docs/product/settings-copy-ledger.md, docs/deploy-notes.md, docs/product/design-decisions.md, src/db/behavior-band-default-migration.test.ts, src/lib/domain/behavior-default-assignment.test.ts, src/actions/behavior-default-company.integration.test.ts, src/components/guideline-kpi-disclosure.test.ts, e2e/guideline-kpi-screens.spec.ts, src/actions/form-to-settings-sync.test.ts, src/actions/settings-to-forms-sync.integration.test.ts, src/lib/settings-copy-ledger.contract.test.ts, e2e/settings-two-way-sync.spec.ts, scripts/sample-data.test.mjs, e2e/sample-open-cycle-evaluation.spec.ts, src/lib/form-align.integration.test.ts, src/components/component-classes.static.test.ts, src/components/gradient-contrast.test.ts, e2e/component-states.spec.ts, src/actions/forms-save-questions.test.ts, src/lib/domain/form-sync.test.ts

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の P05 は、P05 の PR があること（マージの前）を指す。P06 の直しは P05 のブランチへ取り込み、P06 の PR は作らない。止められたときは P05 と同じく --force をせず利用者の判断を仰ぎ、P05 の PR のマージの後に P05 の次に close する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P06 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P06 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 新しい機能の追加
- 範囲の外を取り込まない: テーマの契約テストの書き換え
- 範囲の外を取り込まない: P06 だけの PR を作ること
- 範囲の外を取り込まない: P05 と P04 の write_scope の外のファイルの変更（必要になったら P05 へ戻し、P02 の DD に理由を足す）

## Verification and evidence

- Acceptance: P05 の PR の上で pnpm test・pnpm run typecheck・pnpm run test:coverage・pnpm run test:e2e・pnpm run cf:dry-run・pnpm run check:bundle-size が全て緑である ／ カバレッジが既存の閾値を下回らない
- Automated commands: pnpm test ／ pnpm run typecheck ／ pnpm run test:coverage ／ pnpm run test:e2e ／ pnpm run cf:dry-run ／ pnpm run check:bundle-size
- Required evidence: 6 つのコマンドの出力、流した P05 のブランチの sha、修正のコミットの sha

## Rollout and rollback

- Rollout: 直しは claim のブランチ devgraph/SYS-GUIDE-KPI-P06 を P05 のブランチから切って作り、P05 のブランチへ取り込んで P05 の PR に載せる。P06 の PR は作らない。P05 の PR の上で 6 つが緑であることを確かめ、完了の方針（linked_pr_merged_all）には P05 の PR を紐付け、マージまで Beads は in_progress のままコメントで状態を残す。マージの後に P05 の次に close する
- Rollback trigger and steps: ロールバック: P05 のブランチの直しのコミットを revert する。コードの本体は P05 のまま

## Handoff

- Executor: task-graph build（application-code）
- Ready when: P05 の PR の上で 6 つのコマンドが全て緑である
- 次に利用するノード: SYS-GUIDE-KPI-P07

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P05

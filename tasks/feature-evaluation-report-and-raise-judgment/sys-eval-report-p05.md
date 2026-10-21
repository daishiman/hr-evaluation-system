---
graph_node_id: "SYS-EVAL-REPORT-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "実装（KGI の読み書きの削除・レポート・見る権限・シード・アンケート・ズレ・評価セット・上司の判断）"
project_id: "feature-package-feature-evaluation-report-and-raise-judgment"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["evaluation-report", "p05", "implementation", "mutation"]
file_path: "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-20T00:08:11Z", "origin_kind": "system-dev-planner", "source_digest": "63fee52af84f27bd7073e7c344d2d190a20cb0c42e7dcbcc8cc4f4c308be75c5", "source_path": ".dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-20T00:08:11Z"
updated_at: "2026-10-20T00:08:11Z"
depends_on: ["SYS-EVAL-REPORT-P04"]
related_nodes: ["feature-evaluation-report-and-raise-judgment", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/app/", "src/actions/", "src/lib/", "src/components/", "src/db/schema.ts", "src/test-support/", "drizzle/migrations/", "scripts/seed.mjs", "scripts/seed-data.mjs", "scripts/seed-sample.mjs", "scripts/sample-data.mjs", "scripts/scan-rendered-text.mjs", "system-spec/route-ledger.json", "vitest.config.ts", "docs/product/spec.md", "docs/product/backlog.md", "docs/deploy-notes.md", "docs/migration-mapping.md", "README.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-evaluation-report-and-raise-judgment"
feature_package_id: "feature-package/feature-evaluation-report-and-raise-judgment"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p05.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-inn.5", "linked_at": "2026-10-20T02:41:20.053935Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-20T00:03:13Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 実装（KGI の読み書きの削除・レポート・見る権限・シード・アンケート・ズレ・評価セット・上司の判断）

## Machine-readable registration fields

- id: SYS-EVAL-REPORT-P05
- feature_package_id: feature-package/feature-evaluation-report-and-raise-judgment
- owners: daishiman
- tags: evaluation-report, p05, implementation, mutation
- related_nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-evaluation-report-and-raise-judgment
- phase_ref: P05
- lifecycle_role: mutation
- workstream_kind: backend（secondary: frontend, data, security, documentation）
- build_target_kind: application-code
- depends_on: SYS-EVAL-REPORT-P04
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-evaluation-report-and-raise-judgment/sys-eval-report-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- P04 のテストを緑にする実装を入れる。
- KGI の読み書きの経路（/admin/kgi・src/actions/kgi-results.ts・src/lib/kgi-apply.ts・src/lib/domain/kgi.ts・nav.ts の『運用を補う』の項目・台帳の行）を消し、賞与（仮）を個人Pt＝KPI評価点の合計、賞与額＝個人Pt×bonusYenPerPoint（0 なら出さない）で出す。
- レポート（buildEvaluationReport・ReportTemplate）、見る権限（canViewEvaluationOf）、アンケートの状態の規則（formTransitions）、評価セット（resolveSchemeForCycle）、上司の判断（migration 0038 の 6 列と finalDecision）、シードを入れる。

## 背景

- KGI を含むファイルは src に 28 件あり、計算・画面・テスト・シードにまたがる。
- schema.ts の KGI の表の定義は P08 まで残す（1 回目の Deploy の時点では本番の表がまだあるため）。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-evaluation-report-and-raise-judgment, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-EVAL-REPORT-P04
- Entry gate: P04 のテストがそろい、正しい理由で赤である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:b459beab111355c3b2d815db1360a4010e54eac5216a37f9a8ffd0ecb8d81775
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: KGI の削除と上司の判断の追加が同じ evaluate.ts・EvaluationDetail.tsx に触れるので、差分が大きくなる。コミットを機能ごとに分ける

## Workstream applicability

- Frontend: 適用: レポートの画面と印刷の体裁、評価の画面の判断の入力欄（理由の欄の文『この文は本人にもそのまま見えます。性格ではなく、行動や事実で書いてください』）、本人の結果・評価期間の一覧の最終の可否を入れる
- Backend: 適用: buildEvaluationReport・finalDecision・resolveSchemeForCycle・formTransitions と updateEvaluation の判断の検査（判断を必ず選ぶ・『変える』なら理由が要る・空白だけは不可・上限 2000 字・自分自身は不可）を入れる
- API: N/A: 外部に出す API は無い。Server Actions の契約は server-actions-contract.test.ts で守る
- Data: 適用: migration 0038 で evaluations に raise_decision・raise_decision_reason・promotion_decision・promotion_decision_reason・decision_recorded_by・decision_recorded_at を NULL 可で足す。シードに 5 通りの判断・アンケートの各状態・ズレの 3 種類・直属の部下の関係を入れる
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: canViewEvaluationOf をレポート・評価の詳細・CSV の書き出し・メモの読み出しで使い、本人向けに点数の数値と比べる値を返さない
- Quality: 適用: vitest.config.ts の CALC_FILES から kgi.ts を外し、finalDecision の domain ファイルを足す
- Documentation: 適用: 今の説明を書いている文書（docs/product/spec.md・docs/product/backlog.md・docs/deploy-notes.md・docs/migration-mapping.md・README.md）から KGI の記述を消す
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: DD のとおり、評価セットは resolveSchemeForCycle、見る権限は canViewEvaluationOf、記録する権限は canActOnEmployeeEvaluation、最終の可否は finalDecision の 1 つずつから得る。上司の判断は賞与と等級の自動変更に効かせない
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: 0038 は NULL 可の列を足すだけなので、古いコードのままでも動く。判断の記録が無い古い確定は判定どおりとして扱い、『上司の判断の記録なし（この仕組みより前に確定）』と出す。KGI の表と 2 列はまだ消さない

## 成果物

- Produced artifacts: KGI を含まないコード、レポートの画面、判断の列（0038）、シード、更新した文書
- Consumed artifacts: P04 のテスト、docs/product/design-decisions.md の新しい DD
- Write scope/touches: src/app/, src/actions/, src/lib/, src/components/, src/db/schema.ts, src/test-support/, drizzle/migrations/, scripts/seed.mjs, scripts/seed-data.mjs, scripts/seed-sample.mjs, scripts/sample-data.mjs, scripts/scan-rendered-text.mjs, system-spec/route-ledger.json, vitest.config.ts, docs/product/spec.md, docs/product/backlog.md, docs/deploy-notes.md, docs/migration-mapping.md, README.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-EVAL-REPORT-P05 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-EVAL-REPORT-P05 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: KGI の表と評価の 2 列の削除（P08 の担当）
- 範囲の外を取り込まない: 配色とテーマの変更（DD-003）
- 範囲の外を取り込まない: 確定済みの評価の個人Pt・賞与額・根拠の文の作り直し
- 範囲の外を取り込まない: 本番 DB へのシードの投入

## Verification and evidence

- Acceptance: P04 のテストがすべて緑で、KGI の静的検査が 0 件である ／ finalDecision の domain のカバレッジが 100% である ／ シードを 2 回流しても結果が同じで、本番の設定ではシードが動かない
- Automated commands: pnpm test ／ pnpm run typecheck ／ pnpm run test:coverage ／ pnpm run check:docs ／ pnpm db:migrate:local ／ pnpm db:seed:local（2 回流して結果を比べる）
- Required evidence: 各コマンドの出力、0038 を当てたローカルの PRAGMA table_info(evaluations)

## Rollout and rollback

- Rollout: main へのマージの後、P13 の 1 回目の Deploy で本番に出す。0038 は 1 回目の Deploy で当てる
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば KGI の経路と新しい機能が戻る。0038 の列は NULL 可なので残しても古いコードは動く

## Handoff

- Executor: task-graph build（application-code）
- Ready when: P04 のテストが緑で、P06 で全体のテストを流せる
- 次に利用するノード: SYS-EVAL-REPORT-P06

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/feature-evaluation-report-and-raise-judgment.md、features/feature-evaluation-report-and-raise-judgment.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-EVAL-REPORT-P04

---
graph_node_id: "SYS-GUIDE-KPI-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "文書と運用（製品仕様・DD・公開の手順）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p12", "documentation"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-12-documentation-operations.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P11"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/spec.md", "docs/product/design-decisions.md", "docs/product/settings-copy-ledger.md", "docs/deploy-notes.md", "docs/product/backlog.md", "README.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P12"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p12.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.12", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 文書と運用（製品仕様・DD・公開の手順）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P12
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p12, documentation
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P12
- lifecycle_role: documentation-sync
- workstream_kind: documentation（secondary: operations）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P11
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- 製品仕様（§14 の見本の受付中の期、§22 の 2 つの画面の説明の量、§27 の保存の後の反映、双方向の追従と部品の見た目の新しい節）を、実装に合わせて書く。
- DD の状態と写しの一覧を最終の形にする。docs/deploy-notes.md に、本番でのそろえる操作（KPI・評価セットの入口の「設定とずれた下書きのアンケート」の操作（内容を見る → 確認 → そろえる → 結果の文）。流す前の行の SELECT での書き出しと戻し方を含む）と見本の入れ直しの手順と、本番で実行する前に利用者の確認を取ることを書き、P05 が書いた 0040 の節を実装の結果（件数の読み方・戻し方）に合わせる。
- 製品仕様 §14 には、受付中の期を作ることで生じる影響（本番の見本の会社では、未回答の一覧と提出状況に見本の人が並ぶ。見本の会社の中だけで、本物の会社には出ない）を書く（I31）。

## 背景

- P02 の DD は実装の前に書いたもので、実装で決まった細部（画面の URL・部品クラスの名前・そろえる操作の返り値と画面の文言）が反映されていない。
- §14 の「受付中の期は作らない」は、見本の人が未回答の一覧に並ぶのを避けるための決めだった。I31 はその影響を記したうえで改めることを求めている。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P11
- Entry gate: P11 の証跡がそろっている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: 文書に取り消された呼び名が混ざると文書の検査が落ちる。check:docs を流してから出す

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: N/A: この段では Security の成果物を作らない
- Quality: N/A: この段では Quality の成果物を作らない
- Documentation: 適用: 製品仕様・DD・写しの一覧・公開の手順を書く
- Operations: 適用: 本番でのそろえる操作・見本の入れ直しの順と確認の取り方を書き、0040 の節（Deploy workflow が当てること・戻し方）を実装に合わせる

## Architecture and deploy unit

- Architecture decisions: N/A: 設計は変えない。文書を実装に合わせる
- Deploy unit/environment: N/A: 文書のみ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: データの移行は無い

## 成果物

- Produced artifacts: docs/product/spec.md、docs/product/design-decisions.md、docs/product/settings-copy-ledger.md、docs/deploy-notes.md、docs/product/backlog.md の更新と、README.md の文書の入口への写しの一覧の追加（入口に足す場合だけ）
- Consumed artifacts: P05〜P11 の結果
- Write scope/touches: docs/product/spec.md, docs/product/design-decisions.md, docs/product/settings-copy-ledger.md, docs/deploy-notes.md, docs/product/backlog.md, README.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の前の段の完了（その段の PR のマージ。PR を作らない段は、紐付けた P05 の PR のマージ）を待って着手する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P12 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P12 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: コードの変更
- 範囲の外を取り込まない: 本番での実行（P13 の担当）

## Verification and evidence

- Acceptance: 製品仕様 §14 が受付中の期を作る形に改められ、本番の見本の会社では未回答の一覧と提出状況に見本の人が並ぶこと（見本の会社の中だけで、本物の会社には出ないこと）が書かれている ／ docs/deploy-notes.md に、0040 の節（P05 が書いたもの）が実装の結果に合わせてあり、そろえる操作と見本の入れ直しの順と、利用者の確認を取ることが書かれている ／ check:docs が通る
- Automated commands: pnpm run check:docs
- Required evidence: 文書の差分と check:docs の出力

## Rollout and rollback

- Rollout: 文書のコミットだけ。main へのマージで有効になる
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば文書が前の形に戻る

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 文書がマージされ、check:docs が通る
- 次に利用するノード: SYS-GUIDE-KPI-P13

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P11

---
graph_node_id: "SYS-GUIDE-KPI-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "要件のベースライン（受け入れ 10 件とテスト・担当 phase の対応表）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p01", "requirements", "baseline"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: []
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
phase_ref: "P01"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p01.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.1", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 要件のベースライン（受け入れ 10 件とテスト・担当 phase の対応表）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P01
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p01, requirements, baseline
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P01
- lifecycle_role: preparation
- workstream_kind: documentation（secondary: quality）
- build_target_kind: application-code
- depends_on: なし（鎖の先頭）
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- feature の受け入れ 10 件（O25 が 2 件・O26 が 2 件・O27 が 3 件・O28 が 1 件・O29 が 2 件）を、テストの種類・置き場所・確かめる phase に 1 行ずつ対応付けた基準表にする。
- 未決の事項 5 件（0040 の書き換えの範囲・KPI と評価セットの 4 つの作業の画面の URL・部品クラスの名前と部品の対応・見本の受付中の期の人数の配分・ずれた下書きをそろえる操作の置き場と流し方）に、決める phase（P02）を付ける。
- ヒアリングで利用者が決めた 6 件（保存と同時に設定へ反映・次の版の下書きを自動で作る・確定した時点のまま残す・データを既定へ書き換える・合わない保存は断り理由と直す所を示す・手元と本番の見本の会社の両方）を受領記録に写す。

## 背景

- system-spec の G25〜G29・O25〜O29・I26〜I33 は確定し、完成度の評価（eval-log/system-spec-completeness-2026-10-22.json）は PASS している。
- 受け入れは features/feature-guideline-kpi-ux-and-two-way-sync.context.json にあるが、何で確かめるかが決まっていない。先に 1 枚にそろえないと、P04 のテストと P07 の受け入れがずれる。
- 計画を作った時点では、前提（feature の context.json と説明の文書・system-spec/ の確定章・architecture/ と specs/ の写し）は main に無く、計画を作った worktree に未コミットで置かれている。dev-graph は main から作業ブランチを切るので、利用者が前提を main へ入れてから P01 に着手する。eval-log/ は git の管理外なので、完成度の評価は計画を作った worktree のものを読む。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- Entry gate: 着手の前に、利用者が前提（features/feature-guideline-kpi-ux-and-two-way-sync.context.json・features/guideline-kpi-ux-and-two-way-sync.md・system-spec/ の変更・architecture/system-spec-*.md の 8 件・specs/system-spec-requirements.md）を main へ入れていて、P01 の worktree にそれらがある。feature の context.json の sha256 が 74772c910ff81b3a3c4c320fecd6850d4eb42c959c2860200158843573acbc7f と一致し、system-spec の完成度の評価（eval-log/system-spec-completeness-2026-10-22.json）の verdict が PASS である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: 受け入れの文が長く、1 件に条件が 4 つ以上あるものがある。原文を引用して対応表の列に分け、条件を落とさない

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: N/A: この段では Data の成果物を作らない
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: N/A: この段では Security の成果物を作らない
- Quality: 適用: 受け入れごとにテストの種類と置き場所を決める
- Documentation: 適用: 受領記録に対応表・未決の事項・範囲の外・ヒアリングの決定を書く
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: 受け入れと system-spec の章（ui-ux・frontend・backend・database・auth・security・infrastructure・maintenance-ops）の対応を表にする。設計の判断はしない（P02 の担当）
- Deploy unit/environment: N/A: 文書のみ。Worker と D1 は変えない
- Compatibility/migration/backfill: N/A: 文書だけを足す。データの移行は無い

## 成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md（受け入れの対応表・未決の事項と担当 phase・範囲の外・ヒアリングの決定）
- Consumed artifacts: features/feature-guideline-kpi-ux-and-two-way-sync.context.json、system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Write scope/touches: docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on は無い。着手の条件は Entry gate（前提が main にあること）
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P01 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P01 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 設計の判断（画面の URL・migration の中身・部品クラスの名前）は P02 で行う
- 範囲の外を取り込まない: テストのコードは書かない（P04 の担当）

## Verification and evidence

- Acceptance: 受け入れ 10 件それぞれに、テストの種類（単体・結合・サーバー処理・契約・画面・E2E・見た目の記録）・置き場所・確かめる phase が 1 行ずつある ／ 未決の事項 5 件に担当 phase（P02）が付いている ／ context.json の scope_out 8 件が範囲の外として写されている ／ ヒアリングで決まった 6 件が写されている ／ 受領記録に、前提を main へ入れたコミットの sha と、完成度の評価の verdict（eval-log/ は git の管理外なので写す）がある
- Automated commands: git ls-files --error-unmatch features/feature-guideline-kpi-ux-and-two-way-sync.context.json features/guideline-kpi-ux-and-two-way-sync.md（前提が main にあること。終了コード 0） ／ shasum -a 256 features/feature-guideline-kpi-ux-and-two-way-sync.context.json（74772c910ff81b3a3c4c320fecd6850d4eb42c959c2860200158843573acbc7f と一致） ／ pnpm run check:docs
- Required evidence: 受領記録の path とコミットの sha、check:docs の出力

## Rollout and rollback

- Rollout: 文書のコミットだけ。main へのマージで有効になる
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば受領記録が消える。コードと DB は変わらない

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 受領記録がマージされ、対応表の 10 行がそろっている
- 次に利用するノード: SYS-GUIDE-KPI-P02

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: なし

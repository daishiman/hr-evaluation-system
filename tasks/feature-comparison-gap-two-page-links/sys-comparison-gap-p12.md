---
graph_node_id: "SYS-COMPARISON-GAP-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "spec.md の 22 章・design-decisions・system-spec の文書に反映する"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "documentation-operations"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-12-documentation-operations.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P11"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-maintenance-ops", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/spec.md", "docs/product/design-decisions.md", "system-spec"]
purpose: "docs/product/spec.md の 22 章に、比べる警告の出し方（閉じた1行・開いた表・2つのリンク）を足す。design-decisions.md の DD を実装の結果に合わせて確定する。write_scope の system-spec は、system-spec-harness の compile（C03）の出力としてだけ書き換わる。確定章も含め、手では直さない。"
goal: "spec.md の 22 章・design-decisions・system-spec の文書に反映する"
scope_in: ["docs/product/spec.md", "docs/product/design-decisions.md", "system-spec"]
scope_out: ["キットの実配置（.claude/skills など）の直接の編集", "T2-experience-spec.md の 5 章の書き換え"]
acceptance: ["check:docs が通る", "spec.md・design-decisions.md・system-spec が実装と一致する"]
architecture_refs: ["arch-system-spec-maintenance-ops", "arch-system-spec-ui-ux"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P12"
classification_confidence: 0.9
classification_reason: "P12 documentation-operations の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p12.md", "confidence": 0.9}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-15T01:43:11Z", "missing_sections": [], "status": "complete"}
---

# spec.md の 22 章・design-decisions・system-spec の文書に反映する

## 目的

- docs/product/spec.md の 22 章に、比べる警告の出し方（閉じた1行・開いた表・2つのリンク）を足す
- design-decisions.md の DD を実装の結果に合わせて確定する
- write_scope の system-spec は、system-spec-harness の compile（C03）の出力としてだけ書き換わる。確定章も含め、手では直さない

## 背景

- 仕様と実装がずれると、次の改善で文だけの警告がまた生まれる

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-maintenance-ops, arch-system-spec-ui-ux, SYS-COMPARISON-GAP-P11
- Entry gate: P11 の証跡がコミット済み
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md、docs/product/spec-receipts/2026-10-15-comparison-gap-final-review.md

## 出力と成果物

- Produced artifacts: docs/product/spec.md の 22 章の追記、docs/product/design-decisions.md の DD の確定、system-spec の compile の結果
- Consumed artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md、docs/product/spec-receipts/2026-10-15-comparison-gap-final-review.md
- Write scope/touches: docs/product/spec.md、docs/product/design-decisions.md、system-spec

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P11"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P11 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P11 の完了が条件）

## 実装対象

- Frontend: N/A: コードは変えない
- Backend: N/A: コードは変えない
- API: N/A: コードは変えない
- Data: N/A: 表・列の追加なし
- Infrastructure: N/A: デプロイの単位は変えない
- Security: N/A: 権限の境界の記述は system-spec の security 章の compile で反映する
- Quality: 適用: pnpm run check:docs を通す
- Documentation: 適用: spec.md・design-decisions.md・system-spec を更新する
- Operations: 適用: 公開の手順と戻し方を P13 のために文書に残す

## Write scope と競合制約

- `touches`: `docs/product/spec.md`、`docs/product/design-decisions.md`、`system-spec`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P12 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P12 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P11 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P12 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P11）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P12` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm run check:docs
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P12` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P12` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] check:docs が通る
- [ ] spec.md・design-decisions.md・system-spec が実装と一致する
- [ ] 証跡: check:docs の実行の記録、spec.md の 22 章の差分

## 検証方法

- 自動検証: `pnpm run check:docs`
- 証跡: check:docs の実行の記録、spec.md の 22 章の差分

## リスクとロールバック

- 範囲の外を取り込まない: キットの実配置（.claude/skills など）の直接の編集
- 範囲の外を取り込まない: T2-experience-spec.md の 5 章の書き換え
- ロールバック: 文書のコミットを revert する
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P11 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P13

## Workstream applicability

- Frontend: N/A: コードは変えない
- Backend: N/A: コードは変えない
- API: N/A: コードは変えない
- Data: N/A: 表・列の追加なし
- Infrastructure: N/A: デプロイの単位は変えない
- Security: N/A: 権限の境界の記述は system-spec の security 章の compile で反映する
- Quality: 適用: pnpm run check:docs を通す
- Documentation: 適用: spec.md・design-decisions.md・system-spec を更新する
- Operations: 適用: 公開の手順と戻し方を P13 のために文書に残す

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-maintenance-ops, arch-system-spec-ui-ux。system-spec の確定章は compile（C03）だけが書く。直接の編集はしない
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: N/A: 文書の更新だけ

## Verification and evidence

- Automated commands: pnpm run check:docs
- Required evidence: check:docs の実行の記録、spec.md の 22 章の差分

## Rollout and rollback

- Rollout: 文書の更新だけで、利用者に見える変化はない
- Rollback trigger and steps: 文書のコミットを revert する

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P12 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, documentation-operations
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-maintenance-ops, arch-system-spec-ui-ux
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P12
- classification: confidence 0.9 / documentation-operations の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p12.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-12-documentation-operations.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-maintenance-ops, arch-system-spec-ui-ux
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P12 documentation-operations（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P11

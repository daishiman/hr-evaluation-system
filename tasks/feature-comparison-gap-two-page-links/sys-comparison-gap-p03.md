---
graph_node_id: "SYS-COMPARISON-GAP-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "設計を作った者とは別の担当が独立に設計をレビューする"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "design-review"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P02"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-backend", "arch-system-spec-security"]
resource_scope: ["docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md"]
purpose: "P02 の DD を、作った者とは別の文脈（独立のレビュー担当）で見て、high の指摘が0件になるまで差し戻す。見る観点：型が2つのページを必須にしているか・リンクがルート台帳と役割で絞られるか・読み出しが会社の範囲か・説明の段落を置かない形か・InlineDetail と ActionButton を使い画面ごとに details 要素を書かないか・4つの幅で同じ振る舞いか・テーマの契約に触れないか。"
goal: "設計を作った者とは別の担当が独立に設計をレビューする"
scope_in: ["docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md"]
scope_out: ["設計の書き直し（差し戻しは P02 で直す）"]
acceptance: ["high の指摘が0件", "全観点に判定と根拠がある"]
architecture_refs: ["arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-backend", "arch-system-spec-security"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P03"
classification_confidence: 0.9
classification_reason: "P03 design-review の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p03.md", "confidence": 0.9}]
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

# 設計を作った者とは別の担当が独立に設計をレビューする

## 目的

- P02 の DD を、作った者とは別の文脈（独立のレビュー担当）で見て、high の指摘が0件になるまで差し戻す
- 見る観点：型が2つのページを必須にしているか・リンクがルート台帳と役割で絞られるか・読み出しが会社の範囲か・説明の段落を置かない形か・InlineDetail と ActionButton を使い画面ごとに details 要素を書かないか・4つの幅で同じ振る舞いか・テーマの契約に触れないか

## 背景

- 設計の誤りは実装のあとに直すほど高くつく。とくに会社の範囲と役割の絞り込みの漏れは、他社の名前の露出につながる

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-ui-ux, arch-system-spec-frontend, arch-system-spec-backend, arch-system-spec-security, SYS-COMPARISON-GAP-P02
- Entry gate: P02 の DD がコミット済み
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: docs/product/design-decisions.md の新しい DD、docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md

## 出力と成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md
- Consumed artifacts: docs/product/design-decisions.md の新しい DD、docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md
- Write scope/touches: docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P02"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P02 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P02 の完了が条件）

## 実装対象

- Frontend: 適用: 部品の構成と開閉の形（窓を使わない・開閉の状態を覚えない）をレビューする
- Backend: 適用: 型と読み出しの形をレビューする
- API: 適用: createForms の入力の検査をレビューする
- Data: N/A: 表・列の追加が無いことだけを確かめる
- Infrastructure: N/A: デプロイの単位は変えない
- Security: 適用: 会社の範囲・役割・notFound・gradeIds の拒否をレビューする
- Quality: 適用: 指摘を high・medium・low に分け、high 0件を通過の条件にする
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md に指摘と判定を残す
- Operations: N/A: 運用の変更なし

## Write scope と競合制約

- `touches`: `docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P03 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P03 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P02 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P03 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P02）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P03` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm run check:docs
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P03` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P03` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] high の指摘が0件
- [ ] 全観点に判定と根拠がある
- [ ] 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md に観点ごとの判定と high 0件の結論がある

## 検証方法

- 自動検証: `pnpm run check:docs`
- 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md に観点ごとの判定と high 0件の結論がある

## リスクとロールバック

- 範囲の外を取り込まない: 設計の書き直し（差し戻しは P02 で直す）
- ロールバック: レビューの記録のコミットを revert し、P02 に差し戻す
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P02 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P04

## Workstream applicability

- Frontend: 適用: 部品の構成と開閉の形（窓を使わない・開閉の状態を覚えない）をレビューする
- Backend: 適用: 型と読み出しの形をレビューする
- API: 適用: createForms の入力の検査をレビューする
- Data: N/A: 表・列の追加が無いことだけを確かめる
- Infrastructure: N/A: デプロイの単位は変えない
- Security: 適用: 会社の範囲・役割・notFound・gradeIds の拒否をレビューする
- Quality: 適用: 指摘を high・medium・low に分け、high 0件を通過の条件にする
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md に指摘と判定を残す
- Operations: N/A: 運用の変更なし

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-ui-ux, arch-system-spec-frontend, arch-system-spec-backend, arch-system-spec-security。レビューの基準は architecture の ui-ux・frontend・backend・security と DD-003（配色を移さない）
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: N/A: レビューだけで振る舞いを変えない

## Verification and evidence

- Automated commands: pnpm run check:docs
- Required evidence: docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md に観点ごとの判定と high 0件の結論がある

## Rollout and rollback

- Rollout: レビューの記録だけで、利用者に見える変化はない
- Rollback trigger and steps: レビューの記録のコミットを revert し、P02 に差し戻す

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P03 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, design-review
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-ui-ux, arch-system-spec-frontend, arch-system-spec-backend, arch-system-spec-security
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P03
- classification: confidence 0.9 / design-review の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p03.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-03-design-review.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-ui-ux, arch-system-spec-frontend, arch-system-spec-backend, arch-system-spec-security
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P03 design-review（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P02

---
graph_node_id: "SYS-COMPARISON-GAP-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "main を別の worktree から公開し、本番で確かめて公開の記録を残す"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "release-deploy"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-13-release-deploy.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P12"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops"]
resource_scope: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
purpose: "P01〜P12 の PR がすべて main にマージされたあと、他の作業の未コミットの変更を含まない別の worktree で main の先頭を取り出し、pnpm run deploy で公開する。公開のあと、本番の3画面で閉じた1行が出ることを読むだけで確かめる（本番の DB には書かない）。受領書に公開の日時・版・確かめの結果を足し、この段の PR は利用者に確かめてから出す（勝手に出さない）。"
goal: "main を別の worktree から公開し、本番で確かめて公開の記録を残す"
scope_in: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
scope_out: ["利用者の確認なしの PR の作成", "本番の DB への書き込み"]
acceptance: ["main の先頭で pnpm test・typecheck・check:docs が通ってから公開している", "本番の3画面で閉じた1行が出る", "公開の記録の PR が利用者の確認のあとに出ている"]
architecture_refs: ["arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P13"
classification_confidence: 0.9
classification_reason: "P13 release-deploy の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p13.md", "confidence": 0.9}]
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

# main を別の worktree から公開し、本番で確かめて公開の記録を残す

## 目的

- P01〜P12 の PR がすべて main にマージされたあと、他の作業の未コミットの変更を含まない別の worktree で main の先頭を取り出し、pnpm run deploy で公開する
- 公開のあと、本番の3画面で閉じた1行が出ることを読むだけで確かめる（本番の DB には書かない）
- 受領書に公開の日時・版・確かめの結果を足し、この段の PR は利用者に確かめてから出す（勝手に出さない）

## 背景

- 共有の作業ツリーから公開すると、他のエージェントの未コミットのコードが本番に出るおそれがある

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, SYS-COMPARISON-GAP-P12
- Entry gate: P12 の PR が main にマージ済みで、main の先頭で pnpm test・typecheck・check:docs が通っている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: P01〜P12 の成果

## 出力と成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md の公開の記録、本番の Worker の新しい版
- Consumed artifacts: P01〜P12 の成果
- Write scope/touches: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P12"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P12 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P12 の完了が条件）

## 実装対象

- Frontend: 適用: 本番の3画面で閉じた1行を確かめる
- Backend: N/A: 表・列の変更が無いので、本番の DB の移行は無い
- API: N/A: 新しいサーバー処理は無い
- Data: N/A: 本番の DB は読むだけ
- Infrastructure: 適用: 別の worktree から pnpm run deploy で Worker を公開する
- Security: 適用: 公開する main の先頭に秘密の値が無いことを確かめる
- Quality: 適用: 公開のあとの確かめを受領書に残す
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に公開の記録を足す
- Operations: 適用: 戻し方（revert と再公開）を確かめておく

## Write scope と競合制約

- `touches`: `docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P13 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P13 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P12 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P13 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P12）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P13` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm test / pnpm run typecheck / pnpm run check:docs / pnpm run deploy
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P13` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P13` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] main の先頭で pnpm test・typecheck・check:docs が通ってから公開している
- [ ] 本番の3画面で閉じた1行が出る
- [ ] 公開の記録の PR が利用者の確認のあとに出ている
- [ ] 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に公開の日時・版・本番での確かめの結果がある（実データは入れない）

## 検証方法

- 自動検証: `pnpm test`
- 自動検証: `pnpm run typecheck`
- 自動検証: `pnpm run check:docs`
- 自動検証: `pnpm run deploy`
- 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に公開の日時・版・本番での確かめの結果がある（実データは入れない）

## リスクとロールバック

- 範囲の外を取り込まない: 利用者の確認なしの PR の作成
- 範囲の外を取り込まない: 本番の DB への書き込み
- ロールバック: 問題があれば、原因の段の PR を revert して main の先頭から再公開する（表・列の変更が無いので、データの戻しは要らない）
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P12 が done
- 次に利用するノード: なし（この package の最後の段）

## Workstream applicability

- Frontend: 適用: 本番の3画面で閉じた1行を確かめる
- Backend: N/A: 表・列の変更が無いので、本番の DB の移行は無い
- API: N/A: 新しいサーバー処理は無い
- Data: N/A: 本番の DB は読むだけ
- Infrastructure: 適用: 別の worktree から pnpm run deploy で Worker を公開する
- Security: 適用: 公開する main の先頭に秘密の値が無いことを確かめる
- Quality: 適用: 公開のあとの確かめを受領書に残す
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に公開の記録を足す
- Operations: 適用: 戻し方（revert と再公開）を確かめておく

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-infrastructure, arch-system-spec-maintenance-ops。公開の単位は Cloudflare Worker（hr-evaluation-system）
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: N/A: 表・列の変更が無いので、公開の順序の制約は無い

## Verification and evidence

- Automated commands: pnpm test / pnpm run typecheck / pnpm run check:docs / pnpm run deploy
- Required evidence: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に公開の日時・版・本番での確かめの結果がある（実データは入れない）

## Rollout and rollback

- Rollout: main の先頭を別の worktree から pnpm run deploy で公開し、そのあと公開の記録を受領書に足す
- Rollback trigger and steps: 問題があれば、原因の段の PR を revert して main の先頭から再公開する（表・列の変更が無いので、データの戻しは要らない）

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P13 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, release-deploy
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P13
- classification: confidence 0.9 / release-deploy の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p13.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-13-release-deploy.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-infrastructure, arch-system-spec-maintenance-ops
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P13 release-deploy（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P12

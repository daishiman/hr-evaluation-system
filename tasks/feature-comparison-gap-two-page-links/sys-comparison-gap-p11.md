---
graph_node_id: "SYS-COMPARISON-GAP-P11"
artifact_kind: "task"
artifact_subtypes: []
title: "誰が実行しても同じ結果になる証跡をまとめる"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "evidence"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p11.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-11-evidence.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P10"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-maintenance-ops"]
resource_scope: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
purpose: "テスト・型・カバレッジ・check:docs のコマンドと結果の要約、preview の確かめ方を受領書にまとめ、誰でも同じ手順で再現できるようにする。見本のデータだけを使い、実データ（社員名・評価値など）を入れない。"
goal: "誰が実行しても同じ結果になる証跡をまとめる"
scope_in: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
scope_out: ["実データを使った証跡"]
acceptance: ["同じ手順で同じ結果が出る", "実データが0件"]
architecture_refs: ["arch-system-spec-maintenance-ops"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P11"
classification_confidence: 0.9
classification_reason: "P11 evidence の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p11.md", "confidence": 0.9}]
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

# 誰が実行しても同じ結果になる証跡をまとめる

## 目的

- テスト・型・カバレッジ・check:docs のコマンドと結果の要約、preview の確かめ方を受領書にまとめ、誰でも同じ手順で再現できるようにする
- 見本のデータだけを使い、実データ（社員名・評価値など）を入れない

## 背景

- 公開リポジトリなので、証跡に実データを残さない（README の本番運用とデータの注意）

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-maintenance-ops, SYS-COMPARISON-GAP-P10
- Entry gate: P10 の最終のゲートを通過している
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: P06・P07・P09・P10 の結果

## 出力と成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md の証跡の節
- Consumed artifacts: P06・P07・P09・P10 の結果
- Write scope/touches: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P10"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P10 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P10 の完了が条件）

## 実装対象

- Frontend: 適用: 3画面の確かめ方（幅・開閉の操作）を手順として残す
- Backend: N/A: 読み出しの証跡はテストの結果で足りる
- API: N/A: createForms の証跡はテストの結果で足りる
- Data: 適用: 見本のデータだけを使ったことを明記する
- Infrastructure: 適用: preview の上げ方（build を挟み 8787）を手順として残す
- Security: 適用: 証跡に実データ・秘密の値が無いことを確かめる
- Quality: 適用: コマンドと結果の要約を残す
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に証跡の節を足す
- Operations: N/A: 運用の変更なし

## Write scope と競合制約

- `touches`: `docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P11 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P11 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P10 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P11 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P10）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P11` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm test / pnpm run typecheck / pnpm run test:coverage / pnpm run check:docs
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P11` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P11` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] 同じ手順で同じ結果が出る
- [ ] 実データが0件
- [ ] 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md の証跡の節に、コマンド・結果の要約・再現の手順がある

## 検証方法

- 自動検証: `pnpm test`
- 自動検証: `pnpm run typecheck`
- 自動検証: `pnpm run test:coverage`
- 自動検証: `pnpm run check:docs`
- 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md の証跡の節に、コマンド・結果の要約・再現の手順がある

## リスクとロールバック

- 範囲の外を取り込まない: 実データを使った証跡
- ロールバック: 証跡のコミットを revert する
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P10 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P12

## Workstream applicability

- Frontend: 適用: 3画面の確かめ方（幅・開閉の操作）を手順として残す
- Backend: N/A: 読み出しの証跡はテストの結果で足りる
- API: N/A: createForms の証跡はテストの結果で足りる
- Data: 適用: 見本のデータだけを使ったことを明記する
- Infrastructure: 適用: preview の上げ方（build を挟み 8787）を手順として残す
- Security: 適用: 証跡に実データ・秘密の値が無いことを確かめる
- Quality: 適用: コマンドと結果の要約を残す
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に証跡の節を足す
- Operations: N/A: 運用の変更なし

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-maintenance-ops。証跡の置き場所は docs/product/spec-receipts/ の既存の慣習に合わせる
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: N/A: 証跡の追加だけ

## Verification and evidence

- Automated commands: pnpm test / pnpm run typecheck / pnpm run test:coverage / pnpm run check:docs
- Required evidence: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md の証跡の節に、コマンド・結果の要約・再現の手順がある

## Rollout and rollback

- Rollout: 証跡の追加だけで、利用者に見える変化はない
- Rollback trigger and steps: 証跡のコミットを revert する

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P11 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, evidence
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-maintenance-ops
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P11
- classification: confidence 0.9 / evidence の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p11.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-11-evidence.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-maintenance-ops
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P11 evidence（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P10

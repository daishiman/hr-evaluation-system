---
graph_node_id: "SYS-COMPARISON-GAP-P06"
artifact_kind: "task"
artifact_subtypes: []
title: "既存のテストの固定文字列を新しい形に合わせ、全体のテスト・型・カバレッジを通す"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "test-run"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p06.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-06-test-run.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P05"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-maintenance-ops", "arch-system-spec-frontend", "arch-system-spec-backend"]
resource_scope: ["src/lib/domain/setup-gaps.test.ts", "src/lib/domain/setup-gaps-links.test.ts"]
purpose: "formSyncGaps を呼ぶ既存テスト2件（setup-gaps.test.ts・setup-gaps-links.test.ts）に残る今の警告の固定文字列とリンクの期待値を、ComparisonGap の形に合わせる。この2件のほかのテストが警告の字面で落ちたら、この段では書き換えず、書く範囲の追加として計画に差し戻す。feature の scope_in にある SetupGapList のテストと /admin/forms の一覧のテストは変えない。根拠：src/components/SetupGapList.test.ts は自前の見本の gap だけで描き、formSyncGaps と警告の字面に依存しない。/admin/forms のソースを読むテストは src/components/ui-rules.test.ts の『読むだけの画面に帯（pinned）を作らない』の1件だけで、警告の字面に依存しない。pnpm test でこの2件が通ることを確かめる。pnpm test・typecheck・test:coverage を通し、domain のカバレッジ 100% を保つ。"
goal: "既存のテストの固定文字列を新しい形に合わせ、全体のテスト・型・カバレッジを通す"
scope_in: ["src/lib/domain/setup-gaps.test.ts", "src/lib/domain/setup-gaps-links.test.ts"]
scope_out: ["新しいテストの追加（P04 で済）", "テストの削除による通過", "describeFormKpiDiff と form-sync.test.ts の片付け（P08）", "上の2件のほかのテストの書き換え（計画に差し戻す）", "SetupGapList.test.ts と ui-rules.test.ts の書き換え（字面に依存しないため不要）"]
acceptance: ["pnpm test が全件通る", "typecheck が通る", "domain のカバレッジが 100%"]
architecture_refs: ["arch-system-spec-maintenance-ops", "arch-system-spec-frontend", "arch-system-spec-backend"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P06"
classification_confidence: 0.9
classification_reason: "P06 test-run の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p06.md", "confidence": 0.9}]
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

# 既存のテストの固定文字列を新しい形に合わせ、全体のテスト・型・カバレッジを通す

## 目的

- formSyncGaps を呼ぶ既存テスト2件（setup-gaps.test.ts・setup-gaps-links.test.ts）に残る今の警告の固定文字列とリンクの期待値を、ComparisonGap の形に合わせる
- この2件のほかのテストが警告の字面で落ちたら、この段では書き換えず、書く範囲の追加として計画に差し戻す
- feature の scope_in にある SetupGapList のテストと /admin/forms の一覧のテストは変えない。根拠：src/components/SetupGapList.test.ts は自前の見本の gap だけで描き、formSyncGaps と警告の字面に依存しない。/admin/forms のソースを読むテストは src/components/ui-rules.test.ts の『読むだけの画面に帯（pinned）を作らない』の1件だけで、警告の字面に依存しない。pnpm test でこの2件が通ることを確かめる
- pnpm test・typecheck・test:coverage を通し、domain のカバレッジ 100% を保つ

## 背景

- formSyncGaps の戻りと警告の字面が変わるので、既存のテストの期待値が古くなる

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-maintenance-ops, arch-system-spec-frontend, arch-system-spec-backend, SYS-COMPARISON-GAP-P05
- Entry gate: P05 がコミット済みで、P04 の6種のテストが通っている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: P05 の実装、P04 の6種のテスト

## 出力と成果物

- Produced artifacts: 更新した既存のテスト2件
- Consumed artifacts: P05 の実装、P04 の6種のテスト
- Write scope/touches: src/lib/domain/setup-gaps.test.ts、src/lib/domain/setup-gaps-links.test.ts

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P05"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P05 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P05 の完了が条件）

## 実装対象

- Frontend: N/A: 画面のテストは P04 で足した ComparisonGapNotice.test.ts が受け持ち、ここでは変えない
- Backend: 適用: setup-gaps.test.ts・setup-gaps-links.test.ts の期待値を合わせる
- API: N/A: createForms のテストは P04 で足した。ここでは全体の実行で通ることだけを見る
- Data: N/A: 表・列の追加なし
- Infrastructure: N/A: テストの実行環境は変えない
- Security: 適用: permissions-contract.test.ts を含む全体が通ることを確かめる
- Quality: 適用: pnpm test・typecheck・test:coverage を通す
- Documentation: N/A: 文書は P12 で扱う
- Operations: N/A: 運用の変更なし

## Write scope と競合制約

- `touches`: `src/lib/domain/setup-gaps.test.ts`、`src/lib/domain/setup-gaps-links.test.ts`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P06 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P06 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P05 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P06 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P05）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P06` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm test / pnpm run typecheck / pnpm run test:coverage
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P06` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P06` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] pnpm test が全件通る
- [ ] typecheck が通る
- [ ] domain のカバレッジが 100%
- [ ] 証跡: pnpm test・typecheck・test:coverage の実行の記録、domain のカバレッジ 100% の表示

## 検証方法

- 自動検証: `pnpm test`
- 自動検証: `pnpm run typecheck`
- 自動検証: `pnpm run test:coverage`
- 証跡: pnpm test・typecheck・test:coverage の実行の記録、domain のカバレッジ 100% の表示

## リスクとロールバック

- 範囲の外を取り込まない: 新しいテストの追加（P04 で済）
- 範囲の外を取り込まない: テストの削除による通過
- 範囲の外を取り込まない: describeFormKpiDiff と form-sync.test.ts の片付け（P08）
- 範囲の外を取り込まない: 上の2件のほかのテストの書き換え（計画に差し戻す）
- 範囲の外を取り込まない: SetupGapList.test.ts と ui-rules.test.ts の書き換え（字面に依存しないため不要）
- ロールバック: テストの更新のコミットを revert する
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P05 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P07

## Workstream applicability

- Frontend: N/A: 画面のテストは P04 で足した ComparisonGapNotice.test.ts が受け持ち、ここでは変えない
- Backend: 適用: setup-gaps.test.ts・setup-gaps-links.test.ts の期待値を合わせる
- API: N/A: createForms のテストは P04 で足した。ここでは全体の実行で通ることだけを見る
- Data: N/A: 表・列の追加なし
- Infrastructure: N/A: テストの実行環境は変えない
- Security: 適用: permissions-contract.test.ts を含む全体が通ることを確かめる
- Quality: 適用: pnpm test・typecheck・test:coverage を通す
- Documentation: N/A: 文書は P12 で扱う
- Operations: N/A: 運用の変更なし

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-maintenance-ops, arch-system-spec-frontend, arch-system-spec-backend。テストの意図は変えず、期待値の字面だけを新しい形に合わせる
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: 既存のテストの意図（ズレがあれば警告が出る）を保つ。テストを消して通すことはしない

## Verification and evidence

- Automated commands: pnpm test / pnpm run typecheck / pnpm run test:coverage
- Required evidence: pnpm test・typecheck・test:coverage の実行の記録、domain のカバレッジ 100% の表示

## Rollout and rollback

- Rollout: テストの更新だけで、利用者に見える変化はない
- Rollback trigger and steps: テストの更新のコミットを revert する

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P06 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, test-run
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-maintenance-ops, arch-system-spec-frontend, arch-system-spec-backend
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P06
- classification: confidence 0.9 / test-run の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p06.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-06-test-run.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-maintenance-ops, arch-system-spec-frontend, arch-system-spec-backend
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P06 test-run（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P05

---
graph_node_id: "SYS-COMPARISON-GAP-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "6種のテストを5つのファイルに先に書き、未実装で失敗することを確かめる"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "test-design"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P03"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-frontend"]
resource_scope: ["src/lib/domain/comparison-gap.test.ts", "src/lib/comparison-gap-source.test.ts", "src/lib/comparison-gap-links.test.ts", "src/components/ComparisonGapNotice.test.ts", "src/actions/forms-grade-scope.test.ts"]
purpose: "契約のテスト（src/lib/domain/comparison-gap.test.ts）：比べる警告を作る処理の全件が2つのページ（階層つきの名前とリンク）を持つ（AC1）。画面のテスト（src/components/ComparisonGapNotice.test.ts）：3画面で閉じた状態は1行、開くと2つのリンクと表が出る（AC2）。静的なテスト（src/lib/comparison-gap-source.test.ts）：src/app と src/components に、評価項目とアンケートを比べる警告の文を ComparisonGap を経ずに書く箇所が0件（AC3）。配点の決まりの食い違い（/admin/scheme の一覧）など、比べる警告でない文は対象外とテストの中に明記する。src/lib の中の古い関数は P08 で片付けてから対象を広げる。リンクのテスト（src/lib/comparison-gap-links.test.ts）：リンク先がすべてルート台帳にあり、見る人の役割で開ける。応答に他社の名前が含まれない（AC4）。新しい版のテスト（src/actions/forms-grade-scope.test.ts）：『この等級だけ新しい版の下書きを作る』でその等級の版だけが増える（AC5）。拒否のテスト（src/actions/forms-grade-scope.test.ts。新しい版のテストと同じファイル）：自社のものでない gradeId を含む createForms は何も作らずに拒否される（AC5）。"
goal: "6種のテストを5つのファイルに先に書き、未実装で失敗することを確かめる"
scope_in: ["src/lib/domain/comparison-gap.test.ts", "src/lib/comparison-gap-source.test.ts", "src/lib/comparison-gap-links.test.ts", "src/components/ComparisonGapNotice.test.ts", "src/actions/forms-grade-scope.test.ts"]
scope_out: ["実装のコード（P05）", "既存のテストの書き換え（P06）"]
acceptance: ["AC1〜AC5 のそれぞれに対応するテストが1つ以上ある", "失敗の理由が未実装であり、テストの書き間違いではない"]
architecture_refs: ["arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-frontend"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P04"
classification_confidence: 0.9
classification_reason: "P04 test-design の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p04.md", "confidence": 0.9}]
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

# 6種のテストを5つのファイルに先に書き、未実装で失敗することを確かめる

## 目的

- 契約のテスト（src/lib/domain/comparison-gap.test.ts）：比べる警告を作る処理の全件が2つのページ（階層つきの名前とリンク）を持つ（AC1）
- 画面のテスト（src/components/ComparisonGapNotice.test.ts）：3画面で閉じた状態は1行、開くと2つのリンクと表が出る（AC2）
- 静的なテスト（src/lib/comparison-gap-source.test.ts）：src/app と src/components に、評価項目とアンケートを比べる警告の文を ComparisonGap を経ずに書く箇所が0件（AC3）。配点の決まりの食い違い（/admin/scheme の一覧）など、比べる警告でない文は対象外とテストの中に明記する。src/lib の中の古い関数は P08 で片付けてから対象を広げる
- リンクのテスト（src/lib/comparison-gap-links.test.ts）：リンク先がすべてルート台帳にあり、見る人の役割で開ける。応答に他社の名前が含まれない（AC4）
- 新しい版のテスト（src/actions/forms-grade-scope.test.ts）：『この等級だけ新しい版の下書きを作る』でその等級の版だけが増える（AC5）
- 拒否のテスト（src/actions/forms-grade-scope.test.ts。新しい版のテストと同じファイル）：自社のものでない gradeId を含む createForms は何も作らずに拒否される（AC5）

## 背景

- テストを先に書くと、実装が受け入れ条件からずれたときにすぐ分かる。O16 の『欠落0件』は契約のテストでしか保証できない

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-frontend, SYS-COMPARISON-GAP-P03
- Entry gate: P03 のレビューが high 0件で通過している
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: docs/product/design-decisions.md の新しい DD、docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md、system-spec/route-ledger.json、src/lib/permissions-contract.test.ts

## 出力と成果物

- Produced artifacts: src/lib/domain/comparison-gap.test.ts、src/lib/comparison-gap-source.test.ts、src/lib/comparison-gap-links.test.ts、src/components/ComparisonGapNotice.test.ts、src/actions/forms-grade-scope.test.ts
- Consumed artifacts: docs/product/design-decisions.md の新しい DD、docs/product/spec-receipts/2026-10-15-comparison-gap-design-review.md、system-spec/route-ledger.json、src/lib/permissions-contract.test.ts
- Write scope/touches: src/lib/domain/comparison-gap.test.ts、src/lib/comparison-gap-source.test.ts、src/lib/comparison-gap-links.test.ts、src/components/ComparisonGapNotice.test.ts、src/actions/forms-grade-scope.test.ts

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P03"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P03 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P03 の完了が条件）

## 実装対象

- Frontend: 適用: ComparisonGapNotice の閉じた1行・開いた表・th の scope・読み上げの文字のテストを書く
- Backend: 適用: ComparisonGap を作る処理と2つの読み出しの契約のテストを書く
- API: 適用: createForms の gradeIds の拒否と、新しい版の件数のテストを書く
- Data: N/A: 表・列の追加なし。テストは既存のテスト用データの作り方を使う
- Infrastructure: N/A: テストの実行環境は変えない
- Security: 適用: 他社の gradeId の拒否・役割で開けないリンクの除外・他社の名前を含めないことのテストを書く
- Quality: 適用: 6種のテストを書き、未実装のため失敗することを記録する
- Documentation: N/A: 文書は P12 で扱う
- Operations: N/A: 運用の変更なし

## Write scope と競合制約

- `touches`: `src/lib/domain/comparison-gap.test.ts`、`src/lib/comparison-gap-source.test.ts`、`src/lib/comparison-gap-links.test.ts`、`src/components/ComparisonGapNotice.test.ts`、`src/actions/forms-grade-scope.test.ts`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P04 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P04 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P03 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P04 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P03）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P04` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm vitest run src/lib/domain/comparison-gap.test.ts src/lib/comparison-gap-source.test.ts src/lib/comparison-gap-links.test.ts src/components/ComparisonGapNotice.test.ts src/actions/forms-grade-scope.test.ts
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P04` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P04` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] AC1〜AC5 のそれぞれに対応するテストが1つ以上ある
- [ ] 失敗の理由が未実装であり、テストの書き間違いではない
- [ ] 証跡: 6種のテストが、未実装のモジュールが無いことを理由に失敗した実行の記録

## 検証方法

- 自動検証: `pnpm vitest run src/lib/domain/comparison-gap.test.ts src/lib/comparison-gap-source.test.ts src/lib/comparison-gap-links.test.ts src/components/ComparisonGapNotice.test.ts src/actions/forms-grade-scope.test.ts`
- 証跡: 6種のテストが、未実装のモジュールが無いことを理由に失敗した実行の記録

## リスクとロールバック

- 範囲の外を取り込まない: 実装のコード（P05）
- 範囲の外を取り込まない: 既存のテストの書き換え（P06）
- ロールバック: テストのコミットを revert する
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P03 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P05

## Workstream applicability

- Frontend: 適用: ComparisonGapNotice の閉じた1行・開いた表・th の scope・読み上げの文字のテストを書く
- Backend: 適用: ComparisonGap を作る処理と2つの読み出しの契約のテストを書く
- API: 適用: createForms の gradeIds の拒否と、新しい版の件数のテストを書く
- Data: N/A: 表・列の追加なし。テストは既存のテスト用データの作り方を使う
- Infrastructure: N/A: テストの実行環境は変えない
- Security: 適用: 他社の gradeId の拒否・役割で開けないリンクの除外・他社の名前を含めないことのテストを書く
- Quality: 適用: 6種のテストを書き、未実装のため失敗することを記録する
- Documentation: N/A: 文書は P12 で扱う
- Operations: N/A: 運用の変更なし

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-frontend。テストの置き方は既存の vitest の配置（src の中の .test.ts）に合わせる
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: N/A: 新しいテストの追加だけ。既存のテストの固定文字列の更新は P06 で行う

## Verification and evidence

- Automated commands: pnpm vitest run src/lib/domain/comparison-gap.test.ts src/lib/comparison-gap-source.test.ts src/lib/comparison-gap-links.test.ts src/components/ComparisonGapNotice.test.ts src/actions/forms-grade-scope.test.ts
- Required evidence: 6種のテストが、未実装のモジュールが無いことを理由に失敗した実行の記録

## Rollout and rollback

- Rollout: テストの追加だけで、利用者に見える変化はない
- Rollback trigger and steps: テストのコミットを revert する

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P04 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, test-design
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-frontend
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P04
- classification: confidence 0.9 / test-design の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p04.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-04-test-design.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-frontend
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P04 test-design（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P03

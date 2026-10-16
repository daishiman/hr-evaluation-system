---
graph_node_id: "SYS-COMPARISON-GAP-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "比べる処理の重複と古い警告の文の関数を片付け、静的なテストを src/lib まで広げる（DB の移行は N/A）"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "refactoring-migration"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P07"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-backend", "arch-system-spec-frontend", "arch-system-spec-database"]
resource_scope: ["src/lib/domain/setup-gaps.ts", "src/lib/domain/form-sync.ts", "src/lib/domain/form-sync.test.ts", "src/app/admin/forms/page.tsx", "src/lib/comparison-gap-source.test.ts"]
purpose: "formSyncGaps が ComparisonGap を作るだけの薄い入口になっていることを確かめ、文やリンクの組み立てが setup-gaps.ts に重ねて残っていれば comparison-gap.ts に寄せる。form-sync.ts の describeFormKpiDiff（画面から呼ばれていない古い文の関数）を、P02 の DD の決めどおりに消すか ComparisonGap に寄せ、form-sync.test.ts をそれに合わせる。/admin/forms の画面に残る、比べるための読み出しの重複（diffFormKpiItems の直接の呼び出しなど）を、P05 の読み出しに寄せる。P04 の静的なテスト（comparison-gap-source.test.ts）の対象を src/lib まで広げ、評価項目とアンケートを比べる警告の文が ComparisonGap の外に0件であることを確かめる。SetupGap のほかの利用側（SetupGapList・評価期間の一覧・SetupGuide・StaleCyclesNotice・setup-readiness）は比べる警告を扱わないので変えないことを、差分で確かめる。DB の移行：N/A（表・列の追加・変更が無い）。"
goal: "比べる処理の重複と古い警告の文の関数を片付け、静的なテストを src/lib まで広げる（DB の移行は N/A）"
scope_in: ["src/lib/domain/setup-gaps.ts", "src/lib/domain/form-sync.ts", "src/lib/domain/form-sync.test.ts", "src/app/admin/forms/page.tsx", "src/lib/comparison-gap-source.test.ts"]
scope_out: ["DB の移行", "比べる警告以外の設定不足の一覧の表示の変更（U7）", "SetupGap のほかの利用側の変更"]
acceptance: ["静的なテストが src/lib を含めて通り、比べる警告の文が ComparisonGap の外で0件", "SetupGap のほかの利用側5ファイルに差分が無い", "pnpm test と typecheck が通る"]
architecture_refs: ["arch-system-spec-backend", "arch-system-spec-frontend", "arch-system-spec-database"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P08"
classification_confidence: 0.9
classification_reason: "P08 refactoring-migration の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p08.md", "confidence": 0.9}]
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

# 比べる処理の重複と古い警告の文の関数を片付け、静的なテストを src/lib まで広げる（DB の移行は N/A）

## 目的

- formSyncGaps が ComparisonGap を作るだけの薄い入口になっていることを確かめ、文やリンクの組み立てが setup-gaps.ts に重ねて残っていれば comparison-gap.ts に寄せる
- form-sync.ts の describeFormKpiDiff（画面から呼ばれていない古い文の関数）を、P02 の DD の決めどおりに消すか ComparisonGap に寄せ、form-sync.test.ts をそれに合わせる
- /admin/forms の画面に残る、比べるための読み出しの重複（diffFormKpiItems の直接の呼び出しなど）を、P05 の読み出しに寄せる
- P04 の静的なテスト（comparison-gap-source.test.ts）の対象を src/lib まで広げ、評価項目とアンケートを比べる警告の文が ComparisonGap の外に0件であることを確かめる
- SetupGap のほかの利用側（SetupGapList・評価期間の一覧・SetupGuide・StaleCyclesNotice・setup-readiness）は比べる警告を扱わないので変えないことを、差分で確かめる
- DB の移行：N/A（表・列の追加・変更が無い）

## 背景

- P05 は3画面と型を通すところまでにしたので、古い文の関数と比べる処理の重複がこの段まで残る

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-backend, arch-system-spec-frontend, arch-system-spec-database, SYS-COMPARISON-GAP-P07
- Entry gate: P07 の受け入れが合格している
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: P05 の実装、P04 の静的なテスト、docs/product/design-decisions.md の新しい DD

## 出力と成果物

- Produced artifacts: form-sync.ts の古い文の関数の片付け、/admin/forms の画面の読み出しの重複の整理、静的なテストの対象の src/lib までの拡大
- Consumed artifacts: P05 の実装、P04 の静的なテスト、docs/product/design-decisions.md の新しい DD
- Write scope/touches: src/lib/domain/setup-gaps.ts、src/lib/domain/form-sync.ts、src/lib/domain/form-sync.test.ts、src/app/admin/forms/page.tsx、src/lib/comparison-gap-source.test.ts

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P07"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P07 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P07 の完了が条件）

## 実装対象

- Frontend: 適用: /admin/forms の画面に残る比べるための読み出しの重複を P05 の読み出しに寄せる。ほかの利用側の画面は変えない
- Backend: 適用: form-sync.ts の古い文の関数と setup-gaps.ts の重複した組み立てを片付ける
- API: N/A: server action は変えない
- Data: N/A: 表・列の追加・変更が無いので、D1 の移行と backfill は無い
- Infrastructure: N/A: デプロイの単位は変えない
- Security: N/A: 権限の境界は P05 で決まっており、ここでは変えない
- Quality: 適用: 静的なテストの対象を src/lib まで広げ、pnpm test・typecheck を通す
- Documentation: N/A: 文書は P12 で扱う
- Operations: N/A: 運用の変更なし

## Write scope と競合制約

- `touches`: `src/lib/domain/setup-gaps.ts`、`src/lib/domain/form-sync.ts`、`src/lib/domain/form-sync.test.ts`、`src/app/admin/forms/page.tsx`、`src/lib/comparison-gap-source.test.ts`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P08 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P08 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P07 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P08 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P07）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P08` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm test / pnpm run typecheck / git diff --stat main -- src/components/SetupGapList.tsx src/app/admin/cycles/page.tsx src/app/admin/setup/SetupGuide.tsx src/components/StaleCyclesNotice.tsx src/lib/domain/setup-readiness.ts
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P08` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P08` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] 静的なテストが src/lib を含めて通り、比べる警告の文が ComparisonGap の外で0件
- [ ] SetupGap のほかの利用側5ファイルに差分が無い
- [ ] pnpm test と typecheck が通る
- [ ] 証跡: pnpm test と typecheck の実行の記録、src/lib まで広げた静的なテストが通った記録、ほかの利用側5ファイルの差分が0件の記録

## 検証方法

- 自動検証: `pnpm test`
- 自動検証: `pnpm run typecheck`
- 自動検証: `git diff --stat main -- src/components/SetupGapList.tsx src/app/admin/cycles/page.tsx src/app/admin/setup/SetupGuide.tsx src/components/StaleCyclesNotice.tsx src/lib/domain/setup-readiness.ts`
- 証跡: pnpm test と typecheck の実行の記録、src/lib まで広げた静的なテストが通った記録、ほかの利用側5ファイルの差分が0件の記録

## リスクとロールバック

- 範囲の外を取り込まない: DB の移行
- 範囲の外を取り込まない: 比べる警告以外の設定不足の一覧の表示の変更（U7）
- 範囲の外を取り込まない: SetupGap のほかの利用側の変更
- ロールバック: この段の PR を revert する。P05 の形に戻るだけで、利用者に見える変化は無い
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P07 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P09

## Workstream applicability

- Frontend: 適用: /admin/forms の画面に残る比べるための読み出しの重複を P05 の読み出しに寄せる。ほかの利用側の画面は変えない
- Backend: 適用: form-sync.ts の古い文の関数と setup-gaps.ts の重複した組み立てを片付ける
- API: N/A: server action は変えない
- Data: N/A: 表・列の追加・変更が無いので、D1 の移行と backfill は無い
- Infrastructure: N/A: デプロイの単位は変えない
- Security: N/A: 権限の境界は P05 で決まっており、ここでは変えない
- Quality: 適用: 静的なテストの対象を src/lib まで広げ、pnpm test・typecheck を通す
- Documentation: N/A: 文書は P12 で扱う
- Operations: N/A: 運用の変更なし

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-backend, arch-system-spec-frontend, arch-system-spec-database。比べる警告以外の設定不足の一覧の表示の形は変えない（U7 は scope_out）。比べる警告の文は comparison-gap.ts の1か所だけで作る
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: DB の移行・backfill：N/A（表・列の変更なし）。SetupGap の型とほかの利用側は比べる警告以外の設定不足のために残し、変えない

## Verification and evidence

- Automated commands: pnpm test / pnpm run typecheck / git diff --stat main -- src/components/SetupGapList.tsx src/app/admin/cycles/page.tsx src/app/admin/setup/SetupGuide.tsx src/components/StaleCyclesNotice.tsx src/lib/domain/setup-readiness.ts
- Required evidence: pnpm test と typecheck の実行の記録、src/lib まで広げた静的なテストが通った記録、ほかの利用側5ファイルの差分が0件の記録

## Rollout and rollback

- Rollout: P08 の branch の PR で出す。文の組み立てを寄せるだけで、利用者に見える変化は無い
- Rollback trigger and steps: この段の PR を revert する。P05 の形に戻るだけで、利用者に見える変化は無い

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P08 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, refactoring-migration
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-backend, arch-system-spec-frontend, arch-system-spec-database
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P08
- classification: confidence 0.9 / refactoring-migration の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p08.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-08-refactoring-migration.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-backend, arch-system-spec-frontend, arch-system-spec-database
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P08 refactoring-migration（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P07

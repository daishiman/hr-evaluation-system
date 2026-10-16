---
graph_node_id: "SYS-COMPARISON-GAP-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "受け入れ条件 AC1〜AC7 と、3画面×状態の表を受領書に固める"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "requirements"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: []
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-ui-ux", "arch-system-spec-maintenance-ops"]
resource_scope: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
purpose: "feature の acceptance 7件に AC1〜AC7 の番号を振り、それぞれの確かめ方（テストの名前・コマンド・見る画面）を1対1で決める。アンケートの一覧（/admin/forms）・アンケート1本（/admin/forms/[id]）・使うKPIを選ぶ（/admin/scheme/[group]/criteria） の3画面 × 状態（ズレ0件・下書きで回答0件・下書きで回答あり・公開中・同じ評価期間と等級により新しい下書きあり）の表で、閉じた1行と開いた中身を決める。用語をそろえる：比べる警告・ComparisonGap・2つのページ（使うKPIを選ぶ／このアンケート）・直す操作。"
goal: "受け入れ条件 AC1〜AC7 と、3画面×状態の表を受領書に固める"
scope_in: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
scope_out: ["コードとテストの変更", "表示の文言の最終の字面（P02 で決め、P05 で実装する）", "配色・テーマの変更（AGENTS.md と DD-003）"]
acceptance: ["AC1〜AC7 が feature の acceptance 7件と1対1で対応し、それぞれに確かめ方がある", "3画面×5状態の表に、閉じた1行と開いた中身と直す操作が埋まっている"]
architecture_refs: ["arch-system-spec-ui-ux", "arch-system-spec-maintenance-ops"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P01"
classification_confidence: 0.9
classification_reason: "P01 requirements の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p01.md", "confidence": 0.9}]
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

# 受け入れ条件 AC1〜AC7 と、3画面×状態の表を受領書に固める

## 目的

- feature の acceptance 7件に AC1〜AC7 の番号を振り、それぞれの確かめ方（テストの名前・コマンド・見る画面）を1対1で決める
- アンケートの一覧（/admin/forms）・アンケート1本（/admin/forms/[id]）・使うKPIを選ぶ（/admin/scheme/[group]/criteria） の3画面 × 状態（ズレ0件・下書きで回答0件・下書きで回答あり・公開中・同じ評価期間と等級により新しい下書きあり）の表で、閉じた1行と開いた中身を決める
- 用語をそろえる：比べる警告・ComparisonGap・2つのページ（使うKPIを選ぶ／このアンケート）・直す操作

## 背景

- 今の警告は『いま選んでいる評価項目と、このアンケートが聞いている項目が食い違っています』の文だけで、どのページとどのページが食い違うかが分からず、たどれない（利用者の要望）
- 確定した system-spec の G16・O16・I17 と ui-ux (13) が、比べる警告に2つのページの階層つきの名前とリンクを付けることを決めている
- 利用者の追加の指示：既定は畳む・押すと開く・情報は必要最小限・文章でなく『下記の内容を変更・修正してください』の箇条書きか表

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-ui-ux, arch-system-spec-maintenance-ops
- Entry gate: この package が promote 済みで dev-graph に登録済み、かつ check-implementation-readiness.py が complete を返す
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: features/feature-comparison-gap-two-page-links.context.json、system-spec/00-requirements-definition.md、system-spec/ui-ux.md、docs/product/spec.md の 22 章

## 出力と成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md（AC1〜AC7、3画面×状態の表、用語の表）
- Consumed artifacts: features/feature-comparison-gap-two-page-links.context.json、system-spec/00-requirements-definition.md、system-spec/ui-ux.md、docs/product/spec.md の 22 章
- Write scope/touches: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md

## 依存関係

- `depends_on`: []
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、依存先が無い
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（最初の段で依存先は無い）

## 実装対象

- Frontend: N/A: この段は受け入れ条件を文書に固めるだけで、画面のコードは変えない（画面の振る舞いは表として書く）
- Backend: N/A: 読み出しの形は P02 で決める。ここでは受け入れ条件の文だけを書く
- API: N/A: 新しいサーバー処理は作らない（feature の scope_out）
- Data: N/A: 表・列の追加なし
- Infrastructure: N/A: デプロイの単位と設定は変えない
- Security: 適用: AC4（リンク先が台帳にあり役割で開ける・他社の名前を含めない）と AC5（他社の gradeId の拒否）を受け入れ条件として書く
- Quality: 適用: AC ごとに確かめるテストのファイル名とコマンドを決め、P04 の入力にする
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md を新しく作る
- Operations: N/A: 運用の手順は P12 と P13 で扱う

## Write scope と競合制約

- `touches`: `docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P01 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P01 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（最初の段で依存先は無い）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P01 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（なし（この package の起点））が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P01` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm run check:docs
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P01` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P01` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] AC1〜AC7 が feature の acceptance 7件と1対1で対応し、それぞれに確かめ方がある
- [ ] 3画面×5状態の表に、閉じた1行と開いた中身と直す操作が埋まっている
- [ ] 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に AC1〜AC7 の表と3画面×状態の表がある、feature の acceptance 7件と AC1〜AC7 が1対1で対応する

## 検証方法

- 自動検証: `pnpm run check:docs`
- 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に AC1〜AC7 の表と3画面×状態の表がある、feature の acceptance 7件と AC1〜AC7 が1対1で対応する

## リスクとロールバック

- 範囲の外を取り込まない: コードとテストの変更
- 範囲の外を取り込まない: 表示の文言の最終の字面（P02 で決め、P05 で実装する）
- 範囲の外を取り込まない: 配色・テーマの変更（AGENTS.md と DD-003）
- ロールバック: 受領書のコミットを revert する
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、依存先が無い
- 次に利用するノード: SYS-COMPARISON-GAP-P02

## Workstream applicability

- Frontend: N/A: この段は受け入れ条件を文書に固めるだけで、画面のコードは変えない（画面の振る舞いは表として書く）
- Backend: N/A: 読み出しの形は P02 で決める。ここでは受け入れ条件の文だけを書く
- API: N/A: 新しいサーバー処理は作らない（feature の scope_out）
- Data: N/A: 表・列の追加なし
- Infrastructure: N/A: デプロイの単位と設定は変えない
- Security: 適用: AC4（リンク先が台帳にあり役割で開ける・他社の名前を含めない）と AC5（他社の gradeId の拒否）を受け入れ条件として書く
- Quality: 適用: AC ごとに確かめるテストのファイル名とコマンドを決め、P04 の入力にする
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md を新しく作る
- Operations: N/A: 運用の手順は P12 と P13 で扱う

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-ui-ux, arch-system-spec-maintenance-ops。受け入れ条件は ui-ux (13)・frontend (8)・backend (11)・security (8)・maintenance-ops (5) の契約から取る。新しい設計判断はしない
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: N/A: 文書の追加だけで、既存の振る舞いを変えない

## Verification and evidence

- Automated commands: pnpm run check:docs
- Required evidence: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に AC1〜AC7 の表と3画面×状態の表がある、feature の acceptance 7件と AC1〜AC7 が1対1で対応する

## Rollout and rollback

- Rollout: 受領書の追加だけで、利用者に見える変化はない
- Rollback trigger and steps: 受領書のコミットを revert する

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P01 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, requirements
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-ui-ux, arch-system-spec-maintenance-ops
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P01
- classification: confidence 0.9 / requirements の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p01.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-01-requirements.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-ui-ux, arch-system-spec-maintenance-ops
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P01 requirements（system-plan-phase-names の確定表）
- Dependencies: なし（最初の段）

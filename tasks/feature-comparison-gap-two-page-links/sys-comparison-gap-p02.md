---
graph_node_id: "SYS-COMPARISON-GAP-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "ComparisonGap 型・読み出し・部品の props・リンクの照合・gradeIds の検査を設計する"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "architecture"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P01"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-backend", "arch-system-spec-frontend", "arch-system-spec-security", "arch-system-spec-database", "arch-system-spec-auth"]
resource_scope: ["docs/product/design-decisions.md"]
purpose: "ComparisonGap 型を決める：比べている2つのページ（階層つきの名前・href・いま開いているページか）・項目ごとの有無（使うKPIを選ぶにある／このアンケートにある）・件数（足りない・余分）・直す操作（設問を作り直す／この等級だけ新しい版の下書きを作る／新しい下書きを開く）。ページ名の作り方を決める：ルート台帳の親の画面名と見出しをつなぐ（pointGroupLabel と stepTitle の select、formRowTitle）。リンクは schemeStepPath とアンケートの道筋で作る。読み出しを2つ決める：アンケート1本ぶんのズレと、区分の等級に当たり受付前か受付中の評価期間にある下書きか公開中のアンケートのズレを会社の範囲で一度に読む処理（同じ評価期間・等級のより新しい下書きの有無を含む）。部品 ComparisonGapNotice の props を決め、開閉は既存の InlineDetail、ボタンは ActionButton を使う。createForms の gradeIds の検査を決める：自社のものでない gradeId が1件でもあれば何も作らずに拒否する（今は黙って絞り込んでいる）。formSyncGaps の戻りを ComparisonGap に変える範囲を決める：呼ぶのは /admin/forms の画面と既存テスト2件（setup-gaps.test.ts・setup-gaps-links.test.ts）だけ。form-sync.ts の describeFormKpiDiff（画面から呼ばれていない古い文の関数）は P08 で消すか ComparisonGap に寄せる。"
goal: "ComparisonGap 型・読み出し・部品の props・リンクの照合・gradeIds の検査を設計する"
scope_in: ["docs/product/design-decisions.md"]
scope_out: ["実装のコード", "比べる警告以外の設定不足の一覧（SetupGapList など）の表示の変更（U7）", "新しい書き込みのサーバー処理の追加"]
acceptance: ["ComparisonGap 型が2つのページと項目ごとの有無を必須にしている", "2つの読み出しが会社の範囲で絞る形になっている", "createForms が他社の gradeId を1件でも含むと何も作らずに拒否する形になっている"]
architecture_refs: ["arch-system-spec-backend", "arch-system-spec-frontend", "arch-system-spec-security", "arch-system-spec-database", "arch-system-spec-auth"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P02"
classification_confidence: 0.9
classification_reason: "P02 architecture の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p02.md", "confidence": 0.9}]
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

# ComparisonGap 型・読み出し・部品の props・リンクの照合・gradeIds の検査を設計する

## 目的

- ComparisonGap 型を決める：比べている2つのページ（階層つきの名前・href・いま開いているページか）・項目ごとの有無（使うKPIを選ぶにある／このアンケートにある）・件数（足りない・余分）・直す操作（設問を作り直す／この等級だけ新しい版の下書きを作る／新しい下書きを開く）
- ページ名の作り方を決める：ルート台帳の親の画面名と見出しをつなぐ（pointGroupLabel と stepTitle の select、formRowTitle）。リンクは schemeStepPath とアンケートの道筋で作る
- 読み出しを2つ決める：アンケート1本ぶんのズレと、区分の等級に当たり受付前か受付中の評価期間にある下書きか公開中のアンケートのズレを会社の範囲で一度に読む処理（同じ評価期間・等級のより新しい下書きの有無を含む）
- 部品 ComparisonGapNotice の props を決め、開閉は既存の InlineDetail、ボタンは ActionButton を使う
- createForms の gradeIds の検査を決める：自社のものでない gradeId が1件でもあれば何も作らずに拒否する（今は黙って絞り込んでいる）
- formSyncGaps の戻りを ComparisonGap に変える範囲を決める：呼ぶのは /admin/forms の画面と既存テスト2件（setup-gaps.test.ts・setup-gaps-links.test.ts）だけ。form-sync.ts の describeFormKpiDiff（画面から呼ばれていない古い文の関数）は P08 で消すか ComparisonGap に寄せる

## 背景

- 今は formSyncGaps（src/lib/domain/setup-gaps.ts）が SetupGap を返し、警告の文はその中の固定の文で、2つのページの情報を持たない
- 比べる警告を型で強制しないと、別の画面で文だけの警告がまた生まれる（O16 の『欠落0件』の根拠）
- createForms は今 grades を gradeIds で絞るだけで、他社の id が混ざっても黙って無視する。新しい版を作る操作を足すので、この境界を拒否に変える

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-backend, arch-system-spec-frontend, arch-system-spec-security, arch-system-spec-database, arch-system-spec-auth, SYS-COMPARISON-GAP-P01
- Entry gate: P01 の受領書に AC1〜AC7 と3画面×状態の表がある
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md、src/lib/domain/setup-gaps.ts、src/lib/domain/form-sync.ts、src/lib/domain/scheme-steps.ts、src/lib/master-usage.ts、src/actions/forms.ts、system-spec/route-ledger.json、src/components/ui.tsx、src/app/admin/forms/page.tsx

## 出力と成果物

- Produced artifacts: docs/product/design-decisions.md の新しい DD（ComparisonGap の設計）
- Consumed artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md、src/lib/domain/setup-gaps.ts、src/lib/domain/form-sync.ts、src/lib/domain/scheme-steps.ts、src/lib/master-usage.ts、src/actions/forms.ts、system-spec/route-ledger.json、src/components/ui.tsx、src/app/admin/forms/page.tsx
- Write scope/touches: docs/product/design-decisions.md

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P01"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P01 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P01 の完了が条件）

## 実装対象

- Frontend: 適用: ComparisonGapNotice の props と、閉じた1行・開いた中身の順（①見出しの文 ②2つのリンク ③表 ④ボタン1つ ⑤注記1行）を決める
- Backend: 適用: ComparisonGap 型・2つの読み出し・ページ名とリンクの作り方を決める
- API: 適用: 既存の server action createForms の入力の検査（gradeIds が全件自社のものであること）を決める。新しい server action は作らない
- Data: N/A: 表・列の追加なし。既存の forms・form_items・評価の区分の criteria を読むだけで、D1 の移行は無い
- Infrastructure: N/A: Worker の単位と binding は変えない
- Security: 適用: リンク先をルート台帳にあり見る人の役割で開けるものに限る規則、会社の範囲で絞る読み出し、他社の区分の URL を今どおり notFound にする規則を決める
- Quality: 適用: 設計の各判断に、P04 で書くテストの名前を対応させる
- Documentation: 適用: docs/product/design-decisions.md に新しい DD として記録する
- Operations: N/A: 運用の変更なし

## Write scope と競合制約

- `touches`: `docs/product/design-decisions.md`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P02 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P02 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P01 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P02 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P01）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P02` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm run check:docs
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P02` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P02` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] ComparisonGap 型が2つのページと項目ごとの有無を必須にしている
- [ ] 2つの読み出しが会社の範囲で絞る形になっている
- [ ] createForms が他社の gradeId を1件でも含むと何も作らずに拒否する形になっている
- [ ] 証跡: design-decisions.md の新しい DD に、型・読み出し・props・照合・gradeIds の検査の5つが揃っている

## 検証方法

- 自動検証: `pnpm run check:docs`
- 証跡: design-decisions.md の新しい DD に、型・読み出し・props・照合・gradeIds の検査の5つが揃っている

## リスクとロールバック

- 範囲の外を取り込まない: 実装のコード
- 範囲の外を取り込まない: 比べる警告以外の設定不足の一覧（SetupGapList など）の表示の変更（U7）
- 範囲の外を取り込まない: 新しい書き込みのサーバー処理の追加
- ロールバック: DD のコミットを revert する
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P01 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P03

## Workstream applicability

- Frontend: 適用: ComparisonGapNotice の props と、閉じた1行・開いた中身の順（①見出しの文 ②2つのリンク ③表 ④ボタン1つ ⑤注記1行）を決める
- Backend: 適用: ComparisonGap 型・2つの読み出し・ページ名とリンクの作り方を決める
- API: 適用: 既存の server action createForms の入力の検査（gradeIds が全件自社のものであること）を決める。新しい server action は作らない
- Data: N/A: 表・列の追加なし。既存の forms・form_items・評価の区分の criteria を読むだけで、D1 の移行は無い
- Infrastructure: N/A: Worker の単位と binding は変えない
- Security: 適用: リンク先をルート台帳にあり見る人の役割で開けるものに限る規則、会社の範囲で絞る読み出し、他社の区分の URL を今どおり notFound にする規則を決める
- Quality: 適用: 設計の各判断に、P04 で書くテストの名前を対応させる
- Documentation: 適用: docs/product/design-decisions.md に新しい DD として記録する
- Operations: N/A: 運用の変更なし

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-backend, arch-system-spec-frontend, arch-system-spec-security, arch-system-spec-database, arch-system-spec-auth。architecture の backend・frontend・security・database・auth を参照し、新しい architecture node は作らない
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: SetupGap 型と、ほかの利用側（src/components/SetupGapList.tsx・src/app/admin/cycles/page.tsx・src/app/admin/setup/SetupGuide.tsx・src/components/StaleCyclesNotice.tsx・src/lib/domain/setup-readiness.ts）は比べる警告を扱わないので変えない。formSyncGaps の呼び出し側の対応は P05、describeFormKpiDiff の片付けは P08 に割り当てる

## Verification and evidence

- Automated commands: pnpm run check:docs
- Required evidence: design-decisions.md の新しい DD に、型・読み出し・props・照合・gradeIds の検査の5つが揃っている

## Rollout and rollback

- Rollout: 設計の文書だけで、利用者に見える変化はない
- Rollback trigger and steps: DD のコミットを revert する

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P02 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, architecture
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-backend, arch-system-spec-frontend, arch-system-spec-security, arch-system-spec-database, arch-system-spec-auth
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P02
- classification: confidence 0.9 / architecture の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p02.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-02-architecture.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-backend, arch-system-spec-frontend, arch-system-spec-security, arch-system-spec-database, arch-system-spec-auth
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P02 architecture（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P01

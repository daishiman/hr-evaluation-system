---
graph_node_id: "SYS-COMPARISON-GAP-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "ComparisonGap・読み出し・ComparisonGapNotice・3画面・createForms の検査を実装する"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "implementation"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P04"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-frontend", "arch-system-spec-backend", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/lib/domain/comparison-gap.ts", "src/lib/domain/setup-gaps.ts", "src/lib/domain/form-sync.ts", "src/lib/comparison-gap-loader.ts", "src/components/ComparisonGapNotice.tsx", "src/app/admin/forms/page.tsx", "src/app/admin/forms/[id]/page.tsx", "src/app/admin/scheme/[group]/criteria/page.tsx", "src/app/admin/scheme/data.ts", "src/actions/forms.ts", "src/lib/domain/setup-gaps.test.ts", "src/lib/domain/setup-gaps-links.test.ts"]
purpose: "ComparisonGap 型と、それを作る処理を足し、formSyncGaps をこの型で返す形に改める。formSyncGaps を呼ぶ既存テスト2件（setup-gaps.test.ts・setup-gaps-links.test.ts）は、typecheck が通るところまで呼び出しの型だけを合わせる。アンケート1本ぶんのズレの読み出しと、区分のアンケートのズレを会社の範囲で一度に読む読み出しを足す。ComparisonGapNotice を1つ作り、3画面はこれだけを使う。既定は注意の印・『評価項目とのズレ ◯件（足りない◯・余分◯）』・『直すところを見る』の1行だけ。アンケート側の2画面で開いた中は ①『下記の内容を変更・修正してください』②2つのページのリンク2行（いま開いているページに『（このページ）』）③項目／使うKPIを選ぶ／このアンケートの表 ④ボタン1つ ⑤公開後か回答ありのときだけの注記1行。使うKPIを選ぶの画面では、ズレているアンケートごとに1行の表（アンケート（リンク）・聞いていない項目・余分に聞いている項目）。直す操作：下書きで回答0件なら『設問を作り直す』、それ以外は『この等級だけ新しい版の下書きを作る』。より新しい下書きがあればボタンの代わりにその下書きへのリンク。新しい版は既存の createForms に gradeIds を1件渡して作る。createForms で、自社のものでない gradeId が1件でもあれば何も作らずに拒否する。"
goal: "ComparisonGap・読み出し・ComparisonGapNotice・3画面・createForms の検査を実装する"
scope_in: ["src/lib/domain/comparison-gap.ts", "src/lib/domain/setup-gaps.ts", "src/lib/domain/form-sync.ts", "src/lib/comparison-gap-loader.ts", "src/components/ComparisonGapNotice.tsx", "src/app/admin/forms/page.tsx", "src/app/admin/forms/[id]/page.tsx", "src/app/admin/scheme/[group]/criteria/page.tsx", "src/app/admin/scheme/data.ts", "src/actions/forms.ts", "src/lib/domain/setup-gaps.test.ts", "src/lib/domain/setup-gaps-links.test.ts"]
scope_out: ["比べる警告以外の設定不足の一覧の表示の変更（U7）", "公開後のアンケートの設問の差し替え", "新しい書き込みのサーバー処理の追加", "配色・テーマの変更", "所属の並び順と所属の追加（qa-w12・D-008・D-009）"]
acceptance: ["P04 の6種のテストがすべて通る", "3画面が ComparisonGapNotice だけを使い、画面ごとの details 要素が無い", "createForms が他社の gradeId を含む入力で何も作らずに拒否する"]
architecture_refs: ["arch-system-spec-frontend", "arch-system-spec-backend", "arch-system-spec-security", "arch-system-spec-ui-ux"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P05"
classification_confidence: 0.9
classification_reason: "P05 implementation の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p05.md", "confidence": 0.9}]
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

# ComparisonGap・読み出し・ComparisonGapNotice・3画面・createForms の検査を実装する

## 目的

- ComparisonGap 型と、それを作る処理を足し、formSyncGaps をこの型で返す形に改める。formSyncGaps を呼ぶ既存テスト2件（setup-gaps.test.ts・setup-gaps-links.test.ts）は、typecheck が通るところまで呼び出しの型だけを合わせる
- アンケート1本ぶんのズレの読み出しと、区分のアンケートのズレを会社の範囲で一度に読む読み出しを足す
- ComparisonGapNotice を1つ作り、3画面はこれだけを使う。既定は注意の印・『評価項目とのズレ ◯件（足りない◯・余分◯）』・『直すところを見る』の1行だけ
- アンケート側の2画面で開いた中は ①『下記の内容を変更・修正してください』②2つのページのリンク2行（いま開いているページに『（このページ）』）③項目／使うKPIを選ぶ／このアンケートの表 ④ボタン1つ ⑤公開後か回答ありのときだけの注記1行。使うKPIを選ぶの画面では、ズレているアンケートごとに1行の表（アンケート（リンク）・聞いていない項目・余分に聞いている項目）
- 直す操作：下書きで回答0件なら『設問を作り直す』、それ以外は『この等級だけ新しい版の下書きを作る』。より新しい下書きがあればボタンの代わりにその下書きへのリンク。新しい版は既存の createForms に gradeIds を1件渡して作る
- createForms で、自社のものでない gradeId が1件でもあれば何も作らずに拒否する

## 背景

- P04 のテストを通すことが、この段の完了の条件になる
- 利用者の指示：窓（モーダル）は使わず、その場で開く。説明の段落は置かず、箇条書きか表にする

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-frontend, arch-system-spec-backend, arch-system-spec-security, arch-system-spec-ui-ux, SYS-COMPARISON-GAP-P04
- Entry gate: P04 の6種のテストがコミット済みで、未実装で失敗している
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: docs/product/design-decisions.md の新しい DD、P04 の6種のテスト、src/components/ui.tsx、src/components/ActionButton.tsx、src/lib/domain/scheme-steps.ts、src/lib/master-usage.ts、system-spec/route-ledger.json

## 出力と成果物

- Produced artifacts: src/lib/domain/comparison-gap.ts、src/lib/comparison-gap-loader.ts、src/components/ComparisonGapNotice.tsx、3画面の変更、src/actions/forms.ts の検査
- Consumed artifacts: docs/product/design-decisions.md の新しい DD、P04 の6種のテスト、src/components/ui.tsx、src/components/ActionButton.tsx、src/lib/domain/scheme-steps.ts、src/lib/master-usage.ts、system-spec/route-ledger.json
- Write scope/touches: src/lib/domain/comparison-gap.ts、src/lib/domain/setup-gaps.ts、src/lib/domain/form-sync.ts、src/lib/comparison-gap-loader.ts、src/components/ComparisonGapNotice.tsx、src/app/admin/forms/page.tsx、src/app/admin/forms/[id]/page.tsx、src/app/admin/scheme/[group]/criteria/page.tsx、src/app/admin/scheme/data.ts、src/actions/forms.ts、src/lib/domain/setup-gaps.test.ts、src/lib/domain/setup-gaps-links.test.ts

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P04"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P04 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P04 の完了が条件）

## 実装対象

- Frontend: 適用: ComparisonGapNotice を作り、3画面に置く。表は table 要素で th に scope、○ と — に『ある』『ない』の読み上げの文字、狭い幅では横に流せる枠に入れる
- Backend: 適用: ComparisonGap を作る処理と2つの読み出しを足し、formSyncGaps の戻りを改める
- API: 適用: createForms の gradeIds の検査を拒否に変える。役割の指定と送り元の確認は今どおり通す
- Data: N/A: 表・列の追加なし。読み出しは既存の表を会社の範囲で読む
- Infrastructure: N/A: Worker の設定と binding は変えない
- Security: 適用: リンク先はルート台帳にあり見る人の役割で開けるものだけにする。他社の区分の URL は今どおり notFound
- Quality: 適用: P04 の6種のテストを通す
- Documentation: N/A: 文書は P12 で扱う
- Operations: N/A: 運用の変更なし

## Write scope と競合制約

- `touches`: `src/lib/domain/comparison-gap.ts`、`src/lib/domain/setup-gaps.ts`、`src/lib/domain/form-sync.ts`、`src/lib/comparison-gap-loader.ts`、`src/components/ComparisonGapNotice.tsx`、`src/app/admin/forms/page.tsx`、`src/app/admin/forms/[id]/page.tsx`、`src/app/admin/scheme/[group]/criteria/page.tsx`、`src/app/admin/scheme/data.ts`、`src/actions/forms.ts`、`src/lib/domain/setup-gaps.test.ts`、`src/lib/domain/setup-gaps-links.test.ts`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P05 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P05 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P04 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P05 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P04）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P05` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm vitest run src/lib/domain/comparison-gap.test.ts src/lib/comparison-gap-source.test.ts src/lib/comparison-gap-links.test.ts src/components/ComparisonGapNotice.test.ts src/actions/forms-grade-scope.test.ts / pnpm run typecheck
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P05` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P05` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] P04 の6種のテストがすべて通る
- [ ] 3画面が ComparisonGapNotice だけを使い、画面ごとの details 要素が無い
- [ ] createForms が他社の gradeId を含む入力で何も作らずに拒否する
- [ ] 証跡: P04 の6種のテストがすべて通った実行の記録、typecheck が通った記録

## 検証方法

- 自動検証: `pnpm vitest run src/lib/domain/comparison-gap.test.ts src/lib/comparison-gap-source.test.ts src/lib/comparison-gap-links.test.ts src/components/ComparisonGapNotice.test.ts src/actions/forms-grade-scope.test.ts`
- 自動検証: `pnpm run typecheck`
- 証跡: P04 の6種のテストがすべて通った実行の記録、typecheck が通った記録

## リスクとロールバック

- 範囲の外を取り込まない: 比べる警告以外の設定不足の一覧の表示の変更（U7）
- 範囲の外を取り込まない: 公開後のアンケートの設問の差し替え
- 範囲の外を取り込まない: 新しい書き込みのサーバー処理の追加
- 範囲の外を取り込まない: 配色・テーマの変更
- 範囲の外を取り込まない: 所属の並び順と所属の追加（qa-w12・D-008・D-009）
- ロールバック: この段のコミットを revert すれば、今の文だけの警告に戻る（表・列の変更が無いので、データの戻しは要らない）
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P04 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P06

## Workstream applicability

- Frontend: 適用: ComparisonGapNotice を作り、3画面に置く。表は table 要素で th に scope、○ と — に『ある』『ない』の読み上げの文字、狭い幅では横に流せる枠に入れる
- Backend: 適用: ComparisonGap を作る処理と2つの読み出しを足し、formSyncGaps の戻りを改める
- API: 適用: createForms の gradeIds の検査を拒否に変える。役割の指定と送り元の確認は今どおり通す
- Data: N/A: 表・列の追加なし。読み出しは既存の表を会社の範囲で読む
- Infrastructure: N/A: Worker の設定と binding は変えない
- Security: 適用: リンク先はルート台帳にあり見る人の役割で開けるものだけにする。他社の区分の URL は今どおり notFound
- Quality: 適用: P04 の6種のテストを通す
- Documentation: N/A: 文書は P12 で扱う
- Operations: N/A: 運用の変更なし

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-frontend, arch-system-spec-backend, arch-system-spec-security, arch-system-spec-ui-ux。P02 の DD どおりに実装する。開閉は InlineDetail（src/components/ui.tsx）、ボタンは ActionButton（src/components/ActionButton.tsx）を使い、画面ごとに details 要素を書かない
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: formSyncGaps の戻りを ComparisonGap に変える。呼ぶのは /admin/forms の画面と既存テスト2件（setup-gaps.test.ts・setup-gaps-links.test.ts）だけなので、この段でその呼び出しの型まで合わせて typecheck を通す。期待値の字面の更新は P06、describeFormKpiDiff と読み出しの重複の片付けは P08。SetupGap 型とほかの利用側は変えない

## Verification and evidence

- Automated commands: pnpm vitest run src/lib/domain/comparison-gap.test.ts src/lib/comparison-gap-source.test.ts src/lib/comparison-gap-links.test.ts src/components/ComparisonGapNotice.test.ts src/actions/forms-grade-scope.test.ts / pnpm run typecheck
- Required evidence: P04 の6種のテストがすべて通った実行の記録、typecheck が通った記録

## Rollout and rollback

- Rollout: P05 の branch の PR で3画面が同時に新しい形になる。段階の公開の切り替えは使わない。本番への公開は P13 でまとめて行う
- Rollback trigger and steps: この段のコミットを revert すれば、今の文だけの警告に戻る（表・列の変更が無いので、データの戻しは要らない）

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P05 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, implementation
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-frontend, arch-system-spec-backend, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P05
- classification: confidence 0.9 / implementation の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p05.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-05-implementation.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-frontend, arch-system-spec-backend, arch-system-spec-security, arch-system-spec-ui-ux
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P05 implementation（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P04

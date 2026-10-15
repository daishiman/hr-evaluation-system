---
graph_node_id: "SYS-COMPARISON-GAP-P09"
artifact_kind: "task"
artifact_subtypes: []
title: "他社の gradeId・役割・他社の名前・a11y・テーマの契約を品質と安全の観点で確かめる"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "quality-assurance"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p09.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-09-quality-assurance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P08"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-security", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend"]
resource_scope: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
purpose: "他社の gradeId を含む createForms が何も作らずに拒否されることを確かめる（AC5）。警告のリンクが見る人の役割で開けるものだけで、応答に他社の名前が含まれないことを確かめる（AC4）。a11y：th の scope、○ と — の読み上げの文字、キーボードでの開閉、フォーカスの見え方を確かめる（AC6）。テーマの契約が変わっていないこと：src/components/theme-contract.test.ts・src/components/palette-contract.test.ts・scripts/aidd-kit-boundary.test.mjs が通り、差分に含まれない。この段はコードを書かない。不合格の項目は、画面・読み出し・リンク・createForms の検査・a11y なら P05、古い文の関数や比べる処理の重複なら P08 に差し戻し、直ったあとにこの段をやり直す。"
goal: "他社の gradeId・役割・他社の名前・a11y・テーマの契約を品質と安全の観点で確かめる"
scope_in: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
scope_out: ["テーマの契約テストと globals.css の brand_color_* の書き換え", "平賀配色への移行"]
acceptance: ["high の指摘が0件", "テーマの契約のファイルの差分が0件"]
architecture_refs: ["arch-system-spec-security", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P09"
classification_confidence: 0.9
classification_reason: "P09 quality-assurance の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p09.md", "confidence": 0.9}]
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

# 他社の gradeId・役割・他社の名前・a11y・テーマの契約を品質と安全の観点で確かめる

## 目的

- 他社の gradeId を含む createForms が何も作らずに拒否されることを確かめる（AC5）
- 警告のリンクが見る人の役割で開けるものだけで、応答に他社の名前が含まれないことを確かめる（AC4）
- a11y：th の scope、○ と — の読み上げの文字、キーボードでの開閉、フォーカスの見え方を確かめる（AC6）
- テーマの契約が変わっていないこと：src/components/theme-contract.test.ts・src/components/palette-contract.test.ts・scripts/aidd-kit-boundary.test.mjs が通り、差分に含まれない
- この段はコードを書かない。不合格の項目は、画面・読み出し・リンク・createForms の検査・a11y なら P05、古い文の関数や比べる処理の重複なら P08 に差し戻し、直ったあとにこの段をやり直す

## 背景

- 新しい版を作る操作を足すので、他社の等級に版を作れる穴が無いことを、作った者とは別の観点で確かめる

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-security, arch-system-spec-auth, arch-system-spec-ui-ux, arch-system-spec-frontend, SYS-COMPARISON-GAP-P08
- Entry gate: P08 で pnpm test と typecheck が通っている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: P05〜P08 の成果、src/lib/permissions-contract.test.ts、system-spec/route-ledger.json

## 出力と成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md の品質と安全の節
- Consumed artifacts: P05〜P08 の成果、src/lib/permissions-contract.test.ts、system-spec/route-ledger.json
- Write scope/touches: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P08"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P08 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P08 の完了が条件）

## 実装対象

- Frontend: 適用: a11y とテーマの契約を確かめる
- Backend: 適用: 読み出しが会社の範囲で絞られていることを確かめる
- API: 適用: createForms の拒否と、役割の指定・送り元の確認を確かめる
- Data: N/A: 表・列の追加なし
- Infrastructure: N/A: デプロイの単位は変えない
- Security: 適用: 他社の gradeId・役割・他社の名前・notFound を確かめる
- Quality: 適用: 指摘を high・medium・low に分け、high 0件を通過の条件にする
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に品質と安全の結果を追記する
- Operations: N/A: 運用の変更なし

## Write scope と競合制約

- `touches`: `docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P09 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P09 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P08 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P09 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P08）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P09` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm test / git diff --stat main -- src/components/theme-contract.test.ts src/components/palette-contract.test.ts scripts/aidd-kit-boundary.test.mjs src/app/globals.css
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P09` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P09` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] high の指摘が0件
- [ ] テーマの契約のファイルの差分が0件
- [ ] 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に観点ごとの判定と high 0件の結論がある、テーマの契約のファイルの差分が0件

## 検証方法

- 自動検証: `pnpm test`
- 自動検証: `git diff --stat main -- src/components/theme-contract.test.ts src/components/palette-contract.test.ts scripts/aidd-kit-boundary.test.mjs src/app/globals.css`
- 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に観点ごとの判定と high 0件の結論がある、テーマの契約のファイルの差分が0件

## リスクとロールバック

- 範囲の外を取り込まない: テーマの契約テストと globals.css の brand_color_* の書き換え
- 範囲の外を取り込まない: 平賀配色への移行
- ロールバック: 不合格の項目は P05 か P08 に差し戻し、受領書の結果を更新する
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P08 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P10

## Workstream applicability

- Frontend: 適用: a11y とテーマの契約を確かめる
- Backend: 適用: 読み出しが会社の範囲で絞られていることを確かめる
- API: 適用: createForms の拒否と、役割の指定・送り元の確認を確かめる
- Data: N/A: 表・列の追加なし
- Infrastructure: N/A: デプロイの単位は変えない
- Security: 適用: 他社の gradeId・役割・他社の名前・notFound を確かめる
- Quality: 適用: 指摘を high・medium・low に分け、high 0件を通過の条件にする
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に品質と安全の結果を追記する
- Operations: N/A: 運用の変更なし

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-security, arch-system-spec-auth, arch-system-spec-ui-ux, arch-system-spec-frontend。architecture の security・auth と、AGENTS.md の配色とテーマの規約（DD-003）を基準にする
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: N/A: 確かめるだけで、振る舞いを変えない

## Verification and evidence

- Automated commands: pnpm test / git diff --stat main -- src/components/theme-contract.test.ts src/components/palette-contract.test.ts scripts/aidd-kit-boundary.test.mjs src/app/globals.css
- Required evidence: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に観点ごとの判定と high 0件の結論がある、テーマの契約のファイルの差分が0件

## Rollout and rollback

- Rollout: 確かめるだけで、利用者に見える変化はない
- Rollback trigger and steps: 不合格の項目は P05 か P08 に差し戻し、受領書の結果を更新する

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P09 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, quality-assurance
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-security, arch-system-spec-auth, arch-system-spec-ui-ux, arch-system-spec-frontend
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P09
- classification: confidence 0.9 / quality-assurance の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p09.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-09-quality-assurance.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-security, arch-system-spec-auth, arch-system-spec-ui-ux, arch-system-spec-frontend
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P09 quality-assurance（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P08

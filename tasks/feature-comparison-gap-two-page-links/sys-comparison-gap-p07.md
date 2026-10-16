---
graph_node_id: "SYS-COMPARISON-GAP-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "preview（8787）で3画面を4つの幅で開き、受け入れ条件を目で確かめる"
project_id: "feature-package-feature-comparison-gap-two-page-links"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["comparison-gap", "acceptance"]
file_path: "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-15T02:10:16Z", "origin_kind": "system-dev-planner", "source_digest": "2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b", "source_path": ".dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-15T02:10:16Z"
updated_at: "2026-10-15T02:10:16Z"
depends_on: ["SYS-COMPARISON-GAP-P06"]
related_nodes: ["feature-comparison-gap-two-page-links", "spec-system-spec-requirements", "arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-infrastructure"]
resource_scope: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
purpose: "preview で アンケートの一覧（/admin/forms）・アンケート1本（/admin/forms/[id]）・使うKPIを選ぶ（/admin/scheme/[group]/criteria） を 375px・768px・1280px・1600px の4つの幅で開き、閉じた1行・開いた中身・直す操作を AC2・AC6 に照らして確かめる。狭い幅でも本文が横に流れず、表だけが横に流せる枠の中で動くことを確かめる。"
goal: "preview（8787）で3画面を4つの幅で開き、受け入れ条件を目で確かめる"
scope_in: ["docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md"]
scope_out: ["本番の DB と本番の画面での確かめ（P13）", "実データ（社員名・評価値など）を使った確かめ"]
acceptance: ["3画面×4つの幅で、閉じた1行・開いた中身が受け入れ条件どおり", "狭い幅で本文が横に流れない"]
architecture_refs: ["arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-infrastructure"]
parent_feature: "feature-comparison-gap-two-page-links"
feature_package_id: "feature-package/feature-comparison-gap-two-page-links"
phase_ref: "P07"
classification_confidence: 0.9
classification_reason: "P07 acceptance の単一責務の実行 task"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p07.md", "confidence": 0.9}]
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

# preview（8787）で3画面を4つの幅で開き、受け入れ条件を目で確かめる

## 目的

- preview で アンケートの一覧（/admin/forms）・アンケート1本（/admin/forms/[id]）・使うKPIを選ぶ（/admin/scheme/[group]/criteria） を 375px・768px・1280px・1600px の4つの幅で開き、閉じた1行・開いた中身・直す操作を AC2・AC6 に照らして確かめる
- 狭い幅でも本文が横に流れず、表だけが横に流せる枠の中で動くことを確かめる

## 背景

- テストは字面と構造を見るが、幅ごとの見え方と開閉の操作感は実際の画面でしか確かめられない

## 入力と前提条件

- Required spec/architecture/phase/task nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-ui-ux, arch-system-spec-frontend, arch-system-spec-infrastructure, SYS-COMPARISON-GAP-P06
- Entry gate: P06 で pnpm test・typecheck・test:coverage が通っている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:fb96922e3b4ff7221639829c1b3523802ec8a1c8df175972e495f4c959963fd2
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Consumed artifacts: P05 と P06 の成果、見本のデータ

## 出力と成果物

- Produced artifacts: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md の受け入れの結果の節
- Consumed artifacts: P05 と P06 の成果、見本のデータ
- Write scope/touches: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md

## 依存関係

- `depends_on`: ["SYS-COMPARISON-GAP-P06"]
- 着手できる条件: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P06 が done
- 並列の条件: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P06 の完了が条件）

## 実装対象

- Frontend: 適用: 3画面×4つの幅で、閉じた1行・開いた中身・キーボードでの開閉を確かめる
- Backend: 適用: 見本のデータで、ズレがあるアンケートとズレが無いアンケートの両方を出す
- API: 適用: 『この等級だけ新しい版の下書きを作る』を押し、その等級の版だけが増えることを確かめる
- Data: N/A: 見本のデータだけを使う。見本のアンケートは締切切れなので、form_deadline_extensions で開ける
- Infrastructure: 適用: preview は build を挟んでからポート 8787 で上げる（.dev.vars の送り元と合わせる）
- Security: 適用: 他社の区分の URL が notFound になることを確かめる
- Quality: 適用: AC2・AC5・AC6 の目視の結果を受領書に残す
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に受け入れの結果を追記する
- Operations: N/A: 本番には触れない

## Write scope と競合制約

- `touches`: `docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md`
- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-COMPARISON-GAP-P07 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に SYS-COMPARISON-GAP-P07 を claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる（直前の SYS-COMPARISON-GAP-P06 の完了が条件）
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## GitHub publication

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P07 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## 実行手順

1. 依存先（SYS-COMPARISON-GAP-P06）が done で、前提条件を満たすことを確かめ、`/dev-graph worktree claim SYS-COMPARISON-GAP-P07` で lease を取る
2. 「出力と成果物」の Write scope の中だけで、成果物を作る・直す
3. 検証のコマンドを実行する: pnpm run preview
4. 「Verification and evidence」の証跡を残し、受入条件の各項目に判定と根拠を付ける
5. PR は作る前に利用者に確かめる。本文に `dev-graph:SYS-COMPARISON-GAP-P07` を書き、main へ向ける
6. `/dev-graph worktree release SYS-COMPARISON-GAP-P07` で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] 3画面×4つの幅で、閉じた1行・開いた中身が受け入れ条件どおり
- [ ] 狭い幅で本文が横に流れない
- [ ] 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に3画面×4つの幅の結果の表がある（見本のデータだけを使い、実データは入れない）

## 検証方法

- 自動検証: `pnpm run preview`
- 証跡: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に3画面×4つの幅の結果の表がある（見本のデータだけを使い、実データは入れない）

## リスクとロールバック

- 範囲の外を取り込まない: 本番の DB と本番の画面での確かめ（P13）
- 範囲の外を取り込まない: 実データ（社員名・評価値など）を使った確かめ
- ロールバック: 受け入れで不合格の項目は P05 に差し戻し、受領書の結果を更新する
- 配布の単位: cloudflare-worker:hr-evaluation-system

## Handoff

- Executor: task-graph build（application-code）
- Ready when: confirmed・evaluation pass・readiness complete・promote 済みの digest・dev-graph の登録が揃い、SYS-COMPARISON-GAP-P06 が done
- 次に利用するノード: SYS-COMPARISON-GAP-P08

## Workstream applicability

- Frontend: 適用: 3画面×4つの幅で、閉じた1行・開いた中身・キーボードでの開閉を確かめる
- Backend: 適用: 見本のデータで、ズレがあるアンケートとズレが無いアンケートの両方を出す
- API: 適用: 『この等級だけ新しい版の下書きを作る』を押し、その等級の版だけが増えることを確かめる
- Data: N/A: 見本のデータだけを使う。見本のアンケートは締切切れなので、form_deadline_extensions で開ける
- Infrastructure: 適用: preview は build を挟んでからポート 8787 で上げる（.dev.vars の送り元と合わせる）
- Security: 適用: 他社の区分の URL が notFound になることを確かめる
- Quality: 適用: AC2・AC5・AC6 の目視の結果を受領書に残す
- Documentation: 適用: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に受け入れの結果を追記する
- Operations: N/A: 本番には触れない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-ui-ux, arch-system-spec-frontend, arch-system-spec-infrastructure。preview は opennextjs-cloudflare の build と preview --port 8787 で上げる
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system（本番は P13 だけが触れる）
- Compatibility/migration/backfill: N/A: 確かめるだけで、振る舞いを変えない

## Verification and evidence

- Automated commands: pnpm run preview
- Required evidence: docs/product/spec-receipts/2026-10-15-comparison-gap-two-page-links.md に3画面×4つの幅の結果の表がある（見本のデータだけを使い、実データは入れない）

## Rollout and rollback

- Rollout: 確かめるだけで、利用者に見える変化はない
- Rollback trigger and steps: 受け入れで不合格の項目は P05 に差し戻し、受領書の結果を更新する

## Tracker publication and completion intent

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- PR body contract: 本文に dev-graph:SYS-COMPARISON-GAP-P07 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Machine-readable registration fields

- feature_package_id: feature-package/feature-comparison-gap-two-page-links
- owners: daishiman
- tags: comparison-gap, acceptance
- related_nodes: feature-comparison-gap-two-page-links, spec-system-spec-requirements, arch-system-spec-ui-ux, arch-system-spec-frontend, arch-system-spec-infrastructure
- parent_feature: feature-comparison-gap-two-page-links
- phase_ref: P07
- classification: confidence 0.9 / acceptance の単一責務の実行 task / tasks/feature-comparison-gap-two-page-links/sys-comparison-gap-p07.md
- tracker_binding_intent: beads
- github_publication: local_only（project_aliases なし・labels なし・milestone なし）
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch・worktree lease 必須・default-branch reconciliation・assignment_owner は dev-graph-scheduler

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/task-specs/phase-07-acceptance.md（2ce1bb44d939ecba4041ebbe3fd6b1f38c7e0573ce3c416eae98c533778ed77b）
- task の一覧（promote 済み）: .dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/workstream-inventory.json
- frontmatter の acceptance・architecture_refs・goal・purpose・scope_in・scope_out は graph の node に無い（register-package が運ばない）ので、上の実行仕様と task の一覧から写した。graph の node の値ではない
- System specification: system-spec/index.md、system-spec/00-requirements-definition.md（G16・O16・I17）
- Architecture: arch-system-spec-ui-ux, arch-system-spec-frontend, arch-system-spec-infrastructure
- Feature: feature-comparison-gap-two-page-links
- Phase doc: P07 acceptance（system-plan-phase-names の確定表）
- Dependencies: SYS-COMPARISON-GAP-P06

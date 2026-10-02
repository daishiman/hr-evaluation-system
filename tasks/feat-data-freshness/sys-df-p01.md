---
graph_node_id: "SYS-DF-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "鮮度の要件の基準線（受入18項目と U1・G1〜G5 への対応）を固める"
project_id: "feature-package-feat-data-freshness"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "requirements"]
file_path: "tasks/feat-data-freshness/sys-df-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: []
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["docs/product/spec.md", "specs/data-freshness.md", "docs/product/spec-receipts/2026-10-01-data-freshness.md"]
purpose: "確定済みの要件定義（system-spec/00-requirements-definition.md の U1〜U9 と G1〜G5）から、feature の受入18項目を製品仕様 §27 と specs/data-freshness.md に1対1で写し、以後の phase が同じ基準線を使う状態にする。"
goal: "鮮度の要件の基準線（受入18項目と U1・G1〜G5 への対応）を固める。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["docs/product/spec.md の §27（保存した結果が、どの画面・タブ・端末でもすぐ見える）", "specs/data-freshness.md（受入18項目の正本）", "docs/product/spec-receipts/2026-10-01-data-freshness.md（仕様を確定した受領の記録）"]
scope_out: ["実装の変更（P05 が受け持つ）", "別の利用者・別の端末へ保存を押し出すこと（W1）", "system-spec/ の確定章の書き換え（spec の工程の成果物で、この package は読むだけ）"]
acceptance: ["A8: check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる", "受入18項目が §27 と specs/data-freshness.md の両方に、同じ番号と同じ意味で載っている"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P01"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P01（requirements）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p01.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.1", "linked_at": "2026-10-01T13:15:33Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 鮮度の要件の基準線（受入18項目と U1・G1〜G5 への対応）を固める

## 目的

確定済みの要件定義（system-spec/00-requirements-definition.md の U1〜U9 と G1〜G5）から、feature の受入18項目を製品仕様 §27 と specs/data-freshness.md に1対1で写し、以後の phase が同じ基準線を使う状態にする。

## 背景

利用者の困りごとは「会社を追加したと出たのに、一覧に出ない。再読み込みしても出ない」で、同じことが利用者の登録・アンケートの作成など作る・変える・消す操作の全部で起きていた。画面ごとの直しではなく、共通の契約として要件を1か所にまとめる必要がある。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: system-spec/00-requirements-definition.md、system-spec/index.md、features/feat-data-freshness.json
- 前提: 依存タスク（なし（この package の起点））が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: docs/product/spec.md の §27（保存した結果が、どの画面・タブ・端末でもすぐ見える）
- 生成物: specs/data-freshness.md（受入18項目の正本）
- 生成物: docs/product/spec-receipts/2026-10-01-data-freshness.md（仕様を確定した受領の記録）
- 更新対象: docs/product/spec.md、specs/data-freshness.md、docs/product/spec-receipts/2026-10-01-data-freshness.md

## 依存関係

- `depends_on`: []
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（requirements）は Frontend を変えない
- Backend/API: N/A: この phase（requirements）は Backend/API を変えない
- Database/Data: N/A: この phase（requirements）は Database/Data を変えない
- Infrastructure: N/A: この phase（requirements）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（requirements）は Security/Privacy を変えない
- Documentation: 対象。§27 と specs/data-freshness.md に受入18項目を載せる

## Write scope と競合制約

- `touches`: `docs/product/spec.md`、`specs/data-freshness.md`、`docs/product/spec-receipts/2026-10-01-data-freshness.md`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P01）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P01 の形で割り当てる
- worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- completion projection: 作業のブランチでは保留の記録だけを残し、既定のブランチ main へマージされた時点の reconciliation で done を書く

## GitHub publication

- Mode: local_only（追跡は Beads。GitHub の Issue は作らない）
- Project aliases: N/A: Beads に束ねるので GitHub Projects は使わない
- Issue labels/milestone: N/A: GitHub の Issue を作らないため
- Initial Project fields: N/A: GitHub Projects を使わないため
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Failure policy: 外部の失敗は対象の操作だけを pending_retry にし、ローカルの promote 済み task は戻さない
- Completion policy: linked_pr_merged_all
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P01` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（なし）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P01 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm check:docs
4. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
5. /dev-graph worktree release SYS-DF-P01 で lease を返す

## 受入条件

- [ ] A8: check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる
- [ ] 受入18項目が §27 と specs/data-freshness.md の両方に、同じ番号と同じ意味で載っている

## 検証方法

- 自動検証: `pnpm check:docs`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: docs/product/spec.md の §27、specs/data-freshness.md、eval-log/system-spec-completeness-report-8.json（6観点 PASS）

## リスクとロールバック

- リスク: 実装の変更（P05 が受け持つ） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: §27 と specs/data-freshness.md の差分を git revert で戻す。要件定義の確定章は書き換えない。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P02
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（requirements）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（requirements）の責務に Backend の変更は含まれない
- API: N/A: この phase（requirements）の責務に API の変更は含まれない
- Data: N/A: この phase（requirements）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（requirements）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（requirements）の責務に Security の変更は含まれない
- Quality: 対象。check:docs が要件定義から8章へ辿れることを確かめる
- Documentation: 対象。§27 と specs/data-freshness.md に受入18項目を載せる
- Operations: N/A: この phase（requirements）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: repository-docs（文書だけ。配布の単位を持たない）

## Verification and evidence

- コマンド: pnpm check:docs
- 証跡: docs/product/spec.md の §27
- 証跡: specs/data-freshness.md
- 証跡: eval-log/system-spec-completeness-report-8.json（6観点 PASS）

## Rollout and rollback

- Rollout: 文書の変更なので、マージした時点で有効になる。
- Rollback: §27 と specs/data-freshness.md の差分を git revert で戻す。要件定義の確定章は書き換えない。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-01-requirements.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

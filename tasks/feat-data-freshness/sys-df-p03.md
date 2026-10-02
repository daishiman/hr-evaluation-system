---
graph_node_id: "SYS-DF-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "設計を独立した評価で確かめる"
project_id: "feature-package-feat-data-freshness"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "design-review"]
file_path: "tasks/feat-data-freshness/sys-df-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P02"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["eval-log/system-spec-completeness-report-8.json", "eval-log/run-dev-graph-decompose-audit.json"]
purpose: "P01・P02 の要件と設計を、作った文脈から切り離した評価者が確かめ、6観点の完成度と feature 分解の整合が PASS である状態にする。"
goal: "設計を独立した評価で確かめる。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["eval-log/system-spec-completeness-report-8.json（6観点 PASS）", "eval-log/run-dev-graph-decompose-audit.json（2回とも PASS）"]
scope_out: ["評価の結果に合わせて確定章を書き換えること"]
acceptance: ["A8: check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる", "完成度の6観点と、分解の監査がどちらも PASS である"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P03（design-review）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p03.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.3", "linked_at": "2026-10-01T13:15:36Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 設計を独立した評価で確かめる

## 目的

P01・P02 の要件と設計を、作った文脈から切り離した評価者が確かめ、6観点の完成度と feature 分解の整合が PASS である状態にする。

## 背景

作った本人の確認だけでは、聞き漏れや循環、phase の混入を見落とす。system-spec-harness の完成度評価と dev-graph の整合監査を、別の文脈で走らせる。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: system-spec/index.md、architecture/data-freshness.md、features/feat-data-freshness.md
- 前提: 依存タスク（SYS-DF-P02）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: eval-log/system-spec-completeness-report-8.json（6観点 PASS）
- 生成物: eval-log/run-dev-graph-decompose-audit.json（2回とも PASS）
- 更新対象: eval-log/system-spec-completeness-report-8.json、eval-log/run-dev-graph-decompose-audit.json

## 依存関係

- `depends_on`: ["SYS-DF-P02"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（design-review）は Frontend を変えない
- Backend/API: N/A: この phase（design-review）は Backend/API を変えない
- Database/Data: N/A: この phase（design-review）は Database/Data を変えない
- Infrastructure: N/A: この phase（design-review）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（design-review）は Security/Privacy を変えない
- Documentation: 対象。評価の指摘を文書へ戻す

## Write scope と競合制約

- `touches`: `eval-log/system-spec-completeness-report-8.json`、`eval-log/run-dev-graph-decompose-audit.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P03）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P03 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P03` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P02）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P03 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: python3 で eval-log/system-spec-completeness-report-8.json の verdict を読む
4. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
5. /dev-graph worktree release SYS-DF-P03 で lease を返す

## 受入条件

- [ ] A8: check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる
- [ ] 完成度の6観点と、分解の監査がどちらも PASS である

## 検証方法

- 自動検証: `python3 で eval-log/system-spec-completeness-report-8.json の verdict を読む`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/system-spec-completeness-report-8.json、eval-log/run-dev-graph-decompose-audit.json

## リスクとロールバック

- リスク: 評価の結果に合わせて確定章を書き換えること を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: 評価が FAIL に変わったら、P01・P02 に差し戻して直し、評価をやり直す。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P04
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（design-review）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（design-review）の責務に Backend の変更は含まれない
- API: N/A: この phase（design-review）の責務に API の変更は含まれない
- Data: N/A: この phase（design-review）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（design-review）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（design-review）の責務に Security の変更は含まれない
- Quality: 対象。独立した評価の結果を記録する
- Documentation: 対象。評価の指摘を文書へ戻す
- Operations: N/A: この phase（design-review）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: repository-eval-log（検証の記録だけ。配布の単位を持たない）

## Verification and evidence

- コマンド: python3 で eval-log/system-spec-completeness-report-8.json の verdict を読む
- 証跡: eval-log/system-spec-completeness-report-8.json
- 証跡: eval-log/run-dev-graph-decompose-audit.json

## Rollout and rollback

- Rollout: 評価の記録なので、配布の手順は無い。
- Rollback: 評価が FAIL に変わったら、P01・P02 に差し戻して直し、評価をやり直す。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-03-design-review.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

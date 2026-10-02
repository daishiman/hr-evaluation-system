---
graph_node_id: "SYS-DF-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "保存の入口を1つにする設計と、3つの書き込みの型を決める"
project_id: "feature-package-feat-data-freshness"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "architecture"]
file_path: "tasks/feat-data-freshness/sys-df-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P01"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["architecture/data-freshness.md", "architecture/graph.json", "architecture/index.md", "docs/product/design-decisions.md"]
purpose: "画面からの書き込みをサーバーアクションの入口 runAction に集め、成功の応答に新しい画面を同梱し、複数の表を書く保存を withCompensation・rollForward・writeMasterBatch の3つの型のどれかに入れる設計を、architecture/data-freshness.md に決める。"
goal: "保存の入口を1つにする設計と、3つの書き込みの型を決める。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["architecture/data-freshness.md（入口・同梱・知らせ・書き込みの型の図と契約）", "architecture/graph.json の arch-data-freshness", "architecture/index.md からの参照"]
scope_out: ["実装そのもの（P05）", "別の端末へ押し出す仕組み（W1）"]
acceptance: ["A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）", "A4: 会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない", "A5: 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない", "A13: 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る", "入口・同梱・知らせ・3つの書き込みの型が、architecture/data-freshness.md に図と契約で書かれている"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P02（architecture）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p02.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.2", "linked_at": "2026-10-01T13:15:35Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 保存の入口を1つにする設計と、3つの書き込みの型を決める

## 目的

画面からの書き込みをサーバーアクションの入口 runAction に集め、成功の応答に新しい画面を同梱し、複数の表を書く保存を withCompensation・rollForward・writeMasterBatch の3つの型のどれかに入れる設計を、architecture/data-freshness.md に決める。

## 背景

原因は、Route Handler を fetch で呼んだあと画面ごとに router.refresh を呼ぶ作りで、呼び忘れと、別々の await で2つの表を書く箇所が残っていたこと。D-001（opt-broadcast）・D-002（opt-server-functions）・D-003（opt-batch-first）を確定済み。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: specs/data-freshness.md、system-spec/index.md、architecture/graph.json
- 前提: 依存タスク（SYS-DF-P01）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: architecture/data-freshness.md（入口・同梱・知らせ・書き込みの型の図と契約）
- 生成物: architecture/graph.json の arch-data-freshness
- 生成物: architecture/index.md からの参照
- 更新対象: architecture/data-freshness.md、architecture/graph.json、architecture/index.md、docs/product/design-decisions.md

## 依存関係

- `depends_on`: ["SYS-DF-P01"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: 対象。成功の知らせを新しい一覧が描き終わってから出す（createCommitGate）設計
- Backend/API: 対象。runAction・runRead の入口と、3つの書き込みの型 ／ 対象。/api/* の共通出口（handle・jsonError）で private, no-store を返す契約
- Database/Data: 対象。D1 の batch と、制度マスタの番号の一意制約（移行 0032）
- Infrastructure: N/A: この phase（architecture）は Infrastructure を変えない
- Security/Privacy: 対象。送信元の二重の検査を残し、allowedOrigins を足さない設計
- Documentation: N/A: この phase（architecture）は Documentation を変えない

## Write scope と競合制約

- `touches`: `architecture/data-freshness.md`、`architecture/graph.json`、`architecture/index.md`、`docs/product/design-decisions.md`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P02）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P02 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P02` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P01）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P02 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm check:docs
4. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
5. /dev-graph worktree release SYS-DF-P02 で lease を返す

## 受入条件

- [ ] A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）
- [ ] A4: 会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない
- [ ] A5: 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない
- [ ] A13: 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る
- [ ] 入口・同梱・知らせ・3つの書き込みの型が、architecture/data-freshness.md に図と契約で書かれている

## 検証方法

- 自動検証: `pnpm check:docs`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: architecture/data-freshness.md、architecture/graph.json の arch-data-freshness

## リスクとロールバック

- リスク: 実装そのもの（P05） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: architecture/data-freshness.md の差分を git revert で戻す。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P03
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: 対象。成功の知らせを新しい一覧が描き終わってから出す（createCommitGate）設計
- Backend: 対象。runAction・runRead の入口と、3つの書き込みの型
- API: 対象。/api/* の共通出口（handle・jsonError）で private, no-store を返す契約
- Data: 対象。D1 の batch と、制度マスタの番号の一意制約（移行 0032）
- Infrastructure: N/A: この phase（architecture）の責務に Infrastructure の変更は含まれない
- Security: 対象。送信元の二重の検査を残し、allowedOrigins を足さない設計
- Quality: N/A: この phase（architecture）の責務に Quality の変更は含まれない
- Documentation: N/A: この phase（architecture）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（architecture）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: repository-docs（文書だけ。配布の単位を持たない）

## Verification and evidence

- コマンド: pnpm check:docs
- 証跡: architecture/data-freshness.md
- 証跡: architecture/graph.json の arch-data-freshness

## Rollout and rollback

- Rollout: 文書の変更なので、マージした時点で有効になる。
- Rollback: architecture/data-freshness.md の差分を git revert で戻す。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-02-architecture.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

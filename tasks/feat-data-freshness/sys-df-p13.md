---
graph_node_id: "SYS-DF-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "配布と戻し方の準備（今回の本番配布は対象外として閉じる）"
project_id: "feature-package-feat-data-freshness"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "release-deploy"]
file_path: "tasks/feat-data-freshness/sys-df-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-13-release-deploy.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P11", "SYS-DF-P12"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["docs/deploy-notes.md"]
purpose: "配布の順番（移行 0031・0032 → CREDENTIAL_ENC_KEY の設定 → Worker の差し替え → 作成直後の ⌘+Shift+R の確認）と戻し方を決めて文書に残す。今回の実行では commit・push・PR と本番配布をしないので、本番の操作は N/A とし、ローカルの preview での確認までで閉じる。"
goal: "配布と戻し方の準備（今回の本番配布は対象外として閉じる）。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["docs/deploy-notes.md の配布の順番と戻し方"]
scope_out: ["今回の実行での本番配布・本番の secret 設定・commit・push・PR"]
acceptance: ["A7: ローカルの preview で、会社の追加の応答に新しい会社が載り、直後の再読み込みにも出る", "本番への変更をこの実行で1件も行っていない", "docs/deploy-notes.md は P12 が揃えた内容を書き換えず、配布の順番と戻し方の節だけを足す"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P13"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P13（release-deploy）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p13.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.13", "linked_at": "2026-10-01T13:15:49Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 配布と戻し方の準備（今回の本番配布は対象外として閉じる）

## 目的

配布の順番（移行 0031・0032 → CREDENTIAL_ENC_KEY の設定 → Worker の差し替え → 作成直後の ⌘+Shift+R の確認）と戻し方を決めて文書に残す。今回の実行では commit・push・PR と本番配布をしないので、本番の操作は N/A とし、ローカルの preview での確認までで閉じる。

## 背景

本番の D1 と secret は外部への変更で、利用者の確認を通す決まりがある（W2・W3）。配布の手順だけを先に揃え、実際の配布は利用者が決める。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: eval-log/feat-data-freshness-evidence.json、docs/deploy-notes.md
- 前提: 依存タスク（SYS-DF-P11、SYS-DF-P12）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: docs/deploy-notes.md の配布の順番と戻し方
- 更新対象: docs/deploy-notes.md

## 依存関係

- `depends_on`: ["SYS-DF-P11", "SYS-DF-P12"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（release-deploy）は Frontend を変えない
- Backend/API: N/A: この phase（release-deploy）は Backend/API を変えない
- Database/Data: N/A: この phase（release-deploy）は Database/Data を変えない
- Infrastructure: 対象。Worker の差し替えと D1 の移行の順番
- Security/Privacy: N/A: この phase（release-deploy）は Security/Privacy を変えない
- Documentation: N/A: この phase（release-deploy）は Documentation を変えない

## Write scope と競合制約

- `touches`: `docs/deploy-notes.md`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P13）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P13 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P13` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P11, SYS-DF-P12）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P13 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm preview（ポート 8788 で立ち上げる手順は docs/deploy-notes.md に従う）
4. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
5. /dev-graph worktree release SYS-DF-P13 で lease を返す

## 受入条件

- [ ] A7: ローカルの preview で、会社の追加の応答に新しい会社が載り、直後の再読み込みにも出る
- [ ] 本番への変更をこの実行で1件も行っていない
- [ ] docs/deploy-notes.md は P12 が揃えた内容を書き換えず、配布の順番と戻し方の節だけを足す

## 検証方法

- 自動検証: `pnpm preview（ポート 8788 で立ち上げる手順は docs/deploy-notes.md に従う）`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: docs/deploy-notes.md

## リスクとロールバック

- リスク: 今回の実行での本番配布・本番の secret 設定・commit・push・PR を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: Worker を1つ前の版へ戻す。移行は足すだけの変更なので、前の版のコードと並べても壊れない。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: feat-data-freshness（feature の完了判定）
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（release-deploy）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（release-deploy）の責務に Backend の変更は含まれない
- API: N/A: この phase（release-deploy）の責務に API の変更は含まれない
- Data: N/A: この phase（release-deploy）の責務に Data の変更は含まれない
- Infrastructure: 対象。Worker の差し替えと D1 の移行の順番
- Security: N/A: この phase（release-deploy）の責務に Security の変更は含まれない
- Quality: N/A: この phase（release-deploy）の責務に Quality の変更は含まれない
- Documentation: N/A: この phase（release-deploy）の責務に Documentation の変更は含まれない
- Operations: 対象。配布後の確認（W2）と、CREDENTIAL_ENC_KEY の設定（W3）

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）

## Verification and evidence

- コマンド: pnpm preview（ポート 8788 で立ち上げる手順は docs/deploy-notes.md に従う）
- 証跡: docs/deploy-notes.md

## Rollout and rollback

- Rollout: 移行 → secret → Worker の順で、利用者の確認を通してから配布する。
- Rollback: Worker を1つ前の版へ戻す。移行は足すだけの変更なので、前の版のコードと並べても壊れない。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-13-release-deploy.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

---
graph_node_id: "SYS-DF-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "製品仕様・設計・運用の文書を揃える"
project_id: "feature-package-feat-data-freshness"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "documentation-operations"]
file_path: "tasks/feat-data-freshness/sys-df-p12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-12-documentation-operations.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P10"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["docs/product/spec.md", "docs/deploy-notes.md", "docs/product/backlog.md", "docs/product/backlog-session-notes.md", "docs/migration-mapping.md", "README.md", ".dev.vars.example", "architecture/index.md", "architecture/account-profile.md", "architecture/master-settings.md", "architecture/release-and-forms.md", "system-spec/account-and-users.md", "system-spec/improvement-requests.md", "system-spec/master-settings.md", "system-spec/release-and-forms.md"]
purpose: "製品仕様 §27・領域別の system-spec・architecture・backlog・移行の対応表・デプロイ時の注意を、実装と同じ内容に揃え、check:docs が通る状態にする。運用では、CREDENTIAL_ENC_KEY の設定（.dev.vars.example に名前だけを載せる）と、ローカルの画面テストの手順を書く。"
goal: "製品仕様・設計・運用の文書を揃える。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["docs/product/spec.md の §27", "docs/deploy-notes.md の §6 と画面テストの説明", "docs/product/backlog.md と backlog-session-notes.md の残課題", "architecture/ と system-spec/ の領域別の文書（account-profile・master-settings・release-and-forms、account-and-users・improvement-requests）で、退避した経路をサーバーアクションの名前に置き換える", "docs/migration-mapping.md の入口の列を、API の経路からサーバーアクションの名前に置き換える", "README.md と .dev.vars.example に、CREDENTIAL_ENC_KEY の作り方と、無いときの振る舞いを書く（.dev.vars.example には秘密ではない見本の文字列だけを置く）"]
scope_out: ["backlog-history-2026-08-13.md の変更", "system-spec/ の確定章（00-requirements-definition.md と、収集マトリクスの各章・index.md）の書き換え", "秘密の値を文書や .dev.vars.example に書くこと"]
acceptance: ["A8: check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる", "check:docs が通る", "docs/product/spec.md は P01 が書いた §27 の受入18項目を変えず、実装との差分の同期だけを足す"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P12"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P12（documentation-operations）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p12.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.12", "linked_at": "2026-10-01T13:15:47Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 製品仕様・設計・運用の文書を揃える

## 目的

製品仕様 §27・領域別の system-spec・architecture・backlog・移行の対応表・デプロイ時の注意を、実装と同じ内容に揃え、check:docs が通る状態にする。運用では、CREDENTIAL_ENC_KEY の設定（.dev.vars.example に名前だけを載せる）と、ローカルの画面テストの手順を書く。

## 背景

入口を移したので、Route Handler を前提にした説明や手順が残ると、次の作業者が古い経路を足してしまう。領域別の文書（利用者・制度マスタ・公開とアンケート・改善要望）は、退避した経路を API 契約として書いていた。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: architecture/data-freshness.md、eval-log/feat-data-freshness-final-review.json
- 前提: 依存タスク（SYS-DF-P10）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: docs/product/spec.md の §27
- 生成物: docs/deploy-notes.md の §6 と画面テストの説明
- 生成物: docs/product/backlog.md と backlog-session-notes.md の残課題
- 生成物: architecture/ と system-spec/ の領域別の文書（account-profile・master-settings・release-and-forms、account-and-users・improvement-requests）で、退避した経路をサーバーアクションの名前に置き換える
- 生成物: docs/migration-mapping.md の入口の列を、API の経路からサーバーアクションの名前に置き換える
- 生成物: README.md と .dev.vars.example に、CREDENTIAL_ENC_KEY の作り方と、無いときの振る舞いを書く（.dev.vars.example には秘密ではない見本の文字列だけを置く）
- 更新対象: docs/product/spec.md、docs/deploy-notes.md、docs/product/backlog.md、docs/product/backlog-session-notes.md、docs/migration-mapping.md、README.md、.dev.vars.example、architecture/index.md、architecture/account-profile.md、architecture/master-settings.md、architecture/release-and-forms.md、system-spec/account-and-users.md、system-spec/improvement-requests.md、system-spec/master-settings.md、system-spec/release-and-forms.md

## 依存関係

- `depends_on`: ["SYS-DF-P10"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（documentation-operations）は Frontend を変えない
- Backend/API: N/A: この phase（documentation-operations）は Backend/API を変えない
- Database/Data: N/A: この phase（documentation-operations）は Database/Data を変えない
- Infrastructure: N/A: この phase（documentation-operations）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（documentation-operations）は Security/Privacy を変えない
- Documentation: 対象。§27・設計・backlog の同期

## Write scope と競合制約

- `touches`: `docs/product/spec.md`、`docs/deploy-notes.md`、`docs/product/backlog.md`、`docs/product/backlog-session-notes.md`、`docs/migration-mapping.md`、`README.md`、`.dev.vars.example`、`architecture/index.md`、`architecture/account-profile.md`、`architecture/master-settings.md`、`architecture/release-and-forms.md`、`system-spec/account-and-users.md`、`system-spec/improvement-requests.md`、`system-spec/master-settings.md`、`system-spec/release-and-forms.md`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P12）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P12 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P12` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P10）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P12 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm check:docs
4. 検証のコマンドを実行する: git diff --check
5. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
6. /dev-graph worktree release SYS-DF-P12 で lease を返す

## 受入条件

- [ ] A8: check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる
- [ ] check:docs が通る
- [ ] docs/product/spec.md は P01 が書いた §27 の受入18項目を変えず、実装との差分の同期だけを足す

## 検証方法

- 自動検証: `pnpm check:docs`、`git diff --check`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: docs/product/spec.md、docs/deploy-notes.md

## リスクとロールバック

- リスク: backlog-history-2026-08-13.md の変更 を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: 文書の差分を git revert で戻す。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P13
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（documentation-operations）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（documentation-operations）の責務に Backend の変更は含まれない
- API: N/A: この phase（documentation-operations）の責務に API の変更は含まれない
- Data: N/A: この phase（documentation-operations）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（documentation-operations）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（documentation-operations）の責務に Security の変更は含まれない
- Quality: N/A: この phase（documentation-operations）の責務に Quality の変更は含まれない
- Documentation: 対象。§27・設計・backlog の同期
- Operations: 対象。CREDENTIAL_ENC_KEY の設定と、配布後の確認（W2）の手順

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: repository-docs（文書だけ。配布の単位を持たない）

## Verification and evidence

- コマンド: pnpm check:docs
- コマンド: git diff --check
- 証跡: docs/product/spec.md
- 証跡: docs/deploy-notes.md

## Rollout and rollback

- Rollout: 文書の変更なので、マージした時点で有効になる。
- Rollback: 文書の差分を git revert で戻す。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-12-documentation-operations.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

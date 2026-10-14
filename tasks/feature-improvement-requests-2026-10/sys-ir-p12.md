---
graph_node_id: "SYS-IR-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "製品仕様・機能の地図・運用の文書を、実装の最終の形にそろえる"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "documentation-operations"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-12-documentation-operations.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P10"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-maintenance-ops", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/spec.md", "docs/product/T3-feature-map.md", "docs/product/backlog.md", "docs/deploy-notes.md", "architecture/improvement-requests-2026-10.md"]
purpose: "製品仕様 §28 を実装の最終の画面名と操作に合わせ、機能の地図に権限一覧のページを足し、backlog に11項目の対応を記録する。運用として、会社の管理者が等級名を変える手順、全体管理者が2社目の所属を足す手順、権限一覧の見方を書き、docs/deploy-notes.md に移行 0033・0034 の確認の要点を足す。"
goal: "製品仕様・機能の地図・運用の文書を、実装の最終の形にそろえる。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["docs/product/spec.md の §28 を最終の形に合わせる", "docs/product/T3-feature-map.md に権限一覧のページを足す", "docs/product/backlog.md に11項目の対応と受け持った task を記録する", "docs/deploy-notes.md に移行 0033・0034 の確認の要点を足す", "architecture/improvement-requests-2026-10.md の最終の形への追従"]
scope_out: ["配色・テーマの文書の変更（DD-003）", "report-design-system 系の見本への実データの記載"]
acceptance: ["A9: 画面名が『Claude Code連携（システム開発者専用）』になっている", "A13 の一部: pnpm run check:docs が通る", "文書の画面名が実装と同じ（Claude Code連携（システム開発者専用）、権限一覧）", "backlog の11項目のどれも保留になっていない"]
architecture_refs: ["arch-system-spec-maintenance-ops", "arch-system-spec-ui-ux"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P12"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P12（documentation-operations）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p12.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-13T06:12:29Z", "missing_sections": [], "status": "complete"}
---

# 製品仕様・機能の地図・運用の文書を、実装の最終の形にそろえる

## 目的

製品仕様 §28 を実装の最終の画面名と操作に合わせ、機能の地図に権限一覧のページを足し、backlog に11項目の対応を記録する。運用として、会社の管理者が等級名を変える手順、全体管理者が2社目の所属を足す手順、権限一覧の見方を書き、docs/deploy-notes.md に移行 0033・0034 の確認の要点を足す。

## 背景

画面名の改名（Claude Code連携（システム開発者専用））と権限一覧のページは、文書が古いままだと利用者が迷う。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-maintenance-ops（architecture/system-spec-maintenance-ops.md）、arch-system-spec-ui-ux（architecture/system-spec-ui-ux.md）。

## 入力と前提条件

- 入力: eval-log/feature-improvement-requests-2026-10-final-review.json
- 前提: 依存タスク（SYS-IR-P10）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: docs/product/spec.md の §28 を最終の形に合わせる
- 生成物: docs/product/T3-feature-map.md に権限一覧のページを足す
- 生成物: docs/product/backlog.md に11項目の対応と受け持った task を記録する
- 生成物: docs/deploy-notes.md に移行 0033・0034 の確認の要点を足す
- 生成物: architecture/improvement-requests-2026-10.md の最終の形への追従
- 更新対象: docs/product/spec.md、docs/product/T3-feature-map.md、docs/product/backlog.md、docs/deploy-notes.md、architecture/improvement-requests-2026-10.md

## 依存関係

- `depends_on`: ["SYS-IR-P10"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（documentation-operations）は Frontend を変えない
- Backend/API: N/A: この phase（documentation-operations）は Backend/API を変えない
- Database/Data: N/A: この phase（documentation-operations）は Database/Data を変えない
- Infrastructure: N/A: この phase（documentation-operations）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（documentation-operations）は Security/Privacy を変えない
- Quality: N/A: この phase（documentation-operations）は Quality を変えない
- Documentation: 対象。§28・機能の地図・backlog・運用の手順
- Operations: 対象。等級名と所属の運用の手順

## Write scope と競合制約

- `touches`: `docs/product/spec.md`、`docs/product/T3-feature-map.md`、`docs/product/backlog.md`、`docs/deploy-notes.md`、`architecture/improvement-requests-2026-10.md`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P12）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P12 の形で割り当てる
- worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- completion projection: 作業のブランチでは保留の記録だけを残し、既定のブランチ main へマージされた時点の reconciliation で done を書く

## GitHub publication

- Mode: local_only（追跡は Beads。GitHub の Issue は作らない）
- Project aliases: N/A: Beads に束ねるので GitHub Projects は使わない
- Issue labels/milestone: N/A: GitHub の Issue を作らないため
- Initial Project fields: N/A: GitHub Projects を使わないため
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`（feature も同じ条件を満たすこと）
- Failure policy: 外部の失敗は対象の操作だけを pending_retry にし、ローカルの promote 済み task は戻さない
- Completion policy: linked_pr_merged_all
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P12` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P10）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P12 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm run check:docs
4. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
5. PR の本文に dev-graph: SYS-IR-P12 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
6. /dev-graph worktree release SYS-IR-P12 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] A9: 画面名が『Claude Code連携（システム開発者専用）』になっている
- [ ] A13 の一部: pnpm run check:docs が通る
- [ ] 文書の画面名が実装と同じ（Claude Code連携（システム開発者専用）、権限一覧）
- [ ] backlog の11項目のどれも保留になっていない

## 検証方法

- 自動検証: `pnpm run check:docs`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: check:docs の出力（exit 0）、docs/product/backlog.md の対応の記録

## リスクとロールバック

- リスク: 配色・テーマの文書の変更（DD-003） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: 文書を1つ前のコミットへ戻す

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P13
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（documentation-operations）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（documentation-operations）の責務に Backend の変更は含まれない
- API: N/A: この phase（documentation-operations）の責務に API の変更は含まれない
- Data: N/A: この phase（documentation-operations）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（documentation-operations）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（documentation-operations）の責務に Security の変更は含まれない
- Quality: N/A: この phase（documentation-operations）の責務に Quality の変更は含まれない
- Documentation: 対象。§28・機能の地図・backlog・運用の手順
- Operations: 対象。等級名と所属の運用の手順

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-maintenance-ops・arch-system-spec-ui-ux
- Deploy unit/environment: repository-docs（文書だけ。配布の単位を持たない）
- Compatibility/migration/backfill: N/A: この phase はデータの形を変えない

## Verification and evidence

- コマンド: pnpm run check:docs
- 証跡: check:docs の出力（exit 0）
- 証跡: docs/product/backlog.md の対応の記録

## Rollout and rollback

- Rollout: 文書だけ。main へマージした時点で有効になる。マージで deploy.yml が走るが、製品のコードと移行は変わらないので同じ版の再配布になる
- Rollback: 文書を1つ前のコミットへ戻す

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-12-documentation-operations.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-maintenance-ops.md、architecture/system-spec-ui-ux.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

---
graph_node_id: "SYS-IR-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "設計を、範囲の取りこぼし・他社と点数の漏れ・アクセシビリティ・テーマの契約に照らして見直す"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "design-review"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P02"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-security", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend"]
resource_scope: ["eval-log/feature-improvement-requests-2026-10-design-review.json", "architecture/improvement-requests-2026-10.md"]
purpose: "P02 の設計を6つの観点で見直し、severity high の指摘を0にしてから試験の設計へ進む。1. S1〜S14 と A1〜A13 に置き場所の無いものが無いか。2. 所属の無い会社への切り替え、一般の社員への応答で、他社のデータ・等級・点数が見える経路が無いか。3. 等級名の変更の判定が画面だけになっていないか（サーバー処理でも判定するか）。4. 権限の表示と実際の判定が別の定義を読んでいないか。5. ドラッグの代わりの操作（WCAG 2.2 SC 2.5.7）と、ホバーの説明を Esc で消せること・ポインターを載せても消えないこと（SC 1.4.13）。6. テーマの契約と src/app/globals.css 冒頭の brand_color_* の宣言を変えないこと。"
goal: "設計を、範囲の取りこぼし・他社と点数の漏れ・アクセシビリティ・テーマの契約に照らして見直す。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["eval-log/feature-improvement-requests-2026-10-design-review.json（6つの観点の判定、指摘、直した箇所）", "指摘で直すときの architecture/improvement-requests-2026-10.md の修正"]
scope_out: ["実装とその試験（P04・P05）", "要件の変更（system-spec の手順でだけ変える）"]
acceptance: ["6つの観点がすべて判定されている", "severity high の指摘が0件", "直した指摘ごとに、直した箇所と理由が記録されている"]
architecture_refs: ["arch-system-spec-security", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P03（design-review）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p03.md", "confidence": 0.95}]
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

# 設計を、範囲の取りこぼし・他社と点数の漏れ・アクセシビリティ・テーマの契約に照らして見直す

## 目的

P02 の設計を6つの観点で見直し、severity high の指摘を0にしてから試験の設計へ進む。1. S1〜S14 と A1〜A13 に置き場所の無いものが無いか。2. 所属の無い会社への切り替え、一般の社員への応答で、他社のデータ・等級・点数が見える経路が無いか。3. 等級名の変更の判定が画面だけになっていないか（サーバー処理でも判定するか）。4. 権限の表示と実際の判定が別の定義を読んでいないか。5. ドラッグの代わりの操作（WCAG 2.2 SC 2.5.7）と、ホバーの説明を Esc で消せること・ポインターを載せても消えないこと（SC 1.4.13）。6. テーマの契約と src/app/globals.css 冒頭の brand_color_* の宣言を変えないこと。

## 背景

権限と他社のデータの漏れは、実装のあとで見つけると直す範囲が広い。並べ替えと説明の出し方は、要件どおりでもキーボードと読み上げで使えないと SC 2.5.7・1.4.13 を満たさない。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-security（architecture/system-spec-security.md）、arch-system-spec-auth（architecture/system-spec-auth.md）、arch-system-spec-ui-ux（architecture/system-spec-ui-ux.md）、arch-system-spec-frontend（architecture/system-spec-frontend.md）。

## 入力と前提条件

- 入力: architecture/improvement-requests-2026-10.md、specs/improvement-requests-2026-10.md
- 前提: 依存タスク（SYS-IR-P02）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: eval-log/feature-improvement-requests-2026-10-design-review.json（6つの観点の判定、指摘、直した箇所）
- 生成物: 指摘で直すときの architecture/improvement-requests-2026-10.md の修正
- 更新対象: eval-log/feature-improvement-requests-2026-10-design-review.json、architecture/improvement-requests-2026-10.md

## 依存関係

- `depends_on`: ["SYS-IR-P02"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（design-review）は Frontend を変えない
- Backend/API: N/A: この phase（design-review）は Backend/API を変えない
- Database/Data: N/A: この phase（design-review）は Database/Data を変えない
- Infrastructure: N/A: この phase（design-review）は Infrastructure を変えない
- Security/Privacy: 対象。他社のデータと点数の漏れの経路、cookie の改ざん、判定の置き場所
- Quality: 対象。範囲の取りこぼしとアクセシビリティの見直し
- Documentation: N/A: この phase（design-review）は Documentation を変えない
- Operations: N/A: この phase（design-review）は Operations を変えない

## Write scope と競合制約

- `touches`: `eval-log/feature-improvement-requests-2026-10-design-review.json`、`architecture/improvement-requests-2026-10.md`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P03）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P03 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P03` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P02）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P03 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm run check:docs
4. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
5. PR の本文に dev-graph: SYS-IR-P03 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
6. /dev-graph worktree release SYS-IR-P03 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] 6つの観点がすべて判定されている
- [ ] severity high の指摘が0件
- [ ] 直した指摘ごとに、直した箇所と理由が記録されている

## 検証方法

- 自動検証: `pnpm run check:docs`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feature-improvement-requests-2026-10-design-review.json

## リスクとロールバック

- リスク: 実装とその試験（P04・P05） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: 見直しで直した architecture の文書を1つ前のコミットへ戻す

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P04
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（design-review）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（design-review）の責務に Backend の変更は含まれない
- API: N/A: この phase（design-review）の責務に API の変更は含まれない
- Data: N/A: この phase（design-review）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（design-review）の責務に Infrastructure の変更は含まれない
- Security: 対象。他社のデータと点数の漏れの経路、cookie の改ざん、判定の置き場所
- Quality: 対象。範囲の取りこぼしとアクセシビリティの見直し
- Documentation: N/A: この phase（design-review）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（design-review）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-security・arch-system-spec-auth・arch-system-spec-ui-ux・arch-system-spec-frontend（D-004 opt-membership-cookie（所属の表と cookie）、D-005 opt-pointer-hook（Pointer Events の自作）、D-006 opt-combined（表・役割のタブ・スマホのカード）、D-007 opt-route-ledger-extend（route-ledger.json に足す）、qa-v02（等級名を変えられるのは全体管理者と会社の管理者だけ））
- Deploy unit/environment: repository-docs（文書だけ。配布の単位を持たない）
- Compatibility/migration/backfill: N/A: この phase はデータの形を変えない

## Verification and evidence

- コマンド: pnpm run check:docs
- 証跡: eval-log/feature-improvement-requests-2026-10-design-review.json

## Rollout and rollback

- Rollout: 記録と文書だけ。マージで deploy.yml が走るが、製品のコードと移行は変わらないので同じ版の再配布になる
- Rollback: 見直しで直した architecture の文書を1つ前のコミットへ戻す

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-03-design-review.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-security.md、architecture/system-spec-auth.md、architecture/system-spec-ui-ux.md、architecture/system-spec-frontend.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

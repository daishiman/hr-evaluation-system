---
graph_node_id: "SYS-IR-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "改善要望の範囲14件と受入13項目を、製品仕様と specs の正本へ同じ番号で写す"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "requirements"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: []
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-ui-ux", "arch-system-spec-frontend"]
resource_scope: ["docs/product/spec.md", "specs/improvement-requests-2026-10.md", "docs/product/spec-receipts/2026-10-13-improvement-requests.md"]
purpose: "確定済みの要件定義（system-spec/00-requirements-definition.md の G6〜G15・O6〜O8・I7〜I9、決定 D-004〜D-007 と qa-v02）から、feature の範囲14件（S1〜S14）と受入13項目（A1〜A13）を製品仕様 §28 と specs/improvement-requests-2026-10.md に同じ番号・同じ意味で写し、各項目を受け持つ task（SYS-IR-P01〜P13）を書き添えて、以後の phase が同じ基準線を使う状態にする。"
goal: "改善要望の範囲14件と受入13項目を、製品仕様と specs の正本へ同じ番号で写す。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["docs/product/spec.md の §28（2026-10 の改善要望。等級名・権限一覧・等級と点数・所属・提出状況・設定不足・改名・並べ替え・選択肢・余白）", "specs/improvement-requests-2026-10.md（S1〜S14 と A1〜A13 の正本と、各項目を受け持つ task の対応表）", "docs/product/spec-receipts/2026-10-13-improvement-requests.md（確定の受領の記録。qa-v02・D-004〜D-007 の選択と日時）"]
scope_out: ["要件そのものの変更（G6〜G15・D-004〜D-007 は system-spec の手順でだけ変える）", "配色・テーマの変更（spec.md のテーマ契約と DD-003）"]
acceptance: ["A13 の一部: pnpm run check:docs が通り、要件定義の G6〜G15 から §28 と specs/improvement-requests-2026-10.md へ辿れる", "S1〜S14 と A1〜A13 が §28 と specs の両方に同じ番号・同じ意味で載り、どれも『保留』『対象外』になっていない", "S1〜S14 のそれぞれに、受け持つ task（SYS-IR-P01〜P13）が1件以上書かれている"]
architecture_refs: ["arch-system-spec-ui-ux", "arch-system-spec-frontend"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P01"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P01（requirements）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p01.md", "confidence": 0.95}]
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

# 改善要望の範囲14件と受入13項目を、製品仕様と specs の正本へ同じ番号で写す

## 目的

確定済みの要件定義（system-spec/00-requirements-definition.md の G6〜G15・O6〜O8・I7〜I9、決定 D-004〜D-007 と qa-v02）から、feature の範囲14件（S1〜S14）と受入13項目（A1〜A13）を製品仕様 §28 と specs/improvement-requests-2026-10.md に同じ番号・同じ意味で写し、各項目を受け持つ task（SYS-IR-P01〜P13）を書き添えて、以後の phase が同じ基準線を使う状態にする。

## 背景

依頼は等級名の統一と編集権限・権限一覧・一覧の等級と点数・複数の会社への所属・アンケートの提出状況・設定不足の警告・『Claude Code連携（システム開発者専用）』への改名・長押しドラッグの並べ替え・選択肢が押せない不具合・右側の余白の11項目で、利用者は『保留事項にしないで、今回の内容全て対応』と指示した。範囲の14件を1件も保留・対象外にせず、どの task が満たすかを番号で辿れるようにする。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-ui-ux（architecture/system-spec-ui-ux.md）、arch-system-spec-frontend（architecture/system-spec-frontend.md）。

## 入力と前提条件

- 入力: system-spec/00-requirements-definition.md、system-spec/index.md、features/feature-improvement-requests-2026-10.context.json、features/improvement-requests-2026-10.md
- 前提: 依存タスク（なし（この package の起点））が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: docs/product/spec.md の §28（2026-10 の改善要望。等級名・権限一覧・等級と点数・所属・提出状況・設定不足・改名・並べ替え・選択肢・余白）
- 生成物: specs/improvement-requests-2026-10.md（S1〜S14 と A1〜A13 の正本と、各項目を受け持つ task の対応表）
- 生成物: docs/product/spec-receipts/2026-10-13-improvement-requests.md（確定の受領の記録。qa-v02・D-004〜D-007 の選択と日時）
- 更新対象: docs/product/spec.md、specs/improvement-requests-2026-10.md、docs/product/spec-receipts/2026-10-13-improvement-requests.md

範囲 S1〜S14 と受け持つ task（どれも保留・対象外にしない）:

- S1: 等級の呼び名を作る共通の関数を置いて全表示をそこから作り、既定の等級名を『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』にする（FR-004、I7） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P07
- S2: 既存の会社の等級名と、行動指針の区分名など等級名を含む表示名を、D1 のマイグレーション（0033 以降）で一律に書き換え、英語の区分名を残さない（FR-004、I7） → SYS-IR-P05, SYS-IR-P08
- S3: 等級名を変えられる役割を全体管理者と会社の管理者に限り、画面とサーバー処理の両方で判定する（FR-005、I8） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P09
- S4: route-ledger.json の各ページに accessClass・ページ名・主な操作・役割ごとの可否・説明を置き、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の判定・権限一覧がこの台帳だけを読む（D-007） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P09
- S5: システム管理のサイドバーに権限一覧のページを足し、利用者一覧のトグルで開くモーダルと同じ部品で、表・役割のタブ・スマホのカードと、ポインター・フォーカス・タップで出る説明を見せる（D-006、I9） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P07
- S6: 3つの一覧に今の等級と確定済みの最新評価点を出し、マネージャー・会社の管理者・全体管理者以外には画面にも応答にも含めない（FR-005） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P09
- S7: 所属の表と cookie で選ぶ会社の切り替えで、1つのアカウントが複数の会社に所属でき、既存の利用者には今の値どおりの所属を作る（D-004） → SYS-IR-P05, SYS-IR-P08, SYS-IR-P09
- S8: アンケートの一覧と結果一覧に、対象者全員の提出済み・未提出がわかる提出状況の一覧を足す（FR-005） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P07
- S9: 設定不足の表示（#8・#13）を『何が足りない・どう直す・直す画面へのリンク』の簡潔な形にする（FR-005） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P07
- S10: 『Claude Code連携の鍵』の画面名を『Claude Code連携（システム開発者専用）』に変える（FR-005） → SYS-IR-P05, SYS-IR-P12
- S11: 全ての並べ替えに、Pointer Events で自作する長押しドラッグとキーボード操作の共通部品を入れ、並び順を全体で保存する（D-005） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P09
- S12: アンケートの入力と結果で選択肢を押しても選べない不具合を直し、選択肢の値の重複を拒否する（FR-005） → SYS-IR-P05, SYS-IR-P04, SYS-IR-P07
- S13: 右側の余白が目立つ画面（#14）の配置を見直す（FR-005） → SYS-IR-P05, SYS-IR-P07
- S14: Next.js を 16.3.8 へ上げ、ルート台帳を権限一覧のページを足した47画面にする（互換性・移行・リリース） → SYS-IR-P05, SYS-IR-P13

## 依存関係

- `depends_on`: []
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（requirements）は Frontend を変えない
- Backend/API: N/A: この phase（requirements）は Backend/API を変えない
- Database/Data: N/A: この phase（requirements）は Database/Data を変えない
- Infrastructure: N/A: この phase（requirements）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（requirements）は Security/Privacy を変えない
- Quality: 対象。check:docs が要件定義の G6〜G15 から §28 と specs へ辿れることを確かめる
- Documentation: 対象。§28 と specs/improvement-requests-2026-10.md に S1〜S14・A1〜A13 と受け持つ task を載せる
- Operations: N/A: この phase（requirements）は Operations を変えない

## Write scope と競合制約

- `touches`: `docs/product/spec.md`、`specs/improvement-requests-2026-10.md`、`docs/product/spec-receipts/2026-10-13-improvement-requests.md`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P01）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P01 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P01` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（なし）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P01 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm run check:docs
4. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
5. PR の本文に dev-graph: SYS-IR-P01 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
6. /dev-graph worktree release SYS-IR-P01 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] A13 の一部: pnpm run check:docs が通り、要件定義の G6〜G15 から §28 と specs/improvement-requests-2026-10.md へ辿れる
- [ ] S1〜S14 と A1〜A13 が §28 と specs の両方に同じ番号・同じ意味で載り、どれも『保留』『対象外』になっていない
- [ ] S1〜S14 のそれぞれに、受け持つ task（SYS-IR-P01〜P13）が1件以上書かれている

## 検証方法

- 自動検証: `pnpm run check:docs`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: docs/product/spec.md の §28、specs/improvement-requests-2026-10.md の対応表、check:docs の出力（exit 0）

## リスクとロールバック

- リスク: 要件そのものの変更（G6〜G15・D-004〜D-007 は system-spec の手順でだけ変える） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: §28・specs/improvement-requests-2026-10.md・受領の記録を1つ前のコミットへ戻す。コードとデータには触れていない

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P02
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（requirements）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（requirements）の責務に Backend の変更は含まれない
- API: N/A: この phase（requirements）の責務に API の変更は含まれない
- Data: N/A: この phase（requirements）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（requirements）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（requirements）の責務に Security の変更は含まれない
- Quality: 対象。check:docs が要件定義の G6〜G15 から §28 と specs へ辿れることを確かめる
- Documentation: 対象。§28 と specs/improvement-requests-2026-10.md に S1〜S14・A1〜A13 と受け持つ task を載せる
- Operations: N/A: この phase（requirements）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-ui-ux・arch-system-spec-frontend（D-004 opt-membership-cookie（所属の表と cookie）、D-005 opt-pointer-hook（Pointer Events の自作）、D-006 opt-combined（表・役割のタブ・スマホのカード）、D-007 opt-route-ledger-extend（route-ledger.json に足す）、qa-v02（等級名を変えられるのは全体管理者と会社の管理者だけ））
- Deploy unit/environment: repository-docs（文書だけ。配布の単位を持たない）
- Compatibility/migration/backfill: N/A: この phase はデータの形を変えない

## Verification and evidence

- コマンド: pnpm run check:docs
- 証跡: docs/product/spec.md の §28
- 証跡: specs/improvement-requests-2026-10.md の対応表
- 証跡: check:docs の出力（exit 0）

## Rollout and rollback

- Rollout: 文書だけ。main へマージした時点で基準線になる。マージで deploy.yml が走るが、製品のコードと移行は変わらないので同じ版の再配布になる
- Rollback: §28・specs/improvement-requests-2026-10.md・受領の記録を1つ前のコミットへ戻す。コードとデータには触れていない

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-01-requirements.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-ui-ux.md、architecture/system-spec-frontend.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

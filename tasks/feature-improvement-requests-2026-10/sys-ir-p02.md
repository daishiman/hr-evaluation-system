---
graph_node_id: "SYS-IR-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "等級の呼び名・所属・権限の台帳・並べ替え・権限の見せ方・点数の可視範囲の設計を決めて文書に残す"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "architecture"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P01"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-database", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-security", "arch-system-spec-backend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops"]
resource_scope: ["architecture/improvement-requests-2026-10.md", "architecture/index.md", "architecture/graph.json", "docs/product/design-decisions.md"]
purpose: "次の7つの設計を architecture/improvement-requests-2026-10.md の1か所に決める。1. 等級の呼び名を作る共通の関数（会社の等級名から区分名・行動指針のセット名・昇格の段階名・警告文・アンケートのタイトル・ボタンを作る。既定は等級1・等級2・等級3・等級4-1・等級4-2・等級5-1・等級5-2）。2. 所属の表 company_memberships（利用者・会社・役割・等級・上司）と、cookie hr_company で選ぶ会社（D-004）。3. route-ledger.json の各ルートに permissions（ページ名・主な操作・役割ごとの可否・説明）を足し、サイドバー・ページの入口の判定・サーバー処理の最低ロール・src/lib/session.ts・権限一覧が読む唯一の定義にする（D-007）。4. Pointer Events の長押しドラッグとキーボード操作の共通 hook と部品、全体保存と版の照合による 409（D-005）。5. 表・役割のタブ・スマホのカードを1つの部品で出す権限の見せ方と、ポインター・フォーカス・タップのどれでも出て Esc で消せる説明（D-006）。6. 等級と確定点数を返すかどうかをサーバー側で役割から決める読み出し。7. 提出状況の集計と、設定不足の表示の型（何が足りない・どう直す・直す画面へのリンク）。"
goal: "等級の呼び名・所属・権限の台帳・並べ替え・権限の見せ方・点数の可視範囲の設計を決めて文書に残す。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["architecture/improvement-requests-2026-10.md（7つの設計、移行 0033・0034、戻し方、S1〜S14 の置き場所）", "architecture/index.md と architecture/graph.json に新しい文書を足す", "docs/product/design-decisions.md に DD-004〜DD-008（D-004 所属の表と cookie、D-005 Pointer Events の自作、D-006 表・タブ・カードの組み合わせ、D-007 route-ledger への追加、qa-v02 等級名の編集は全体管理者と会社の管理者だけ）"]
scope_out: ["役割の種類の追加", "等級名の変更権限を除く、役割ごとの権限の中身の変更", "即時配信（WebSocket 等の push）とオフライン編集"]
acceptance: ["S1〜S14 のそれぞれに、置き場所（ファイル）と受け持つ task が書かれている", "権限の定義の正本が route-ledger.json の1つだけで、別の表や TS モジュールに同じ情報を持たない（D-007、O8 の前提）", "移行 0033・0034 の中身、2回流しても変わらない作り、戻し方、P05 のマージで deploy.yml が本番へ当てることと当てたあとは書き換えないことが書かれている", "テーマの契約（spec.md のテーマ契約・DD-003）と役割の種類（4つのまま。システム開発者の役割は作らない）を変えないことが明記されている"]
architecture_refs: ["arch-system-spec-database", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-security", "arch-system-spec-backend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P02（architecture）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p02.md", "confidence": 0.95}]
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

# 等級の呼び名・所属・権限の台帳・並べ替え・権限の見せ方・点数の可視範囲の設計を決めて文書に残す

## 目的

次の7つの設計を architecture/improvement-requests-2026-10.md の1か所に決める。1. 等級の呼び名を作る共通の関数（会社の等級名から区分名・行動指針のセット名・昇格の段階名・警告文・アンケートのタイトル・ボタンを作る。既定は等級1・等級2・等級3・等級4-1・等級4-2・等級5-1・等級5-2）。2. 所属の表 company_memberships（利用者・会社・役割・等級・上司）と、cookie hr_company で選ぶ会社（D-004）。3. route-ledger.json の各ルートに permissions（ページ名・主な操作・役割ごとの可否・説明）を足し、サイドバー・ページの入口の判定・サーバー処理の最低ロール・src/lib/session.ts・権限一覧が読む唯一の定義にする（D-007）。4. Pointer Events の長押しドラッグとキーボード操作の共通 hook と部品、全体保存と版の照合による 409（D-005）。5. 表・役割のタブ・スマホのカードを1つの部品で出す権限の見せ方と、ポインター・フォーカス・タップのどれでも出て Esc で消せる説明（D-006）。6. 等級と確定点数を返すかどうかをサーバー側で役割から決める読み出し。7. 提出状況の集計と、設定不足の表示の型（何が足りない・どう直す・直す画面へのリンク）。

## 背景

決定 D-004〜D-007 と qa-v02 は system-spec で利用者が選んで確定している。実装の前に、どのファイルが何を持つかと、移行と戻し方を1か所に決めておかないと、14件が別々の作りになり、権限の表示と実際の判定がずれる（O8）。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-database（architecture/system-spec-database.md）、arch-system-spec-auth（architecture/system-spec-auth.md）、arch-system-spec-ui-ux（architecture/system-spec-ui-ux.md）、arch-system-spec-frontend（architecture/system-spec-frontend.md）、arch-system-spec-security（architecture/system-spec-security.md）、arch-system-spec-backend（architecture/system-spec-backend.md）、arch-system-spec-infrastructure（architecture/system-spec-infrastructure.md）、arch-system-spec-maintenance-ops（architecture/system-spec-maintenance-ops.md）。

## 入力と前提条件

- 入力: architecture/system-spec-database.md、architecture/system-spec-auth.md、architecture/system-spec-ui-ux.md、architecture/system-spec-frontend.md、architecture/system-spec-security.md、architecture/system-spec-backend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、specs/improvement-requests-2026-10.md、system-spec/route-ledger.json
- 前提: 依存タスク（SYS-IR-P01）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: architecture/improvement-requests-2026-10.md（7つの設計、移行 0033・0034、戻し方、S1〜S14 の置き場所）
- 生成物: architecture/index.md と architecture/graph.json に新しい文書を足す
- 生成物: docs/product/design-decisions.md に DD-004〜DD-008（D-004 所属の表と cookie、D-005 Pointer Events の自作、D-006 表・タブ・カードの組み合わせ、D-007 route-ledger への追加、qa-v02 等級名の編集は全体管理者と会社の管理者だけ）
- 更新対象: architecture/improvement-requests-2026-10.md、architecture/index.md、architecture/graph.json、docs/product/design-decisions.md

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

- `depends_on`: ["SYS-IR-P01"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: 対象。等級の呼び名の関数・権限の見せ方・並べ替えの部品の置き場所
- Backend/API: 対象。等級名の変更の判定、点数の読み出しの役割の判定、提出状況の集計
- Database/Data: 対象。所属の表と移行 0033・0034 の設計
- Infrastructure: N/A: この phase（architecture）は Infrastructure を変えない
- Security/Privacy: 対象。他社のデータと点数を見せない境界、cookie の改ざんへの備え
- Quality: N/A: この phase（architecture）は Quality を変えない
- Documentation: 対象。architecture の文書と設計判断の記録
- Operations: N/A: この phase（architecture）は Operations を変えない

## Write scope と競合制約

- `touches`: `architecture/improvement-requests-2026-10.md`、`architecture/index.md`、`architecture/graph.json`、`docs/product/design-decisions.md`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P02）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P02 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P02` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P01）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P02 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm run check:docs
4. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
5. PR の本文に dev-graph: SYS-IR-P02 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
6. /dev-graph worktree release SYS-IR-P02 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] S1〜S14 のそれぞれに、置き場所（ファイル）と受け持つ task が書かれている
- [ ] 権限の定義の正本が route-ledger.json の1つだけで、別の表や TS モジュールに同じ情報を持たない（D-007、O8 の前提）
- [ ] 移行 0033・0034 の中身、2回流しても変わらない作り、戻し方、P05 のマージで deploy.yml が本番へ当てることと当てたあとは書き換えないことが書かれている
- [ ] テーマの契約（spec.md のテーマ契約・DD-003）と役割の種類（4つのまま。システム開発者の役割は作らない）を変えないことが明記されている

## 検証方法

- 自動検証: `pnpm run check:docs`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: architecture/improvement-requests-2026-10.md、docs/product/design-decisions.md の DD-004〜DD-008、check:docs の出力（exit 0）

## リスクとロールバック

- リスク: 役割の種類の追加 を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: 追加した architecture の文書と DD-004〜DD-008 を1つ前のコミットへ戻す

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P03
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: 対象。等級の呼び名の関数・権限の見せ方・並べ替えの部品の置き場所
- Backend: 対象。等級名の変更の判定、点数の読み出しの役割の判定、提出状況の集計
- API: N/A: この phase（architecture）の責務に API の変更は含まれない
- Data: 対象。所属の表と移行 0033・0034 の設計
- Infrastructure: N/A: この phase（architecture）の責務に Infrastructure の変更は含まれない
- Security: 対象。他社のデータと点数を見せない境界、cookie の改ざんへの備え
- Quality: N/A: この phase（architecture）の責務に Quality の変更は含まれない
- Documentation: 対象。architecture の文書と設計判断の記録
- Operations: N/A: この phase（architecture）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-database・arch-system-spec-auth・arch-system-spec-ui-ux・arch-system-spec-frontend・arch-system-spec-security・arch-system-spec-backend・arch-system-spec-infrastructure・arch-system-spec-maintenance-ops（D-004 opt-membership-cookie（所属の表と cookie）、D-005 opt-pointer-hook（Pointer Events の自作）、D-006 opt-combined（表・役割のタブ・スマホのカード）、D-007 opt-route-ledger-extend（route-ledger.json に足す）、qa-v02（等級名を変えられるのは全体管理者と会社の管理者だけ））
- Deploy unit/environment: repository-docs（文書だけ。配布の単位を持たない）
- Compatibility/migration/backfill: 移行 0033（所属の表の追加と、既存の利用者の今の会社・役割・等級・上司どおりの所属の作成）と 0034（会社の等級名と、英語の区分名を含む表示名の一律の書き換え）の設計。実装とマージの前のローカルの予行は P05、多様な見本のデータでの確認は P08。main へのマージで deploy.yml が書き出しのあとに本番へ当てるので、当てたあとは書き換えない

## Verification and evidence

- コマンド: pnpm run check:docs
- 証跡: architecture/improvement-requests-2026-10.md
- 証跡: docs/product/design-decisions.md の DD-004〜DD-008
- 証跡: check:docs の出力（exit 0）

## Rollout and rollback

- Rollout: 文書だけ。main へマージした時点で実装の基準になる。マージで deploy.yml が走るが、製品のコードと移行は変わらないので同じ版の再配布になる
- Rollback: 追加した architecture の文書と DD-004〜DD-008 を1つ前のコミットへ戻す

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-02-architecture.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-database.md、architecture/system-spec-auth.md、architecture/system-spec-ui-ux.md、architecture/system-spec-frontend.md、architecture/system-spec-security.md、architecture/system-spec-backend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

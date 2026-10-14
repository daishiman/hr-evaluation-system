---
graph_node_id: "SYS-IR-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "ローカルの preview で、受入 A1〜A12 を役割ごと・4つの幅で確かめる"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "acceptance"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P06"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-ui-ux", "arch-system-spec-frontend"]
resource_scope: ["eval-log/feature-improvement-requests-2026-10-acceptance.json", "eval-log/feature-improvement-requests-2026-10-screens/"]
purpose: "ローカルの D1 に移行と見本のデータを入れ、preview（ポート 8787）で全体管理者・会社の管理者・マネージャー・一般の社員の4つの役割と、375・768・1280・1600 の4つの幅で、A1〜A12 を画面の通し試験と撮影で確かめる。"
goal: "ローカルの preview で、受入 A1〜A12 を役割ごと・4つの幅で確かめる。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["eval-log/feature-improvement-requests-2026-10-acceptance.json（A1〜A12 ごとの判定と根拠）", "eval-log/feature-improvement-requests-2026-10-screens/（見本のデータだけで撮った4つの幅の画面）"]
scope_out: ["本番の環境での確認（P13 で、利用者の確認を経て行う）", "e2e のスペックと製品のコードの書き換え（スペックの持ち主は P04・P05。不一致を見つけたら FAIL として記録し、P09 の直しか P10 の判定で扱う）"]
acceptance: ["A1: 等級名を変える結合テストで全表示が新しい名前になり、英語の区分名の静的検査が0件である（O6）", "A2: 等級名の変更は、全体管理者と会社の管理者以外では画面とサーバーの両方が拒否する（O7）", "A3: ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストが通る（O8）", "A4: 権限一覧の表とカードが同じ内容を出し、説明がポインター・フォーカス・タップのどれでも出る", "A5: 評価確定の直後に3つの一覧へ最新の点数が出て、一般の社員の応答には等級と点数が含まれない", "A6: 2社目への所属ができ、所属していない会社への切り替えと操作は拒否される", "A7: 提出状況の一覧に対象者全員が提出済み・未提出つきで出る", "A8: 設定不足の全件に、何が足りないか・どう直すかと直す画面へのリンクがある", "A9: 画面名が『Claude Code連携（システム開発者専用）』になっている", "A10: 並べ替えはポインター・タッチ・キーボードの3操作で同じ結果になり、全体保存の競合は 409 を返す", "A11: 選択肢を押すと選べ、選択肢の値の重複は拒否される", "A12: 4つの幅の撮影で右側だけが空く画面が無い", "撮影と記録に実在の社員名・評価値が無い（見本のデータだけ）"]
architecture_refs: ["arch-system-spec-ui-ux", "arch-system-spec-frontend"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P07（acceptance）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p07.md", "confidence": 0.95}]
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

# ローカルの preview で、受入 A1〜A12 を役割ごと・4つの幅で確かめる

## 目的

ローカルの D1 に移行と見本のデータを入れ、preview（ポート 8787）で全体管理者・会社の管理者・マネージャー・一般の社員の4つの役割と、375・768・1280・1600 の4つの幅で、A1〜A12 を画面の通し試験と撮影で確かめる。

## 背景

権限一覧のカードの切り替え・長押しドラッグ・右側の余白は、単体の試験では見えない。役割と幅を変えて実物で確かめる。撮影には見本のデータだけを使い、実在の社員名や評価値を入れない。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-ui-ux（architecture/system-spec-ui-ux.md）、arch-system-spec-frontend（architecture/system-spec-frontend.md）。

## 入力と前提条件

- 入力: e2e/improvement-requests-2026-10.spec.ts、eval-log/feature-improvement-requests-2026-10-test-run.json
- 前提: 依存タスク（SYS-IR-P06）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: eval-log/feature-improvement-requests-2026-10-acceptance.json（A1〜A12 ごとの判定と根拠）
- 生成物: eval-log/feature-improvement-requests-2026-10-screens/（見本のデータだけで撮った4つの幅の画面）
- 更新対象: eval-log/feature-improvement-requests-2026-10-acceptance.json、eval-log/feature-improvement-requests-2026-10-screens/

## 依存関係

- `depends_on`: ["SYS-IR-P06"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: 対象。4つの幅と4つの役割での画面の確認
- Backend/API: N/A: この phase（acceptance）は Backend/API を変えない
- Database/Data: N/A: この phase（acceptance）は Database/Data を変えない
- Infrastructure: N/A: この phase（acceptance）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（acceptance）は Security/Privacy を変えない
- Quality: 対象。受入の判定と記録
- Documentation: N/A: この phase（acceptance）は Documentation を変えない
- Operations: N/A: この phase（acceptance）は Operations を変えない

## Write scope と競合制約

- `touches`: `eval-log/feature-improvement-requests-2026-10-acceptance.json`、`eval-log/feature-improvement-requests-2026-10-screens/`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P07）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P07 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P07` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P06）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P07 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm db:migrate:local
4. 検証のコマンドを実行する: pnpm db:sample:local
5. 検証のコマンドを実行する: pnpm preview
6. 検証のコマンドを実行する: pnpm test:e2e
7. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
8. PR の本文に dev-graph: SYS-IR-P07 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
9. /dev-graph worktree release SYS-IR-P07 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] A1: 等級名を変える結合テストで全表示が新しい名前になり、英語の区分名の静的検査が0件である（O6）
- [ ] A2: 等級名の変更は、全体管理者と会社の管理者以外では画面とサーバーの両方が拒否する（O7）
- [ ] A3: ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストが通る（O8）
- [ ] A4: 権限一覧の表とカードが同じ内容を出し、説明がポインター・フォーカス・タップのどれでも出る
- [ ] A5: 評価確定の直後に3つの一覧へ最新の点数が出て、一般の社員の応答には等級と点数が含まれない
- [ ] A6: 2社目への所属ができ、所属していない会社への切り替えと操作は拒否される
- [ ] A7: 提出状況の一覧に対象者全員が提出済み・未提出つきで出る
- [ ] A8: 設定不足の全件に、何が足りないか・どう直すかと直す画面へのリンクがある
- [ ] A9: 画面名が『Claude Code連携（システム開発者専用）』になっている
- [ ] A10: 並べ替えはポインター・タッチ・キーボードの3操作で同じ結果になり、全体保存の競合は 409 を返す
- [ ] A11: 選択肢を押すと選べ、選択肢の値の重複は拒否される
- [ ] A12: 4つの幅の撮影で右側だけが空く画面が無い
- [ ] 撮影と記録に実在の社員名・評価値が無い（見本のデータだけ）

## 検証方法

- 自動検証: `pnpm db:migrate:local`、`pnpm db:sample:local`、`pnpm preview`、`pnpm test:e2e`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feature-improvement-requests-2026-10-acceptance.json、pnpm test:e2e の出力、eval-log/feature-improvement-requests-2026-10-screens/

## リスクとロールバック

- リスク: 本番の環境での確認（P13 で、利用者の確認を経て行う） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: 記録と撮影を1つ前のコミットへ戻す

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P10
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: 対象。4つの幅と4つの役割での画面の確認
- Backend: N/A: この phase（acceptance）の責務に Backend の変更は含まれない
- API: N/A: この phase（acceptance）の責務に API の変更は含まれない
- Data: N/A: この phase（acceptance）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（acceptance）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（acceptance）の責務に Security の変更は含まれない
- Quality: 対象。受入の判定と記録
- Documentation: N/A: この phase（acceptance）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（acceptance）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-ui-ux・arch-system-spec-frontend
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）
- Compatibility/migration/backfill: N/A: この phase はデータの形を変えない

## Verification and evidence

- コマンド: pnpm db:migrate:local
- コマンド: pnpm db:sample:local
- コマンド: pnpm preview
- コマンド: pnpm test:e2e
- 証跡: eval-log/feature-improvement-requests-2026-10-acceptance.json
- 証跡: pnpm test:e2e の出力
- 証跡: eval-log/feature-improvement-requests-2026-10-screens/

## Rollout and rollback

- Rollout: 記録だけ。マージで deploy.yml が走るが、製品のコードと移行は変わらないので同じ版の再配布になる
- Rollback: 記録と撮影を1つ前のコミットへ戻す

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-07-acceptance.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-ui-ux.md、architecture/system-spec-frontend.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

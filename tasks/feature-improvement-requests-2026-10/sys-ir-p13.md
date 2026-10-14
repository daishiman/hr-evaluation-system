---
graph_node_id: "SYS-IR-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "本番への配布の結果を確かめて配布の記録と戻し方を残し、利用者の確認のあと本番の画面を確かめて改善要望を対応済みにする"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "release-deploy"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-13-release-deploy.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P11", "SYS-IR-P12"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-database"]
resource_scope: ["docs/deploy-notes.md", "eval-log/feature-improvement-requests-2026-10-release.json"]
purpose: "P13 を始めた時点の main の先頭のコミット（P11 と P12 のマージを含む）について、deploy.yml の実行が成功していること（未適用の移行の確認・Worker の差し替え・スモーク2回）を gh run list と gh run view で読み取りだけで確かめる。あわせて、P05 のマージの実行で 0033・0034 が Worker の差し替えより先に当たったことを確かめ、P06 が記録した実行番号と書き出しの artifact の名前を引き継ぐ。docs/deploy-notes.md に配布の記録（マージごとの deploy.yml の実行番号・当たった移行・Worker の版・書き出しの artifact の名前）と戻し方の節を足し、next 16.3.8 でのビルドを確かめる。利用者の確認のあと、本番の画面で4つの役割ごとに要点を確かめ、改善要望 #8・#13・#14 を pnpm improvements done で対応済みにする。"
goal: "本番への配布の結果を確かめて配布の記録と戻し方を残し、利用者の確認のあと本番の画面を確かめて改善要望を対応済みにする。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["docs/deploy-notes.md の配布の記録と戻し方の節", "eval-log/feature-improvement-requests-2026-10-release.json（deploy.yml の実行の確認、本番の画面での役割ごとの判定、改善要望の状態の更新、利用者の確認の日時）"]
scope_out: ["本番の DB への直接の書き込みと手動の移行（migrate.yml は復旧のときだけ使い、この phase では動かさない）", "本番データの修正（等級名の書き換えと所属の作成を除く）", "新しい機能の追加"]
acceptance: ["S14: main の package.json と pnpm-lock.yaml の next が 16.3.8 で、pnpm cf:dry-run（opennextjs-cloudflare のビルド）が通る", "P13 を始めた時点の main の先頭のコミットで deploy.yml の実行が成功している（移行の再確認・Worker の差し替え・スモーク2回）", "P05 のマージの deploy.yml の実行で 0033・0034 が当たり、その実行の書き出しの artifact の名前と有無が P06 の記録（feature-improvement-requests-2026-10-test-run.json）から docs/deploy-notes.md へ引き継がれている", "本番の DB へ直接書き込んでいない（wrangler d1 execute --remote・db:migrate:remote・db:sample:remote・migrate.yml を使っていない）", "利用者の確認のあと、本番の画面で4つの役割ごとに等級名の表示・権限一覧・等級と点数の見え方・設定不足の表示・画面名を確かめ、判定だけを記録している（撮影や実在の社員名・評価値を残さない）", "利用者の確認のあと、改善要望 #8・#13・#14 を pnpm improvements done で対応済みにしている", "docs/deploy-notes.md は P12 が揃えた内容を書き換えず、配布の記録と戻し方の節だけを足す", "P11 の証跡と P12 の文書の両方が揃ったコミットで pnpm run check:docs が通る"]
architecture_refs: ["arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-database"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P13"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P13（release-deploy）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p13.md", "confidence": 0.95}]
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

# 本番への配布の結果を確かめて配布の記録と戻し方を残し、利用者の確認のあと本番の画面を確かめて改善要望を対応済みにする

## 目的

P13 を始めた時点の main の先頭のコミット（P11 と P12 のマージを含む）について、deploy.yml の実行が成功していること（未適用の移行の確認・Worker の差し替え・スモーク2回）を gh run list と gh run view で読み取りだけで確かめる。あわせて、P05 のマージの実行で 0033・0034 が Worker の差し替えより先に当たったことを確かめ、P06 が記録した実行番号と書き出しの artifact の名前を引き継ぐ。docs/deploy-notes.md に配布の記録（マージごとの deploy.yml の実行番号・当たった移行・Worker の版・書き出しの artifact の名前）と戻し方の節を足し、next 16.3.8 でのビルドを確かめる。利用者の確認のあと、本番の画面で4つの役割ごとに要点を確かめ、改善要望 #8・#13・#14 を pnpm improvements done で対応済みにする。

## 背景

deploy.yml は main への push のたびに、本番の D1 の書き出し（未適用の移行があるとき）→ 移行 → Worker の差し替え → スモーク2回を自動で行う。配布そのものは P05 などのマージで既に起きているので、P13 はその結果を読み取りで確かめ、記録と戻し方を残す。本番の DB は読み取り専用の扱いで、本番のアプリへの書き込み（改善要望の状態の更新）は利用者の確認を通す決まりがある。書き出しの artifact は14日で消えるので、その有無は P06 がマージの直後に記録してある。P13 の時点で artifact が既に消えていても、P06 の記録で確かめたものとして扱う。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-infrastructure（architecture/system-spec-infrastructure.md）、arch-system-spec-maintenance-ops（architecture/system-spec-maintenance-ops.md）、arch-system-spec-database（architecture/system-spec-database.md）。

## 入力と前提条件

- 入力: eval-log/feature-improvement-requests-2026-10-evidence.json、docs/deploy-notes.md、eval-log/feature-improvement-requests-2026-10-implementation.json、eval-log/feature-improvement-requests-2026-10-test-run.json、.github/workflows/deploy.yml
- 前提: 依存タスク（SYS-IR-P11、SYS-IR-P12）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: docs/deploy-notes.md の配布の記録と戻し方の節
- 生成物: eval-log/feature-improvement-requests-2026-10-release.json（deploy.yml の実行の確認、本番の画面での役割ごとの判定、改善要望の状態の更新、利用者の確認の日時）
- 更新対象: docs/deploy-notes.md、eval-log/feature-improvement-requests-2026-10-release.json

## 依存関係

- `depends_on`: ["SYS-IR-P11", "SYS-IR-P12"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（release-deploy）は Frontend を変えない
- Backend/API: N/A: この phase（release-deploy）は Backend/API を変えない
- Database/Data: N/A: この phase（release-deploy）は Database/Data を変えない
- Infrastructure: 対象。deploy.yml の実行の結果（移行・Worker・スモーク）の確認と戻し方
- Security/Privacy: N/A: この phase（release-deploy）は Security/Privacy を変えない
- Quality: N/A: この phase（release-deploy）は Quality を変えない
- Documentation: N/A: この phase（release-deploy）は Documentation を変えない
- Operations: 対象。本番の画面での役割ごとの確認と、改善要望の状態の更新

## Write scope と競合制約

- `touches`: `docs/deploy-notes.md`、`eval-log/feature-improvement-requests-2026-10-release.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P13）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P13 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P13` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P11、SYS-IR-P12）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P13 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: gh run list --workflow deploy.yml --branch main --limit 20
4. 検証のコマンドを実行する: gh run view（P05 のマージと先頭のコミットの実行番号を付ける）
5. 検証のコマンドを実行する: pnpm run check:docs
6. 検証のコマンドを実行する: pnpm cf:dry-run
7. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
8. PR の本文に dev-graph: SYS-IR-P13 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
9. /dev-graph worktree release SYS-IR-P13 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] S14: main の package.json と pnpm-lock.yaml の next が 16.3.8 で、pnpm cf:dry-run（opennextjs-cloudflare のビルド）が通る
- [ ] P13 を始めた時点の main の先頭のコミットで deploy.yml の実行が成功している（移行の再確認・Worker の差し替え・スモーク2回）
- [ ] P05 のマージの deploy.yml の実行で 0033・0034 が当たり、その実行の書き出しの artifact の名前と有無が P06 の記録（feature-improvement-requests-2026-10-test-run.json）から docs/deploy-notes.md へ引き継がれている
- [ ] 本番の DB へ直接書き込んでいない（wrangler d1 execute --remote・db:migrate:remote・db:sample:remote・migrate.yml を使っていない）
- [ ] 利用者の確認のあと、本番の画面で4つの役割ごとに等級名の表示・権限一覧・等級と点数の見え方・設定不足の表示・画面名を確かめ、判定だけを記録している（撮影や実在の社員名・評価値を残さない）
- [ ] 利用者の確認のあと、改善要望 #8・#13・#14 を pnpm improvements done で対応済みにしている
- [ ] docs/deploy-notes.md は P12 が揃えた内容を書き換えず、配布の記録と戻し方の節だけを足す
- [ ] P11 の証跡と P12 の文書の両方が揃ったコミットで pnpm run check:docs が通る

## 検証方法

- 自動検証: `gh run list --workflow deploy.yml --branch main --limit 20`、`gh run view（P05 のマージと先頭のコミットの実行番号を付ける）`、`pnpm run check:docs`、`pnpm cf:dry-run`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feature-improvement-requests-2026-10-release.json、docs/deploy-notes.md の配布の記録と戻し方、gh run view の出力（deploy.yml の各段の成否）、check:docs の出力（exit 0。P11 と P12 の両方が揃ったコミット）、cf:dry-run の出力（exit 0）

## リスクとロールバック

- リスク: 本番の DB への直接の書き込みと手動の移行（migrate.yml は復旧のときだけ使い、この phase では動かさない） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: 配布の不具合が見つかったら、wrangler deployments list で1つ前の版を確かめて wrangler rollback で Worker を戻す。0034 の書き換えは P05 のマージの実行が保管した書き出しから会社の等級名と表示名の列だけを戻す。戻すのは本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として行う。戻す前に、書き出しの値・移行が書いた値・今の値を会社ごとに突き合わせ、今の値が移行の書いた値のままの行だけを戻す。マージのあとに会社が編集した等級名や表示名は上書きせず、一覧にして利用者に示す。0033 の表は前の版のコードが読まないので残してよい。改善要望を対応済みにしたあとで不具合が見つかったときは、pnpm improvements failed で理由を残す

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: feature-improvement-requests-2026-10（feature の完了判定）
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（release-deploy）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（release-deploy）の責務に Backend の変更は含まれない
- API: N/A: この phase（release-deploy）の責務に API の変更は含まれない
- Data: N/A: この phase（release-deploy）の責務に Data の変更は含まれない
- Infrastructure: 対象。deploy.yml の実行の結果（移行・Worker・スモーク）の確認と戻し方
- Security: N/A: この phase（release-deploy）の責務に Security の変更は含まれない
- Quality: N/A: この phase（release-deploy）の責務に Quality の変更は含まれない
- Documentation: N/A: この phase（release-deploy）の責務に Documentation の変更は含まれない
- Operations: 対象。本番の画面での役割ごとの確認と、改善要望の状態の更新

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-infrastructure・arch-system-spec-maintenance-ops・arch-system-spec-database（D-004 opt-membership-cookie（所属の表と cookie）、D-005 opt-pointer-hook（Pointer Events の自作）、D-006 opt-combined（表・役割のタブ・スマホのカード）、D-007 opt-route-ledger-extend（route-ledger.json に足す）、qa-v02（等級名を変えられるのは全体管理者と会社の管理者だけ））
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）
- Compatibility/migration/backfill: 移行 0033・0034 は P05 のマージで deploy.yml が Worker の差し替えより先に当て済み。P13 は本番の DB に書き込まず、当たったことを deploy.yml の実行の記録で確かめる

## Verification and evidence

- コマンド: gh run list --workflow deploy.yml --branch main --limit 20
- コマンド: gh run view（P05 のマージと先頭のコミットの実行番号を付ける）
- コマンド: pnpm run check:docs
- コマンド: pnpm cf:dry-run
- 証跡: eval-log/feature-improvement-requests-2026-10-release.json
- 証跡: docs/deploy-notes.md の配布の記録と戻し方
- 証跡: gh run view の出力（deploy.yml の各段の成否）
- 証跡: check:docs の出力（exit 0。P11 と P12 の両方が揃ったコミット）
- 証跡: cf:dry-run の出力（exit 0）

## Rollout and rollback

- Rollout: P13 のマージも deploy.yml を起こすが、文書と記録だけなので同じ版の再配布になる。本番の画面の確認と改善要望の状態の更新は、本番のアプリへの読み書きなので利用者の確認のあとに行う
- Rollback: 配布の不具合が見つかったら、wrangler deployments list で1つ前の版を確かめて wrangler rollback で Worker を戻す。0034 の書き換えは P05 のマージの実行が保管した書き出しから会社の等級名と表示名の列だけを戻す。戻すのは本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として行う。戻す前に、書き出しの値・移行が書いた値・今の値を会社ごとに突き合わせ、今の値が移行の書いた値のままの行だけを戻す。マージのあとに会社が編集した等級名や表示名は上書きせず、一覧にして利用者に示す。0033 の表は前の版のコードが読まないので残してよい。改善要望を対応済みにしたあとで不具合が見つかったときは、pnpm improvements failed で理由を残す

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-13-release-deploy.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-database.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

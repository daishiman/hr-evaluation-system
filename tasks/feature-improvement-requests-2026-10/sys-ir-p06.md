---
graph_node_id: "SYS-IR-P06"
artifact_kind: "task"
artifact_subtypes: []
title: "P04 で赤だった試験を全部緑にし、型検査・文書の検査・domain のカバレッジ 100% を確かめる"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "test-run"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p06.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-06-test-run.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P05"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-frontend", "arch-system-spec-backend"]
resource_scope: ["eval-log/feature-improvement-requests-2026-10-test-run.json"]
purpose: "P05 の実装のあとで、型検査・全試験・カバレッジ・文書の検査を流し、P04 で赤だった試験が全部緑になり、既存の試験を弱めていないことを確かめて記録する。"
goal: "P04 で赤だった試験を全部緑にし、型検査・文書の検査・domain のカバレッジ 100% を確かめる。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["eval-log/feature-improvement-requests-2026-10-test-run.json（コマンドごとの終了コードと件数、P04 の赤から緑への対応、P05 のマージで動いた deploy.yml の実行番号・結論・書き出しの artifact の名前と有無）"]
scope_out: ["画面の通し試験と撮影（P07）", "試験の期待の変更"]
acceptance: ["A13: pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ", "P04 で赤だった試験が全部緑", "既存の試験に skip・only の追加や期待の削除が無い（git diff で確かめる）", "P05 のマージで動いた deploy.yml の実行番号と結論、d1-backup- に実行番号を付けた書き出しの artifact があることを、gh run list --workflow deploy.yml と gh run view の読み取りだけで確かめて記録している（artifact は14日で消えるので、P06 の開始の時点で残す）"]
architecture_refs: ["arch-system-spec-frontend", "arch-system-spec-backend"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P06"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P06（test-run）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p06.md", "confidence": 0.95}]
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

# P04 で赤だった試験を全部緑にし、型検査・文書の検査・domain のカバレッジ 100% を確かめる

## 目的

P05 の実装のあとで、型検査・全試験・カバレッジ・文書の検査を流し、P04 で赤だった試験が全部緑になり、既存の試験を弱めていないことを確かめて記録する。

## 背景

試験を緑にするために期待を弱めたり飛ばしたりすると、受入の意味がなくなる。差分で確かめる。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-frontend（architecture/system-spec-frontend.md）、arch-system-spec-backend（architecture/system-spec-backend.md）。

## 入力と前提条件

- 入力: eval-log/feature-improvement-requests-2026-10-test-design.json
- 前提: 依存タスク（SYS-IR-P05）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: eval-log/feature-improvement-requests-2026-10-test-run.json（コマンドごとの終了コードと件数、P04 の赤から緑への対応、P05 のマージで動いた deploy.yml の実行番号・結論・書き出しの artifact の名前と有無）
- 更新対象: eval-log/feature-improvement-requests-2026-10-test-run.json

## 依存関係

- `depends_on`: ["SYS-IR-P05"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（test-run）は Frontend を変えない
- Backend/API: N/A: この phase（test-run）は Backend/API を変えない
- Database/Data: N/A: この phase（test-run）は Database/Data を変えない
- Infrastructure: N/A: この phase（test-run）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（test-run）は Security/Privacy を変えない
- Quality: 対象。全試験・カバレッジ・文書の検査の実行と記録
- Documentation: N/A: この phase（test-run）は Documentation を変えない
- Operations: N/A: この phase（test-run）は Operations を変えない

## Write scope と競合制約

- `touches`: `eval-log/feature-improvement-requests-2026-10-test-run.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P06）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P06 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P06` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P05）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P06 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm typecheck
4. 検証のコマンドを実行する: pnpm test
5. 検証のコマンドを実行する: pnpm test:coverage
6. 検証のコマンドを実行する: pnpm run check:docs
7. 検証のコマンドを実行する: gh run list --workflow deploy.yml --branch main --limit 5
8. 検証のコマンドを実行する: gh run view --json conclusion,jobs
9. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
10. PR の本文に dev-graph: SYS-IR-P06 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
11. /dev-graph worktree release SYS-IR-P06 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] A13: pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ
- [ ] P04 で赤だった試験が全部緑
- [ ] 既存の試験に skip・only の追加や期待の削除が無い（git diff で確かめる）
- [ ] P05 のマージで動いた deploy.yml の実行番号と結論、d1-backup- に実行番号を付けた書き出しの artifact があることを、gh run list --workflow deploy.yml と gh run view の読み取りだけで確かめて記録している（artifact は14日で消えるので、P06 の開始の時点で残す）

## 検証方法

- 自動検証: `pnpm typecheck`、`pnpm test`、`pnpm test:coverage`、`pnpm run check:docs`、`gh run list --workflow deploy.yml --branch main --limit 5`、`gh run view --json conclusion,jobs`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feature-improvement-requests-2026-10-test-run.json、coverage の要約（domain 100%）、gh run view の出力（P05 のマージの実行番号・結論・artifact の名前）

## リスクとロールバック

- リスク: 画面の通し試験と撮影（P07） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: 記録を1つ前のコミットへ戻す。製品のコードには触れていない

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P07、SYS-IR-P09
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（test-run）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（test-run）の責務に Backend の変更は含まれない
- API: N/A: この phase（test-run）の責務に API の変更は含まれない
- Data: N/A: この phase（test-run）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（test-run）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（test-run）の責務に Security の変更は含まれない
- Quality: 対象。全試験・カバレッジ・文書の検査の実行と記録
- Documentation: N/A: この phase（test-run）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（test-run）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-frontend・arch-system-spec-backend
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）
- Compatibility/migration/backfill: N/A: この phase はデータの形を変えない

## Verification and evidence

- コマンド: pnpm typecheck
- コマンド: pnpm test
- コマンド: pnpm test:coverage
- コマンド: pnpm run check:docs
- コマンド: gh run list --workflow deploy.yml --branch main --limit 5
- コマンド: gh run view --json conclusion,jobs
- 証跡: eval-log/feature-improvement-requests-2026-10-test-run.json
- 証跡: coverage の要約（domain 100%）
- 証跡: gh run view の出力（P05 のマージの実行番号・結論・artifact の名前）

## Rollout and rollback

- Rollout: 記録だけ。マージで deploy.yml が走るが、製品のコードと移行は変わらないので同じ版の再配布になる
- Rollback: 記録を1つ前のコミットへ戻す。製品のコードには触れていない

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-06-test-run.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-frontend.md、architecture/system-spec-backend.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

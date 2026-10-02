---
graph_node_id: "SYS-DF-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "移行を既存のデータに当てて確かめ、退避の片付けを済ませる"
project_id: "feature-package-feat-data-freshness"
domain: "data"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "refactoring-migration"]
file_path: "tasks/feat-data-freshness/sys-df-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P05"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: [".gitignore", "eval-log/feat-data-freshness-migration-check.json"]
purpose: "移行 0031・0032 を、空の D1 と、サンプルのデータ（実データではない）を入れた D1 の両方に使い捨ての保存先で当て、0032 が同じ実体の中で番号を振り直してから一意の索引を張れること、退避した経路が src/ と e2e/ から呼ばれていないことを確かめて記録する。退避で要らなくなった .gitignore の例外の行（evaluations/build）を消す。"
goal: "移行を既存のデータに当てて確かめ、退避の片付けを済ませる。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["eval-log/feat-data-freshness-migration-check.json（空の D1 とサンプルのデータの D1 で、0031・0032 が当たったことと、uq_ce_entity_seq の重なりが0件であることの記録）", ".gitignore から、退避した evaluations/build の経路のための例外の行を消す（P04 が足した test-results・playwright-report・e2e/.auth の行は変えない）"]
scope_out: ["本番の D1 への移行（P13 で配布するときに、利用者の確認を通して行う）", "移行の SQL の変更（P05 が持つ）", "src/ の変更（P05 が持つ）"]
acceptance: ["A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）", "A5: 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない", "サンプルのデータの D1 で、0032 のあとに同じ実体の中の番号の重なりが0件である", "検証にローカル以外の D1 を使っていない"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P08（refactoring-migration）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p08.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.8", "linked_at": "2026-10-01T13:15:42Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 移行を既存のデータに当てて確かめ、退避の片付けを済ませる

## 目的

移行 0031・0032 を、空の D1 と、サンプルのデータ（実データではない）を入れた D1 の両方に使い捨ての保存先で当て、0032 が同じ実体の中で番号を振り直してから一意の索引を張れること、退避した経路が src/ と e2e/ から呼ばれていないことを確かめて記録する。退避で要らなくなった .gitignore の例外の行（evaluations/build）を消す。

## 背景

0032 は既存の制度マスタの履歴に重なった番号があっても通るよう、ROW_NUMBER で振り直してから DROP INDEX idx_ce_entity と CREATE UNIQUE INDEX uq_ce_entity_seq を行う。空の D1 だけで試すと、重なりのあるデータでの振る舞いを確かめられない。本番の D1 に当てる前に、ローカルで両方の状態を試す。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: drizzle/migrations/0031_initial_credential_memos.sql、drizzle/migrations/0032_constitution_events_seq_unique.sql、src/db/constitution-events-seq-migration.test.ts、src/actions/
- 前提: 依存タスク（SYS-DF-P05）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: eval-log/feat-data-freshness-migration-check.json（空の D1 とサンプルのデータの D1 で、0031・0032 が当たったことと、uq_ce_entity_seq の重なりが0件であることの記録）
- 生成物: .gitignore から、退避した evaluations/build の経路のための例外の行を消す（P04 が足した test-results・playwright-report・e2e/.auth の行は変えない）
- 更新対象: .gitignore、eval-log/feat-data-freshness-migration-check.json

## 依存関係

- `depends_on`: ["SYS-DF-P05"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（refactoring-migration）は Frontend を変えない
- Backend/API: 対象。退避した経路を呼ぶ部品と試験が src/ と e2e/ に0件であること
- Database/Data: 対象。移行を空の D1 とサンプルのデータの D1 に当て、番号の重なりが0件になること
- Infrastructure: N/A: この phase（refactoring-migration）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（refactoring-migration）は Security/Privacy を変えない
- Documentation: N/A: この phase（refactoring-migration）は Documentation を変えない

## Write scope と競合制約

- `touches`: `.gitignore`、`eval-log/feat-data-freshness-migration-check.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P08）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P08 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P08` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P05）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P08 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm exec wrangler d1 migrations apply hr-evaluation-db --local --persist-to で使い捨ての保存先を指定し、空の状態とサンプルのデータを入れた状態の両方に当てる
4. 検証のコマンドを実行する: pnpm vitest run src/db/constitution-events-seq-migration.test.ts
5. 検証のコマンドを実行する: git grep で、退避した22本の経路を呼ぶ箇所が src/ と e2e/ に0件であることを確かめる
6. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
7. /dev-graph worktree release SYS-DF-P08 で lease を返す

## 受入条件

- [ ] A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）
- [ ] A5: 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない
- [ ] サンプルのデータの D1 で、0032 のあとに同じ実体の中の番号の重なりが0件である
- [ ] 検証にローカル以外の D1 を使っていない

## 検証方法

- 自動検証: `pnpm exec wrangler d1 migrations apply hr-evaluation-db --local --persist-to で使い捨ての保存先を指定し、空の状態とサンプルのデータを入れた状態の両方に当てる`、`pnpm vitest run src/db/constitution-events-seq-migration.test.ts`、`git grep で、退避した22本の経路を呼ぶ箇所が src/ と e2e/ に0件であることを確かめる`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feat-data-freshness-migration-check.json、src/db/constitution-events-seq-migration.test.ts の結果

## リスクとロールバック

- リスク: 本番の D1 への移行（P13 で配布するときに、利用者の確認を通して行う） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: 移行が当たらないときは P05 に差し戻して SQL を直す。.gitignore の変更は git revert で戻す。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P09
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（refactoring-migration）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（refactoring-migration）の責務に Backend の変更は含まれない
- API: 対象。退避した経路を呼ぶ部品と試験が src/ と e2e/ に0件であること
- Data: 対象。移行を空の D1 とサンプルのデータの D1 に当て、番号の重なりが0件になること
- Infrastructure: N/A: この phase（refactoring-migration）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（refactoring-migration）の責務に Security の変更は含まれない
- Quality: N/A: この phase（refactoring-migration）の責務に Quality の変更は含まれない
- Documentation: N/A: この phase（refactoring-migration）の責務に Documentation の変更は含まれない
- Operations: 対象。本番の D1 に当てる前の、ローカルでの下確かめの手順を残す

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: local-d1-scratch（使い捨てのローカル D1 で移行を試す。本番の D1 と Worker には配布しない）

## Verification and evidence

- コマンド: pnpm exec wrangler d1 migrations apply hr-evaluation-db --local --persist-to で使い捨ての保存先を指定し、空の状態とサンプルのデータを入れた状態の両方に当てる
- コマンド: pnpm vitest run src/db/constitution-events-seq-migration.test.ts
- コマンド: git grep で、退避した22本の経路を呼ぶ箇所が src/ と e2e/ に0件であることを確かめる
- 証跡: eval-log/feat-data-freshness-migration-check.json
- 証跡: src/db/constitution-events-seq-migration.test.ts の結果

## Rollout and rollback

- Rollout: ローカルの使い捨ての D1 だけを使うので、配布の手順は無い。本番の移行は P13 の順番に従う。
- Rollback: 移行が当たらないときは P05 に差し戻して SQL を直す。.gitignore の変更は git revert で戻す。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-08-refactoring-migration.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

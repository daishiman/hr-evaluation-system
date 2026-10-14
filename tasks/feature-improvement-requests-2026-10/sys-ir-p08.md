---
graph_node_id: "SYS-IR-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "移行 0033・0034 を、多様な見本のデータで2回流して確かめ、移行の対応表を残す"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "data"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "refactoring-migration"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P05"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-database", "arch-system-spec-infrastructure"]
resource_scope: ["eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json", "docs/migration-mapping.md", "drizzle/migrations/0035_migration_corrections.sql", "drizzle/migrations/meta/"]
purpose: "P05 の予行より広い見本のデータ（独自の等級名を付けた会社、上司のいない利用者、英語の区分名が混ざった表示名）を入れたローカルの D1 で、移行の前に書き出しを取り、0033・0034 を当てて、(1) 既存の利用者がそれぞれ今の会社・役割・等級・上司どおりの所属を1件ずつ持つ、(2) 会社の等級名がすべて等級N・等級N-M の形になる、(3) 表示名の列に英語の区分名が残らない、(4) 同じ SQL を wrangler d1 execute --local --file でもう一度流しても変わる行が0件、(5) 書き出しから戻すと元に戻る、の5つを確かめて記録し、docs/migration-mapping.md に旧から新への対応表を残す。"
goal: "移行 0033・0034 を、多様な見本のデータで2回流して確かめ、移行の対応表を残す。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json（見本のデータの種類、前後の件数、2回目の変化0、戻しの結果）", "docs/migration-mapping.md に 0033・0034 の旧から新への対応表を足す", "予行で直しが要ったときだけ、drizzle/migrations/0035_migration_corrections.sql（直しを1本にまとめる）と drizzle/migrations/meta/ の更新"]
scope_out: ["本番の D1 への直接の書き込み（wrangler d1 execute --remote などを使わない）", "本番に当て済みの移行 0033・0034 の書き換え", "等級名の書き換えと所属の作成を除く本番データの修正"]
acceptance: ["A1 の一部: 移行の後の会社の等級名がすべて等級N・等級N-M の形で、表示名の列に英語の区分名が0件", "A6 の一部: 既存の利用者がそれぞれ1件ずつ、今の値どおりの所属を持つ", "2回目に流して変わる行が0件", "書き出しから戻すと移行の前と同じ件数と値になる", "drizzle/migrations/0033_company_memberships.sql と 0034_grade_display_names.sql の差分が0件（本番に当て済みの移行を書き換えていない）"]
architecture_refs: ["arch-system-spec-database", "arch-system-spec-infrastructure"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P08（refactoring-migration）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p08.md", "confidence": 0.95}]
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

# 移行 0033・0034 を、多様な見本のデータで2回流して確かめ、移行の対応表を残す

## 目的

P05 の予行より広い見本のデータ（独自の等級名を付けた会社、上司のいない利用者、英語の区分名が混ざった表示名）を入れたローカルの D1 で、移行の前に書き出しを取り、0033・0034 を当てて、(1) 既存の利用者がそれぞれ今の会社・役割・等級・上司どおりの所属を1件ずつ持つ、(2) 会社の等級名がすべて等級N・等級N-M の形になる、(3) 表示名の列に英語の区分名が残らない、(4) 同じ SQL を wrangler d1 execute --local --file でもう一度流しても変わる行が0件、(5) 書き出しから戻すと元に戻る、の5つを確かめて記録し、docs/migration-mapping.md に旧から新への対応表を残す。

## 背景

P08 は P05 のあとに始まるので、0033・0034 は P05 のマージで deploy.yml が本番に当て済みになっている。D1 は当てた移行をファイル名で記録するので、0033・0034 を書き換えても本番では二度と流れず、ローカルと本番の中身が食い違う。直しが要るときは、新しい移行 drizzle/migrations/0035_migration_corrections.sql の1本にまとめて足す。新しい移行を足したときは、P10 で試験と画面の通し試験を流し直す。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-database（architecture/system-spec-database.md）、arch-system-spec-infrastructure（architecture/system-spec-infrastructure.md）。

## 入力と前提条件

- 入力: drizzle/migrations/0033_company_memberships.sql、drizzle/migrations/0034_grade_display_names.sql、architecture/improvement-requests-2026-10.md、eval-log/feature-improvement-requests-2026-10-implementation.json
- 前提: 依存タスク（SYS-IR-P05）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json（見本のデータの種類、前後の件数、2回目の変化0、戻しの結果）
- 生成物: docs/migration-mapping.md に 0033・0034 の旧から新への対応表を足す
- 生成物: 予行で直しが要ったときだけ、drizzle/migrations/0035_migration_corrections.sql（直しを1本にまとめる）と drizzle/migrations/meta/ の更新
- 更新対象: eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json、docs/migration-mapping.md、drizzle/migrations/0035_migration_corrections.sql、drizzle/migrations/meta/

## 依存関係

- `depends_on`: ["SYS-IR-P05"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（refactoring-migration）は Frontend を変えない
- Backend/API: 対象。移行の後の読み出しが所属の表を使うことの確認
- Database/Data: 対象。移行の予行と対応表、直しが要るときの新しい移行
- Infrastructure: N/A: この phase（refactoring-migration）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（refactoring-migration）は Security/Privacy を変えない
- Quality: N/A: この phase（refactoring-migration）は Quality を変えない
- Documentation: N/A: この phase（refactoring-migration）は Documentation を変えない
- Operations: N/A: この phase（refactoring-migration）は Operations を変えない

## Write scope と競合制約

- `touches`: `eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json`、`docs/migration-mapping.md`、`drizzle/migrations/0035_migration_corrections.sql`、`drizzle/migrations/meta/`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P08）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P08 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P08` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P05）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P08 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm db:migrate:local
4. 検証のコマンドを実行する: pnpm db:sample:local
5. 検証のコマンドを実行する: pnpm test
6. 検証のコマンドを実行する: pnpm typecheck
7. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
8. PR の本文に dev-graph: SYS-IR-P08 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
9. /dev-graph worktree release SYS-IR-P08 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] A1 の一部: 移行の後の会社の等級名がすべて等級N・等級N-M の形で、表示名の列に英語の区分名が0件
- [ ] A6 の一部: 既存の利用者がそれぞれ1件ずつ、今の値どおりの所属を持つ
- [ ] 2回目に流して変わる行が0件
- [ ] 書き出しから戻すと移行の前と同じ件数と値になる
- [ ] drizzle/migrations/0033_company_memberships.sql と 0034_grade_display_names.sql の差分が0件（本番に当て済みの移行を書き換えていない）

## 検証方法

- 自動検証: `pnpm db:migrate:local`、`pnpm db:sample:local`、`pnpm test`、`pnpm typecheck`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json、docs/migration-mapping.md、git diff で 0033・0034 の差分が0件であることの出力

## リスクとロールバック

- リスク: 本番の D1 への直接の書き込み（wrangler d1 execute --remote などを使わない） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: ローカルは書き出しから戻す。新しい移行を本番へ当てたあとに戻すときは、deploy.yml が保管した書き出しから対象の列だけを戻し、Worker は wrangler rollback で戻す。戻すのは本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として行う。戻す前に、書き出しの値・移行が書いた値・今の値を会社ごとに突き合わせ、今の値が移行の書いた値のままの行だけを戻す。マージのあとに会社が編集した等級名や表示名は上書きせず、一覧にして利用者に示す

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P09
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（refactoring-migration）の責務に Frontend の変更は含まれない
- Backend: 対象。移行の後の読み出しが所属の表を使うことの確認
- API: N/A: この phase（refactoring-migration）の責務に API の変更は含まれない
- Data: 対象。移行の予行と対応表、直しが要るときの新しい移行
- Infrastructure: N/A: この phase（refactoring-migration）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（refactoring-migration）の責務に Security の変更は含まれない
- Quality: N/A: この phase（refactoring-migration）の責務に Quality の変更は含まれない
- Documentation: N/A: この phase（refactoring-migration）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（refactoring-migration）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-database・arch-system-spec-infrastructure（D-004 opt-membership-cookie（所属の表と cookie）、D-005 opt-pointer-hook（Pointer Events の自作）、D-006 opt-combined（表・役割のタブ・スマホのカード）、D-007 opt-route-ledger-extend（route-ledger.json に足す）、qa-v02（等級名を変えられるのは全体管理者と会社の管理者だけ））
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）
- Compatibility/migration/backfill: 0033 は表の追加と所属の作成（WHERE NOT EXISTS で2回目は何もしない）。0034 は条件つきの UPDATE（2回目は0行）。どちらも本番に当て済みなので書き換えず、直しは新しい移行 0035_migration_corrections.sql の1本で行う

## Verification and evidence

- コマンド: pnpm db:migrate:local
- コマンド: pnpm db:sample:local
- コマンド: pnpm test
- コマンド: pnpm typecheck
- 証跡: eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json
- 証跡: docs/migration-mapping.md
- 証跡: git diff で 0033・0034 の差分が0件であることの出力

## Rollout and rollback

- Rollout: 新しい移行を足さなければ記録と文書だけで、main へのマージで deploy.yml が走っても同じ版の再配布になる。0035_migration_corrections.sql を足したときは、そのマージで deploy.yml が書き出しのあとに本番へ当てるので、マージは利用者の確認のあとに行う
- Rollback: ローカルは書き出しから戻す。新しい移行を本番へ当てたあとに戻すときは、deploy.yml が保管した書き出しから対象の列だけを戻し、Worker は wrangler rollback で戻す。戻すのは本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として行う。戻す前に、書き出しの値・移行が書いた値・今の値を会社ごとに突き合わせ、今の値が移行の書いた値のままの行だけを戻す。マージのあとに会社が編集した等級名や表示名は上書きせず、一覧にして利用者に示す

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-08-refactoring-migration.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-database.md、architecture/system-spec-infrastructure.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

---
graph_node_id: "SYS-IR-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "受入13項目を、実装の前に単体・結合・契約・画面の試験にして、赤になることを確かめる"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "test-design"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P03"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-frontend", "arch-system-spec-backend", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["tests/red/", "vitest.red.config.mts", "e2e/improvement-requests-2026-10.spec.ts", "eval-log/feature-improvement-requests-2026-10-test-design.json"]
purpose: "受入 A1〜A12 を、実装の前に試験の形で固定する。等級の呼び名と英語の区分名の静的検査（A1）、等級名の変更の役割ごとの結合試験（A2）、route-ledger の権限と実際の判定の契約試験（A3）、権限一覧の表とカードと説明（A4）、点数の可視範囲（A5）、2社目の所属と切り替えの拒否（A6）、提出状況（A7）、設定不足のリンク（A8）、画面名（A9）、並べ替えの3操作と 409（A10）、選択肢と値の重複（A11）、4つの幅の撮影（A12）。この時点では実装が無いので、試験が期待どおり赤になることまでを確かめて記録する。単体・結合・契約の赤の試験は tests/red/ に置き、専用の設定 vitest.red.config.mts でだけ流す。P04 の PR は単独で main へマージし、main の確認は緑のままにする。"
goal: "受入13項目を、実装の前に単体・結合・契約・画面の試験にして、赤になることを確かめる。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["tests/red/grade-label.test.mts（A1。等級の呼び名と既定の等級名。P05 が src/lib/domain/grade-label.test.ts へ移す）", "tests/red/grade-label-static.test.mts（A1。英語の区分名 Beginner・Regular・Chief・AM・Manager を画面の文字として書く箇所が0件。P05 が src/lib/grade-label-static.test.ts へ移す）", "tests/red/grade-names.integration.test.mts（A2。マネージャー・一般の社員・他社の会社管理者の変更を拒否。P05 が src/actions/grade-names.integration.test.ts へ移す）", "tests/red/permissions-contract.test.mts（A3。route-ledger の permissions とサイドバー・ページの判定・サーバー処理の最低ロールの照合。P05 が src/lib/permissions-contract.test.ts へ移す）", "tests/red/score-visibility.test.mts（A5。一般の社員の応答に等級と点数が無い。P05 が src/lib/score-visibility.test.ts へ移す）", "tests/red/memberships.integration.test.mts（A6。2社目の所属と、所属していない会社への切り替えと操作の拒否。P05 が src/actions/memberships.integration.test.ts へ移す）", "tests/red/submission-status.test.mts（A7。対象者全員が提出済み・入力途中・未回答つきで出る。P05 が src/lib/domain/submission-status.test.ts へ移す）", "tests/red/setup-gaps-links.test.mts（A8。設定不足の全件に何が足りない・どう直す・直す画面のリンク。P05 が src/lib/domain/setup-gaps-links.test.ts へ移す）", "tests/red/useLongPressReorder.test.mts（A10。ポインター・タッチ・キーボードで同じ並び、版の不一致で 409。P05 が src/components/reorder/useLongPressReorder.test.ts へ移す）", "tests/red/FormAnswer.test.mts（A11。選択肢を押すと選べる。見本では理由が出る。P05 が src/components/FormAnswer.test.ts へ移す）", "tests/red/route-ledger.test.mjs（A3・S14。今の scripts/route-ledger.test.mjs の期待を47画面と permissions の形にした写し。P05 が scripts/route-ledger.test.mjs と入れ替える）", "vitest.red.config.mts（include は tests/red/**/*.test.mts と tests/red/**/*.test.mjs だけ。environment と alias の @ は vitest.config.mts と同じ）", "e2e/improvement-requests-2026-10.spec.ts（A4・A9・A12。権限一覧の表とカード、画面名、375・768・1280・1600 の4つの幅の撮影。製品のコードを import しないので typecheck は通る）", "eval-log/feature-improvement-requests-2026-10-test-design.json（実装の前に赤になった試験の一覧と件数、移す先の対応、P04 のコミットの sha）"]
scope_out: ["実装（P05）", "既存の試験の期待を弱めること", "赤の試験を main の vitest や tsconfig の include に入れること"]
acceptance: ["A1〜A12 のそれぞれに、それを縛る試験が1件以上ある", "実装の前に、新しい試験が赤になることを記録している（pnpm exec vitest run --config vitest.red.config.mts の赤の件数と試験名、e2e のスペックの赤）", "P04 の PR を単独で main へマージしたときに、main の pnpm typecheck・pnpm test・pnpm test:coverage が緑のまま（赤の試験が vitest と tsconfig の include の外にある）", "既存の scripts/route-ledger.test.mjs の期待を P04 では変えていない（入れ替えは P05）", "テーマの契約試験（theme-contract・palette-contract・aidd-kit-boundary）を変えていない", "赤を隠すために、既存の試験にも新しい試験にも skip・only・保留扱いの印を足していない", "e2e は CI と deploy.yml のどちらでも流れない。P05 のマージまで、main で pnpm test:e2e を流すと新しいスペックだけが赤になることを test-design.json に書いている"]
architecture_refs: ["arch-system-spec-frontend", "arch-system-spec-backend", "arch-system-spec-security", "arch-system-spec-ui-ux"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P04（test-design）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p04.md", "confidence": 0.95}]
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

# 受入13項目を、実装の前に単体・結合・契約・画面の試験にして、赤になることを確かめる

## 目的

受入 A1〜A12 を、実装の前に試験の形で固定する。等級の呼び名と英語の区分名の静的検査（A1）、等級名の変更の役割ごとの結合試験（A2）、route-ledger の権限と実際の判定の契約試験（A3）、権限一覧の表とカードと説明（A4）、点数の可視範囲（A5）、2社目の所属と切り替えの拒否（A6）、提出状況（A7）、設定不足のリンク（A8）、画面名（A9）、並べ替えの3操作と 409（A10）、選択肢と値の重複（A11）、4つの幅の撮影（A12）。この時点では実装が無いので、試験が期待どおり赤になることまでを確かめて記録する。単体・結合・契約の赤の試験は tests/red/ に置き、専用の設定 vitest.red.config.mts でだけ流す。P04 の PR は単独で main へマージし、main の確認は緑のままにする。

## 背景

画面ごとの直しでは、新しい画面を足したときに同じ漏れが戻る。権限と等級の呼び名は契約試験と静的検査で縛れば、漏れが試験の失敗として見える。試験は P05 の実装を import するので、P05 より前は赤が正しい。ただし main の CI と deploy.yml は、vitest の include（src/**/*.test.ts と scripts/**/*.test.mjs）と tsconfig の include（*.ts と *.tsx。scripts/ は除外）の試験と型検査を流すので、赤の試験をそこに置くと P04 を単独でマージできず、one-task-one-branch で P04 を done にできない。そこで赤の試験は tests/red/ の *.test.mts（route-ledger の分は *.test.mjs）に置く。.mts と .mjs はどちらの include にも一致しないので、main の typecheck・test・test:coverage の対象にならない。P05 がそれらを本来の場所へ移して緑にする。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-frontend（architecture/system-spec-frontend.md）、arch-system-spec-backend（architecture/system-spec-backend.md）、arch-system-spec-security（architecture/system-spec-security.md）、arch-system-spec-ui-ux（architecture/system-spec-ui-ux.md）。

## 入力と前提条件

- 入力: specs/improvement-requests-2026-10.md、architecture/improvement-requests-2026-10.md、system-spec/route-ledger.json、scripts/route-ledger.test.mjs、vitest.config.mts、tsconfig.json
- 前提: 依存タスク（SYS-IR-P03）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: tests/red/grade-label.test.mts（A1。等級の呼び名と既定の等級名。P05 が src/lib/domain/grade-label.test.ts へ移す）
- 生成物: tests/red/grade-label-static.test.mts（A1。英語の区分名 Beginner・Regular・Chief・AM・Manager を画面の文字として書く箇所が0件。P05 が src/lib/grade-label-static.test.ts へ移す）
- 生成物: tests/red/grade-names.integration.test.mts（A2。マネージャー・一般の社員・他社の会社管理者の変更を拒否。P05 が src/actions/grade-names.integration.test.ts へ移す）
- 生成物: tests/red/permissions-contract.test.mts（A3。route-ledger の permissions とサイドバー・ページの判定・サーバー処理の最低ロールの照合。P05 が src/lib/permissions-contract.test.ts へ移す）
- 生成物: tests/red/score-visibility.test.mts（A5。一般の社員の応答に等級と点数が無い。P05 が src/lib/score-visibility.test.ts へ移す）
- 生成物: tests/red/memberships.integration.test.mts（A6。2社目の所属と、所属していない会社への切り替えと操作の拒否。P05 が src/actions/memberships.integration.test.ts へ移す）
- 生成物: tests/red/submission-status.test.mts（A7。対象者全員が提出済み・入力途中・未回答つきで出る。P05 が src/lib/domain/submission-status.test.ts へ移す）
- 生成物: tests/red/setup-gaps-links.test.mts（A8。設定不足の全件に何が足りない・どう直す・直す画面のリンク。P05 が src/lib/domain/setup-gaps-links.test.ts へ移す）
- 生成物: tests/red/useLongPressReorder.test.mts（A10。ポインター・タッチ・キーボードで同じ並び、版の不一致で 409。P05 が src/components/reorder/useLongPressReorder.test.ts へ移す）
- 生成物: tests/red/FormAnswer.test.mts（A11。選択肢を押すと選べる。見本では理由が出る。P05 が src/components/FormAnswer.test.ts へ移す）
- 生成物: tests/red/route-ledger.test.mjs（A3・S14。今の scripts/route-ledger.test.mjs の期待を47画面と permissions の形にした写し。P05 が scripts/route-ledger.test.mjs と入れ替える）
- 生成物: vitest.red.config.mts（include は tests/red/**/*.test.mts と tests/red/**/*.test.mjs だけ。environment と alias の @ は vitest.config.mts と同じ）
- 生成物: e2e/improvement-requests-2026-10.spec.ts（A4・A9・A12。権限一覧の表とカード、画面名、375・768・1280・1600 の4つの幅の撮影。製品のコードを import しないので typecheck は通る）
- 生成物: eval-log/feature-improvement-requests-2026-10-test-design.json（実装の前に赤になった試験の一覧と件数、移す先の対応、P04 のコミットの sha）
- 更新対象: tests/red/、vitest.red.config.mts、e2e/improvement-requests-2026-10.spec.ts、eval-log/feature-improvement-requests-2026-10-test-design.json

## 依存関係

- `depends_on`: ["SYS-IR-P03"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: 対象。権限一覧・並べ替え・選択肢・余白を画面の試験で縛る
- Backend/API: 対象。等級名の変更・所属・点数の読み出し・提出状況を結合試験で縛る
- Database/Data: N/A: この phase（test-design）は Database/Data を変えない
- Infrastructure: N/A: この phase（test-design）は Infrastructure を変えない
- Security/Privacy: 対象。他社の会社への切り替えと、一般の社員への点数の応答を拒否する試験
- Quality: 対象。試験の設計そのもの
- Documentation: N/A: この phase（test-design）は Documentation を変えない
- Operations: N/A: この phase（test-design）は Operations を変えない

## Write scope と競合制約

- `touches`: `tests/red/`、`vitest.red.config.mts`、`e2e/improvement-requests-2026-10.spec.ts`、`eval-log/feature-improvement-requests-2026-10-test-design.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P04）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P04 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P04` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P03）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P04 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm exec vitest run --config vitest.red.config.mts
4. 検証のコマンドを実行する: pnpm db:migrate:local
5. 検証のコマンドを実行する: pnpm db:sample:local
6. 検証のコマンドを実行する: pnpm preview
7. 検証のコマンドを実行する: pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts
8. 検証のコマンドを実行する: pnpm typecheck
9. 検証のコマンドを実行する: pnpm test
10. 検証のコマンドを実行する: pnpm test:coverage
11. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
12. PR の本文に dev-graph: SYS-IR-P04 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
13. /dev-graph worktree release SYS-IR-P04 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] A1〜A12 のそれぞれに、それを縛る試験が1件以上ある
- [ ] 実装の前に、新しい試験が赤になることを記録している（pnpm exec vitest run --config vitest.red.config.mts の赤の件数と試験名、e2e のスペックの赤）
- [ ] P04 の PR を単独で main へマージしたときに、main の pnpm typecheck・pnpm test・pnpm test:coverage が緑のまま（赤の試験が vitest と tsconfig の include の外にある）
- [ ] 既存の scripts/route-ledger.test.mjs の期待を P04 では変えていない（入れ替えは P05）
- [ ] テーマの契約試験（theme-contract・palette-contract・aidd-kit-boundary）を変えていない
- [ ] 赤を隠すために、既存の試験にも新しい試験にも skip・only・保留扱いの印を足していない
- [ ] e2e は CI と deploy.yml のどちらでも流れない。P05 のマージまで、main で pnpm test:e2e を流すと新しいスペックだけが赤になることを test-design.json に書いている

## 検証方法

- 自動検証: `pnpm exec vitest run --config vitest.red.config.mts`、`pnpm db:migrate:local`、`pnpm db:sample:local`、`pnpm preview`、`pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts`、`pnpm typecheck`、`pnpm test`、`pnpm test:coverage`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feature-improvement-requests-2026-10-test-design.json（赤の試験名・件数・移す先・P04 のコミットの sha）、vitest.red.config.mts での実行の出力（新しい試験が赤）、pnpm test:e2e の出力（新しいスペックが赤）、pnpm typecheck・pnpm test・pnpm test:coverage の出力（exit 0。main の確認が緑のまま）

## リスクとロールバック

- リスク: 実装（P05） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: tests/red/・vitest.red.config.mts・e2e のスペックを1つ前のコミットへ戻す。製品のコードには触れていない

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P05
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: 対象。権限一覧・並べ替え・選択肢・余白を画面の試験で縛る
- Backend: 対象。等級名の変更・所属・点数の読み出し・提出状況を結合試験で縛る
- API: N/A: この phase（test-design）の責務に API の変更は含まれない
- Data: N/A: この phase（test-design）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（test-design）の責務に Infrastructure の変更は含まれない
- Security: 対象。他社の会社への切り替えと、一般の社員への点数の応答を拒否する試験
- Quality: 対象。試験の設計そのもの
- Documentation: N/A: この phase（test-design）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（test-design）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-frontend・arch-system-spec-backend・arch-system-spec-security・arch-system-spec-ui-ux（D-004 opt-membership-cookie（所属の表と cookie）、D-005 opt-pointer-hook（Pointer Events の自作）、D-006 opt-combined（表・役割のタブ・スマホのカード）、D-007 opt-route-ledger-extend（route-ledger.json に足す）、qa-v02（等級名を変えられるのは全体管理者と会社の管理者だけ））
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）
- Compatibility/migration/backfill: N/A: この phase はデータの形を変えない

## Verification and evidence

- コマンド: pnpm exec vitest run --config vitest.red.config.mts
- コマンド: pnpm db:migrate:local
- コマンド: pnpm db:sample:local
- コマンド: pnpm preview
- コマンド: pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts
- コマンド: pnpm typecheck
- コマンド: pnpm test
- コマンド: pnpm test:coverage
- 証跡: eval-log/feature-improvement-requests-2026-10-test-design.json（赤の試験名・件数・移す先・P04 のコミットの sha）
- 証跡: vitest.red.config.mts での実行の出力（新しい試験が赤）
- 証跡: pnpm test:e2e の出力（新しいスペックが赤）
- 証跡: pnpm typecheck・pnpm test・pnpm test:coverage の出力（exit 0。main の確認が緑のまま）

## Rollout and rollback

- Rollout: P04 の PR を単独で main へマージする。マージで deploy.yml が走るが、製品のコードも移行も変わらないので同じ版の再配布になる。マージは外部への変更なので利用者の確認のあとに行う
- Rollback: tests/red/・vitest.red.config.mts・e2e のスペックを1つ前のコミットへ戻す。製品のコードには触れていない

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-04-test-design.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-frontend.md、architecture/system-spec-backend.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

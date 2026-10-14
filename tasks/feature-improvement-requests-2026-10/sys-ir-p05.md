---
graph_node_id: "SYS-IR-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "14件の改善を実装し、移行 0033・0034 を書く"
project_id: "feature-package-feature-improvement-requests-2026-10"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement-requests-2026-10", "implementation"]
file_path: "tasks/feature-improvement-requests-2026-10/sys-ir-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-13T06:16:15Z", "origin_kind": "system-dev-planner", "source_digest": "71e6c72c1e9129dcb81be164d346cf85402d2df4a1e297ee4b662c08c50b8dfe", "source_path": ".dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-13T06:16:15Z"
updated_at: "2026-10-13T06:16:15Z"
depends_on: ["SYS-IR-P04"]
related_nodes: ["feature-improvement-requests-2026-10", "spec-system-spec-requirements", "arch-system-spec-database", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-security", "arch-system-spec-backend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops"]
resource_scope: ["src/lib/", "src/actions/", "src/components/", "src/db/", "src/app/", "system-spec/route-ledger.json", "drizzle/migrations/0033_company_memberships.sql", "drizzle/migrations/0034_grade_display_names.sql", "drizzle/migrations/meta/", "package.json", "pnpm-lock.yaml", "tests/red/", "vitest.red.config.mts", "scripts/route-ledger.test.mjs", "e2e/improvement-requests-2026-10.spec.ts", "eval-log/feature-improvement-requests-2026-10-implementation.json"]
purpose: "P04 の試験を緑にする実装を、範囲の S1〜S14 の全部について行う。等級の呼び名の共通の関数と全表示の置き換え、等級名の変更の役割の判定、route-ledger の permissions を唯一の定義にした判定と権限一覧、一覧の等級と確定点数、所属の表と会社の切り替え、提出状況の一覧、設定不足の表示、画面名の改名、並べ替えの共通部品、選択肢の不具合、右側の余白、ルート台帳の47画面と Next.js 16.3.8 の確認までを、この phase で済ませる。"
goal: "14件の改善を実装し、移行 0033・0034 を書く。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["S1: src/lib/domain/grade-label.ts（等級の呼び名の共通の関数）と既定の等級名（等級1・等級2・等級3・等級4-1・等級4-2・等級5-1・等級5-2）。src/lib/domain/scheme.ts・scheme-steps.ts・behavior.ts・grade-points.ts・src/lib/form-build.ts・src/components/PromotionRequirementEditor.tsx などの表示をこの関数へ置き換える", "S2: drizzle/migrations/0034_grade_display_names.sql（会社の等級名と、行動指針の区分名など等級名を含む表示名の一律の書き換え）", "S3: src/actions/masters.ts（saveMaster の kind=grade、台帳の操作 masters.save）と src/lib/masters/apply-master-update.ts の case \"grade\" で、等級名の変更を全体管理者と自社の会社管理者に限り（他社の等級は 404）、画面では他の役割に編集の操作を出さない", "S4: system-spec/route-ledger.json の各ルートに permissions（ページ名・主な操作・役割ごとの可否・説明）を足し（章ではなく台帳。compile の対象外）、src/lib/nav.ts・src/lib/session.ts・ページの入口の判定・サーバー処理の最低ロールがこれを読む", "S5: src/components/permissions/PermissionMatrix.tsx（表・役割のタブ・スマホのカード・説明の部品）と、システム管理の権限一覧のページ src/app/system/permissions/page.tsx、利用者一覧のトグルで開くモーダル", "S6: マネージャーの部下一覧・会社の管理者の利用者一覧・全体管理者の利用者一覧に今の等級と確定済みの最新評価の点数を出し、他の役割には応答に含めない", "S7: src/db/schema.ts の表 company_memberships と drizzle/migrations/0033_company_memberships.sql、src/components/CompanyScopeSwitcher.tsx を所属のある会社だけの切り替えに広げる", "S8: アンケートの一覧と結果一覧に、対象者全員の提出済み・入力途中・未回答の一覧を足す", "S9: 設定不足の表示（改善要望 #8・#13）を、何が足りない・どう直す・直す画面へのリンクの形にそろえる", "S10: src/lib/domain/agent-keys.ts の AGENT_KEY_PAGE_LABEL・route-ledger.json の label・src/lib/nav.ts（台帳の label を引く）などの画面名を『Claude Code連携（システム開発者専用）』へ改める", "S11: src/components/reorder/ の長押しドラッグとキーボードの共通 hook と部品を、FormBuilder・GradeRequirementEditor・PromotionRequirementEditor など並び順を持つ全ての編集画面へ入れ、並び順を全体で保存して版の不一致は 409 にする", "S12: src/components/FormAnswer.tsx と結果の画面で選択肢を押しても選べない不具合を直し、src/components/FormBuilder.tsx と保存の処理で選択肢の値の重複を拒否する。見本の表示では見本であることと回答できない理由を出す", "S13: 右側の余白が目立つ画面（改善要望 #14）の配置を直す。src/app/globals.css は配置の部品だけを足し、冒頭の brand_color_* の宣言は変えない", "S14: route-ledger.json を権限一覧のページを足した47画面にし、package.json と pnpm-lock.yaml の next が 16.3.8 であることを確かめる（マージ済みの main で既に 16.3.8 なら変更しない）", "P04 の tests/red/ の試験を、期待を変えずに本来の場所（src/ の *.test.ts と scripts/route-ledger.test.mjs）へ移し、tests/red/ と vitest.red.config.mts を消す", "eval-log/feature-improvement-requests-2026-10-implementation.json（移した試験の対応、移行の予行の結果、PR の番号）"]
scope_out: ["役割の種類の追加", "配色・テーマの変更と、テーマの契約試験・T2-experience-spec.md §5・globals.css 冒頭の brand_color_* の書き換え", "即時配信（WebSocket 等の push）とオフライン編集", "P04 の試験の期待を書き換えること（実装を試験に合わせる）", "本番の D1 への直接の書き込み（wrangler d1 execute --remote などを使わない。移行は deploy.yml だけが当てる）"]
acceptance: ["A1: 等級名を変える結合テストで全表示が新しい名前になり、英語の区分名の静的検査が0件である（O6）", "A2: 等級名の変更は、全体管理者と会社の管理者以外では画面とサーバーの両方が拒否する（O7）", "A3: ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストが通る（O8）", "A5: 評価確定の直後に3つの一覧へ最新の点数が出て、一般の社員の応答には等級と点数が含まれない", "A6: 2社目への所属ができ、所属していない会社への切り替えと操作は拒否される", "A7: 提出状況の一覧に対象者全員が提出済み・未提出つきで出る", "A8: 設定不足の全件に、何が足りないか・どう直すかと直す画面へのリンクがある", "A9: 画面名が『Claude Code連携（システム開発者専用）』になっている", "A10: 並べ替えはポインター・タッチ・キーボードの3操作で同じ結果になり、全体保存の競合は 409 を返す", "A11: 選択肢を押すと選べ、選択肢の値の重複は拒否される", "S14: route-ledger.json が47画面で、next が 16.3.8", "P04 の赤の試験を、期待を変えずに本来の場所へ移して緑にし、tests/red/ と vitest.red.config.mts が残っていない（移す前後の試験の本文の差分は import のパスだけ）", "main へ入れたときに pnpm typecheck・pnpm test・pnpm test:coverage・pnpm run check:docs・pnpm cf:dry-run が緑", "P04 の e2e/improvement-requests-2026-10.spec.ts が pnpm preview の上で緑。スペックを直したのは画面の要素の探し方（selector）と待ち方だけで、確かめる中身（A4・A9・A12 の期待）は変えていない。直した行と理由を implementation.json に書いている", "マージの前に、ローカルの D1 で移行を予行している。見本のデータに 0033・0034 を当て、同じ SQL を wrangler d1 execute --local --file でもう一度流して変わる行が0件、ローカルの書き出しから戻すと元の件数と値に戻る", "マージの確認を求めるときに、利用者へ次の3つを示している。(1) このマージで移行と Worker が本番へ出ること、(2) 画面の通しの確認（P07）と攻撃側からの確認（P09）はマージの後に行うこと、(3) 他社のデータ・等級・点数の漏れを縛る結合試験 src/actions/memberships.integration.test.ts・src/lib/score-visibility.test.ts・src/actions/grade-names.integration.test.ts と src/lib/permissions-contract.test.ts が緑である pnpm test の出力"]
architecture_refs: ["arch-system-spec-database", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-security", "arch-system-spec-backend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops"]
parent_feature: "feature-improvement-requests-2026-10"
feature_package_id: "feature-package/feature-improvement-requests-2026-10"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P05（implementation）として、feature feature-improvement-requests-2026-10 の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-improvement-requests-2026-10/sys-ir-p05.md", "confidence": 0.95}]
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

# 14件の改善を実装し、移行 0033・0034 を書く

## 目的

P04 の試験を緑にする実装を、範囲の S1〜S14 の全部について行う。等級の呼び名の共通の関数と全表示の置き換え、等級名の変更の役割の判定、route-ledger の permissions を唯一の定義にした判定と権限一覧、一覧の等級と確定点数、所属の表と会社の切り替え、提出状況の一覧、設定不足の表示、画面名の改名、並べ替えの共通部品、選択肢の不具合、右側の余白、ルート台帳の47画面と Next.js 16.3.8 の確認までを、この phase で済ませる。

## 背景

どの項目も保留にしない指示なので、14件を1つの実装の束で揃える。等級の呼び名・権限・所属は複数の画面とサーバー処理にまたがり、別々に直すとまた食い違う。共通の関数・唯一の台帳・共通の部品に寄せてから各画面を置き換える。

根拠のノードは feature-improvement-requests-2026-10（features/improvement-requests-2026-10.md）、spec-system-spec-requirements（specs/system-spec-requirements.md）、arch-system-spec-database（architecture/system-spec-database.md）、arch-system-spec-auth（architecture/system-spec-auth.md）、arch-system-spec-ui-ux（architecture/system-spec-ui-ux.md）、arch-system-spec-frontend（architecture/system-spec-frontend.md）、arch-system-spec-security（architecture/system-spec-security.md）、arch-system-spec-backend（architecture/system-spec-backend.md）、arch-system-spec-infrastructure（architecture/system-spec-infrastructure.md）、arch-system-spec-maintenance-ops（architecture/system-spec-maintenance-ops.md）。

## 入力と前提条件

- 入力: architecture/improvement-requests-2026-10.md、tests/red/、vitest.red.config.mts、e2e/improvement-requests-2026-10.spec.ts、eval-log/feature-improvement-requests-2026-10-test-design.json
- 前提: 依存タスク（SYS-IR-P04）が done で、feature feature-improvement-requests-2026-10 が confirmed・evaluation pass・readiness complete であること
- 登録の時点（2026-10-13）の feature は confirmation draft・evaluation pending。確定するまで着手しない

## 出力と成果物

- 生成物: S1: src/lib/domain/grade-label.ts（等級の呼び名の共通の関数）と既定の等級名（等級1・等級2・等級3・等級4-1・等級4-2・等級5-1・等級5-2）。src/lib/domain/scheme.ts・scheme-steps.ts・behavior.ts・grade-points.ts・src/lib/form-build.ts・src/components/PromotionRequirementEditor.tsx などの表示をこの関数へ置き換える
- 生成物: S2: drizzle/migrations/0034_grade_display_names.sql（会社の等級名と、行動指針の区分名など等級名を含む表示名の一律の書き換え）
- 生成物: S3: src/actions/masters.ts（saveMaster の kind=grade、台帳の操作 masters.save）と src/lib/masters/apply-master-update.ts の case "grade" で、等級名の変更を全体管理者と自社の会社管理者に限り（他社の等級は 404）、画面では他の役割に編集の操作を出さない
- 生成物: S4: system-spec/route-ledger.json の各ルートに permissions（ページ名・主な操作・役割ごとの可否・説明）を足し（章ではなく台帳。compile の対象外）、src/lib/nav.ts・src/lib/session.ts・ページの入口の判定・サーバー処理の最低ロールがこれを読む
- 生成物: S5: src/components/permissions/PermissionMatrix.tsx（表・役割のタブ・スマホのカード・説明の部品）と、システム管理の権限一覧のページ src/app/system/permissions/page.tsx、利用者一覧のトグルで開くモーダル
- 生成物: S6: マネージャーの部下一覧・会社の管理者の利用者一覧・全体管理者の利用者一覧に今の等級と確定済みの最新評価の点数を出し、他の役割には応答に含めない
- 生成物: S7: src/db/schema.ts の表 company_memberships と drizzle/migrations/0033_company_memberships.sql、src/components/CompanyScopeSwitcher.tsx を所属のある会社だけの切り替えに広げる
- 生成物: S8: アンケートの一覧と結果一覧に、対象者全員の提出済み・入力途中・未回答の一覧を足す
- 生成物: S9: 設定不足の表示（改善要望 #8・#13）を、何が足りない・どう直す・直す画面へのリンクの形にそろえる
- 生成物: S10: src/lib/domain/agent-keys.ts の AGENT_KEY_PAGE_LABEL・route-ledger.json の label・src/lib/nav.ts（台帳の label を引く）などの画面名を『Claude Code連携（システム開発者専用）』へ改める
- 生成物: S11: src/components/reorder/ の長押しドラッグとキーボードの共通 hook と部品を、FormBuilder・GradeRequirementEditor・PromotionRequirementEditor など並び順を持つ全ての編集画面へ入れ、並び順を全体で保存して版の不一致は 409 にする
- 生成物: S12: src/components/FormAnswer.tsx と結果の画面で選択肢を押しても選べない不具合を直し、src/components/FormBuilder.tsx と保存の処理で選択肢の値の重複を拒否する。見本の表示では見本であることと回答できない理由を出す
- 生成物: S13: 右側の余白が目立つ画面（改善要望 #14）の配置を直す。src/app/globals.css は配置の部品だけを足し、冒頭の brand_color_* の宣言は変えない
- 生成物: S14: route-ledger.json を権限一覧のページを足した47画面にし、package.json と pnpm-lock.yaml の next が 16.3.8 であることを確かめる（マージ済みの main で既に 16.3.8 なら変更しない）
- 生成物: P04 の tests/red/ の試験を、期待を変えずに本来の場所（src/ の *.test.ts と scripts/route-ledger.test.mjs）へ移し、tests/red/ と vitest.red.config.mts を消す
- 生成物: eval-log/feature-improvement-requests-2026-10-implementation.json（移した試験の対応、移行の予行の結果、PR の番号）
- 更新対象: src/lib/、src/actions/、src/components/、src/db/、src/app/、system-spec/route-ledger.json、drizzle/migrations/0033_company_memberships.sql、drizzle/migrations/0034_grade_display_names.sql、drizzle/migrations/meta/、package.json、pnpm-lock.yaml、tests/red/、vitest.red.config.mts、scripts/route-ledger.test.mjs、e2e/improvement-requests-2026-10.spec.ts、eval-log/feature-improvement-requests-2026-10-implementation.json

## 依存関係

- `depends_on`: ["SYS-IR-P04"]
- ブロッカー: 依存タスクが main へマージされて done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: 対象。権限一覧のページとモーダル、並べ替えの部品、選択肢、余白、設定不足の表示、改名
- Backend/API: 対象。等級の呼び名、等級名の変更の判定、点数の読み出し、所属、提出状況 ／ 対象。サーバー処理の応答から、見てはいけない役割には等級と点数を除く
- Database/Data: 対象。表 company_memberships と移行 0033・0034
- Infrastructure: N/A: この phase（implementation）は Infrastructure を変えない
- Security/Privacy: 対象。cookie hr_company の会社が本人の所属であることをサーバーで確かめる
- Quality: N/A: この phase（implementation）は Quality を変えない
- Documentation: N/A: この phase（implementation）は Documentation を変えない
- Operations: N/A: この phase（implementation）は Operations を変えない

## Write scope と競合制約

- `touches`: `src/lib/`、`src/actions/`、`src/components/`、`src/db/`、`src/app/`、`system-spec/route-ledger.json`、`drizzle/migrations/0033_company_memberships.sql`、`drizzle/migrations/0034_grade_display_names.sql`、`drizzle/migrations/meta/`、`package.json`、`pnpm-lock.yaml`、`tests/red/`、`vitest.red.config.mts`、`scripts/route-ledger.test.mjs`、`e2e/improvement-requests-2026-10.spec.ts`、`eval-log/feature-improvement-requests-2026-10-implementation.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-IR-P05）
- 並列実行条件: depends_on がすべて done で、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-IR-P05 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-IR-P05` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-IR-P04）が done で、feature feature-improvement-requests-2026-10 が確定していることを確かめ、/dev-graph worktree claim SYS-IR-P05 で lease を取る
2. 出力と成果物の欄にあるファイルを、write scope の中だけで作る・直す
3. 検証のコマンドを実行する: pnpm db:migrate:local
4. 検証のコマンドを実行する: pnpm db:sample:local
5. 検証のコマンドを実行する: pnpm typecheck
6. 検証のコマンドを実行する: pnpm test
7. 検証のコマンドを実行する: pnpm test:coverage
8. 検証のコマンドを実行する: pnpm run check:docs
9. 検証のコマンドを実行する: pnpm cf:dry-run
10. 検証のコマンドを実行する: pnpm preview
11. 検証のコマンドを実行する: pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts
12. 証跡の欄の記録を残し、受入条件の各項目に判定と根拠を付ける
13. PR の本文に dev-graph: SYS-IR-P05 を書いて main へ向ける。PR の作成とマージは本番への配布につながるので、利用者の確認のあとに行う
14. /dev-graph worktree release SYS-IR-P05 で lease を返す。done はマージのあとの reconciliation で書く

## 受入条件

- [ ] A1: 等級名を変える結合テストで全表示が新しい名前になり、英語の区分名の静的検査が0件である（O6）
- [ ] A2: 等級名の変更は、全体管理者と会社の管理者以外では画面とサーバーの両方が拒否する（O7）
- [ ] A3: ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストが通る（O8）
- [ ] A5: 評価確定の直後に3つの一覧へ最新の点数が出て、一般の社員の応答には等級と点数が含まれない
- [ ] A6: 2社目への所属ができ、所属していない会社への切り替えと操作は拒否される
- [ ] A7: 提出状況の一覧に対象者全員が提出済み・未提出つきで出る
- [ ] A8: 設定不足の全件に、何が足りないか・どう直すかと直す画面へのリンクがある
- [ ] A9: 画面名が『Claude Code連携（システム開発者専用）』になっている
- [ ] A10: 並べ替えはポインター・タッチ・キーボードの3操作で同じ結果になり、全体保存の競合は 409 を返す
- [ ] A11: 選択肢を押すと選べ、選択肢の値の重複は拒否される
- [ ] S14: route-ledger.json が47画面で、next が 16.3.8
- [ ] P04 の赤の試験を、期待を変えずに本来の場所へ移して緑にし、tests/red/ と vitest.red.config.mts が残っていない（移す前後の試験の本文の差分は import のパスだけ）
- [ ] main へ入れたときに pnpm typecheck・pnpm test・pnpm test:coverage・pnpm run check:docs・pnpm cf:dry-run が緑
- [ ] P04 の e2e/improvement-requests-2026-10.spec.ts が pnpm preview の上で緑。スペックを直したのは画面の要素の探し方（selector）と待ち方だけで、確かめる中身（A4・A9・A12 の期待）は変えていない。直した行と理由を implementation.json に書いている
- [ ] マージの前に、ローカルの D1 で移行を予行している。見本のデータに 0033・0034 を当て、同じ SQL を wrangler d1 execute --local --file でもう一度流して変わる行が0件、ローカルの書き出しから戻すと元の件数と値に戻る
- [ ] マージの確認を求めるときに、利用者へ次の3つを示している。(1) このマージで移行と Worker が本番へ出ること、(2) 画面の通しの確認（P07）と攻撃側からの確認（P09）はマージの後に行うこと、(3) 他社のデータ・等級・点数の漏れを縛る結合試験 src/actions/memberships.integration.test.ts・src/lib/score-visibility.test.ts・src/actions/grade-names.integration.test.ts と src/lib/permissions-contract.test.ts が緑である pnpm test の出力

## 検証方法

- 自動検証: `pnpm db:migrate:local`、`pnpm db:sample:local`、`pnpm typecheck`、`pnpm test`、`pnpm test:coverage`、`pnpm run check:docs`、`pnpm cf:dry-run`、`pnpm preview`、`pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts`
- 手動検証: 受入条件の各項目について、証跡を開いて判定と根拠が書かれていることを確かめる
- 証跡: pnpm test の出力（移した試験が緑）、pnpm test:e2e の出力（新しいスペックが緑）、eval-log/feature-improvement-requests-2026-10-implementation.json、src/lib/permissions-contract.test.ts、src/lib/grade-label-static.test.ts、src/actions/memberships.integration.test.ts、cf:dry-run の出力（exit 0）

## リスクとロールバック

- リスク: 役割の種類の追加 を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- リスク: main へのマージは deploy.yml を起こし、本番の移行と Worker の差し替えまで進む。マージは利用者の確認のあとに限る
- ロールバック: Worker は wrangler deployments list で1つ前の版を確かめて wrangler rollback で戻す。0033 は表の追加なので前の版と並べても壊れない。0034 の書き換えは、deploy.yml が保管した書き出しから会社の等級名と表示名の列だけを戻す。戻すのは本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として行う。戻す前に、書き出しの値・移行が書いた値・今の値を会社ごとに突き合わせ、今の値が移行の書いた値のままの行だけを戻す。マージのあとに会社が編集した等級名や表示名は上書きせず、一覧にして利用者に示す。deploy.yml は失敗しても自動では戻さないので、人が判断する。P07・P09 で他社への漏れなど重い指摘が出たときも、まず Worker をこの手順で P05 の前の版へ戻す

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-IR-P06、SYS-IR-P08
- 現状: 未着手。PR を出して main へマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: 対象。権限一覧のページとモーダル、並べ替えの部品、選択肢、余白、設定不足の表示、改名
- Backend: 対象。等級の呼び名、等級名の変更の判定、点数の読み出し、所属、提出状況
- API: 対象。サーバー処理の応答から、見てはいけない役割には等級と点数を除く
- Data: 対象。表 company_memberships と移行 0033・0034
- Infrastructure: N/A: この phase（implementation）の責務に Infrastructure の変更は含まれない
- Security: 対象。cookie hr_company の会社が本人の所属であることをサーバーで確かめる
- Quality: N/A: この phase（implementation）の責務に Quality の変更は含まれない
- Documentation: N/A: この phase（implementation）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（implementation）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-system-spec-database・arch-system-spec-auth・arch-system-spec-ui-ux・arch-system-spec-frontend・arch-system-spec-security・arch-system-spec-backend・arch-system-spec-infrastructure・arch-system-spec-maintenance-ops（D-004 opt-membership-cookie（所属の表と cookie）、D-005 opt-pointer-hook（Pointer Events の自作）、D-006 opt-combined（表・役割のタブ・スマホのカード）、D-007 opt-route-ledger-extend（route-ledger.json に足す）、qa-v02（等級名を変えられるのは全体管理者と会社の管理者だけ））
- Deploy unit/environment: worker:hr-evaluation-system（OpenNext で Cloudflare Workers に載せる1つの Worker と D1）
- Compatibility/migration/backfill: 移行 0033（表 company_memberships の追加と、既存の利用者の今の会社・役割・等級・上司どおりの所属の作成）と 0034（会社の等級名を等級N・等級N-M の形へ、英語の区分名を含む表示名を等級名へ一律に書き換える）。users.company_id は既定で選ぶ会社として残し、前の版のコードと並べても壊れない形にする

## Verification and evidence

- コマンド: pnpm db:migrate:local
- コマンド: pnpm db:sample:local
- コマンド: pnpm typecheck
- コマンド: pnpm test
- コマンド: pnpm test:coverage
- コマンド: pnpm run check:docs
- コマンド: pnpm cf:dry-run
- コマンド: pnpm preview
- コマンド: pnpm test:e2e e2e/improvement-requests-2026-10.spec.ts
- 証跡: pnpm test の出力（移した試験が緑）
- 証跡: pnpm test:e2e の出力（新しいスペックが緑）
- 証跡: eval-log/feature-improvement-requests-2026-10-implementation.json
- 証跡: src/lib/permissions-contract.test.ts
- 証跡: src/lib/grade-label-static.test.ts
- 証跡: src/actions/memberships.integration.test.ts
- 証跡: cf:dry-run の出力（exit 0）

## Rollout and rollback

- Rollout: P05 の PR を main へマージすると、deploy.yml が未適用の移行を見つけ、本番の D1 の書き出し（d1-backup- に実行番号を付けた artifact。14日保管）→ 移行 0033・0034 → 移行の再確認 → Worker の差し替え → スモーク2回、を自動で行う。0033・0034 が Worker の差し替えより先に当たる。マージは本番の移行と配布になる外部への変更なので、PR の作成とマージはどちらも利用者の確認のあとに行う。deploy.yml は main への push で無条件に配るので、P07 の画面の通しと P09 の攻撃側からの確認はマージの後になる。そのためマージの確認では、P07・P09 が後続であることと、A2・A5・A6 を縛る結合試験（memberships.integration・score-visibility・grade-names.integration・permissions-contract）が緑である出力を必ず示し、示せないときはマージしない。PR を作ったら、改善要望 #8・#13・#14 を pnpm improvements review でレビュー待ちにする（本番のアプリへの書き込みなので利用者の確認のあと）
- Rollback: Worker は wrangler deployments list で1つ前の版を確かめて wrangler rollback で戻す。0033 は表の追加なので前の版と並べても壊れない。0034 の書き換えは、deploy.yml が保管した書き出しから会社の等級名と表示名の列だけを戻す。戻すのは本番の DB への書き込みなので、利用者の確認のあとに復旧の手順として行う。戻す前に、書き出しの値・移行が書いた値・今の値を会社ごとに突き合わせ、今の値が移行の書いた値のままの行だけを戻す。マージのあとに会社が編集した等級名や表示名は上書きせず、一覧にして利用者に示す。deploy.yml は失敗しても自動では戻さないので、人が判断する。P07・P09 で他社への漏れなど重い指摘が出たときも、まず Worker をこの手順で P05 の前の版へ戻す

## Tracker publication and completion intent

- Tracker binding: beads（このリポジトリの .dev-graph/config.json の tracker.mode）
- Beads: 親の epic は feature-improvement-requests-2026-10 に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行い、feature が確定するまで投影しない
- Completion intent: linked_pr_merged_all。結び付いた PR がすべて main へマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feature-improvement-requests-2026-10/task-specs/phase-05-implementation.md
- Feature: features/improvement-requests-2026-10.md（入力の context は features/feature-improvement-requests-2026-10.context.json）
- Architecture: architecture/system-spec-database.md、architecture/system-spec-auth.md、architecture/system-spec-ui-ux.md、architecture/system-spec-frontend.md、architecture/system-spec-security.md、architecture/system-spec-backend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md
- Specification: specs/system-spec-requirements.md、system-spec/00-requirements-definition.md

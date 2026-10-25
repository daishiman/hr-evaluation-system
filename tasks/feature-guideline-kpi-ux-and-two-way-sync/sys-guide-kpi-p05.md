---
graph_node_id: "SYS-GUIDE-KPI-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "実装（行動指針の既定・2 つの画面の組み替え・双方向の追従・見本の受付中の期・部品クラス）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p05", "implementation", "mutation"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P04"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/app/admin/behavior/", "src/app/admin/scheme/", "src/app/admin/masters/", "src/app/admin/forms/", "src/app/admin/setup/page.tsx", "src/app/admin/AdminDashboard.tsx", "src/app/admin/cycles/page.tsx", "src/app/manager/cycles/", "src/app/globals.css", "src/actions/scheme.ts", "src/actions/masters.ts", "src/actions/forms.ts", "src/actions/evaluations.ts", "src/lib/domain/", "src/lib/masters/", "src/lib/form-build.ts", "src/lib/template.ts", "src/lib/freshness.ts", "src/lib/nav.ts", "src/lib/route-access.ts", "src/lib/permission-rows.ts", "src/lib/use-refresh.ts", "src/lib/stale-asking-loader.ts", "src/components/", "src/db/schema.ts", "src/test-support/", "drizzle/migrations/0040_behavior_band_defaults.sql", "drizzle/rollback/0040_behavior_band_defaults_rollback.sql", "src/lib/form-align.ts", "src/actions/form-align.ts", "scripts/sample-data.mjs", "scripts/seed-data.mjs", "scripts/seed-sample.mjs", "scripts/seed.mjs", "drizzle/seed.sql", "system-spec/route-ledger.json", "system-spec/routes-and-access.md", "docs/product/settings-copy-ledger.md", "docs/deploy-notes.md", "docs/product/design-decisions.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p05.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.5", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 実装（行動指針の既定・2 つの画面の組み替え・双方向の追従・見本の受付中の期・部品クラス）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P05
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p05, implementation, mutation
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P05
- lifecycle_role: mutation
- workstream_kind: backend（secondary: frontend, data, security, documentation）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P04
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- P04 のテストを緑にする実装を入れる。
- 行動指針: 既定の割り当てを等級の内部の識別子で持ち、新しい会社が既定で始まるようにし、初期設定の説明をいまの割り当てから作る。drizzle/migrations/0040_behavior_band_defaults.sql と drizzle/rollback/0040_behavior_band_defaults_rollback.sql を書く。
- 画面: 行動指針の画面の冒頭を 1 文とまとまりの状態だけにし、編集部品の同じ説明の繰り返しを 1 か所にまとめる。KPI・評価セットは入口を等級区分ごとのカードにし、4 つの作業を別の画面に分け、KPI 項目は聞くことを 1 行ずつ並べ、計算式と実績区分・単位・向きは開いたときに出す。
- 追従: 下書きのアンケートで設定とつながった設問を足す・外す・文を直すと同じ保存で設定へ反映し、合わない保存は合わない決まりと直す画面を示して断る。設定の保存で回答 0 件の下書きを作り直し、回答のある公開中のアンケートに次の版の下書きを 1 つ作り、確定前の評価を集計し直し、保存の結果の文で示す。0040 で書き換えた会社のアンケートと、いまずれている下書きを、下書きごとに更新時刻の新しい方へそろえる操作を Worker の中に作る（P02 の DD のとおり）: 判定 src/lib/domain/form-align.ts、DB の層 src/lib/form-align.ts（dryRun は書かずに件数と一覧を返す）、サーバー処理 src/actions/form-align.ts、画面は KPI・評価セットの入口の「設定とずれた下書きのアンケート」の操作（内容を見る → 確認 → そろえる → 結果の文）。I28・I29 の保存と同じ関数を呼び、規則を二重に書かない。Node の台本と package.json の script は足さない。
- 見本と部品: scripts/sample-data.mjs と手元の seed に受付中の期を足し（seed の元を変えたら node scripts/seed.mjs --generate-only で drizzle/seed.sql を書き出し直してコミットする。DD-020 の 4）、globals.css に既存の意味のトークンと color-mix だけで部品クラスを足して、ボタン・カード・見出し・選ぶ部品・状態の印・進み具合・数の面・知らせ・表・いまいる場所の印から使う。
- 経路: 4 つの作業の画面と旧い URL の転送を system-spec/route-ledger.json と system-spec/routes-and-access.md に足す（page.tsx と台帳が一致しないと check:docs が落ちる）。
- 0040 の確かめ: P05 の PR のマージで Deploy workflow が 0040 を本番の全社に当てるので、マージの前に手元の D1 で、リポジトリの外に置いた一時的な SQL（等級 1 だけが 2 つ目のまとまりへ移った会社・呼び名を変えた会社・既定のまとまりが無い会社の試験データ）を入れて書き換えと件数を確かめ、2 回当てて 2 回目の変更が 0 件であること、drizzle/rollback/0040_behavior_band_defaults_rollback.sql で戻してからもう一度当てて同じ結果になることを確かめる。戻し方と利用者の承認を docs/deploy-notes.md の 0040 の節に書き、マージの前にそろえる（DD-020 の 9 と同じ形）。
- 分担: 0040 の作成・手元での確かめ・戻し方の文書と、ずれた下書きをそろえる操作の実装は P05、手元の preview でのそろえる操作の本流しと使わなくなったコードの片付けは P08、本番の結果の読み取りと本番でのそろえる操作は P13 が受け持つ。

## 背景

- 公開は main へのマージで、Deploy workflow（.github/workflows/deploy.yml）は main への push で動く。未適用の migration があると、本番 D1 の全体を書き出して Artifact（d1-backup に実行 id を付けた名前。保管 14 日）に残し、migration を当て、確認してから Worker を配る（DD-020 の 1・2）。P05 の PR のマージで 0040 が本番の全社の行動指針の割り当てを書き換える。適用済みの migration は d1_migrations に記録され、ファイルを後から直しても当て直されない。
- system-spec/routes-and-access.md と system-spec/route-ledger.json は compile が作る章でなく（frontmatter が無い）、#93・#95・#96・#98 も実装のコミットで直している。scripts/check-docs-drift.mjs は 2 つを必須とし、台帳と page.tsx の一致・4 幅・4 ロールの期待結果を検査する。
- 関係するコードは src/app/admin/behavior・src/app/admin/scheme・src/app/admin/masters・src/app/admin/forms・src/app/manager/cycles と、src/actions の scheme.ts・masters.ts・forms.ts・evaluations.ts、src/lib/domain の behavior.ts・behavior-band-range.ts・form-sync.ts・form-question-links.ts、src/lib の form-build.ts・freshness.ts にまたがる。
- 共通部品は src/components の ui.tsx・ActionButton.tsx・ConfirmButton.tsx・DataTable.tsx・AppSidebar.tsx・HeaderNav.tsx・Charts.tsx・DecisionBadge.tsx などで、色は globals.css の意味のトークンから来る。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P04
- Entry gate: P04 のテストが P05 のブランチの最初のコミットにそろい、正しい理由で赤である。着手の前に、system-spec/routes-and-access.md と system-spec/route-ledger.json が確定章の writer の管轄でないこと（frontmatter が無く、spec-state.json の章に無いこと）を確かめる。管轄なら writer の corrections で直し、P05 では書かない。マージの前に、docs/product/backlog.md の SECURITY-014（書き出しの Artifact の置き場所）を利用者が決めている。決まっていなければ P05 の PR をマージしない
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: 0040 は P05 の PR のマージで、本番の全社の行動指針の割り当てを書き換える。マージの前に手元で書き換え・2 回目の 0 件・戻しを確かめ、その結果を見せて利用者の承認を取る。追従の実装は forms.ts と scheme.ts と masters.ts の保存の全てに触れ、差分が大きくなる。コミットを行動指針・画面・追従・見本・部品の 5 つに分ける。write_scope の外のファイルを直す必要が出たら、P02 の DD に理由を足してから広げる

## Workstream applicability

- Frontend: 適用: 2 つの画面の段階的な開示、KPI・評価セットの入口と 4 つの作業の画面、KPI 項目のカードとブロック、全ての共通部品の部品クラスと状態の見分けを入れる。入口に KPI・評価セットの入口の「設定とずれた下書きのアンケート」の操作（内容を見る → 確認 → そろえる → 結果の文）を入れる
- Backend: 適用: 双方向の追従（反映・断る保存・下書きの作り直し・次の版の下書き・確定前の評価の集計し直し・保存の結果の文）と、ずれた下書きをそろえる操作（src/lib/domain/form-align.ts・src/lib/form-align.ts・src/actions/form-align.ts）を入れる
- API: N/A: この段では API の成果物を作らない
- Data: 適用: drizzle/migrations/0040_behavior_band_defaults.sql で行動指針の既定の割り当てへ書き換え（観点の文と会社が足した観点は残し、既定のまとまりが無い会社は書き換えずに件数を報告する。移行の後に会社が変えた割り当ては正として残す）、書き換える行の updated_at を移行の時刻にし、手元のずれた会社の試験データで確かめる。見本と手元の seed に受付中の期を足し、node scripts/seed.mjs --generate-only で drizzle/seed.sql を書き出し直す
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: アンケートからの反映とそろえる操作を、設定の保存と同じ権限・会社の絞り込み・409・制度の変更の記録に通す。見本の台本は見本の会社の行だけに触れる。試験データと書き出しはリポジトリに入れない（Public）
- Quality: 適用: P04 のテストを緑にし、テーマの契約テストを書き換えない。PR を出す前に、移行のテストと src/lib/form-align.integration.test.ts と手元の 0040 の確かめをそろえる
- Documentation: 適用: docs/product/settings-copy-ledger.md を実装に合わせ、新しい画面の経路と旧い URL の転送を system-spec/route-ledger.json と system-spec/routes-and-access.md に足す。docs/deploy-notes.md に 0040 の節（中身・本番での戻し方・戻す前に利用者の承認を取ること・Artifact の保管 14 日）を書く
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: P02 の DD のとおり。確定した評価・評価レポート・締め切ったアンケートには書かない。色は既存の意味のトークンと color-mix だけで作り、globals.css 冒頭の brand_color_* の宣言は変えない
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system と D1 hr-evaluation-db（本番）。P05 の PR のマージで、Deploy workflow が書き出し → 0040 → 確認 → 配布を行う。手では deploy・db:backup・db:migrate:remote をしない（DD-020 の 7）
- Compatibility/migration/backfill: 0040 は行動指針の割り当ての行を書き換えるだけで、列と表を消さない。workflow が migration を Worker より先に当てても、差し替わるまでの古いコードは書き換えた後の割り当てで動く（固定の説明文がいまの割り当てと合わないだけ。DD-020 の 3 の考え方）。新しいコードは 0040 の前と後のどちらの割り当てでも動く（説明はいまの割り当てから作るため）。旧い KPI・評価セットの URL は新しい画面へ転送する

## 成果物

- Produced artifacts: 2 つの画面と 4 つの作業の画面、双方向の追従、drizzle/migrations/0040_behavior_band_defaults.sql、drizzle/rollback/0040_behavior_band_defaults_rollback.sql、ずれた下書きをそろえる操作（src/lib/domain/form-align.ts・src/lib/form-align.ts・src/actions/form-align.ts と入口の知らせ）、見本の受付中の期と書き出し直した drizzle/seed.sql、部品クラス、docs/deploy-notes.md の 0040 の節
- Consumed artifacts: P04 のテスト、docs/product/design-decisions.md、docs/product/settings-copy-ledger.md
- Write scope/touches: src/app/admin/behavior/, src/app/admin/scheme/, src/app/admin/masters/, src/app/admin/forms/, src/app/admin/setup/page.tsx, src/app/admin/AdminDashboard.tsx, src/app/admin/cycles/page.tsx, src/app/manager/cycles/, src/app/globals.css, src/actions/scheme.ts, src/actions/masters.ts, src/actions/forms.ts, src/actions/evaluations.ts, src/lib/domain/, src/lib/masters/, src/lib/form-build.ts, src/lib/template.ts, src/lib/freshness.ts, src/lib/nav.ts, src/lib/route-access.ts, src/lib/permission-rows.ts, src/lib/use-refresh.ts, src/lib/stale-asking-loader.ts, src/components/, src/db/schema.ts, src/test-support/, drizzle/migrations/0040_behavior_band_defaults.sql, drizzle/rollback/0040_behavior_band_defaults_rollback.sql, src/lib/form-align.ts, src/actions/form-align.ts, scripts/sample-data.mjs, scripts/seed-data.mjs, scripts/seed-sample.mjs, scripts/seed.mjs, drizzle/seed.sql, system-spec/route-ledger.json, system-spec/routes-and-access.md, docs/product/settings-copy-ledger.md, docs/deploy-notes.md, docs/product/design-decisions.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の P04 は、P04 のテストのコミットがそろったこと（P04 のブランチの sha）を指し、P04 の close を待たない（P04 の PR は無い）。dev-graph の next・bd の ready・claim の parity の検査が、P04 が closed でないことを理由に P05 を止めたら、--force をせず利用者の判断を仰ぐ。P05 の PR のマージの後に P04 → P05 → P06 の順に close する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P05 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P05 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 平賀配色への移行・新しい色のトークン・テーマの契約テストと brand_color_* の宣言の書き換え
- 範囲の外を取り込まない: 確定した評価と評価レポートの集計し直し
- 範囲の外を取り込まない: 公開中・締め切ったアンケートの設問のその場での差し替え
- 範囲の外を取り込まない: 別の利用者が開いている画面への即時配信
- 範囲の外を取り込まない: 本番 DB への見本の投入と、本番でのそろえる操作（P13 の担当）
- 範囲の外を取り込まない: Node の台本や package.json の script でずれた下書きをそろえること（src/lib/domain の .ts は Node から直接 import できない）
- 範囲の外を取り込まない: 手での deploy・db:backup・db:migrate:remote（0040 は Deploy workflow が当てる。DD-020 の 7）
- 範囲の外を取り込まない: write_scope の外の画面の組み替え（ほかの画面には src/components の共通部品の見た目と手応えだけが効く）

## Verification and evidence

- Acceptance: P04 の vitest のテストが全て緑である（E2E の 4 本は P06 で流す） ／ テーマの契約テストが書き換えなしで緑である ／ pnpm run check:docs と scripts/route-ledger.test.mjs が緑で、4 つの作業の画面が system-spec/route-ledger.json と system-spec/routes-and-access.md にある ／ pnpm run test:coverage で src/lib/domain の網羅率が 100% のままである ／ PR を出す前に、src/db/behavior-band-default-migration.test.ts と src/lib/form-align.integration.test.ts が緑で、手元のずれた会社の試験データでの 0040・2 回目・drizzle/rollback/0040_behavior_band_defaults_rollback.sql での戻し・当て直しの読み取りの結果が PR の本文にある ／ src/lib/form-align.ts は I28・I29 の保存と同じ関数を呼んで規則を二重に書かず、src/lib/form-align.integration.test.ts で dry-run が書き込まずに件数と一覧を返し、本流しの後の 2 回目の dry-run が 0 件である ／ KPI・評価セットの入口に、設定とずれた下書きがあるときだけ件数の知らせが出て、内容を見る → 確認 → そろえる → 結果の文、の順に進む（会社の管理者より下の権限では出ない。e2e/guideline-kpi-screens.spec.ts を P06 で流して確かめる） ／ 0040 で書き換えた行の updated_at が移行の時刻で、手元の D1 で 0040 の後にそろえる操作の dry-run を見ると、設定の側が新しいと判定される ／ drizzle/seed.sql を node scripts/seed.mjs --generate-only で書き出し直してコミットしてあり、もう一度書き出しても git diff --exit-code drizzle/seed.sql が 0 で終わる ／ 手元の D1 で、ずれた会社が識別子で既定へ戻り、既定の会社と観点の中身は変わらず、既定のまとまりが無い会社は書き換えられずに読み取りで件数が数えられる ／ 0040 を 2 回当てても 2 回目の変更が 0 件で、drizzle/rollback/0040_behavior_band_defaults_rollback.sql で書き換えの前の割り当てに戻り、もう一度当てると同じ結果になる ／ 0040 が書き換える前の値を behavior_band_default_rewrites に残し、移行の後に会社が変えた行は drizzle/rollback/0040_behavior_band_defaults_rollback.sql で上書きされない（手元の D1 で、0040 の後に 1 社の割り当てを変えてから戻しを当てて確かめる） ／ 移行の後に会社が割り当てを変えると、その変更が正として残る（移行のテストと、設定の保存の後の読み取りで既定へ戻されない） ／ docs/deploy-notes.md に 0040 の節（中身・戻し方・戻す前の利用者の承認・Artifact の保管 14 日）がある ／ ずれた会社の試験データの SQL がリポジトリに含まれていない ／ pnpm db:seed:local を 2 回流しても、表ごとの行の数が同じである ／ pnpm db:sample:local を 2 回流しても見本の会社の行の数が同じで、見本の会社以外の行の数が流す前と同じである
- Automated commands: pnpm test ／ pnpm run typecheck ／ pnpm run check:docs ／ pnpm vitest run scripts/route-ledger.test.mjs ／ pnpm vitest run src/db/behavior-band-default-migration.test.ts src/lib/form-align.integration.test.ts（PR を出す前に緑） ／ pnpm run test:coverage（src/lib/domain は 100%） ／ pnpm db:migrate:local ／ pnpm exec wrangler d1 execute hr-evaluation-db --local --file "$TMPDIR/behavior-band-drift.sql"（リポジトリの外に置いた一時的な SQL（等級 1 だけが 2 つ目のまとまりへ移った会社・呼び名を変えた会社・既定のまとまりが無い会社の試験データ）） ／ pnpm exec wrangler d1 execute hr-evaluation-db --local --file drizzle/migrations/0040_behavior_band_defaults.sql（2 回当てる。wrangler は当てた migration を二度は当てないので --file で直接当てる） ／ pnpm exec wrangler d1 execute hr-evaluation-db --local --command "SELECT company_id, code, behavior_band, updated_at FROM grades ORDER BY company_id, display_order"（当てる前と後と戻した後の割り当ての読み取り） ／ pnpm exec wrangler d1 execute hr-evaluation-db --local --command "SELECT * FROM behavior_band_default_rewrites WHERE migration = '0040_behavior_band_defaults'"（書き換える前の値と新しい値の記録） ／ pnpm exec wrangler d1 execute hr-evaluation-db --local --file drizzle/rollback/0040_behavior_band_defaults_rollback.sql（戻ることを読み取りで確かめ、もう一度 drizzle/migrations/0040_behavior_band_defaults.sql を当てる） ／ pnpm db:seed:local（2 回流して表ごとの行の数を比べる） ／ pnpm db:sample:local（2 回流して、見本の会社とそれ以外の行の数を流す前と比べる） ／ node scripts/seed.mjs --generate-only の後に git diff --exit-code drizzle/seed.sql（差分が無く終了コード 0） ／ git status --short（試験データの SQL が出ないこと）
- Required evidence: 各コマンドの出力、0040 の前後と戻した後の手元の割り当ての読み取り、2 回目の変更の件数、見本を流す前と 2 回流した後の行の数、SECURITY-014 の決定と利用者の承認の記録

## Rollout and rollback

- Rollout: P04 のテストを最初のコミットに入れた P05 のブランチで PR を作る（作る前に利用者に確かめる）。PR を出す条件は、移行のテストと src/lib/form-align.integration.test.ts が緑で、手元のずれた会社の試験データでの 0040・2 回目・戻し・当て直しの結果が PR の本文にそろっていること。P06 が P05 の PR の上で 6 つのコマンドを緑にし、SECURITY-014 が決まり、手元の 0040 の結果を見た利用者が本番への適用を承認してからマージする。マージで Deploy workflow が書き出し → 0040 → 確認 → 配布を行う
- Rollback trigger and steps: ロールバック: コードは前へ進める PR で直す（P05 を revert しても 0040 は戻らない）。0040 を戻すときは、利用者の承認を得てから drizzle/rollback/0040_behavior_band_defaults_rollback.sql を pnpm exec wrangler d1 execute hr-evaluation-db --remote --file で当てる。drizzle/rollback/0040_behavior_band_defaults_rollback.sql は behavior_band_default_rewrites の記録から、今の値が 0040 の書いた値のままの行だけを戻す。Artifact の書き出し（14 日）は控えで、使うときも全体は流し込まず、行動指針の割り当ての表だけを取り出す

## Handoff

- Executor: task-graph build（application-code）
- Ready when: P04 のテストが緑で、手元で 0040 と戻しが確かめられ、P06 で P05 の PR の上の全体のテストを流せる
- 次に利用するノード: SYS-GUIDE-KPI-P06

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P04

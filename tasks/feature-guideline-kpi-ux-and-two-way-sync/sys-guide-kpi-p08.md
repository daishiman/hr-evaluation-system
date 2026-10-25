---
graph_node_id: "SYS-GUIDE-KPI-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "移行と片付け（ずれた下書きを手元でそろえ、使わなくなったコードを消す）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "data"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p08", "migration", "cleanup"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P07"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["src/app/admin/behavior/", "src/app/admin/scheme/", "src/components/", "src/lib/domain/", "src/lib/form-align.ts", "src/actions/form-align.ts", "e2e/", "docs/product/design-decisions.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p08.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.8", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 移行と片付け（ずれた下書きを手元でそろえ、使わなくなったコードを消す）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P08
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p08, migration, cleanup
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P08
- lifecycle_role: migration
- workstream_kind: data（secondary: backend, frontend, quality）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P07
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- 手元の preview（pnpm run preview、8787）で、全体管理者として会社を 1 つずつ切り替え、KPI・評価セットの入口の「設定とずれた下書きのアンケート」の操作（内容を見る → 確認 → そろえる → 結果の文）を流す。「内容を見る」（dry-run）の件数と一覧を会社ごとに記録し、そろえた後にもう一度「内容を見る」で 0 件になることを確かめる。0040 で書き換えた会社のアンケートと、いまずれている下書きが、下書きごとに更新時刻の新しい方へそろうことを手元の D1 の読み取りで確かめ、流す前の行の書き出しがリポジトリの外にあることを確かめる。
- 画面の分割と段階的な開示で使わなくなったコード（固定の初期設定の説明文・編集部品の重複した説明・1 画面にまとめていた KPI・評価セットの旧い節）を消し、旧い URL からの転送を残す。消す前に、消す説明文と旧い節の見出しの文を e2e/ と src/ の *.test.ts・*.spec.ts から grep -rn で探し、当たったテストを直す一覧を記録に残す。write_scope の外のテストに当たったら、P02 の DD に理由を足してから広げる。

## 背景

- 0040 は P05 で書いて手元で確かめ、P05 の PR のマージで本番に当たっている（DD-020 の 1・2）。そろえる操作（src/lib/domain/form-align.ts・src/lib/form-align.ts・src/actions/form-align.ts）は P05 で作り src/lib/form-align.integration.test.ts で確かめたが、手元の preview で会社ごとに流して 2 回目が 0 件になることはまだ確かめていない。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P07
- Entry gate: P07 の受け入れが合格である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: 0040 は P05 のマージで本番に適用済みで、本番の d1_migrations に記録されている。ファイルを直しても本番には当て直されないので、この段では 0040 と戻しの SQL を変えない。0040 に直しが要るときは、新しい番号の migration で前へ進め、P02 の DD に理由を足す。そろえる操作は手元の下書きを書き換えるので、流す前に pnpm exec wrangler d1 execute hr-evaluation-db --local --json --command "SELECT * FROM forms WHERE company_id = '$COMPANY_ID' AND status = 'draft'; SELECT * FROM form_questions WHERE form_id IN (SELECT id FROM forms WHERE company_id = '$COMPANY_ID' AND status = 'draft')" > "$TMPDIR/align-dump-local-$COMPANY_ID.json"（COMPANY_ID は切り替えた会社の id。対象の下書きの行をリポジトリの外へ書き出す。SELECT だけ）

## Workstream applicability

- Frontend: 適用: 使わなくなった画面の節と説明文を消し、旧い URL の転送を残す。手元の preview で KPI・評価セットの入口の「設定とずれた下書きのアンケート」の操作（内容を見る → 確認 → そろえる → 結果の文）を流す
- Backend: 適用: そろえる操作の「内容を見る」と本流しの件数を会社ごとに記録する
- API: N/A: この段では API の成果物を作らない
- Data: 適用: 流す前の対象の行をリポジトリの外へ書き出し、流した後の下書きと設定と、2 回目の 0 件を読み取りで確かめる
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: N/A: この段では Security の成果物を作らない
- Quality: 適用: 片付けの後も全てのテストが緑であることを確かめる
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: P02 の DD のとおり。そろえる操作は下書きごとに更新時刻の新しい方を正とし（I30）、下書きが新しければ設定へ反映し（I28）、設定が新しければ回答 0 件の下書きを作り直すか、回答のある公開中のアンケートに次の版の下書きを作る（I29）
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system。P08 の PR のマージで、Deploy workflow が migration なしで Worker を配る（本番の D1 への書き込みは P13 だけ）
- Compatibility/migration/backfill: migration を足さないので、本番の D1 の形は変わらない。旧い URL の転送の page.tsx は残す。そろえる操作は何度流しても結果が同じ（2 回目の「内容を見る」が 0 件）

## 成果物

- Produced artifacts: 手元の preview でのそろえる操作の会社ごとの件数の記録、片付けのコミット
- Consumed artifacts: P05 のそろえる操作（src/lib/domain/form-align.ts・src/lib/form-align.ts・src/actions/form-align.ts と入口の知らせ）、P05 で手元に当てた 0040 の結果
- Write scope/touches: src/app/admin/behavior/, src/app/admin/scheme/, src/components/, src/lib/domain/, src/lib/form-align.ts, src/actions/form-align.ts, e2e/, docs/product/design-decisions.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の前の段の完了（その段の PR のマージ。PR を作らない段は、紐付けた P05 の PR のマージ）を待って着手する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P08 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P08 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 本番 DB でのそろえる操作（P13 の担当）
- 範囲の外を取り込まない: 適用済みの drizzle/migrations/0040_behavior_band_defaults.sql と drizzle/rollback/0040_behavior_band_defaults_rollback.sql の書き換え
- 範囲の外を取り込まない: 新しい機能の追加
- 範囲の外を取り込まない: Node の台本や package.json の script でずれた下書きをそろえること

## Verification and evidence

- Acceptance: 消す文に当たったテストの一覧が記録にあり、その全てが直されている ／ 手元の preview で、全体管理者が会社を切り替えて KPI・評価セットの入口の「設定とずれた下書きのアンケート」の操作（内容を見る → 確認 → そろえる → 結果の文）を流すと、0040 で書き換えた会社とずれていた下書きが更新時刻の新しい方へそろい、2 回目の「内容を見る」が 0 件で知らせが消える ／ 流す前の対象の行の書き出しがリポジトリの外にあり、git status に出ない ／ 片付けの後も pnpm test・pnpm run typecheck・pnpm run check:docs が緑である（旧い URL の転送の page.tsx は残すので、経路の台帳は変わらない） ／ P08 のブランチで drizzle/migrations/0040_behavior_band_defaults.sql と drizzle/rollback/0040_behavior_band_defaults_rollback.sql を変えていない（P05 のマージの後の main からの差分が空）
- Automated commands: pnpm run preview（8787。全体管理者でログインし、会社を 1 つずつ切り替えて入口の「内容を見る」→ 確認 →「そろえる」→ もう一度「内容を見る」を流す） ／ pnpm exec wrangler d1 execute hr-evaluation-db --local --json --command "SELECT * FROM forms WHERE company_id = '$COMPANY_ID' AND status = 'draft'; SELECT * FROM form_questions WHERE form_id IN (SELECT id FROM forms WHERE company_id = '$COMPANY_ID' AND status = 'draft')" > "$TMPDIR/align-dump-local-$COMPANY_ID.json"（COMPANY_ID は切り替えた会社の id。対象の下書きの行をリポジトリの外へ書き出す。SELECT だけ）（「そろえる」の前に会社ごと） ／ pnpm exec wrangler d1 execute hr-evaluation-db --local --command "SELECT f.company_id, f.id, f.version, f.updated_at, COUNT(q.id) AS questions FROM forms f LEFT JOIN form_questions q ON q.form_id = f.id WHERE f.status = 'draft' GROUP BY f.id ORDER BY f.company_id, f.updated_at"（流す前と後の下書きの版・設問の数・更新時刻の読み取り） ／ grep -rn -F -f "$TMPDIR/removed-strings.txt" e2e src --include=*.test.ts --include=*.spec.ts（消す文を 1 行ずつ書いたリポジトリの外のファイルで探し、当たったテストを直す一覧にする） ／ pnpm test ／ pnpm run typecheck ／ pnpm run check:docs ／ git diff --stat origin/main...HEAD -- drizzle/migrations/0040_behavior_band_defaults.sql drizzle/rollback/0040_behavior_band_defaults_rollback.sql（出力が空） ／ git status --short（書き出しが出ないこと）
- Required evidence: 会社ごとの「内容を見る」の件数と一覧、そろえた後の 0 件、流す前と後の読み取り、テストの出力、git status の出力

## Rollout and rollback

- Rollout: 片付けのコミットで PR を作り（作る前に利用者に確かめる）、main へマージする。マージで Deploy workflow が配る。本番でのそろえる操作は P13 で行う
- Rollback trigger and steps: ロールバック: 片付けのコミットを revert する PR で戻す。手元の下書きは流す前の行の書き出しから入れ直し、設定の側は constitution_events の before_json の値で設定の画面から戻す

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 手元でそろえる操作の 2 回目が 0 件で、片付けの後も全てのテストが緑である
- 次に利用するノード: SYS-GUIDE-KPI-P09

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P07

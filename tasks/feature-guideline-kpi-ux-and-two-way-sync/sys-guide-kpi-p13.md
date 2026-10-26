---
graph_node_id: "SYS-GUIDE-KPI-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "リリースの記録（Deploy workflow の実行・本番の読み取り・下書きの整列と見本の入れ直し）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p13", "release"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-13-release-deploy.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P12"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/deploy-notes.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P13"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p13.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.13", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: リリースの記録（Deploy workflow の実行・本番の読み取り・下書きの整列と見本の入れ直し）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P13
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p13, release
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P13
- lifecycle_role: release
- workstream_kind: operations（secondary: quality, data）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P12
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- P05〜P12 のマージで動いた Deploy workflow の実行 id・sha・時刻と、P05 のマージの実行が残した D1 の書き出しの Artifact の名前と id を記録する。手では deploy・db:backup・db:migrate:remote をしない（DD-020 の 7）。
- 本番 DB は SELECT の読み取りだけで確かめる（0040 の結果と、既定のまとまりが無い会社の件数）。
- 本番で、全体管理者が会社を 1 つずつ切り替えて KPI・評価セットの入口の「設定とずれた下書きのアンケート」の操作（内容を見る → 確認 → そろえる → 結果の文）の「内容を見る」の件数と一覧を利用者に見せ、確認を取ってから、流す前の行をリポジトリの外へ書き出し、「そろえる」を流す。見本の会社は、確認の後に pnpm db:sample:remote で入れ直す。結果を docs/deploy-notes.md の公開の記録に書く。

## 背景

- 公開は main へのマージで、配布と migration の適用は Deploy workflow が受け持つ（DD-020 の 1・2）。0040 は P05 のマージで本番に当たり、その前の本番 D1 の全体は Artifact（保管 14 日）に書き出されている。
- 本番の D1 にこの段で書き込むのは、本番の Worker の中のそろえる操作と、見本の入れ直しの 2 つだけで、どちらも利用者の確認の後に行う。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P12
- Entry gate: P12 がマージされ、その Deploy workflow の実行が成功している。P10 で本番への書き込みを止める指摘が 0 件である
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: そろえる操作は本物の会社の下書きを書き換える。会社ごとに「内容を見る」の件数と一覧を利用者に見せて確認を取り、流す前の行は pnpm exec wrangler d1 execute hr-evaluation-db --remote --json --command "SELECT * FROM forms WHERE company_id = '$COMPANY_ID' AND status = 'draft'; SELECT * FROM form_questions WHERE form_id IN (SELECT id FROM forms WHERE company_id = '$COMPANY_ID' AND status = 'draft')" > "$TMPDIR/align-dump-remote-$COMPANY_ID.json"（COMPANY_ID は切り替えた会社の id。対象の下書きの行をリポジトリの外へ書き出す。SELECT だけ。db:backup は使わない）してから流す。見本の入れ直し（pnpm db:sample:remote）は手元の node から本番へ書くので、共有のワークツリーから流すと他のエージェントの未コミットのコードで本番に書くことになる。main の sha のクリーンな checkout（別の worktree）から流す

## Workstream applicability

- Frontend: N/A: この段では Frontend の成果物を作らない
- Backend: N/A: この段では Backend の成果物を作らない
- API: N/A: この段では API の成果物を作らない
- Data: 適用: そろえる操作と見本の入れ直しを、利用者の確認の後に行い、件数を読み取る
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: N/A: この段では Security の成果物を作らない
- Quality: 適用: 本番の読み取りで、行動指針の割り当てと見本の受付中の期を確かめる
- Documentation: N/A: この段では Documentation の成果物を作らない
- Operations: 適用: Deploy workflow の実行と Artifact を記録し、確認を取りながらそろえる操作と見本の入れ直しを流す

## Architecture and deploy unit

- Architecture decisions: N/A: 設計は変えない
- Deploy unit/environment: cloudflare-worker:hr-evaluation-system と D1 hr-evaluation-db（本番）。配布と 0040 の適用は Deploy workflow の担当で、この段では手で配らない
- Compatibility/migration/backfill: 0040 は列と表を消さない。そろえる操作は何度流しても結果が同じ（2 回目の「内容を見る」が 0 件）。見本の台本は見本の会社の行だけに触れる

## 成果物

- Produced artifacts: Deploy workflow の実行と Artifact の記録、本番の読み取りの結果、そろえる操作の会社ごとの件数、見本の入れ直し、docs/deploy-notes.md の公開の記録
- Consumed artifacts: P12 までの main、docs/deploy-notes.md の手順、Deploy workflow の実行の記録
- Write scope/touches: docs/deploy-notes.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の前の段の完了（その段の PR のマージ。PR を作らない段は、紐付けた P05 の PR のマージ）を待って着手する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P13 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P13 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 手での deploy・db:backup・db:migrate:remote
- 範囲の外を取り込まない: 利用者の確認を取らずに本番へ書き込むこと
- 範囲の外を取り込まない: 本物の会社のデータに仮のデータを入れること
- 範囲の外を取り込まない: 書き出しや書き換える前の行をリポジトリに入れること
- 範囲の外を取り込まない: Node の台本や wrangler の書き込みの SQL でずれた下書きをそろえること

## Verification and evidence

- Acceptance: P05〜P12 のマージの Deploy workflow の実行 id・sha・時刻と、P05 の実行の D1 の書き出しの Artifact の名前と id が公開の記録にある ／ 本番の読み取りで、既定からずれていた会社が既定の割り当てになり、既定のまとまりが無い会社の件数が記録されている ／ 入口に知らせが出ていた全ての会社で、そろえた後の「内容を見る」が 0 件で、知らせが消えている ／ 本番の見本の会社に、提出済み・下書き・未回答が混ざった受付中の期が 1 つある ／ 本番への書き込み（そろえる操作と見本の入れ直し）の全てに、利用者の確認の記録がある ／ 書き出しと書き換える前の行がリポジトリに無い（git status に出ない）
- Automated commands: gh run list --workflow deploy.yml --branch main（P05〜P12 のマージの実行を読む） ／ gh run view（P05 のマージの実行。d1-backup の Artifact の名前と id を読む） ／ pnpm exec wrangler d1 execute hr-evaluation-db --remote --command "SELECT company_id, code, behavior_band, updated_at FROM grades ORDER BY company_id, display_order"（0040 の結果） ／ pnpm exec wrangler d1 execute hr-evaluation-db --remote --command "SELECT c.id, GROUP_CONCAT(b.code) AS band_codes FROM companies c LEFT JOIN behavior_band_sets b ON b.company_id = c.id AND b.is_active = 1 GROUP BY c.id ORDER BY c.id"（band_codes に g1_2 と g3_4 がそろわない会社を、既定のまとまりが無い会社として数える。数え方は P02 の DD に合わせる） ／ 本番の KPI・評価セットの入口で、全体管理者が会社を 1 つずつ切り替えて「内容を見る」の件数と一覧を読み、利用者に見せて確認を取る（書き込まない） ／ pnpm exec wrangler d1 execute hr-evaluation-db --remote --json --command "SELECT * FROM forms WHERE company_id = '$COMPANY_ID' AND status = 'draft'; SELECT * FROM form_questions WHERE form_id IN (SELECT id FROM forms WHERE company_id = '$COMPANY_ID' AND status = 'draft')" > "$TMPDIR/align-dump-remote-$COMPANY_ID.json"（COMPANY_ID は切り替えた会社の id。対象の下書きの行をリポジトリの外へ書き出す。SELECT だけ。db:backup は使わない）（確認の後、「そろえる」の前に会社ごと） ／ 入口の「そろえる」→ もう一度「内容を見る」（0 件で知らせが消える） ／ pnpm db:sample:remote（利用者の確認の後） ／ pnpm exec wrangler d1 execute hr-evaluation-db --remote --command "SELECT r.status, COUNT(*) AS n FROM form_responses r JOIN evaluation_cycles c ON c.id = r.cycle_id WHERE r.company_id = 'cmp_sample' AND c.status = 'open' GROUP BY r.status"（見本の受付中の期の提出済みと下書きの件数） ／ pnpm exec wrangler d1 execute hr-evaluation-db --remote --command "SELECT COUNT(*) AS no_response FROM users u WHERE u.company_id = 'cmp_sample' AND u.id NOT IN (SELECT r.employee_id FROM form_responses r JOIN evaluation_cycles c ON c.id = r.cycle_id WHERE r.company_id = 'cmp_sample' AND c.status = 'open')"（受付中の期に回答の行が無い人の数。管理者を含むので、見本の生成のテストの人数と比べる） ／ git status --short（書き出しが出ないこと）
- Required evidence: workflow の実行 id・sha・時刻と Artifact の名前と id、各コマンドの出力、本番の読み取りの結果、利用者の確認の記録、書き出しの置き場（中身は記録に写さない）

## Rollout and rollback

- Rollout: 記録 → 本番の読み取り → 会社ごとの「内容を見る」→ 確認 → 流す前の行の書き出し →「そろえる」→ 2 回目の「内容を見る」→ 確認 → 見本の入れ直し → 読み取り、の順に流し、公開の記録を文書のコミットで main へマージする
- Rollback trigger and steps: ロールバック: 0040 は、利用者の承認の後に drizzle/rollback/0040_behavior_band_defaults_rollback.sql を pnpm exec wrangler d1 execute hr-evaluation-db --remote --file で当てる（behavior_band_default_rewrites の記録から、今の値が 0040 の書いた値のままの行だけを戻す）。Artifact の書き出し（14 日）は全体を流し込まず、行動指針の割り当ての表だけを取り出す。そろえる操作は、流す前の行の書き出しから下書きの行を入れ直し（利用者の承認の後に wrangler d1 execute --remote --file）、設定の側は constitution_events の before_json の値で設定の画面から戻す。見本は pnpm db:sample:remove:remote で消す（確認の後）。コードは前へ進める PR で直す

## Handoff

- Executor: task-graph build（application-code）
- Ready when: 本番の読み取りで受け入れが確かめられ、公開の記録がマージされている
- 次に利用するノード: なし（リリースで feature が完了する）

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P12

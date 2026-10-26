---
graph_node_id: "SYS-GUIDE-KPI-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "設計（行動指針の既定・画面の分割・双方向の追従・写しの一覧・見本の期・部品クラス）"
project_id: "feature-package-feature-guideline-kpi-ux-and-two-way-sync"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guideline-kpi", "p02", "design", "decision"]
file_path: "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-22T10:19:40Z", "origin_kind": "system-dev-planner", "source_digest": "08d67c7d2b45201603d3d3595fbe934d5171854de5288e39467d4338f37b3021", "source_path": ".dev-graph/plans/feature-package-feature-guideline-kpi-ux-and-two-way-sync/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-22T10:19:40Z"
updated_at: "2026-10-22T10:19:40Z"
depends_on: ["SYS-GUIDE-KPI-P01"]
related_nodes: ["feature-guideline-kpi-ux-and-two-way-sync", "spec-system-spec-requirements", "arch-system-spec-auth", "arch-system-spec-backend", "arch-system-spec-database", "arch-system-spec-frontend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops", "arch-system-spec-security", "arch-system-spec-ui-ux"]
resource_scope: ["docs/product/design-decisions.md", "docs/product/settings-copy-ledger.md", "docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md", "docs/product/backlog.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: "feature-guideline-kpi-ux-and-two-way-sync"
feature_package_id: "feature-package/feature-guideline-kpi-ux-and-two-way-sync"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p02.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-6pi.2", "linked_at": "2026-10-22T11:02:28.603066Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-22T10:13:45Z", "missing_sections": [], "status": "complete"}
---

# System task overlay: 設計（行動指針の既定・画面の分割・双方向の追従・写しの一覧・見本の期・部品クラス）

## Machine-readable registration fields

- id: SYS-GUIDE-KPI-P02
- feature_package_id: feature-package/feature-guideline-kpi-ux-and-two-way-sync
- owners: daishiman
- tags: guideline-kpi, p02, design, decision
- related_nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux
- parent_feature: feature-guideline-kpi-ux-and-two-way-sync
- phase_ref: P02
- lifecycle_role: preparation
- workstream_kind: documentation（secondary: frontend, backend, data）
- build_target_kind: application-code
- depends_on: SYS-GUIDE-KPI-P01
- classification: confidence 0.95 / reason 単一責務の実行タスクで artifact_kind は task 以外に取り得ない / candidate path tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

- DD-026 以降に、DD-010 を改める決め（行動指針の既定の割り当てを等級の内部の識別子で持つ。beginner・regular で 1 つ、chief・am1・am2 で 1 つ、manager1・manager2 は出さない。初期設定の説明はいまの割り当てから作る）を書く。
- 行動指針の画面の段階的な開示（冒頭は 1 文とまとまりの状態だけ）と、KPI・評価セットの入口と 4 つの作業（等級区分ごとの設定・全等級区分に共通の設定・KPI 項目・KPI カテゴリ）の画面の URL と分け方を決める。
- DD-015・DD-016 を改める決め（下書きのアンケートから設定への反映と断る条件、設定の保存から回答 0 件の下書き・回答のある公開中のアンケート・確定前の評価への追従、確定した評価とレポートは触らない、staleAskingItems と公開の前の検査は残す）を書く。
- 写しを持つ全ての場所を docs/product/settings-copy-ledger.md に一覧にし、参照・追従・確定した時点の写しのどれかに分ける。
- 製品仕様 §14 を改める決め（見本に受付中の期を 1 つ作り、締切は流した日から数える）と、globals.css の部品クラス（既存の意味のトークンと color-mix だけ）・状態の見分け・44px・主の操作は 1 つの規則と、migration 0040 の中身と戻し方を決める。

## 背景

- DD-010 は等級の並びで続いた等級にだけ基準セットを出せるようにしたが、既定の割り当ては決めておらず、既存の会社がずれたまま残っている。
- DD-015・DD-016 は、アンケートの設問を直しても設定へ戻さず、設定を直しても下書きを作り直さない前提で書かれている。要件の制約により、これらを改める DD を書いてから実装する。
- 製品仕様 §14 は、本番の未回答の一覧に見本の 12 名が並ぶのを避けるため、受付中の期を作らないと決めている。

## 前提条件

- Required spec/architecture/phase/task nodes: feature-guideline-kpi-ux-and-two-way-sync, spec-system-spec-requirements, arch-system-spec-auth, arch-system-spec-backend, arch-system-spec-database, arch-system-spec-frontend, arch-system-spec-infrastructure, arch-system-spec-maintenance-ops, arch-system-spec-security, arch-system-spec-ui-ux、SYS-GUIDE-KPI-P01
- Entry gate: P01 の受領記録がマージされている
- Source pin: system-spec-harness 0.1.22 / run-system-spec-compile / assign-system-spec-completeness-evaluator / sha256:2219ab51f6e08bf4a7fa948ef2f35a75d5e16495ee279a412e447ddd7c4f528f（workstream-inventory.json の source_lineage.source_version 0.1.0 は inventory の schema が固定する版で、出典の版ではない。出典の版はこの pin の 0.1.22）
- Repository context: github:daishiman/hr-evaluation-system / explicit-cli / .dev-graph/config.json
- Blocker: なし
- Open risk: 双方向の追従は書く場所が 2 つになり、同時の保存で食い違う。409 と更新時刻の新しい方を正とする規則を DD に書き、P04 のテストに落とす

## Workstream applicability

- Frontend: 適用: 2 つの画面の段階的な開示・4 つの作業の画面の URL・部品クラスの一覧と部品の対応を決める。KPI・評価セットの入口の「次にやること」として、KPI・評価セットの入口の「設定とずれた下書きのアンケート」の操作（内容を見る → 確認 → そろえる → 結果の文）を置く（件数が 0 のときは知らせを出さない。I27 の入口の範囲の中で、ほかの画面は組み替えない）
- Backend: 適用: 追従の規則・断る条件・保存の結果の文と、ずれた下書きをそろえる操作の判定・返り値（dry-run の件数と一覧）を決める
- API: N/A: この段では API の成果物を作らない
- Data: 適用: 0040 の書き換えの範囲と、既定のまとまりが無い会社は書き換えずに件数を報告する規則と、戻し方を決める。移行の後に会社が変えた割り当てを正とすること（I26）を決める。drizzle の $onUpdate は生の SQL では効かないので、0040 は書き換える行の updated_at を明示して移行の時刻にし、ずれた下書きをそろえるときに設定の側が新しいと判定されるようにする。ずれた下書きをそろえる仕組みは Node の台本でなく Worker の中の操作にする: 判定 src/lib/domain/form-align.ts（下書きごとに更新時刻の新しい方を正とする I30。下書きが新しければ設定へ反映 I28、設定が新しければ回答 0 件の下書きの作り直しか次の版の下書き I29。締め切ったアンケートと確定した評価は対象にしない）、DB の層 src/lib/form-align.ts（alignDraftForms(db, {companyId, dryRun})。I28・I29 の保存と同じ buildFormDraft・syncFormQuestions・設定の更新の関数を呼び、規則を二重に書かない。dryRun は書かずに件数と一覧を返す）、サーバー処理 src/actions/form-align.ts（src/lib/action.ts の runAction を通す）。src/lib/domain の .ts は拡張子なしの相対 import のため node --experimental-strip-types では読めないので、Node の台本からは import せず、package.json に台本の script を足さない。流す前の対象の行は、SELECT だけの wrangler d1 execute --json で forms・form_questions をリポジトリの外へ書き出し、設定の側は constitution_events の before_json から戻すと決める。雛形の会社（src/lib/template.ts の findTemplateCompany が返す is_template の会社）も 0040 の対象に入り、新しい会社は copyCompanyMasters で雛形の等級（behavior_band を含む）と行動指針を写して始まると決める。0040 の戻しの元: 0034 の display_name_rewrites は主キーが (table_name, row_id, column_name) で、0034 が behavior_band_sets.name をすでに記録しているため、同じ表に書くと INSERT OR IGNORE で 0040 の書き換える前の値が残らない。そこで 0040 は、同じ列を持つ別の記録の表 behavior_band_default_rewrites（CREATE TABLE IF NOT EXISTS・INSERT OR IGNORE・migration は 0040_behavior_band_defaults）に、書き換える列（grades.behavior_band と、呼び名を既定へ戻すなら behavior_band_sets.name）の前の値と新しい値を残す。drizzle/rollback/0040_behavior_band_defaults_rollback.sql は今の値が新しい値のままの行だけを前の値へ戻し（0034 の戻しと同じ形）、記録の表は消さない。表の定義は src/db/schema.ts にも足す
- Infrastructure: N/A: この段では Infrastructure の成果物を作らない
- Security: 適用: アンケートからの反映と、ずれた下書きをそろえる操作が、設定の保存と同じ権限（会社の管理者以上）・会社の絞り込み・409・制度の変更の記録を通ることを決める。全体管理者は switchCompanyScope で会社を 1 つずつ切り替えて使い、会社をまたいで一度にそろえる入口は作らない
- Quality: 適用: 決めたことごとに P04 のテストの名前を付ける
- Documentation: 適用: DD と写しの一覧を書き、受領記録の未決の事項を埋める。docs/product/backlog.md の SECURITY-014 の文を、この feature の P05（0040）のマージでも Deploy workflow の書き出しが 1 つ増え、0040 を戻す元にもなることに掛かるよう直す
- Operations: N/A: この段では Operations の成果物を作らない

## Architecture and deploy unit

- Architecture decisions: DD-010・DD-015・DD-016 と製品仕様 §14 を改める DD を DD-026 から順に書く。配色は DD-003 のまま（平賀配色へ移さず、新しい色のトークンを足さない）。写しの分け方は参照・追従・確定した時点の写しの 3 つ
- Deploy unit/environment: N/A: 文書のみ。Worker と D1 は変えない
- Compatibility/migration/backfill: 0040 は P05 で書いて手元で確かめ、P05 の PR のマージで Deploy workflow が本番に当てる（DD-020 の 1・2）。この段では文書だけを書く

## 成果物

- Produced artifacts: docs/product/design-decisions.md（DD-026 以降）、docs/product/settings-copy-ledger.md（写しの一覧）、受領記録の未決の事項の欄、docs/product/backlog.md の SECURITY-014 の文
- Consumed artifacts: docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md、docs/product/spec.md（§14・§22・§27）、docs/product/design-decisions.md（DD-003・DD-010・DD-015・DD-016・DD-025）
- Write scope/touches: docs/product/design-decisions.md, docs/product/settings-copy-ledger.md, docs/product/spec-receipts/2026-10-22-guideline-kpi-ux-and-two-way-sync.md, docs/product/backlog.md

## Tracker publication and completion

- Tracker binding intent: beads（repo-config の execution_tracker.mode は beads）
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads 束縛で GitHub の Issue は起票しない
- PR completion policy: linked_pr_merged_all
- Dependency meaning: depends_on の前の段の完了（その段の PR のマージ。PR を作らない段は、紐付けた P05 の PR のマージ）を待って着手する
- PR body contract: 本文に dev-graph:SYS-GUIDE-KPI-P02 を書き、default branch（main）を向ける
- PR creation: PR は作る前に利用者に確かめる（勝手に出さない）
- Ownership boundary: system-dev-planner は intent の宣言だけを行い、起票・依存の投影・完了の収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録のあとに C15 が devgraph/SYS-GUIDE-KPI-P02 を割り当てる（system-dev-planner は先に決めない）
- Worktree lease: 着手の前に claim し、作業中は heartbeat、終わったら release する
- Parallel safety: depends_on の完了と、resource_scope と有効な lease が重ならないことを scheduler が確かめる
- Completion projection: feature branch では pending の event だけを記録し、clean な default branch で done を確定する

## スコープ外

- 範囲の外を取り込まない: 平賀配色への移行と新しい色のトークンの追加（DD-003）
- 範囲の外を取り込まない: コードの変更（P04 以降）
- 範囲の外を取り込まない: 確定した評価と評価レポートを新しい設定で集計し直すこと
- 範囲の外を取り込まない: SECURITY-014 の置き場所を決めること（利用者が P05 のマージの前に決める。P02 は文を直すだけ）

## Verification and evidence

- Acceptance: DD が DD-010・DD-015・DD-016・製品仕様 §14 のどれを改めるかを明記している ／ DD に、ずれた下書きをそろえる操作の置き場（src/lib/domain/form-align.ts・src/lib/form-align.ts・src/actions/form-align.ts と入口の知らせ）・dry-run の返り値・権限・流す前の行の書き出しと戻し方と、0040 が updated_at を移行の時刻にすることが書かれている ／ DD に、雛形の会社も 0040 の対象で、新しい会社は copyCompanyMasters で雛形の割り当てを写して始まることが書かれている ／ DD に、0040 の戻しの元（記録の表 behavior_band_default_rewrites・記録する列・今の値が新しい値のままの行だけを戻すこと・0034 の記録の表を使わない理由）が書かれている ／ docs/product/backlog.md の SECURITY-014 が、この feature の P05 のマージでも書き出しが増えることを書いている ／ 写しの一覧が、設定の値を写す全ての場所を 3 つの分け方のどれかに入れている ／ 未決の事項 5 件が全て決まり、受領記録の欄が埋まっている
- Automated commands: pnpm run check:docs
- Required evidence: DD の番号と、写しの一覧の path、受領記録の未決の欄が埋まった差分

## Rollout and rollback

- Rollout: 文書のコミットだけ。main へのマージで有効になる
- Rollback trigger and steps: ロールバック: この段のコミットを revert すれば DD と写しの一覧が消える。コードと DB は変わらない

## Handoff

- Executor: task-graph build（application-code）
- Ready when: DD と写しの一覧がマージされ、未決の事項が 0 件である
- 次に利用するノード: SYS-GUIDE-KPI-P03

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md、specs/system-spec-requirements.md
- Architecture: architecture/system-spec-auth.md、architecture/system-spec-backend.md、architecture/system-spec-database.md、architecture/system-spec-frontend.md、architecture/system-spec-infrastructure.md、architecture/system-spec-maintenance-ops.md、architecture/system-spec-security.md、architecture/system-spec-ui-ux.md
- Feature: features/guideline-kpi-ux-and-two-way-sync.md、features/feature-guideline-kpi-ux-and-two-way-sync.context.json
- Phase doc: この task-spec が phase の正本で、別の phase 文書は作らない
- Dependencies: SYS-GUIDE-KPI-P01

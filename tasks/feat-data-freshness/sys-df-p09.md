---
graph_node_id: "SYS-DF-P09"
artifact_kind: "task"
artifact_subtypes: []
title: "送信元の検査・控えの暗号化・監査で、安全と運用の備えを確かめる"
project_id: "feature-package-feat-data-freshness"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "quality-assurance"]
file_path: "tasks/feat-data-freshness/sys-df-p09.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-09-quality-assurance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P06", "SYS-DF-P08"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["eval-log/feat-data-freshness-quality.json"]
purpose: "別のサイト・ポート違いからの書き込みと読み出しをログインを確かめる前に断ること、控えを開けるのがシステム全体管理者と同じ会社の管理者だけであること、SECURITY-001 の監査と private, no-store が揃っていることを確かめ、記録する。"
goal: "送信元の検査・控えの暗号化・監査で、安全と運用の備えを確かめる。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["eval-log/feat-data-freshness-quality.json（安全の確認の記録）"]
scope_out: ["本番の CREDENTIAL_ENC_KEY の設定（W3。外部への変更なので利用者の確認を通す）"]
acceptance: ["A2: ログイン後の画面と /api/* の応答が private, no-store", "A6: 控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える", "A14: 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。allowedOrigins を足していない（action-origin.test.ts）", "A15: 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える", "A16: 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。応答に仮パスワードが無い（SECURITY-001）", "allowedOrigins を足していない"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P09"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P09（quality-assurance）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p09.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.9", "linked_at": "2026-10-01T13:15:44Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 送信元の検査・控えの暗号化・監査で、安全と運用の備えを確かめる

## 目的

別のサイト・ポート違いからの書き込みと読み出しをログインを確かめる前に断ること、控えを開けるのがシステム全体管理者と同じ会社の管理者だけであること、SECURITY-001 の監査と private, no-store が揃っていることを確かめ、記録する。

## 背景

入口を1つにしたぶん、その入口の検査が崩れると全機能に効く。初期パスワードの控えは秘密の値なので、平文で残さず、期限と権限を試験で縛る。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: src/lib/action-origin.test.ts、src/lib/credential-vault.test.ts、src/actions/account-and-company-admin.integration.test.ts
- 前提: 依存タスク（SYS-DF-P06、SYS-DF-P08）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: eval-log/feat-data-freshness-quality.json（安全の確認の記録）
- 更新対象: eval-log/feat-data-freshness-quality.json

## 依存関係

- `depends_on`: ["SYS-DF-P06", "SYS-DF-P08"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: N/A: この phase（quality-assurance）は Frontend を変えない
- Backend/API: N/A: この phase（quality-assurance）は Backend/API を変えない
- Database/Data: N/A: この phase（quality-assurance）は Database/Data を変えない
- Infrastructure: N/A: この phase（quality-assurance）は Infrastructure を変えない
- Security/Privacy: 対象。送信元の二重の検査、控えの AES-GCM と権限、SECURITY-001
- Documentation: N/A: この phase（quality-assurance）は Documentation を変えない

## Write scope と競合制約

- `touches`: `eval-log/feat-data-freshness-quality.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P09）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P09 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P09` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P06, SYS-DF-P08）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P09 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm typecheck
4. 検証のコマンドを実行する: pnpm test
5. 検証のコマンドを実行する: pnpm test:e2e（P06 と P08 の合流後に、ローカルの preview だけを相手にする）
6. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
7. /dev-graph worktree release SYS-DF-P09 で lease を返す

## 受入条件

- [ ] A2: ログイン後の画面と /api/* の応答が private, no-store
- [ ] A6: 控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える
- [ ] A14: 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。allowedOrigins を足していない（action-origin.test.ts）
- [ ] A15: 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える
- [ ] A16: 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。応答に仮パスワードが無い（SECURITY-001）
- [ ] allowedOrigins を足していない

## 検証方法

- 自動検証: `pnpm typecheck`、`pnpm test`、`pnpm test:e2e（P06 と P08 の合流後に、ローカルの preview だけを相手にする）`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feat-data-freshness-quality.json

## リスクとロールバック

- リスク: 本番の CREDENTIAL_ENC_KEY の設定（W3。外部への変更なので利用者の確認を通す） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: 検査が崩れていたら P05 に差し戻す。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P10
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: N/A: この phase（quality-assurance）の責務に Frontend の変更は含まれない
- Backend: N/A: この phase（quality-assurance）の責務に Backend の変更は含まれない
- API: N/A: この phase（quality-assurance）の責務に API の変更は含まれない
- Data: N/A: この phase（quality-assurance）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（quality-assurance）の責務に Infrastructure の変更は含まれない
- Security: 対象。送信元の二重の検査、控えの AES-GCM と権限、SECURITY-001
- Quality: 対象。安全の試験の結果を記録する
- Documentation: N/A: この phase（quality-assurance）の責務に Documentation の変更は含まれない
- Operations: 対象。CREDENTIAL_ENC_KEY が無いときに控えを作らず、知らせる運用

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: repository-eval-log（検証の記録だけ。配布の単位を持たない）

## Verification and evidence

- コマンド: pnpm typecheck
- コマンド: pnpm test
- コマンド: pnpm test:e2e（P06 と P08 の合流後に、ローカルの preview だけを相手にする）
- 証跡: eval-log/feat-data-freshness-quality.json

## Rollout and rollback

- Rollout: 確認の記録なので、配布の手順は無い。
- Rollback: 検査が崩れていたら P05 に差し戻す。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-09-quality-assurance.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

---
graph_node_id: "SYS-DF-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "目的から導いた受入を、ローカルの preview で確かめる"
project_id: "feature-package-feat-data-freshness"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "acceptance"]
file_path: "tasks/feat-data-freshness/sys-df-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-data-freshness/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T13:00:07Z", "origin_kind": "system-dev-planner", "source_digest": "b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd", "source_path": ".dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T13:00:07Z"
updated_at: "2026-10-01T13:19:00Z"
depends_on: ["SYS-DF-P06"]
related_nodes: ["feat-data-freshness", "spec-data-freshness", "arch-data-freshness"]
resource_scope: ["eval-log/feat-data-freshness-acceptance.json"]
purpose: "feature の受入18項目のそれぞれについて、通った試験・画面の操作・応答の見出しを結び付け、ローカルの preview で会社の追加の応答に新しい会社が載り、直後の再読み込みにも出ることを確かめる。"
goal: "目的から導いた受入を、ローカルの preview で確かめる。受入条件のすべてに、検証のコマンドと証跡の場所が結び付いている。"
scope_in: ["eval-log/feat-data-freshness-acceptance.json（受入18項目ごとの判定と証跡）"]
scope_out: ["本番での作成直後の ⌘+Shift+R の確認（W2。配布後に行う）", "移行を既存のデータに当てる確認（P08 が受け持つ）"]
acceptance: ["A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）", "A1: 成功した保存だけが1回描き直し、断られた保存は1行も書かず描き直さない", "A2: ログイン後の画面と /api/* の応答が private, no-store", "A3: 保存の知らせが他のタブに届き、送ったタブには届かない。取り直しは1.5秒に1回へ間引かれる", "A4: 会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない", "A5: 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない", "A6: 控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える", "A7: ローカルの preview で、会社の追加の応答に新しい会社が載り、直後の再読み込みにも出る", "A8: check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる", "A9: 成功の知らせが出た瞬間の画面に、新しい会社の行・1つ増えた件数・会社切替の選択肢がある（E2E 1。待機なし）", "A10: 作成直後のキャッシュを使わない再読み込みで新しい会社が出て、応答の x-generated-at が作成より後（E2E 2）", "A11: 他のタブ・画面復帰・戻る・bfcache の復元で、新しい会社が1秒以内に出る（E2E 3a・3b・4a・4b）", "A12: 発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・RecordForm.test.ts）", "A13: 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る", "A14: 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。allowedOrigins を足していない（action-origin.test.ts）", "A15: 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える", "A16: 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。応答に仮パスワードが無い（SECURITY-001）", "A17: スマホ（375px）・タブレット（768px）の幅でも、E2E 1 と 5 が同じに通る（E2E 6-1・6-5）", "受入18項目すべてに、PASS の判定と証跡の場所がある"]
architecture_refs: ["arch-data-freshness"]
parent_feature: "feat-data-freshness"
feature_package_id: "feature-package/feat-data-freshness"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "system-dev-planner の exact-13 package の P07（acceptance）として、feature feat-data-freshness の受入条件に結び付く単一責務の実行タスク。種別は task。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-data-freshness/sys-df-p07.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "hr-czp.7", "linked_at": "2026-10-01T13:15:41Z", "sync_state": "linked", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T12:55:30Z", "missing_sections": [], "status": "complete"}
---

# 目的から導いた受入を、ローカルの preview で確かめる

## 目的

feature の受入18項目のそれぞれについて、通った試験・画面の操作・応答の見出しを結び付け、ローカルの preview で会社の追加の応答に新しい会社が載り、直後の再読み込みにも出ることを確かめる。

## 背景

試験が通っても、利用者の目的（保存の直後に、次の作業へ進める）を満たしたかは、受入の言葉で確かめる必要がある。

根拠のノードは spec-data-freshness（specs/data-freshness.md）、arch-data-freshness（architecture/data-freshness.md）、feat-data-freshness（features/feat-data-freshness.md）。

## 入力と前提条件

- 入力: eval-log/feat-data-freshness-test-run.json、specs/data-freshness.md
- 前提: 依存タスク（SYS-DF-P06）が完了していて、feature feat-data-freshness が confirmed・evaluation pass・readiness complete

## 出力と成果物

- 生成物: eval-log/feat-data-freshness-acceptance.json（受入18項目ごとの判定と証跡）
- 更新対象: eval-log/feat-data-freshness-acceptance.json

## 依存関係

- `depends_on`: ["SYS-DF-P06"]
- ブロッカー: 依存タスクが done になるまで着手しない。並べてよいのは write scope と lease が重ならないときだけ

## 実装対象

- Frontend: 対象。成功の知らせの瞬間の画面と、別タブ・戻る・bfcache の復元
- Backend/API: N/A: この phase（acceptance）は Backend/API を変えない
- Database/Data: N/A: この phase（acceptance）は Database/Data を変えない
- Infrastructure: N/A: この phase（acceptance）は Infrastructure を変えない
- Security/Privacy: N/A: この phase（acceptance）は Security/Privacy を変えない
- Documentation: N/A: この phase（acceptance）は Documentation を変えない

## Write scope と競合制約

- `touches`: `eval-log/feat-data-freshness-acceptance.json`
- 排他資源: 上の touches と、worktree の lease（graph_node_id SYS-DF-P07）
- 並列実行条件: depends_on がすべて完了し、生きている lease と touches が重ならないこと
- branch: 1タスク1ブランチ。名前は dev-graph の scheduler が devgraph/SYS-DF-P07 の形で割り当てる
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
- PR linkage requirement: PR の本文に `dev-graph: SYS-DF-P07` を書き、既定のブランチ main へ向ける
- Closed without merge: keep_active（自動で done にしない）
- Local reconciliation: /dev-graph sync を手で回すか、マージ後の reconciliation で収束させる

## 実行手順

1. 依存タスク（SYS-DF-P06）が完了していることを確かめ、/dev-graph worktree claim SYS-DF-P07 で lease を取る
2. 成果物の欄にあるファイルを作る、または今の作業ツリーにある実装が受入条件を満たすことを確かめる
3. 検証のコマンドを実行する: pnpm db:migrate:local（0031・0032 が当たっていることを確かめる）
4. 検証のコマンドを実行する: pnpm test（A0 の契約テストを含む）
5. 検証のコマンドを実行する: pnpm check:docs（A8）
6. 検証のコマンドを実行する: pnpm test:e2e（ローカルの preview だけを相手にする）
7. 証跡の欄の記録を残し、受入条件の各項目に判定を付ける
8. /dev-graph worktree release SYS-DF-P07 で lease を返す

## 受入条件

- [ ] A0: 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト）
- [ ] A1: 成功した保存だけが1回描き直し、断られた保存は1行も書かず描き直さない
- [ ] A2: ログイン後の画面と /api/* の応答が private, no-store
- [ ] A3: 保存の知らせが他のタブに届き、送ったタブには届かない。取り直しは1.5秒に1回へ間引かれる
- [ ] A4: 会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない
- [ ] A5: 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない
- [ ] A6: 控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える
- [ ] A7: ローカルの preview で、会社の追加の応答に新しい会社が載り、直後の再読み込みにも出る
- [ ] A8: check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる
- [ ] A9: 成功の知らせが出た瞬間の画面に、新しい会社の行・1つ増えた件数・会社切替の選択肢がある（E2E 1。待機なし）
- [ ] A10: 作成直後のキャッシュを使わない再読み込みで新しい会社が出て、応答の x-generated-at が作成より後（E2E 2）
- [ ] A11: 他のタブ・画面復帰・戻る・bfcache の復元で、新しい会社が1秒以内に出る（E2E 3a・3b・4a・4b）
- [ ] A12: 発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・RecordForm.test.ts）
- [ ] A13: 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る
- [ ] A14: 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。allowedOrigins を足していない（action-origin.test.ts）
- [ ] A15: 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える
- [ ] A16: 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。応答に仮パスワードが無い（SECURITY-001）
- [ ] A17: スマホ（375px）・タブレット（768px）の幅でも、E2E 1 と 5 が同じに通る（E2E 6-1・6-5）
- [ ] 受入18項目すべてに、PASS の判定と証跡の場所がある

## 検証方法

- 自動検証: `pnpm db:migrate:local（0031・0032 が当たっていることを確かめる）`、`pnpm test（A0 の契約テストを含む）`、`pnpm check:docs（A8）`、`pnpm test:e2e（ローカルの preview だけを相手にする）`
- 手動検証: 受入条件の各項目について、証跡のファイルを開いて判定と根拠が書かれていることを確かめる
- 証跡: eval-log/feat-data-freshness-acceptance.json

## リスクとロールバック

- リスク: 本番での作成直後の ⌘+Shift+R の確認（W2。配布後に行う） を範囲に取り込んでしまうこと。範囲の外は scope_out に従って触らない
- ロールバック: 受入が満たせない項目があれば、その項目に結び付く phase へ差し戻す。

## Handoff

- 実装 route: human（このリポジトリでは /improve-app と通常の開発の手順）
- 次に利用するノード: SYS-DF-P10
- 現状: 実装と検証はこの作業ツリーで済んでいる。PR を出してマージするまで done にしない（linked_pr_merged_all）

## Workstream applicability

- Frontend: 対象。成功の知らせの瞬間の画面と、別タブ・戻る・bfcache の復元
- Backend: N/A: この phase（acceptance）の責務に Backend の変更は含まれない
- API: N/A: この phase（acceptance）の責務に API の変更は含まれない
- Data: N/A: この phase（acceptance）の責務に Data の変更は含まれない
- Infrastructure: N/A: この phase（acceptance）の責務に Infrastructure の変更は含まれない
- Security: N/A: この phase（acceptance）の責務に Security の変更は含まれない
- Quality: 対象。受入の判定
- Documentation: N/A: この phase（acceptance）の責務に Documentation の変更は含まれない
- Operations: N/A: この phase（acceptance）の責務に Operations の変更は含まれない

## Architecture and deploy unit

- Architecture decisions: arch-data-freshness（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）
- Deploy unit/environment: repository-eval-log（検証の記録だけ。配布の単位を持たない）

## Verification and evidence

- コマンド: pnpm db:migrate:local（0031・0032 が当たっていることを確かめる）
- コマンド: pnpm test（A0 の契約テストを含む）
- コマンド: pnpm check:docs（A8）
- コマンド: pnpm test:e2e（ローカルの preview だけを相手にする）
- 証跡: eval-log/feat-data-freshness-acceptance.json

## Rollout and rollback

- Rollout: 受入の記録なので、配布の手順は無い。
- Rollback: 受入が満たせない項目があれば、その項目に結び付く phase へ差し戻す。

## Tracker publication and completion intent

- Tracker binding: repo-config-default（このリポジトリの設定で beads に解決する）
- Beads: 親の epic は feat-data-freshness に結び付いた課題。起票と blocks の依存は bd-bridge の投影だけが行う
- Completion intent: linked_pr_merged_all。PR がすべてマージされたら done を書く

## 参照情報

- 実行仕様（promote 済み）: .dev-graph/plans/feature-package-feat-data-freshness/task-specs/phase-07-acceptance.md
- Feature: features/feat-data-freshness.md
- Architecture: architecture/data-freshness.md
- Specification: specs/data-freshness.md

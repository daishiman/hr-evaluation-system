---
graph_node_id: "task-docs-briefing"
artifact_kind: "task"
artifact_subtypes: []
title: "打ち合わせ資料の説明・保守手順を整えて最終レビューする"
project_id: "hr-evaluation-system"
domain: "documentation"
status: "draft"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: []
file_path: "tasks/docs-briefing.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest": null, "evaluator": null, "evidence_ref": null}
source_lineage: {"imported_at": null, "origin_kind": "manual", "source_digest": null, "source_path": null, "source_plugin": null, "source_version": null}
created_at: "2026-10-29T07:30:24.359868Z"
updated_at: "2026-10-29T11:48:39.797649Z"
depends_on: []
related_nodes: []
resource_scope: ["打ち合わせ資料/", "docs/", "features/", "specs/", "tasks/", "system-spec/index.md", "architecture/index.md", "README.md", "package.json", "pnpm-lock.yaml", "scripts/runtime-version-contract.test.mjs"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 0.98
classification_reason: "既存派生資料の最終レビューと提出を行う単一の作業であるため。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/docs-briefing.md", "confidence": 0.98}, {"artifact_kind": "document", "candidate_path": "docs/docs-briefing.md", "confidence": 0.02}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-29T11:48:39.797649Z", "missing_sections": [], "status": "complete"}
---

# 目的

既存アプリの47画面と業務の仕組みを、99図解と単一HTMLの説明書で確認できるようにし、最終レビュー後にdraft PRを提出する。Beads: hr-pq7。

## 背景

画面一覧だけでなく、評価作成の起点・設定変更の反映範囲・例外・復旧を説明する。機能定義は features/meeting-briefing-documents.md、仕様影響は specs/meeting-briefing-documents.md を参照。

## 入力と前提条件

- 入力: 63ae2ccを基準とする30da196と作業中の資料差分。
- 前提: 派生資料であり、既存製品仕様・system-spec・実装を優先する。画面内の人物と値は見本。

## 出力と成果物

- 生成物: 打ち合わせ資料/ の原稿・99HTML/PNG/WebP・単一HTML・検査記録。
- 更新対象: README、docs/reviews、features、specs、tasks、system-spec/index.md、architecture/index.md、仕様反映受領書。

## 依存関係

- depends_on: なし（独立した文書タスク）。
- ブロッカー: なし。mainの63ae2ccを取り込み済み。

## 実装対象

- Frontend: 資料用HTML/CSSと冊子のみ。
- Backend/API・Database/Data・Infrastructure: 対象外。資料の説明整理で実行時の契約は変えない。
- Security/Privacy: 見本だけを掲載し、秘密・実データ・端末用記録をコミットしない。
- Documentation: 原稿・生成物・更新経路と追跡文書を同期する。
- CI監査への追補: better-authの下限^1.7.7、lock1.7.14へ更新。認証の設定・契約・DBは変えない。

## Write scope と競合制約

- touches: package.json、pnpm-lock.yaml、scripts/runtime-version-contract.test.mjs、打ち合わせ資料/、README.md、features/meeting-briefing-documents.md、specs/meeting-briefing-documents.md、tasks/docs-briefing.md、docs/reviews/elegant-review-2026-10-29-documents.md、docs/product/spec-receipts/2026-10-29-meeting-briefing-documents.md、features/README.md、system-spec/index.md、architecture/index.md。
- 排他資源: 打ち合わせ資料の生成物。同時生成しない。
- branch: devgraph/task-docs-briefing。
- worktree: 現在のドキュメント作業場所。
- completion projection: draft PR中はBeadsをin_progressとし、マージ後に完了確認する。

## GitHub publication

- Mode: local_only（IssueはBeadsで管理）。
- PR: main向けdraft、本文にBeads hr-pq7とdev-graph: task-docs-briefingを記載。
- Completion policy: マージ後に手動確認。マージせず閉じた場合は作業中のまま。

## 実行手順

1. statusとmainからの差分を確認し、無関係な差分を除外する。
2. 文章を正本・実装に照合し、文書と生成物を検査する。
3. 仕様影響を受領書へ記録し、Beadsを更新する。
4. origin/mainをローカルmainへマージし、そのmainを作業ブランチへマージする。
5. 対象限定コミット・push・draft PRを作成する。

## 受入条件

- [x] 文書検査errors=0、既存3種の警告には理由がある。
- [x] 全99ボード検査errors/warnings=0。
- [x] 冊子102ページ・99画像、古い画像/外部参照/リンク欠落/埋込画像不一致=0。
- [x] 明示素材参照が全件実在し、資料と正本の意味を照合した。
- [x] docs driftと空白検査が成功し、仕様反映受領書とBeads更新がある。
- [x] 正しいmainを統合し、対象ファイルだけをcommit/pushしてdraft PRを作成する。

## 検証方法

資料部分の最終レビューは文書ゲートを使う。CI監査への追補は認証・セッション関連の8ファイル135テスト、型・Workersビルド・依存監査を実施し、全量coverageはリモートCIで確認する。

- 自動検証: `node "$PLUGIN_ROOT/scripts/validate-briefing-docs.mjs" --dir 打ち合わせ資料 --stage all`、`node "$PLUGIN_ROOT/scripts/render-board-png.mjs" --dir 打ち合わせ資料 --jobs 1 --check-only --quiet`、`node "$PLUGIN_ROOT/scripts/build-briefing-book.mjs" --dir 打ち合わせ資料`。PLUGIN_ROOTは資料READMEに従いsystem-briefing-book 0.2.10の実体へ解決する。
- 自動検証: `node scripts/check-docs-drift.mjs`、`git diff --check`、素材参照と冊子の埋込画像・内部リンクの照合。
- 手動検証: 変更した文章を正本・実装に照合し、代表図解と冊子の表示を確認する。
- 証跡: docs/product/spec-receipts/2026-10-29-meeting-briefing-documents.md。生ログはeval-log/documents-final-review/。

## リスクとロールバック

- リスク: 手動管理の派生資料が正本に追従しなくなる。資料READMEへ比較元・再生成方法を明記する。
- ロールバック: 資料と追跡文書のコミットをrevertする。アプリ・DBへの移行はない。

## Handoff

- 実装route: human（本セッションで資料整理と最終レビューを実施）。
- 次の作業: draft PRのレビューとマージ後の追跡完了。未決の運用Q01〜Q08は資料作成だけで確定しない。

## 最終レビュー実測（2026-10-29）

文書errors=0、全99件の配置errors/warnings=0、冊子102ページ/99画像・古い画像/外部参照0。依存322パス・素材参照159パス・埋込画像99件が一致。ブラウザのJavaScript無効/有効、docs drift、空白検査が成功。受領書: docs/product/spec-receipts/2026-10-29-meeting-briefing-documents.md。資料整理コミット91ffe8cをorigin/devgraph/task-docs-briefingへpushし、main向けdraft PR #104（https://github.com/daishiman/hr-evaluation-system/pull/104）を作成した。Beads hr-pq7はin_progressを維持し、レビュー・マージ後に完了確認する。

## CI監査への追補（2026-10-29）

Security audit 40836877220はbetter-auth 1.6.26のcritical 1/high 2で失敗。下限^1.7.7・lock1.7.14へ更新し、既存ランタイム契約テストに下限を追加した。更新前に当該1件の失敗、更新後に認証/セッション関連8ファイル135件、型、Workersビルド、docs/security、依存監査high/critical=0を確認。通常CIの全量coverageと監査の再実行結果を待つ。詳細と残るmoderateは仕様反映受領書の追補を参照。

---
graph_node_id: "feature-improvement-requests-2026-10"
artifact_kind: "feature"
artifact_subtypes: []
title: "等級名の統一・権限一覧・一覧の等級と点数・複数の会社への所属・提出状況・設定不足のリンク・改名・並べ替え・選択肢・余白をまとめて直す"
project_id: "hr-evaluation-system"
domain: "frontend"
status: "draft"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["改善要望対応", "2026-10-13"]
file_path: "features/improvement-requests-2026-10.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest": null, "evaluator": null, "evidence_ref": null}
source_lineage: {"imported_at": null, "origin_kind": "generated", "source_digest": null, "source_path": null, "source_plugin": "dev-graph", "source_version": null}
created_at: "2026-10-13T05:14:08.263424Z"
updated_at: "2026-10-13T05:14:08.263424Z"
depends_on: []
related_nodes: ["spec-system-spec-requirements"]
resource_scope: []
purpose: "等級の呼び名・役割ごとにできること・各人の等級と確定済みの評価・アンケートの提出状況・設定の不足を、どの画面でも同じ言葉で、見てよい人にだけ示し、並べ替え・選択・配置の使いにくさを取り除く（G6〜G15、U5）"
goal: "等級名を『等級4-1』の形に変えると行動指針・評価セット・昇格の要件・警告・アンケートのタイトル・ボタンのすべてがその名前で出て、権限一覧のページとモーダル、一覧の等級と点数、2社目への所属、提出状況の一覧、リンク付きの設定不足の表示、『Claude Code連携（システム開発者専用）』への改名、長押しドラッグでの並べ替え、押せる選択肢、右側の余白の解消がそろっている"
scope_in: ["等級の呼び名を作る共通の関数を置いて全表示をそこから作り、既定の等級名を『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』にする（FR-004、I7）", "既存の会社の等級名と、行動指針の区分名など等級名を含む表示名を、D1 のマイグレーション（0033 以降）で一律に書き換え、英語の区分名を残さない（FR-004、I7）", "等級名を変えられる役割を全体管理者と会社の管理者に限り、画面とサーバー処理の両方で判定する（FR-005、I8）", "route-ledger.json の各ページに accessClass・ページ名・主な操作・役割ごとの可否・説明を置き、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の判定・権限一覧がこの台帳だけを読む（D-007）", "システム管理のサイドバーに権限一覧のページを足し、利用者一覧のトグルで開くモーダルと同じ部品で、表・役割のタブ・スマホのカードと、ポインター・フォーカス・タップで出る説明を見せる（D-006、I9）", "3つの一覧に今の等級と確定済みの最新評価点を出し、マネージャー・会社の管理者・全体管理者以外には画面にも応答にも含めない（FR-005）", "所属の表と cookie で選ぶ会社の切り替えで、1つのアカウントが複数の会社に所属でき、既存の利用者には今の値どおりの所属を作る（D-004）", "アンケートの一覧と結果一覧に、対象者全員の提出済み・未提出がわかる提出状況の一覧を足す（FR-005）", "設定不足の表示（#8・#13）を『何が足りない・どう直す・直す画面へのリンク』の簡潔な形にする（FR-005）", "『Claude Code連携の鍵』の画面名を『Claude Code連携（システム開発者専用）』に変える（FR-005）", "全ての並べ替えに、Pointer Events で自作する長押しドラッグとキーボード操作の共通部品を入れ、並び順を全体で保存する（D-005）", "アンケートの入力と結果で選択肢を押しても選べない不具合を直し、選択肢の値の重複を拒否する（FR-005）", "右側の余白が目立つ画面（#14）の配置を見直す（FR-005）", "Next.js を 16.3.8 へ上げ、ルート台帳を権限一覧のページを足した47画面にする（互換性・移行・リリース）"]
scope_out: ["別の利用者が開いている画面への即時配信（WebSocket 等の push）", "オフライン編集と同期", "配色・テーマの変更（AGENTS.md と DD-003）", "等級名の一律の書き換えと所属の作成を除く本番データの移行・修正", "役割の種類の追加（『システム開発者』の役割は作らない）", "等級名の変更権限を除く役割ごとの権限の中身の変更", "保存結果の鮮度の保証（G1〜G5）の作り直し（feat-data-freshness で実装済み）"]
acceptance: ["等級名を変える結合テストで全表示が新しい名前になり、英語の区分名の静的検査が0件である（O6）", "等級名の変更は、全体管理者と会社の管理者以外では画面とサーバーの両方が拒否する（O7）", "ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストが通る（O8）", "権限一覧の表とカードが同じ内容を出し、説明がポインター・フォーカス・タップのどれでも出る", "評価確定の直後に3つの一覧へ最新の点数が出て、一般の社員の応答には等級と点数が含まれない", "2社目への所属ができ、所属していない会社への切り替えと操作は拒否される", "提出状況の一覧に対象者全員が提出済み・未提出つきで出る", "設定不足の全件に、何が足りないか・どう直すかと直す画面へのリンクがある", "画面名が『Claude Code連携（システム開発者専用）』になっている", "並べ替えはポインター・タッチ・キーボードの3操作で同じ結果になり、全体保存の競合は 409 を返す", "選択肢を押すと選べ、選択肢の値の重複は拒否される", "4つの幅の撮影で右側だけが空く画面が無い", "pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ"]
architecture_refs: ["arch-system-spec-database", "arch-system-spec-auth", "arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-security", "arch-system-spec-backend", "arch-system-spec-infrastructure", "arch-system-spec-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "declared by the C14 macro contract (run-dev-graph-decompose)"
classification_candidates: [{"artifact_kind": "feature", "candidate_path": "features/improvement-requests-2026-10.md", "confidence": 1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-13T05:14:08.263424Z", "missing_sections": [], "status": "complete"}
---

# 目的

等級の呼び名・役割ごとにできること・各人の等級と確定済みの評価・アンケートの提出状況・設定の不足を、どの画面でも同じ言葉で、見てよい人にだけ示し、並べ替え・選択・配置の使いにくさを取り除く（G6〜G15、U5）

## 到達状態

等級名を『等級4-1』の形に変えると行動指針・評価セット・昇格の要件・警告・アンケートのタイトル・ボタンのすべてがその名前で出て、権限一覧のページとモーダル、一覧の等級と点数、2社目への所属、提出状況の一覧、リンク付きの設定不足の表示、『Claude Code連携（システム開発者専用）』への改名、長押しドラッグでの並べ替え、押せる選択肢、右側の余白の解消がそろっている

## スコープ

- スコープ内: 等級の呼び名を作る共通の関数を置いて全表示をそこから作り、既定の等級名を『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』にする（FR-004、I7）
- スコープ内: 既存の会社の等級名と、行動指針の区分名など等級名を含む表示名を、D1 のマイグレーション（0033 以降）で一律に書き換え、英語の区分名を残さない（FR-004、I7）
- スコープ内: 等級名を変えられる役割を全体管理者と会社の管理者に限り、画面とサーバー処理の両方で判定する（FR-005、I8）
- スコープ内: route-ledger.json の各ページに accessClass・ページ名・主な操作・役割ごとの可否・説明を置き、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の判定・権限一覧がこの台帳だけを読む（D-007）
- スコープ内: システム管理のサイドバーに権限一覧のページを足し、利用者一覧のトグルで開くモーダルと同じ部品で、表・役割のタブ・スマホのカードと、ポインター・フォーカス・タップで出る説明を見せる（D-006、I9）
- スコープ内: 3つの一覧に今の等級と確定済みの最新評価点を出し、マネージャー・会社の管理者・全体管理者以外には画面にも応答にも含めない（FR-005）
- スコープ内: 所属の表と cookie で選ぶ会社の切り替えで、1つのアカウントが複数の会社に所属でき、既存の利用者には今の値どおりの所属を作る（D-004）
- スコープ内: アンケートの一覧と結果一覧に、対象者全員の提出済み・未提出がわかる提出状況の一覧を足す（FR-005）
- スコープ内: 設定不足の表示（#8・#13）を『何が足りない・どう直す・直す画面へのリンク』の簡潔な形にする（FR-005）
- スコープ内: 『Claude Code連携の鍵』の画面名を『Claude Code連携（システム開発者専用）』に変える（FR-005）
- スコープ内: 全ての並べ替えに、Pointer Events で自作する長押しドラッグとキーボード操作の共通部品を入れ、並び順を全体で保存する（D-005）
- スコープ内: アンケートの入力と結果で選択肢を押しても選べない不具合を直し、選択肢の値の重複を拒否する（FR-005）
- スコープ内: 右側の余白が目立つ画面（#14）の配置を見直す（FR-005）
- スコープ内: Next.js を 16.3.8 へ上げ、ルート台帳を権限一覧のページを足した47画面にする（互換性・移行・リリース）
- スコープ外: 別の利用者が開いている画面への即時配信（WebSocket 等の push）
- スコープ外: オフライン編集と同期
- スコープ外: 配色・テーマの変更（AGENTS.md と DD-003）
- スコープ外: 等級名の一律の書き換えと所属の作成を除く本番データの移行・修正
- スコープ外: 役割の種類の追加（『システム開発者』の役割は作らない）
- スコープ外: 等級名の変更権限を除く役割ごとの権限の中身の変更
- スコープ外: 保存結果の鮮度の保証（G1〜G5）の作り直し（feat-data-freshness で実装済み）

## 受入

- [ ] 等級名を変える結合テストで全表示が新しい名前になり、英語の区分名の静的検査が0件である（O6）
- [ ] 等級名の変更は、全体管理者と会社の管理者以外では画面とサーバーの両方が拒否する（O7）
- [ ] ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストが通る（O8）
- [ ] 権限一覧の表とカードが同じ内容を出し、説明がポインター・フォーカス・タップのどれでも出る
- [ ] 評価確定の直後に3つの一覧へ最新の点数が出て、一般の社員の応答には等級と点数が含まれない
- [ ] 2社目への所属ができ、所属していない会社への切り替えと操作は拒否される
- [ ] 提出状況の一覧に対象者全員が提出済み・未提出つきで出る
- [ ] 設定不足の全件に、何が足りないか・どう直すかと直す画面へのリンクがある
- [ ] 画面名が『Claude Code連携（システム開発者専用）』になっている
- [ ] 並べ替えはポインター・タッチ・キーボードの3操作で同じ結果になり、全体保存の競合は 409 を返す
- [ ] 選択肢を押すと選べ、選択肢の値の重複は拒否される
- [ ] 4つの幅の撮影で右側だけが空く画面が無い
- [ ] pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ

## 追加要望（2026-10-14、PR #94）

上のスコープと受入は変えない。#93 を本番へ配布したあとに受けた3件を、同じ feature の task（P04・P05・P07・P12）の中で扱う。状態と残りの作業は [タスクの状態](../tasks/improvement-requests-2026-10.md)、受領は [追加要望の受領書](../docs/product/spec-receipts/2026-10-14-improvement-requests-additional.md) を正本にする。

- 追加A: 並べ替えの行の段組みと、持ち上げて動かす操作（製品仕様 §28-11）
- 追加B: 人の一覧の検索と並べ替え。選べる並べ替えは権限で決める（§28-13・DD-011）
- 追加C: 行動指針の基準セットは、等級の並びで続いた等級にだけ出す（§28-12・DD-010）。本番の直しは管理者の1手で、配布のあと

## アーキテクチャ参照

- `arch-system-spec-database`
- `arch-system-spec-auth`
- `arch-system-spec-ui-ux`
- `arch-system-spec-frontend`
- `arch-system-spec-security`
- `arch-system-spec-backend`
- `arch-system-spec-infrastructure`
- `arch-system-spec-maintenance-ops`

## 機能間依存

- 先行 feature なし (`depends_on` は空)

## Handoff

- per-feature planning: ready 時に run-system-dev-plan を自動起動するか、手動 `/system-dev-plan` の結果を同じ登録経路で受理する
- 生成物: P01..P13 の exact 13 executable task specs と 13-node intra-feature DAG
- 登録先: `register-package.py register` が parent_feature=`feature-improvement-requests-2026-10` で 13 件を atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 全 done かつ P07/P10/P11 の evidence が受入を満たす場合だけ done


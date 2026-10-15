---
graph_node_id: "feature-comparison-gap-two-page-links"
artifact_kind: "feature"
artifact_subtypes: []
title: "比べる警告（評価項目とアンケートのズレ）に、比べている両方のページの階層つきの名前とリンクを付け、既定は1行・押すとその場で表で開く形にする"
project_id: "hr-evaluation-system"
domain: "frontend"
status: "draft"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["改善要望対応", "2026-10-15", "比べる警告"]
file_path: "features/comparison-gap-two-page-links.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest": null, "evaluator": null, "evidence_ref": null}
source_lineage: {"imported_at": null, "origin_kind": "generated", "source_digest": null, "source_path": null, "source_plugin": "dev-graph", "source_version": null}
created_at: "2026-10-15T01:35:55.901986Z"
updated_at: "2026-10-15T01:35:55.901986Z"
depends_on: []
related_nodes: ["spec-system-spec-requirements"]
resource_scope: []
purpose: "評価項目とアンケートのズレの警告から、どのページとどのページが食い違っているかを階層つきのページ名で見て、どちらのページへも1回の操作で移り、直すところを表で確かめて直せるようにする（G16、U2・U5）"
goal: "アンケートの一覧・アンケート1本・使うKPIを選ぶの3画面で、ズレの警告が既定は『評価項目とのズレ ◯件（足りない◯・余分◯）』と『直すところを見る』の1行で出て、押すとその場で『下記の内容を変更・修正してください』・比べている2つのページの階層つきのリンク2行・項目ごとの ○ と — の表・直す操作のボタン1つが開き、公開後のズレはその等級だけ新しい版の下書きで直せる（O16、I17）"
scope_in: ["ComparisonGap 型を足し、比べている2つのページの階層つきの名前と href、項目ごとの有無を必須にして、formSyncGaps をこの型で返す形に改める（backend (11)、I17）", "ページ名はルート台帳の親の画面名と見出しをつないで作り（pointGroupLabel＋stepTitle(\"select\")、formRowTitle）、リンクは schemeStepPath とアンケートの道筋で作る（backend (11)）", "アンケート1本ぶんのズレを読む処理と、使うKPIを選ぶの画面のために、その区分の等級に当たり受付前か受付中の評価期間にある下書きか公開中のアンケートのズレを、会社の範囲で一度に読む処理（同じ評価期間・等級のより新しい下書きの有無を含む）を足す（backend (11)）", "比べる警告の部品 ComparisonGapNotice を1つ作って3画面はこれだけを使い、開閉は既存の InlineDetail、ボタンは ActionButton で作り、画面ごとに <details> を書かない（frontend (8)）", "既定は注意の印・『評価項目とのズレ ◯件（足りない◯・余分◯）』・『直すところを見る』の1行だけを出し、押すとその場で開き（窓は使わない）、開閉の状態は覚えない（ui-ux (13)、frontend (8)）", "アンケート側の2画面で開いた中は、①『下記の内容を変更・修正してください』②2つのページのリンク2行（いま開いているページに『（このページ）』）③項目／使うKPIを選ぶ／このアンケートの表 ④ボタン1つ ⑤公開後か回答ありのときだけの注記1行の順にし、説明の段落は置かない（ui-ux (13)）", "使うKPIを選ぶの画面で開いた中は、ズレているアンケートごとに1行の表（アンケート（リンク）・聞いていない項目・余分に聞いている項目）にする（ui-ux (13)）", "直す操作は、下書きで回答0件なら『設問を作り直す』、それ以外は『この等級だけ新しい版の下書きを作る』とし、同じ評価期間・等級により新しい下書きがあればボタンの代わりにその下書きへのリンクを出し、新しい版は既存の createForms に gradeIds を1件渡して作る（ui-ux (13)、backend (11)）", "表は table 要素で th に scope を付け、○ と — に『ある』『ない』の読み上げの文字を添え、4つの幅で同じ振る舞いにして、狭い幅では表を横に流せる枠に入れる（frontend (8)、ui-ux (13)）", "警告のリンク先はルート台帳にあり見る人の役割で開けるページに限り、ズレを読む処理は会社の範囲で絞って他社の名前を含めず、他社の区分を指す URL は今どおり notFound にする（security (8)）", "createForms は役割の指定と送り元の確認を通し、自社のものでない gradeId が1件でもあれば何も作らずに拒否する（security (8)）", "テストを足す：全件が2つのページを持つ／『食い違』『ズレ』の警告が ComparisonGap 以外から作られていない／リンク先が台帳にあり役割で開ける／3画面で閉じた1行と開いた表が出る／新しい版はその等級の版だけが増える／他社の等級は拒否される（maintenance-ops (5)）", "setup-gaps・SetupGapList・一覧のテストの固定文字列を新しい形に合わせ、docs/product/spec.md §22 と system-spec の文書に反映し、受領書を docs/product/spec-receipts/ に残す（maintenance-ops (5)）"]
scope_out: ["比べる警告以外の設定不足の一覧（SetupGapList・公開前の不足など）の表示の形の変更（U7）", "公開後のアンケートの設問の差し替え（公開後のズレは新しい版の下書きで直す）", "新しい書き込みのサーバー処理の追加（新しい版は既存の createForms を使う）", "配色・テーマの変更（AGENTS.md と DD-003）", "所属の並び順と所属の追加（qa-w12・D-008・D-009）の実装の変更（別の follow-up）"]
acceptance: ["比べる警告を作る処理の全件が2つのページ（階層つきの名前とリンク）を持つことを確かめる契約テストで、欠落が0件である（O16）", "アンケートの一覧・アンケート1本・使うKPIを選ぶの3画面の画面のテストで、閉じた状態が1行・開くと2つのリンクと表が出る（O16）", "『食い違』『ズレ』を含む警告が ComparisonGap 以外から作られていないことを静的なテストが確かめる", "警告のリンク先がすべてルート台帳にあり、見る人の役割で開けることを契約テストが確かめ、ズレの応答に他社の名前が含まれない（security (8)）", "『この等級だけ新しい版の下書きを作る』でその等級の版だけが増え、自社のものでない gradeId を含む createForms は何も作らずに拒否される", "表の th に scope があり ○ と — に読み上げの文字が付き、4つの幅で同じ振る舞いで、狭い幅でも本文が横に流れない", "pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ"]
architecture_refs: ["arch-system-spec-ui-ux", "arch-system-spec-frontend", "arch-system-spec-backend", "arch-system-spec-security", "arch-system-spec-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "declared by the C14 macro contract (run-dev-graph-decompose)"
classification_candidates: [{"artifact_kind": "feature", "candidate_path": "features/comparison-gap-two-page-links.md", "confidence": 1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-15T01:35:55.901986Z", "missing_sections": [], "status": "complete"}
---

# 目的

評価項目とアンケートのズレの警告から、どのページとどのページが食い違っているかを階層つきのページ名で見て、どちらのページへも1回の操作で移り、直すところを表で確かめて直せるようにする（G16、U2・U5）

## 到達状態

アンケートの一覧・アンケート1本・使うKPIを選ぶの3画面で、ズレの警告が既定は『評価項目とのズレ ◯件（足りない◯・余分◯）』と『直すところを見る』の1行で出て、押すとその場で『下記の内容を変更・修正してください』・比べている2つのページの階層つきのリンク2行・項目ごとの ○ と — の表・直す操作のボタン1つが開き、公開後のズレはその等級だけ新しい版の下書きで直せる（O16、I17）

## スコープ

- スコープ内: ComparisonGap 型を足し、比べている2つのページの階層つきの名前と href、項目ごとの有無を必須にして、formSyncGaps をこの型で返す形に改める（backend (11)、I17）
- スコープ内: ページ名はルート台帳の親の画面名と見出しをつないで作り（pointGroupLabel＋stepTitle("select")、formRowTitle）、リンクは schemeStepPath とアンケートの道筋で作る（backend (11)）
- スコープ内: アンケート1本ぶんのズレを読む処理と、使うKPIを選ぶの画面のために、その区分の等級に当たり受付前か受付中の評価期間にある下書きか公開中のアンケートのズレを、会社の範囲で一度に読む処理（同じ評価期間・等級のより新しい下書きの有無を含む）を足す（backend (11)）
- スコープ内: 比べる警告の部品 ComparisonGapNotice を1つ作って3画面はこれだけを使い、開閉は既存の InlineDetail、ボタンは ActionButton で作り、画面ごとに <details> を書かない（frontend (8)）
- スコープ内: 既定は注意の印・『評価項目とのズレ ◯件（足りない◯・余分◯）』・『直すところを見る』の1行だけを出し、押すとその場で開き（窓は使わない）、開閉の状態は覚えない（ui-ux (13)、frontend (8)）
- スコープ内: アンケート側の2画面で開いた中は、①『下記の内容を変更・修正してください』②2つのページのリンク2行（いま開いているページに『（このページ）』）③項目／使うKPIを選ぶ／このアンケートの表 ④ボタン1つ ⑤公開後か回答ありのときだけの注記1行の順にし、説明の段落は置かない（ui-ux (13)）
- スコープ内: 使うKPIを選ぶの画面で開いた中は、ズレているアンケートごとに1行の表（アンケート（リンク）・聞いていない項目・余分に聞いている項目）にする（ui-ux (13)）
- スコープ内: 直す操作は、下書きで回答0件なら『設問を作り直す』、それ以外は『この等級だけ新しい版の下書きを作る』とし、同じ評価期間・等級により新しい下書きがあればボタンの代わりにその下書きへのリンクを出し、新しい版は既存の createForms に gradeIds を1件渡して作る（ui-ux (13)、backend (11)）
- スコープ内: 表は table 要素で th に scope を付け、○ と — に『ある』『ない』の読み上げの文字を添え、4つの幅で同じ振る舞いにして、狭い幅では表を横に流せる枠に入れる（frontend (8)、ui-ux (13)）
- スコープ内: 警告のリンク先はルート台帳にあり見る人の役割で開けるページに限り、ズレを読む処理は会社の範囲で絞って他社の名前を含めず、他社の区分を指す URL は今どおり notFound にする（security (8)）
- スコープ内: createForms は役割の指定と送り元の確認を通し、自社のものでない gradeId が1件でもあれば何も作らずに拒否する（security (8)）
- スコープ内: テストを足す：全件が2つのページを持つ／『食い違』『ズレ』の警告が ComparisonGap 以外から作られていない／リンク先が台帳にあり役割で開ける／3画面で閉じた1行と開いた表が出る／新しい版はその等級の版だけが増える／他社の等級は拒否される（maintenance-ops (5)）
- スコープ内: setup-gaps・SetupGapList・一覧のテストの固定文字列を新しい形に合わせ、docs/product/spec.md §22 と system-spec の文書に反映し、受領書を docs/product/spec-receipts/ に残す（maintenance-ops (5)）
- スコープ外: 比べる警告以外の設定不足の一覧（SetupGapList・公開前の不足など）の表示の形の変更（U7）
- スコープ外: 公開後のアンケートの設問の差し替え（公開後のズレは新しい版の下書きで直す）
- スコープ外: 新しい書き込みのサーバー処理の追加（新しい版は既存の createForms を使う）
- スコープ外: 配色・テーマの変更（AGENTS.md と DD-003）
- スコープ外: 所属の並び順と所属の追加（qa-w12・D-008・D-009）の実装の変更（別の follow-up）

## 受入

- [ ] 比べる警告を作る処理の全件が2つのページ（階層つきの名前とリンク）を持つことを確かめる契約テストで、欠落が0件である（O16）
- [ ] アンケートの一覧・アンケート1本・使うKPIを選ぶの3画面の画面のテストで、閉じた状態が1行・開くと2つのリンクと表が出る（O16）
- [ ] 『食い違』『ズレ』を含む警告が ComparisonGap 以外から作られていないことを静的なテストが確かめる
- [ ] 警告のリンク先がすべてルート台帳にあり、見る人の役割で開けることを契約テストが確かめ、ズレの応答に他社の名前が含まれない（security (8)）
- [ ] 『この等級だけ新しい版の下書きを作る』でその等級の版だけが増え、自社のものでない gradeId を含む createForms は何も作らずに拒否される
- [ ] 表の th に scope があり ○ と — に読み上げの文字が付き、4つの幅で同じ振る舞いで、狭い幅でも本文が横に流れない
- [ ] pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ

## アーキテクチャ参照

- `arch-system-spec-ui-ux`
- `arch-system-spec-frontend`
- `arch-system-spec-backend`
- `arch-system-spec-security`
- `arch-system-spec-maintenance-ops`

## 機能間依存

- 先行 feature なし (`depends_on` は空)

## Handoff

- per-feature planning: ready 時に run-system-dev-plan を自動起動するか、手動 `/system-dev-plan` の結果を同じ登録経路で受理する
- 生成物: P01..P13 の exact 13 executable task specs と 13-node intra-feature DAG
- 登録先: `register-package.py register` が parent_feature=`feature-comparison-gap-two-page-links` で 13 件を atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 全 done かつ P07/P10/P11 の evidence が受入を満たす場合だけ done


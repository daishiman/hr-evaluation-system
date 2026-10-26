---
graph_node_id: "arch-system-spec-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "保守運用の検査・文書・本番手順（評価レポート・上司の判断）と脆弱性の台帳・勧告への対応"
project_id: "hr-evaluation-system"
domain: "maintenance-ops"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応", "脆弱性対策"]
file_path: "architecture/system-spec-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "stale"
confirmation_evidence: {"evaluated_digest": "fb49eaa71e2639c4013ec1f7f97944307c83b93ebbfb868de7f03f0e3d93e8c0", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-report.json"}
source_lineage: {"imported_at": "2026-10-22T13:49:14Z", "origin_kind": "system-spec-harness", "source_digest": "fb49eaa71e2639c4013ec1f7f97944307c83b93ebbfb868de7f03f0e3d93e8c0", "source_path": "system-spec/maintenance-ops.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
created_at: "2026-10-22T13:57:45.864509Z"
updated_at: "2026-10-26T20:54:12.328854Z"
depends_on: []
related_nodes: []
resource_scope: []
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 0.92
classification_reason: "確定した技術章（system-spec の章）で、構成・境界・横断契約・決定を記す architecture の取込。"
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-maintenance-ops.md", "confidence": 0.92}, {"artifact_kind": "specification", "candidate_path": "specs/system-spec-maintenance-ops.md", "confidence": 0.4}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-26T20:54:12.328854Z", "missing_sections": [], "status": "complete"}
---

# Architecture overview

この章は、鮮度と原子性の契約と 2026-10-12 の追加要件の契約を、人の記憶ではなく検査・文書・手順で守る運用の設計である。pnpm test に3つの契約試験（server-actions-contract.test.ts・write-atomicity-contract.test.ts・action-origin.test.ts）を入れ、違反0件でなければ失敗にする。Playwright の E2E で6つの経路を確かめる。『反映されない』報告の切り分けと、compensation_failed・rollforward_failed の直し方を deploy-notes §7 に置く。追加要件では、ルート台帳に権限一覧のページを足し（46 画面 → 47 画面）、全てのページに主な操作・役割ごとの可否・説明の欄を足す（D-007 ①）。台帳の説明書き（$schemaNote）と、route-ledger.test.mjs の件数と新しい欄の検査も合わせる。『Claude Code 連携の鍵』を『Claude Code連携（システム開発者専用）』に改め、ルート台帳・サイドバー・画面名の定数・文書・テストで同じ名前にそろえる。決まりの文書と文字列を固定したテストを新しい形に合わせ、11 項目の検査を足す。その一つが、ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定の一致である。本番の等級名の一律の書き換えは、前に本番 DB を読み取りで数えて書き換え前の値を記録し、外部変更ガードを通して Deploy する。後に、英語の区分名が残っていないことを読み取りで確かめる。根拠: qa-v31（主）、qa-r-ops-3（旧主根拠）、qa-v25、D-007、system-spec/maintenance-ops.md。

2026-10-14 の追加で、比べる警告のテスト6種と、文書への反映・受領書の置き場所を定めた（O16）。この追加の全文は、利用者が全文のまま承認した（qa-w10、2026-10-14T20:46:24Z）。根拠: qa-w10／system-spec/maintenance-ops.md

2026-10-19〜20 の追加: KGI のテスト・文書・台帳の行・ナビの記述を消して参照が残らないことを検査で確かめ、レポート・見える範囲・評価セットの決め方・アンケートの状態の規則・ズレの3種類・上司の判断のテストと E2E を足す。アンケート・昇給の設定・評価セット・評価期間・評価・レポートのつながりを docs/product に図で残し、契約テストの一覧と対応させる。A4 の印刷は Playwright で PDF を作って確かめる。
根拠: qa-y16（system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビュー（SYS-EVAL-REPORT-P01）で見つかった食い違いを、DD-020〜DD-024（docs/product/design-decisions.md）と計画レビューの受領書に確定させ、spec-state への反映は P12 でまとめて行った。qa-y16 の答には訂正を足し、KGI の削除の2回の Deploy を、main へのマージで自動で本番に出る仕組みに合わせて読み替えた。見える範囲の契約テストは、レポートの判定の関数を使うのがレポートの画面だけであることを確かめる形にした。上位概念の G22・I20・I23・I25 と、O17・O19・O22 の文と測り方も、DD-020〜DD-024 に合わせて改めた。
根拠: qa-z03、qa-z05、qa-z06、qa-z07、qa-y16 の訂正、DD-020〜DD-024（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: 本章の serves_goals に G25・G27・G28 を足し、O25・O27・O28 の測り方をテスト・E2E・DD に割り付ける。行動指針の既定の割り当てへのデータの移行（I26）、設定とアンケートの両方向の反映と追従（I28・I29）、写しを持つ場所の一覧の文書（I30）、見本の会社の受付中の評価期間（I31）を、検査・文書・本番の手順で支える。DD-010・DD-015・DD-016 と製品仕様 §14 の決めは、改める DD を書いてから実装する。評価レポートの印刷は、A4 縦の初期の選択を保ち、A3 横を選んだら標準1枚にして、最終の実 PDF の証拠を受領書へ追記する。共通部品の色使い（G29）は既存のテーマの契約テストを書き換えずに通し、要件の土台への追記は appr-foundation-016〜020 で確定した。
根拠: qa-aa09-report-print-final-alignment、qa-ab13-foundation-016-approval、qa-ab15-foundation-017-approval、qa-ab16-foundation-018-approval、qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、G25、G27、G28、G29、appr-foundation-016〜020（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 事業所の達成率のテスト・文書・台帳の行・ナビの記述を消して参照が残らないことを検査で確かめ、レポート・見える範囲・評価セットの決め方・アンケートの状態の規則・ズレの3種類・上司の判断のテストと E2E を足す。アンケート・昇給の設定・評価セット・評価期間・評価・レポートのつながりを docs/product に図で残し、契約テストの一覧と対応させる。A4 の印刷は Playwright で PDF を作って確かめる。
2026-10-22 の追加: 監査の全指摘を docs/security/ の台帳で ID・深刻度・状態つきで追い、契約テストで確かめる。CI に pnpm audit を push・PR と週1回で置き（D-011）、Node 本体の勧告は nodejs-sec とブログで受けて台帳に日付と結果を書く。critical と high は48時間で対応する。漏えいの恐れの後の手順書を docs/security/ に置き、ローカルで確かめる（G31・G32・G38）。
根拠: qa-ac07 (16)(17)(19)、G31・G32・G38（system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md）

## Context and drivers

もともとの検証は pnpm test（vitest）・check:docs・check:bundle-size に限られ、ブラウザを自動操作する E2E は無かった。本番の調べ方は、Workers Logs と読み取り専用の D1 照会だけだった（qa-f09）。強制再読み込みでも出なかった報告（qa-u03）を推測で閉じないため、観測の順序を手順として持つ必要があった（qa-f08）。追加要件は、文書・画面名・権限・文字列に広く触れる。権限の定義はルート台帳に足すので（D-007 ①）、台帳の説明書きと検査も変わる。そのため、文字列を固定したテストや文書が新しい形とぶつかる。本番の等級名の書き換えは、戻せる証跡を要する。品質の優先は、規則を検査で落とすこと（G4）、本番を手で書き換えないこと、文書と実装を食い違わせないことである。制約は四つある。本番 DB は読み取り専用。外部への変更は preview → CONFIRM → authorize → execute のガードを通す。PR は実装後に利用者の確認を取ってから作る。公開リポジトリのため、文書や見本に実データを入れない。根拠: qa-v31、qa-r-ops-3、qa-f09、qa-f08、D-007、constraints、system-spec/maintenance-ops.md。

2026-10-19〜20 の追加: 2026-10-19 の依頼（KGI の削除・評価レポート・見える範囲・テストデータ・アンケートの全機能の監査・依存関係の整理）と qa-x08・qa-y08 の A4 の印刷、2026-10-20 の上司の判断で、検査・文書・本番の手順を足す必要が生じた。
根拠: qa-x01、qa-x08、qa-y01、qa-y08、qa-y16（system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビューで、節番号が2系統あること・canViewEvaluationOf と既存の関数の関係・DD-012 を改めたこと・Deploy の手順などの食い違いが見つかった。計画は「P13 で手動で2回公開する」だったが、main にマージすると自動で本番に出る仕組みと合わなかった。本番に今ある権限の漏れも2件見つかった。上司が書く昇給・昇格の理由は本人にも同じ文で見せるので、点数などが本人へ漏れるのを防ぐ必要が生じた。
根拠: qa-z03（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: 2026-10-21 の依頼で、評価レポートを A3 なら1枚・A4 なら切りのいい所で分けて URL を入れずに出すこと、キーごとの点数と等級の推移がすぐ分かること、黒い縦線の意味、待機が長くて次へ進めないこと（場面は印刷の準備と仮定した）が挙がった。調べると、行動指針の既定の分け方は data/grades.json・drizzle/seed.sql・DEFAULT_BAND_SETS の3か所にあり、新しい会社はテンプレート会社を写すだけで、既定からずれた会社を当て直す処理は無かった。設定とアンケートは「制度が正・アンケートは写し」で、アンケートから設定へ戻す経路は無く、配布済みのアンケートは追従しなかった。本番の見本の会社は5期すべて締め済みで、「提出済みの回答から評価を作る」を試せる受付中の期が無かった。
根拠: qa-aa03-report-paper-user-revision、qa-aa05-report-score-grade-request、qa-aa07-report-threshold-marker-audit、qa-aa10-report-print-background-preparation、qa-ab02-behavior-band-default-observed、qa-ab04-setting-copy-propagation-observed、qa-ab05-evaluation-build-showcase-observed（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 2026-10-19 の依頼（事業所の達成率の削除・評価レポート・見える範囲・テストデータ・アンケートの全機能の監査・依存関係の整理）と qa-x08・qa-y08 の A4 の印刷、2026-10-20 の上司の判断で、検査・文書・本番の手順を足す必要が生じた。
2026-10-22 の追加: 依頼（qa-ac01）を受け、監査の結果を台帳で追い、同じ型の欠陥を静的検査で落とす運用を足す。
根拠: qa-ac01、qa-ac07 (19)(20)（system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md）

## Goals and non-goals

ゴールは maintenance-ops 章の serves_goals の G2・G4（鮮度の保証と適用漏れの検出）と、G6〜G15 を検査と文書で裏付けることである。受入は O2・O4・O6〜O15 の測り方（静的検査で0件、役割ごとの結合テスト、375・768・1280・1600 の4つの幅での撮影など）を、pnpm test・pnpm test:e2e・pnpm run check:docs と本番の読み取り確認に割り付けて判定する。domain のカバレッジ 100% を保つ。非ゴールは、エージェントによる本番への書き込み、本番データの移行・修正（等級名と等級名を含む表示名の一律の書き換えを除く）、役割の種類の追加（『システム開発者』の役割は作らず、画面名だけを変える）である。根拠: qa-v31 (3)(4)、qa-r-ops-3、scope.out、system-spec/maintenance-ops.md（To-Be / Delta）。

2026-10-19〜20 の追加: Goals: KGI の参照0件、O17〜O24 の測り方をテストと E2E で満たす、依存関係の図とテストの一覧を一致させる。Non-goals: 本番へのテストデータの投入。
根拠: qa-y16（system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: O19 の目標を、役割ごとにレポート・評価の中身・上司の判断・CSV・メモの見える範囲をサーバーで絞り、上司の判断は評価の詳細と同じ範囲で見せて見える人を増やさない形にした。Non-goals: 自分を評価する側にも立つ人が自分について見られる情報は、この目標の外に置き、SECURITY-013 で決める。G22 は、新しい版が下書きの間は回答を集めている古い版の警告を消さず、今の設定と一致した新しい版を公開して古い版が締め切られたら出さない、という条件にした。その警告には「第N版の下書きを開く」を添え、公開すれば古い版が締め切られる旨の注記は、その下書きが今の設定と一致しているときだけ添える（I23）。
根拠: qa-z05、qa-z06、qa-z07、DD-021、DD-022、DD-024（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: Goals: G25（行動指針の既定の分け方を、新しい会社と既定からずれた会社の両方で成り立たせる）、G27（後から変えた方を正として追従し、確定した評価とレポートは確定した時点のまま残す）、G28（手元と本番の見本の会社で評価を作る画面を試せる）を、O25・O27・O28 のテストと E2E で満たす。要件の土台には G26（行動指針と KPI・評価セットの画面の認知の負荷）と O26・I27、ボタン以外へ広げた G29 と O29・I32、I33 も確定し、画面の組み替えは I27 の2画面と評価を作る画面に限る。Non-goals: 本番 DB へのテストデータ（手元の seed と E2E のデータ）の投入。本番の見本の会社への仮のデータ（G28・I31）はこれに含めない。本番データの移行・修正の除外には、行動指針の既定の割り当てへの書き換え（I26）と、行を書き換える移行 0032・0033・0034・0035・0036・0039 を挙げる。
根拠: qa-ab13-foundation-016-approval、qa-ab15-foundation-017-approval、qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、G25、G26、G27、G28、G29、appr-foundation-016、appr-foundation-017、appr-foundation-019、appr-foundation-020（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: Goals: 事業所の達成率の参照0件、O17〜O24 の測り方をテストと E2E で満たす、依存関係の図とテストの一覧を一致させる。Non-goals: 本番へのテストデータの投入。
2026-10-22 の追加: Goals: high 以上の未対応を0件にする（O32）。台帳の全行が状態と根拠を持つ（O38）。Non-goals: 修正の PR を自動で作ること（D-011。人が作る）、本番での秘密の交換などの実行（利用者）。
根拠: qa-ab03、qa-ac07 (16)(17)(19)、O32・O38（system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md）

## System context and boundaries

運用の担い手は、リポジトリで実装と検査を回す開発者とエージェント、本番で操作する利用者である。エージェントは本番に書き込まない（反映の確認に使う作成も、利用者のふだんの操作で行う）。E2E はローカルの preview だけに向け、ローカル以外へ向かないよう LOCAL_HOSTS で止める。本番との境界は、読み取りだけの D1 照会・Workers Logs・応答の生成時刻ヘッダー・ゾーンのキャッシュ規則の確認である。変更は GitHub Actions の Deploy と外部変更ガードを通す。文書の境界は README の文書の入口である。決まりの正本（docs/product/spec.md・system-spec/ の各文書）と反映の受領書（docs/product/spec-receipts/）を、そこから辿る。根拠: qa-r-ops-3 (2)(3)(4)、qa-v31 (2)(4)、O2、system-spec/maintenance-ops.md。

2026-10-21〜22 の追加: 手元の seed は scripts/seed-target.mjs が --remote を断るので本番へ向かない。本番の見本の会社（scripts/sample-data.mjs の cmp_sample）への仮のデータは、既存の db:sample:remote の手順で、実行の前に利用者の確認を取って入れ、見本の会社に紐づく行だけを INSERT する（I31）。評価レポートの印刷では、ブラウザ自身のヘッダーとフッターを全ての環境で強制できないので、残るときは印刷設定でオフにする案内を出す。印刷のダイアログ自身は背景で動かさず、準備が済んだ後に利用者が明示して押したときだけ開く。
根拠: qa-ab05-evaluation-build-showcase-observed、qa-ab12-showcase-data-location、qa-aa04-report-landscape-onepage-design、qa-aa09-report-print-final-alignment、qa-aa10-report-print-background-preparation、G28（system-spec/maintenance-ops.md）

2026-10-22 の追加: 運用の担当は、Node 本体の勧告を nodejs-sec とブログの通知で受ける。npm の依存は CI の pnpm audit が知らせる。
根拠: qa-ac02、qa-ac07 (17)（system-spec/maintenance-ops.md）

## Container and component view

検査の層は四つある。pnpm test（vitest。3つの契約試験、ルート台帳の route-ledger.test.mjs（件数と新しい欄の検査）、nav.test.ts、ui-rules.test.ts、agent-keys.test.ts、improvement-ux-contracts.test.ts など。追加の11項目の検査もここに足す）。pnpm test:e2e（Playwright。6つの経路と控えの畳み方、375px・768px）。pnpm run check:docs（文書のずれ・リンク切れ）。check:bundle-size。どれも違反0件でなければ失敗にする。文書の層は、deploy-notes（§6 secret の置き方、§7 反映されない報告の切り分けと失敗記録からの直し方）、ルート台帳（46 → 47 画面。全ページに主な操作・役割ごとの可否・説明の欄を持ち、権限の定義をまとめる唯一の台帳。D-007 ①）、決まりの文書（docs/product/spec.md・system-spec/account-and-users.md・routes-and-access.md・master-settings.md）、反映の受領書 docs/product/spec-receipts/ である。観測の層は、応答の生成時刻ヘッダー x-generated-at、Workers Logs、ゾーンのキャッシュ規則の読み取り確認、本番 DB の読み取り専用の照会である。根拠: qa-r-ops-3 (1)〜(4)、qa-v31 (1)(2)(3)、D-007、qa-f09、system-spec/maintenance-ops.md。

2026-10-19〜20 の追加: 単体テスト：レポートの作成（同じ入力で同じ出力・軸の数・3人未満で平均を出さない・本人向けに点数が無い）、見える範囲（役割と直属の部下の組ごと）、評価セットの決め方が4つの処理で同じ、アンケートの状態の規則と会社の条件、ズレの3種類と行ごとのリンク、finalDecision の5通り、確定の入力の検査、確定を戻しても判断が残ること、CSV の列、全ての表示先が finalDecision を使うことの契約テスト。E2E：レポート（管理者・マネージャー・本人）、配布 URL（ログイン前・等級違い・締切後・古い版）、回答・回答一覧・締め切る・延長、ズレの『直すところを見る』の各リンク、マネージャーが『変える』で見送って確定し本人の結果とレポートに結論・印・同じ理由が出て点数の数値が出ないこと。
根拠: qa-y16（system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: 契約テストをファイルで名指しした。最終の可否（finalDecision）と評価セットの決め方（resolveSchemeForCycle）は、使う側の全てがその関数だけを使うことを final-decision.contract.test.ts・scheme-resolution.contract.test.ts で守り、アンケートの状態の規則（formTransitions）の会社の条件は forms-transitions.integration.test.ts で守る。見える範囲は src/lib/report-visibility.contract.test.ts で、canViewEvaluationOf を使うのがレポートの画面だけで、CSV（canReviewEmployeeEvaluation）とメモ（readableNoteVisibilities）がこの関数を使わないことを確かめる。レポートの作成のテストの「3人未満で平均を出さない」を改めた：今は、同じ等級の重ならない社員が3人未満なら平均と幅を出さない。
根拠: qa-y16 の訂正、qa-z05、DD-021、DD-024（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: 移行のテスト：等級1だけが2つ目のまとまりへ移った会社が既定へ戻る・既定の会社は変わらない・呼び名を変えた会社も識別子で戻る・既定のまとまりが無い会社は書き換えずに件数を報告する・観点の中身は変わらない。結合テストと画面のテストで、新しい会社が既定の割り当てで始まることと、初期設定の説明がいまの割り当てと一致し既定と違うときに違いを示すことを確かめる。サーバー処理のテスト：下書きのアンケートで設定とつながった設問を足す・外す・文を直すと元の設定が同じ保存で変わり、決まりに合わない保存は合わない決まりと直す画面を示して断られる。結合テスト：設定を変えると回答0件の下書きが作り直され、回答のある公開中のアンケートには次の版の下書きが1つだけでき、締め切ったアンケート・確定した評価・レポートは変わらず、確定前の評価は集計し直される。契約テストで写しを持つ場所の一覧の文書とコードの一致を、見本の生成のテストで受付中の期が1つあること・評価がまだ作られていないこと・見本の印・他社の行に触れないことを確かめる。E2E：保存の直後に関係する画面と他のタブが新しい内容で出ること、手元の見本で「提出済みの回答から評価を作る」を押して評価の一覧と詳細まで進めること。
根拠: qa-ab02-behavior-band-default-observed、qa-ab04-setting-copy-propagation-observed、qa-ab10-band-drift-rewrite、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、G25、G27、G28（system-spec/maintenance-ops.md）

2026-10-22 の追加: docs/security/ に台帳と漏えいの恐れの後の手順書を置く。docs/deploy-notes.md に #97 の 0039 の記録を置く。
根拠: qa-ac07 (15)(16)(19)（system-spec/maintenance-ops.md）

## Cross-cutting contracts

アクセスは、本番 DB と Cloudflare の設定を読み取りだけで調べ、変更は外部変更ガードを通し、PR は実装後に利用者の確認を取ってから作る形にそろえる。誤りと回復は、compensation_failed と rollforward_failed を Workers Logs で見つけ、本番 DB を手で書き換えずに直すことで揃える（rollforward_failed は、本人にもう一度パスワードを変えてもらうと続きがやり直される）。監査は、本番の一律の書き換えの前に対象の会社数・等級数・英語入りの表示名の数を数えて書き換え前の値を記録し、後に読み取りで確かめることで残す。権限の定義はルート台帳1つに置き、台帳とサイドバー・ページの判定・サーバー処理の役割の指定の一致を pnpm test の検査で守る（D-007 ①）。命名の互換は、画面名の改名を対象のすべてで同時に改めることで保つ。対象は、ルート台帳・サイドバー（nav.ts）・画面名の定数（src/lib/domain/agent-keys.ts の AGENT_KEY_PAGE_LABEL）・README・system-spec/improvement-requests.md・docs/deploy-notes.md・specs/data-freshness.md・テスト（agent-keys.test.ts・improvement-ux-contracts.test.ts）である。漏れは check:docs で落とし、役割の種類は増やさない。公開リポジトリのため、文書・テスト・見本に実データや秘密の値を入れない。根拠: qa-r-ops-3 (3)、qa-v31 (1)(3)(4)、D-007、constraints、system-spec/maintenance-ops.md。

2026-10-19〜20 の追加: docs/product/spec.md と system-spec の文書から KGI の章を外して賞与（仮）の式を改め、昇給・昇格の判定の節に上司の判断と最終の可否の決め方を足す。依存関係の図に上司の判断を加える。
根拠: qa-y16（system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: 評価レポートを開ける人を判定する関数（本人・全体管理者・会社の管理者・直属の上司）を1つにまとめ、使うのはレポートの画面だけにした。評価の詳細の2画面は今の判定のままにし、レポートは誰が開いても確定した評価だけから作る。上司の判断の理由は本人にも同じ文で見せるので、保存のときに本人に見せられない語（点数・配点・必要点数につながる表現）を検査し、引っかかった語を名指しして断る。上司コメント（evaluatorComment）にも、保存のときに同じ検査をかける。
根拠: qa-z03、qa-z05、qa-z06、DD-021、DD-023、DD-024（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: アンケートから設定への反映も、設定の保存と同じ権限（会社の管理者以上）・会社の絞り込み・同時に保存したときの 409・制度の変更の記録を通す。評価セットの決まりや KPI の計算に要る設問に合わない保存は、アンケートも設定も変えずに断り、合わない決まりと直す画面を示す。設定を保存したら、どのアンケートと評価が変わったかを結果の文で示し、関係する全ての画面を取り直して他のタブにも知らせる。確定した評価と評価レポートは確定した時点のまま残し、確定前の評価だけが最新に追従する。評価レポートを直すときも、保存した得点と判定を再計算・上書きせず、本人向けに点数の数値・割合・同じ等級の平均を持たせない射影と認可を変えない。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab09-finalized-evaluation-keep、qa-ab11-survey-writeback-rule-conflict、qa-aa06-report-score-grade-design、qa-aa07-report-threshold-marker-audit、G27（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: docs/product/spec.md と system-spec の文書から事業所の達成率の章を外して賞与（仮）の式を改め、昇給・昇格の判定の節に上司の判断と最終の可否の決め方を足す。依存関係の図に上司の判断を加える。
2026-10-22 の追加: 台帳と報告に、攻撃の細部と秘密を書かない。
根拠: qa-ac07 (19)（system-spec/maintenance-ops.md）

## Subtype architecture

合成対象の subtype と該当テンプレート:

- Frontend: N/A: subtype 非選択
- Backend: N/A: subtype 非選択
- Infrastructure: 合成済み (`architecture-infrastructure.md`)
- Data: N/A: subtype 非選択
- Security: N/A: subtype 非選択

2026-10-22 の追加: Infrastructure に、台帳・pnpm audit の CI・勧告の受け方・手順書・#97 の記録・再発を止める静的検査（system-spec/maintenance-ops.md の qa-ac07 (20)）を足す（G30〜G33・G38）。
根拠: qa-ac07（system-spec/maintenance-ops.md）

### Infrastructure architecture

#### Environments and topology

検査の環境は、ローカルの vitest（pnpm test）と、ローカルの preview に向けた Playwright（pnpm test:e2e）である。E2E はローカル以外へ向かないよう LOCAL_HOSTS で止め、375px・768px の幅でも回す。画面の配置の確認は、375・768・1280・1600 の4つの幅で撮影して行う。配布の環境は、GitHub Actions のクリーンな checkout から本番の Worker と D1 へ配る1本だけで、ローカルの作業ツリーを直接配らない（system-spec/release-and-forms.md）。本番は観測の対象で、応答の生成時刻ヘッダー・Workers Logs・ゾーンのキャッシュ規則・D1 の読み取り専用の照会で調べる。根拠: qa-r-ops-3 (2)(3)、qa-v31 (3)、O15、system-spec/maintenance-ops.md。

2026-10-21〜22 の追加: 手元の seed（scripts/seed-data.mjs）は --remote を断るローカル専用で、受付中の期に、評価を作る画面で試せる人数の提出済みを持たせる。本番の見本の会社（scripts/sample-data.mjs、会社 cmp_sample）にも受付中の評価期間を1つ足し、提出済み・下書き・未回答を混ぜる。「提出済みの回答から評価を作る」から評価の一覧と詳細まで進める E2E は、手元の見本で回す。
根拠: qa-ab05-evaluation-build-showcase-observed、qa-ab12-showcase-data-location、G28（system-spec/maintenance-ops.md）

2026-10-22 の追加: CI（push・PR と週1回）で pnpm audit --prod --audit-level high を回す（D-011）。
根拠: qa-ab03、qa-ac07 (17)（system-spec/maintenance-ops.md）

#### Compute and storage

運用のために新しい計算資源や保存先は足さず、検査と手順は今の Worker・D1・Workers Logs の上で行う。記録の置き場は三つある。Workers Logs の構造化ログ（compensation_failed・rollforward_failed）。等級名の一律の書き換えの前の値の記録（表に残す。表の中身は system-spec/database.md）。本番の前後の読み取りで得た数（対象の会社数・等級数・英語入りの表示名の数）。数は本番の読み取りで得る件数にとどめ、実データ（社員名・評価値）を文書や見本に写さない。根拠: qa-v31 (4)、qa-r-ops-3 (3)、qa-v29 (2)、constraints、system-spec/maintenance-ops.md、system-spec/infrastructure.md。

2026-10-21〜22 の追加: 印刷の背景の準備は、新しい API・永続ジョブ・外部送信・スキーマを足さず、同じ会社・社員・閲覧形・レポートの内容の画面の中だけで結果を使い回す。キーごとの点数と等級の推移も、新しい列・再計算・判断の基準・閲覧の権限を足さず、過去の期は評価の時点の等級を残す。見本の生成は手元と本番の見本の会社で同じ buildSeed を使い、INSERT だけで見本の会社に紐づく行に限る。
根拠: qa-aa06-report-score-grade-design、qa-aa10-report-print-background-preparation、qa-ab12-showcase-data-location、G28（system-spec/maintenance-ops.md）

2026-10-22 の追加: 台帳と手順書は docs/security/ に置き、DB の表にしない。
根拠: qa-ac07 (16)(19)、qa-ac12 (18)（system-spec/maintenance-ops.md、system-spec/database.md）

#### IaC and delivery

検査は、package の scripts（pnpm test・pnpm test:e2e・pnpm run check:docs・check:bundle-size）とテストのファイルとしてリポジトリに置く。Deploy workflow は、同じ checkout でこれらを通してから配る。ルート台帳に権限一覧のページと、全ページの主な操作・役割ごとの可否・説明の欄を足すときは（D-007 ①）、台帳の説明書き（$schemaNote の『44個』）を直し、route-ledger.test.mjs の件数（46 → 47）と新しい欄の検査・nav.test.ts・check:docs を合わせる。画面名の改名は、ルート台帳・nav.ts・画面名の定数（AGENT_KEY_PAGE_LABEL）・README・文書・テストで合わせる。決まりの文書を改めたら、反映の受領書を docs/product/spec-receipts/ に残す。PR は実装後に利用者の確認を取ってから作り、本番への変更（Deploy・secret の設定）は外部変更ガードを通す。根拠: qa-v31 (1)(2)、D-007、qa-r-ops-3 (1)(4)、constraints、system-spec/maintenance-ops.md。

2026-10-19〜20 の追加: KGI の削除の2回の Deploy は外部変更ガードを通し、2回目の前に本番 DB を読み取りで数える。
根拠: qa-y16（system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: 「KGI の削除の2回の Deploy」の出し方を改めた：今は、P13 が手で2回公開するのではなく、P05 と P08 の PR のマージで Deploy workflow が自動で動き、P13 は実行の記録と本番の読み取りを受け持つ。P05 をマージする前に、P05 の PR の上で P06 の自動テスト（pnpm test・typecheck・test:coverage・test:e2e）と cf:dry-run・check:bundle-size を通す。計画レビューで決めた中身は DD-020〜DD-024 と受領書 docs/product/spec-receipts/2026-10-20-evaluation-report-plan-review.md に置き、Beads の各 task からそこへリンクする。
根拠: qa-y16 の訂正、qa-z03、DD-020〜DD-024（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: 写しを持つ場所の3分類（参照・追従・確定した時点の写し）の一覧を docs/product に置き、製品仕様 §27 から辿れるようにする。評価レポートの印刷と点数・等級の推移の決めは、製品仕様 §29・DD-025・specs/report-access-print.md・architecture/report-access-print.md と受領書 docs/product/spec-receipts/2026-10-21-report-access-print.md に反映する。
根拠: qa-ab13-foundation-016-approval、qa-aa04-report-landscape-onepage-design、qa-aa06-report-score-grade-design、qa-aa09-report-print-final-alignment、G27、appr-foundation-016（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 事業所の達成率の削除の2回の Deploy は外部変更ガードを通し、2回目の前に本番 DB を読み取りで数える。
2026-10-22 の追加: 版の一致・SHA・工程の分離を契約テストで確かめる（G33・O33）。再発を止める4つの静的検査は system-spec/maintenance-ops.md の qa-ac07 (20) を参照する。
根拠: qa-ac07 (18)(20)（system-spec/maintenance-ops.md）

#### Secrets and access

運用の人とエージェントは本番 DB を読み取りだけで調べ、本番に書き込まない。本番への秘密の設定（CREDENTIAL_ENC_KEY の wrangler secret put）や Deploy は、外部への変更として確認を取ってから行い、手順は deploy-notes §6 に置く。改名する『Claude Code連携（システム開発者専用）』の画面は名前だけを変え、役割の種類は増やさない。公開リポジトリのため、手順・ログの例・テストの見本に秘密の値や実データを入れない。根拠: qa-r-ops-3 (3)、qa-r-infrastructure-3 (5)、qa-v31 (1)、constraints、system-spec/maintenance-ops.md。

2026-10-20〜21 の追加: 計画レビューで見つかった本番の権限の漏れ2件（マネージャーが CSV で会社全員分の結果を取れる・管理者だけのメモがマネージャーに見える）を直した。今は、CSV の書き出しを上司側の判定で、メモの読み出しを今の公開範囲の判定で絞り、どちらもレポートの判定の関数を使わない。
根拠: qa-z03、qa-z05、DD-021、DD-024（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: アンケートから設定への反映は、設定の保存と同じく会社の管理者以上に限り、会社の絞り込みを通す。見本のデータの氏名は実在しない「サンプル」などにし、公開リポジトリのため実データは置かない。評価レポートの印刷の直しでは、認可と本人向けの数値を出さない扱いを変えない。
根拠: qa-ab05-evaluation-build-showcase-observed、qa-ab12-showcase-data-location、qa-aa04-report-landscape-onepage-design、qa-aa09-report-print-final-alignment、G27、G28（system-spec/maintenance-ops.md）

2026-10-22 の追加: 漏えいの恐れの後の手順書（秘密の交換・セッションの失効・パスワードの変更）を docs/security/ に置き、ローカルで確かめる。本番は利用者が決め、外部変更ガードを通す（G31・O31）。
根拠: qa-ac07 (16)、qa-ac09 (12)（system-spec/maintenance-ops.md、system-spec/auth.md）

#### Reliability and recovery

SLO の数値は置かない。鮮度の信頼性は、O2（再読み込みで反映率 100%）と O4（入口を通らない経路0件）を検査で保つ。障害の切り分けは、deploy-notes §7 の順（生成時刻ヘッダー → Workers Logs → ゾーンのキャッシュ規則）に読み取りだけで進め、推測で閉じない。compensation_failed は Workers Logs から見つけ、本番 DB を手で書き換えずに直す。rollforward_failed は、本人にもう一度パスワードを変えてもらうと続きがやり直される。本番の等級名の書き換えは、前の値の記録と後の読み取りでの確認を持ち、崩れたら戻す手順で戻す。根拠: qa-r-ops-3 (3)、qa-v31 (4)、qa-v29 (2)、system-spec/maintenance-ops.md、system-spec/infrastructure.md。

2026-10-19〜20 の追加: 1回目の後に KGI の画面が開けないことを確かめ、2回目の前の数えた値と Deploy の自動バックアップで戻せるようにする。
根拠: qa-y16、qa-x15（system-spec/maintenance-ops.md、system-spec/infrastructure.md）

2026-10-20〜21 の追加: 「1回目の後に KGI の画面が開けないことを確かめ」を改めた：今は、本番の画面を開かず、P07 が配った sha の静的検査と台帳で、本番に KGI の画面と操作が無いことを示す。2回目の前の本番 DB の読み取りは読むだけで行い、Deploy workflow の2回の実行 id・sha・時刻・書き出しの Artifact の id を、P13 が docs/deploy-notes.md に記録する。
根拠: qa-y16 の訂正、qa-z03、DD-020（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: 制度マスタの同時保存は後の保存を 409 で止めて黙って上書きせず、アンケートからの反映も同じ 409 を通す。印刷の準備は取消と再試行を持ち、会社・社員・閲覧形・内容の変更や離脱で古い処理と結果を捨て、図と文字の15秒の上限と未準備の印刷の抑止を保つ。A3 に収まらないときは切り詰めや極端な縮小をせずに印刷を開かず、A4 の全文の印刷へ案内して回復させる。
根拠: qa-ab04-setting-copy-propagation-observed、qa-ab11-survey-writeback-rule-conflict、qa-aa04-report-landscape-onepage-design、qa-aa09-report-print-final-alignment、qa-aa10-report-print-background-preparation、G27（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 1回目の後に事業所の達成率の画面が開けないことを確かめ、2回目の前の数えた値と D1 の Time Travel（7日。D-010）で戻せるようにする。
2026-10-22 の追加: d1-backup の成果物が0件であることを読み取りで確かめる（O30）。qa-ac07 (9) の『Artifact の id』は『時刻と bookmark』に読み替える。#97 の 0039 は 2026-10-21T07:49:53Z〜55Z（run 39564492520）に当たり、Time Travel の期限は 2026-10-28T07:49Z ごろで、戻さない。docs/deploy-notes.md と台帳に記録する。
根拠: qa-ac05、qa-ac07 (14)(15)（system-spec/maintenance-ops.md）

#### Infrastructure verification

毎回の検査は、pnpm test（3つの契約試験、追加の11項目の検査、ルート台帳の件数と新しい欄の検査を含み、違反0件でなければ失敗）、pnpm run check:docs、domain のカバレッジ 100%、6つの経路の E2E（375px・768px を含む）である。Deploy は、同じ checkout でこれらを通してから配る。リリースの前後の確認として、本番の書き換えの前に、対象の会社数・等級数・英語入りの表示名の数を読み取りで数える。Deploy の後は、英語の区分名が残っていないことと、作成直後の強制再読み込みで新しい行が出て生成時刻ヘッダーが作成より後であることを確かめる。独自ドメインへ移すときは、ゾーンに HTML・/api を保存する規則が無いことを読み取りで確かめる。根拠: qa-v31 (1)(3)(4)、qa-r-ops-3、O2、system-spec/maintenance-ops.md。

比べる警告のテストを足す：全件が2つのページを持つ／『食い違』『ズレ』を含む警告が ComparisonGap 以外から作られていない／リンク先が台帳にあり、見る人の役割で開ける／3画面で閉じた1行と開いた表が出る／新しい版はその等級の版だけが増える／他社の等級は拒否される。setup-gaps・SetupGapList・一覧のテストの固定文字列を新しい形に合わせ、domain のカバレッジ 100% を保つ。根拠: qa-w10／system-spec/maintenance-ops.md

2026-10-19〜20 の追加: KGI の参照0件の静的検査、O17〜O24 の単体テスト・契約テスト・E2E、A4 の PDF の E2E（2ページ・2枚目が⑤から）を置く。
根拠: qa-y16（system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: KGI の参照を探す静的検査は、docs のうち経緯を残す5種類（受領書・バックログの履歴・レビューの記録・判断の記録・デプロイ時の注意）を走査から外し、外す先が実在することも同じ検査で確かめる。賞与の計算の単体テストで、1点あたりの円が0以下なら賞与額を出さないことを確かめる。2回目の公開（P08 の PR のマージで Deploy workflow が動く）の後に、本番 DB に3つの表と2列が無いことを読み取りで確かめる。ズレの警告は、新しい版が下書きの間は消えず、今の設定と一致した新しい版の公開の後は出ず、一致していない新しい版があれば版の状態を問わず出ることをテストで確かめる（O22）。
根拠: qa-z05、qa-z07、DD-020、DD-022、DD-024（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: 既定の割り当てを持つ3か所（data/grades.json・drizzle/seed.sql・DEFAULT_BAND_SETS）が同じ値であることをテストで確かめる。共通部品の色使いは既存のテーマの契約テストを書き換えずに通し、グラデーションのコントラストと focus-visible の検査を新しいテストに1か所で書く。共通部品の色を変えたときは、主要な画面の明暗の見た目の記録を取り直す。O25・O27・O28 の測り方として、移行・書き戻し・追従・見本の生成のテストと E2E を置き、評価レポートの最終の実 PDF の試験の結果は受領書へ追記する。
根拠: qa-ab02-behavior-band-default-observed、qa-ab15-foundation-017-approval、qa-aa09-report-print-final-alignment、G25、G27、G28、G29、appr-foundation-017（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 事業所の達成率の参照0件の静的検査、O17〜O24 の単体テスト・契約テスト・E2E、A4 の PDF の E2E（2ページ・2枚目が⑤から）を置く。
2026-10-22 の追加: 台帳の全行が ID・深刻度・状態・根拠を持つことを契約テストで確かめ、再発を止める静的検査を CI で通す（O38）。Node 本体の通知を確かめた記録が台帳にあることを確かめる（O32）。
根拠: qa-ac07 (17)(19)(20)、O32・O38（system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md）

## Architecture decisions

本章に効く確定意思決定は D-002・D-004・D-005・D-006・D-007 である。D-002（opt-server-functions）で画面からの書き込みを1つの入口に集めたので、入口を通らない経路を静的検査で0件に保つ運用が成り立つ（二つの経路の混在は移行で解消済み）。D-004（opt-membership-cookie）・D-005（opt-pointer-hook）・D-006（opt-combined）・D-007（opt-route-ledger-extend）は利用者が選んだ。D-007 は、委任を受けて AI が選んだ案とは別の案を、利用者が3案の比較を見たうえで明示して選んだ（qa-v25、2026-10-13T03:40:15Z）。本章は、D-004 を所属していない会社のデータが読めない検査で、D-005 を並べ替えの部品のテストと静的検査（O13）で、D-006 を権限一覧の表とカードが同じ内容を出す検査で守る。D-007 は、ルート台帳の全てのページに主な操作・役割ごとの可否・説明の欄を足し、台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致する検査で守る。代わりに、説明の文言の直しも仕様の台帳の変更として扱う。運用の型は、Clean Code の『一つの規則は一か所に書き、検査で守る』と、Google SRE の『推測より観測』である。規則を検査と記録に持たせ、切り分けを生成時刻ヘッダー → Workers Logs → ゾーンのキャッシュ規則の順に、読み取りだけで進める。足す検査（11 項目）と、本番の書き換えの前後に読み取りで数えることは、qa-v31 の文面にある。本章の要件は、2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (1)・(3) だけを①に直し、旧と新を逐語で示して承認を取り直したものである（qa-v31、2026-10-13T03:48:20Z）。前後の読み取りは、手間と引き換えに書き換えの範囲と結果を証跡に残す。E2E の相手をローカルの preview に限ることで、本番への誤操作を避ける。代わりに、本番での確認はリリース後の利用者の操作と読み取りに頼る。根拠: D-002、D-004、D-005、D-006、D-007、qa-v25、qa-v31、qa-r-ops-3、system-spec/maintenance-ops.md（本章に効く確定意思決定・上流指針・適用された設計知識）。

2026-10-19〜20 の追加: A4 の印刷は Playwright で A4 の PDF を作り、ナビと操作のボタンが無いこと・図と表が途中で切れないこと・本人向けに点数が無いこと・ページ数が2で2枚目が⑤から始まることを確かめる（qa-y09 の2枚組）。
根拠: qa-y16、qa-y09（system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 計画レビューの4問に、利用者は次を選んだ。食い違いの直し先は、今は DD と計画レビューの記録に確定させ、spec-state への反映は P12 で行う。「P13 で手動で2回公開する」は、自動の Deploy に合わせて、1回目＝P05 のマージ、2回目＝P08 のマージと読み替える。3問目の答え『prは出さなくて良い』は、別の PR を出さずこの作業ツリーの変更の中で直す、と読んだ。上司の理由の文から数値が漏れるのは、表示時に共通文へ差し替えず、保存時に語を示して直してもらう形で防ぐ。
根拠: qa-z03、DD-020〜DD-024（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: 利用者は、下書きのアンケートの変更を保存と同時に設定へ反映する、公開中のアンケートには次の版の下書きを自動で作る、確定した評価は確定した時点のまま残す、ずれた会社はデータを既定へ書き換える、決まりに合わない保存は断り理由と直す所を示す、見本のデータは手元と本番の見本の会社の両方に置く、を選んだ。これに合わせ、DD-010 の「移行で書き換えない」、DD-015 の「新しい設問を KPI 項目に紐づけない」、DD-016 が却下した「聞き方の保存で下書きを書き換える」、製品仕様 §14 の「受付中の期は作らない」は、改める DD を書いてから実装し、公開の前の検査（staleAskingItems）は残す。評価レポートの印刷は、初稿の A3 を既定にする案と余白ボックスを空にする案を採らず、A4 縦の初期の選択と、@page margin:0 と本文12mm の余白のページごとの繰り返しで URL と日時を抑える形にした（製品仕様 §29・DD-025）。黒い縦線は得点ではなく実績値の位置だと凡例で示し、得点の棒と分ける。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab09-finalized-evaluation-keep、qa-ab10-band-drift-rewrite、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、qa-ab16-foundation-018-approval、qa-aa08-report-marker-detail-print-design、qa-aa09-report-print-final-alignment、appr-foundation-018（system-spec/maintenance-ops.md）

2026-10-22 の追加: D-011（採択：CI の pnpm audit だけ）。修正の PR は人が作る。Node 本体の勧告は CI では受けず、運用の担当が公式の通知で受ける。
根拠: qa-ab03、qa-ac02（system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md）

## Delivery, migration and rollback

リリースは、実装と検査（pnpm test・pnpm run check:docs・E2E）→ 利用者の確認を取ってから PR → main への取り込み → Deploy workflow の自動マイグレーションと fail-closed のゲート → 配布の順で進める。等級名の一律の書き換えは、前に本番 DB を読み取り専用で数え（対象の会社数・等級数・英語入りの表示名の数）、書き換え前の値を記録する。外部変更ガードを通して Deploy し、後に英語の区分名が残っていないことを読み取りで確かめる。本番へのマイグレーションの適用は、wrangler d1 migrations apply に --remote を明示する。失敗した番号はロールバックされ、前に成功した番号は残る（cloudflare-wrangler-d1-commands）。これを前提に、後の読み取りで崩れが見つかれば、書き換え前の値の記録から戻す手順（qa-v29 (2)）を使う。リリース後は、利用者のふだんの作成の直後に ⌘+Shift+R をして新しい行が出ることと、生成時刻ヘッダーが作成より後であることを確かめる。根拠: qa-v31 (4)、qa-v29 (2)、O2、constraints、system-spec/maintenance-ops.md、system-spec/infrastructure.md。

比べる警告の変更は docs/product/spec.md §22 と system-spec の文書に反映し、受領書を docs/product/spec-receipts/ に残す。根拠: qa-w10／system-spec/maintenance-ops.md

2026-10-19〜20 の追加: 1回目の Deploy の後に KGI の画面が開けないことを確かめる。2回目の前に本番 DB を読み取りで数えてから、外部変更ガードを通して Deploy する。テストデータは本番に入れない。
根拠: qa-y16（system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: Google SRE の変更管理に沿い、KGI の削除の本番への反映を、確かめられる手順に分けた。「1回目の Deploy の後に KGI の画面が開けないことを確かめる」を改めた：今は、1回目＝P05 の PR のマージ、2回目＝P08 の PR のマージと読み、1回目の確かめは本番の画面を開かずに、P07 が配った sha の静的検査と台帳で示す。上司の判断の列は足すだけなので、今の Deploy の順番のまま出せる（database (14)）。
根拠: qa-y16 の訂正、qa-z03、DD-020（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: 行動指針の既定の割り当てへの書き換えはデータの移行で行い、書き換えるのは等級とまとまりの割り当てだけで、観点の文と会社が足した観点は残す。既定のまとまりが無い会社は書き換えずに件数を報告し、移行の後に会社が割り当てを変えたときはその変更を正とする。見本の会社の受付中の評価期間は、既存の db:sample:remote の手順で、実行の前に利用者の確認を取って本番へ入れる。本番の未回答の一覧に見本の人が並ぶことは、運用の注意として記す。評価レポートの印刷の最終の実 PDF の証拠は、docs/product/spec-receipts/2026-10-21-report-access-print.md に追記する。
根拠: qa-ab10-band-drift-rewrite、qa-ab12-showcase-data-location、qa-ab17-foundation-019-approval、qa-aa09-report-print-final-alignment、G25、G28、appr-foundation-019（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 1回目の Deploy の後に事業所の達成率の画面が開けないことを確かめる。2回目の前に本番 DB を読み取りで数えてから、外部変更ガードを通して Deploy する。テストデータは本番に入れない。
2026-10-22 の追加: 台帳・手順書・CI の検査は、対策のコードと合わせて入れる。PR は利用者の確認を取ってから作る。
根拠: qa-ac07 (16)〜(20)（system-spec/maintenance-ops.md）

## Risks and verification

前提として、本章の要件は利用者の承認を得た文面である（qa-v31、2026-10-13T03:48:20Z）。2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (1)・(3) だけを①に直し、旧と新を逐語で示して承認を取り直した。危険は三つある。文字列を固定したテスト（setup-readiness・scheme-steps・form-sync・StaleCyclesNotice・nav・ui-rules・improvement-ux-contracts・versioned-master-editors）や決まりの文書が、古い文面のまま残ること。改名の取り残し。本番の書き換えの証跡の欠け。これらは、文面の更新・check:docs・前後の読み取りで抑える。また、ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定のどれかが食い違うと、権限一覧の表示と実際の判定がずれる。台帳と各判定の一致の検査で落とす。台帳の件数（47）と新しい欄は、route-ledger.test.mjs で確かめる。足す検査は次の11項目である。表示の英語・カタカナの等級区分名0件。等級名を変えられる役割の限定。ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定の一致。権限一覧の表とカードが同じ内容を出すこと。一般の社員の応答に他人の等級と点数が無いこと。所属していない会社のデータが読めないこと。提出状況の数と一覧の一致。設定不足の各件に直す画面のリンクがあること。並べ替えの全体の保存と 409。選択肢の値が重ならないこと。4 幅で右側だけが空く画面が無いこと。既存の3つの契約試験と6つの経路の E2E、domain のカバレッジ 100% も保ち、pnpm test と check:docs を通す。根拠: qa-v31 (1)(3)、qa-v25、D-007、qa-r-ops-3 (1)(2)、system-spec/maintenance-ops.md（受入条件）。

2026-10-19〜20 の追加: リスクは、KGI の参照が文書や台帳に残ること、テストと依存関係の図がずれること、印刷の体裁が画面の変更で崩れることである。pnpm test・check:docs・E2E（A4 の PDF を含む）で落とす。
根拠: qa-y16（system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: P12 で反映するまでは system-spec の本文に古い記述が残るので、DD と計画レビューの記録のほうが優先だと明記した。qa-y16 の答は凍結された記録として変えず、本文と食い違うときは 2026-10-20T21:45:11Z の訂正を正とする。
根拠: qa-z03、qa-y16 の訂正（system-spec/maintenance-ops.md）

2026-10-21〜22 の追加: リスクは、本番の未回答の一覧に見本の人が並んで本物の未回答者が埋もれること、初期設定の説明の文がいまの割り当てを読まずに画面のカードと食い違って見えること、黒い縦線の凡例・単位・範囲外の説明が足りず、現在の基準の帯と保存した判定を混同させうることである。印刷の待機は本番で長い待機を再現できておらず、手元の GET 891ms を本番の実測として扱わない。O25・O27・O28 のテストと E2E で落とし、実 PDF と実ブラウザの試験の結果は受領書へ追記して合格を先取りしない。
根拠: qa-ab02-behavior-band-default-observed、qa-ab05-evaluation-build-showcase-observed、qa-aa07-report-threshold-marker-audit、qa-aa10-report-print-background-preparation、G25、G27、G28（system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: リスクは、事業所の達成率の参照が文書や台帳に残ること、テストと依存関係の図がずれること、印刷の体裁が画面の変更で崩れることである。pnpm test・check:docs・E2E（A4 の PDF を含む）で落とす。
2026-10-22 の追加: 残るリスクを台帳に載せる：回数制限の数が isolate ごと（B）、アプリより前の層の防御が無い（D-012）、7日まで（D-010）、修正の PR は人が作る（D-011）、CSP の 'unsafe-inline'・SECURITY-013・SECURITY-015（範囲の外）。low の指摘も載せる。
根拠: qa-ac07 (21)（system-spec/maintenance-ops.md）


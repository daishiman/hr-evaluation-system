---
graph_node_id: "arch-system-spec-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "バックエンドの書き込み契約と業務ルール（評価レポート・評価セット・アンケートの状態・上司の判断・設定とアンケートの両方向の追従・行動指針の既定・見本のデータ）"
project_id: "hr-evaluation-system"
domain: "backend"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応"]
file_path: "architecture/system-spec-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "bb2c53c338213b7b690e344bc15597c128d8edc6d1632182792b182b7bc76ed0", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-2026-10-22.json"}
source_lineage: {"imported_at": "2026-10-22T07:58:56Z", "origin_kind": "system-spec-harness", "source_digest": "bb2c53c338213b7b690e344bc15597c128d8edc6d1632182792b182b7bc76ed0", "source_path": "system-spec/backend.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
created_at: "2026-10-22T08:03:51.121694Z"
updated_at: "2026-10-22T08:03:51.121694Z"
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-backend.md", "confidence": 0.92}, {"artifact_kind": "specification", "candidate_path": "specs/system-spec-backend.md", "confidence": 0.4}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-22T08:03:51.121694Z", "missing_sections": [], "status": "complete"}
---

# Architecture overview

Next.js 16 系（App Router）のサーバー側を OpenNext Cloudflare で Workers に載せ、D1 を drizzle で読み書きするバックエンドである。画面から呼ぶ書き込みは src/actions の Server Functions に集める。共通の入口 runAction が、送り元と認可・大きさ・入力の検証・本体・成功時の refresh を決まった順で行い、成功の表示と同じ応答で今の画面を作り直す（鮮度の契約）。複数の表を書く操作は D1 batch を第一とする。batch に入りきらない会社の追加だけを withCompensation で、取り消せない認証ライブラリの書き込みの続きを rollForward で守る。2026-10-12 の追加要件は、同じ入口と契約の上に足す。足すのは、等級の呼び名を作る共通の関数、権限の定義、所属から作る閲覧者（getViewer）、等級と確定済み最新評価の一覧、提出状況、設定不足の構造、並び順の全体保存、選択肢の値の一意である。権限の定義は、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、この台帳1つにまとめる（D-007 ①）。getViewer は cookie（hr_company）で選んでいる会社への所属から作る（D-004）。根拠: qa-v30（主）、qa-r-backend-4（旧主根拠）、qa-v25、D-004、D-007、system-spec/backend.md。

2026-10-14 の追加で、比べる警告の型 ComparisonGap と、ズレを読む処理を足す（G16・I17）。この追加の全文は、利用者が全文のまま承認した（qa-w08、2026-10-14T20:46:24Z）。根拠: qa-w08, qa-w01／system-spec/backend.md

2026-10-19〜20 の追加: KGI の処理を消し、賞与（仮）の計算を scoring の側へ移す。domain に、レポートのデータを作る buildEvaluationReport、評価期間から評価セットを決める resolveSchemeForCycle、アンケートの状態の規則 formTransitions、昇給と昇格の最終の可否を出す finalDecision の4つを置き、各処理がそれだけを使う。評価の確定（finalize）の入力に上司の判断を足し、評価の1行の更新で一緒に書く。
根拠: qa-z01（system-spec/backend.md）

2026-10-20〜21 の追加: DD-020〜DD-024 を当てて、評価レポートと上司の判断の処理を書き直した。レポートは、純粋な関数 buildEvaluationReport と、確定した評価だけを読む loadEvaluationReport に分ける。評価の更新では、自分自身の評価と部下でない人の評価を先に 403 で断り、そのあと理由と上司コメントを本人に見せられない語の一覧 CRITERIA_LEAK_PATTERNS で検査して、引っかかった語を名指しして 400 で返す。最終の可否は finalDecision で出して列に保存せず、CSV は先頭の23列をそのままに末尾へ7列を足し、行を canReviewEmployeeEvaluation で絞る。本番にあった権限の漏れ2件（マネージャーが CSV で会社全員分の結果を取れる・管理者だけのメモがマネージャーに見える）も、この変更の中で直した。
根拠: qa-z03、qa-z04、DD-020〜DD-024（system-spec/backend.md）

2026-10-21〜22 の追加: serves_goals に G25（行動指針の既定の分け方）・G27（後から変えた方を正とする追従）・G28（評価を作る画面を試す見本のデータ）を足す。アンケートから設定への書き戻しは、runAction→権限と会社の範囲→決まりに合うかの判定（domain の純粋な関数）→設定とアンケートを書く→追従の順に1つの処理で行い、どの段で断っても何も書かない。確定した評価とレポートは確定した時点のまま残し、確定前の評価だけが最新に追従する。行動指針の既定の割り当ては等級の内部の識別子で引き、見本の生成は buildSeed を使い回す。評価レポートには、評価者向けにキーごとの獲得点と配点・判定と、全ての確定した期の等級と達成率の推移を、新しい列も計算のし直しも足さずに加える。G26（画面の認知の負荷）と G29（共通部品の色使い）を含む要件の土台の追記は appr-foundation-016 から順に取り直し、appr-foundation-020 が今の承認である。
根拠: qa-ab07-survey-to-setting-direction、qa-ab09-finalized-evaluation-keep、qa-ab11-survey-writeback-rule-conflict、qa-ab02-behavior-band-default-observed、qa-aa06-report-score-grade-design、qa-ab13-foundation-016-approval、qa-ab18-foundation-020-approval、G25、G27、G28、appr-foundation-016〜020（system-spec/backend.md）

## Context and drivers

出発点は二つある。一つは、会社追加などの成功表示の後も一覧が古く、強制再読み込みでも出ない報告である（qa-u01・qa-u03）。もう一つは、書き込み後の鮮度を保証する共通の仕組みが無く、会社追加が原子的でないというコード調査である（qa-f06・qa-u02）。2026-10-12 の依頼（qa-v01）と利用者の決定（qa-v02）で、課題が加わった。等級名への英語の区分名の混在、役割ごとの権限を確かめる手段の欠如、2社目に登録できない所属、提出状況と設定不足の分かりにくさ、並べ替えと選択肢の不具合である。所属の持ち方は D-004（opt-membership-cookie）で、権限の定義の置き場は D-007（opt-route-ledger-extend。route-ledger.json に操作と説明を足す）で決まった。どちらも利用者が選んだ（qa-v12・qa-v25）。品質の優先は、書き込み結果の即時の正しさ（G1・G2）、中途状態を残さない原子性（G5）、見てよい人にだけ返す認可（G7・G9・G10）、権限の表示と判定の一致（G8）、検査で守れる共通契約（G4）である。制約は三つある。Next.js 16 系（16.3.8 へ上げる）・OpenNext Cloudflare 1.20 系・Workers・D1・better-auth の構成を変えないこと。pointGroup を結合キーとして値を変えないこと。役割による制限を画面で隠すだけにせず、サーバーがデータを作る段階で行うことである（requirements_foundation の constraints）。根拠: qa-v30、qa-r-backend-4、qa-f06、qa-d01、qa-v12、qa-v25、D-004、D-007、system-spec/backend.md。

2026-10-19〜20 の追加: 2026-10-19 の依頼（KGI の削除・評価レポート・アンケートの全機能の監査・アンケートと昇給の設定と評価セットの整合）と 2026-10-20 の依頼（上司の判断）で、評価セットの決め方とアンケートの状態の規則が処理ごとに書かれていることが調査で分かった。優先する品質は、同じ入力から同じレポートになること（G18）、状態と締切に合う操作だけをサーバーも許すこと（G21）、同じ評価セットを使うこと（G23）、最終の可否を1か所で決めること（G24）である。
根拠: qa-x01、qa-x05、qa-y01、qa-z01（system-spec/backend.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビュー（SYS-EVAL-REPORT-P01）で、節番号が2系統あること・canViewEvaluationOf と既存の関数の関係・DD-012 を改めたこと・Deploy の手順などの食い違いが見つかった。あわせて、本番にある権限の漏れ2件と、上司が書く昇給・昇格の理由に点数などが書かれて本人へ漏れるおそれが問われた。メモの漏れを直すと、マネージャーが「管理者のみ」で書いたメモが、書いた本人の画面から消えることも分かった。
根拠: qa-z03、qa-z04（system-spec/backend.md）

2026-10-21〜22 の追加: 2026-10-21 の依頼で、評価レポートの印刷（A4 と A3、紙に出る URL）と、キーごとの点数・等級の推移・基準帯の黒い縦線の意味が問われた。2026-10-22 の依頼は、行動指針の既定の分け方、画面の情報量、後から設定した方を正として他の画面へ反映すること、評価を作る画面を試すデータ、共通部品の見た目である。調査で、既定を当て直す処理が無く初期設定の説明がいまの割り当てを読まないこと、設定が正でアンケートは写しの一方向で、アンケートから設定へ戻す経路が無く配布済みのアンケートは追従させず人が決める形であること、本番の見本の会社は全ての期が締め済みであることが分かった。あわせて、直属のメンバーだけを集計する処理で employeeIds が空の配列のときに全員を対象にしていた不具合を見つけ、未指定は全員、空の配列は対象なしに直した（src/lib/evaluate.ts）。
根拠: qa-aa01-report-access-print、qa-aa03-report-paper-user-revision、qa-aa05-report-score-grade-request、qa-aa02-empty-evaluation-scope、qa-ab01-settings-ui-overhaul-request、qa-ab02-behavior-band-default-observed、qa-ab04-setting-copy-propagation-observed、qa-ab05-evaluation-build-showcase-observed（system-spec/backend.md）

## Goals and non-goals

ゴールは backend 章の serves_goals のうち、鮮度と原子性の G1・G2・G4・G5 と、追加要件の G6〜G14 である。G6〜G14 は、等級名の統一と動的反映、等級名を編集できる役割の限定、役割ごとの権限の確認と表示と判定の一致、等級と確定済み最新評価の一覧、複数会社への所属、提出状況、設定不足の構造、並べ替え、選択肢である。受入は O1・O2・O4〜O14 の測り方で判定する。たとえば、共通の包みを通らない書き込みが静的検査で0件、等級名を変える結合テストで全ての表示が新しい名前になる、一般の社員への応答に他人の等級と点数が無い、などである。本章の U9 には I9（権限の定義・権限一覧ページ・『Claude Code連携（システム開発者専用）』への改名）が含まれる。改名は、役割の種類を増やさない名前の変更にとどめる。非ゴールは、別の利用者の画面への即時配信（WebSocket などの push）、オフライン編集、役割の種類の追加、等級名の編集権限以外の役割ごとの権限の中身の変更、等級名の一律の書き換え以外の本番データの移行である（scope.out）。根拠: qa-v30、qa-v03、system-spec/backend.md（To-Be / Delta）。

2026-10-19〜20 の追加: Goals: レポート・評価セット・アンケートの状態・最終の可否を、それぞれ1つの関数に閉じ込める。判断の無い確定を 400 で拒む。Non-goals: 確定済みの評価の個人Pt・賞与額・根拠の文の作り直し、上司の判断を賞与（仮）の計算に効かせること、上書きした前の判断の履歴を残すこと。
根拠: qa-z01、qa-y07（system-spec/backend.md、system-spec/00-requirements-definition.md の U7）

2026-10-20〜21 の追加: backend の資するゴールに G20（テストデータ）は足さない。テストデータの項目は backend の答えに無く、maintenance-ops と database が担う。G22 は、新しい版が下書きの間は回答を集めている古い版の警告を消さず、今の設定と一致した新しい版を公開して古い版が締め切られたら出さない、という条件の文にした。O19 は、上司の判断を評価の詳細と同じ範囲で見せ、見える人を増やさないことを目標の文に入れた。
根拠: qa-z03、DD-022、DD-024、G22（qa-z05・qa-z07 で改めた文）、O19（qa-z05 で改めた文）（system-spec/backend.md）

2026-10-21〜22 の追加: Goals: G25（行動指針の既定の分け方（等級1・2で1つ、等級3・4-1・4-2で1つ、等級5-1・5-2は出さない）を、呼び名を変えた会社も含め、新しい会社と既定からずれた既存の会社の両方で成り立たせる）、G27（設定とアンケートの設問のどちらを後から変えても、後から変えた方を正として、もう一方と写しを持つ全ての画面と機能が追従する）、G28（手元の見本と本番の見本の会社に、提出済みの回答を含む受付中の評価期間を用意する）。Non-goals: 確定した評価と評価レポートを最新の設定で集計し直すこと、評価レポートの追加で新しい列・計算のし直し・判断の基準・閲覧の権限を足すこと。範囲の外の『本番 DB へのテストデータの投入』は手元の seed と E2E のデータに限り、本番の見本の会社への仮のデータ（G28・I31）を除く。範囲の外の『本番データの移行・修正』の除外には、行を書き換える移行 0032・0033・0034・0035・0036・0039 と、行動指針の既定の割り当てへの書き換え（I26）を挙げる。
根拠: G25、G27、G28、qa-ab09-finalized-evaluation-keep、qa-aa06-report-score-grade-design、qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、appr-foundation-019、appr-foundation-020（system-spec/backend.md）

## System context and boundaries

利用者はシステム全体管理者・会社の管理者・マネージャー・一般の社員である。Web・モバイル・タブレットのブラウザから同じ書き込みの入口を使う（デスクトップのネイティブアプリは appr-platform-001・qa-u08 で対象外）。画面からの書き込みは Server Functions で受ける。外部のエージェントが Bearer 鍵と端末の承認で呼ぶ API・離脱時の利用記録（sendBeacon）・外観の選択の記録・認証・読むだけの検索と書き出しは Route Handler に残す。画面からしか呼ばれなくなった Route Handler は消し、書き込みの経路を二重にしない。信頼の境界は会社で、全ての読み書きを『選んでいる会社』の所属で絞る。選んでいる会社は cookie（hr_company。httpOnly・Secure・SameSite=Lax）で持ち、全員に広げる（D-004）。cookie の値はそのまま信じず、getViewer が要求のたびにサーバーで所属を確かめる。会社の切り替えの処理（switchCompanyScope）は全ての役割に開き、所属を確かめる。扱いは system-spec/security.md・auth.md と同じである。データの境界は D1 の1つのデータベースで、取り消し・やり直しまで失敗した事実は Workers Logs に残す。根拠: qa-r-backend-4 (1)(3)、qa-v30 (5)、D-004、qa-f02、system-spec/backend.md、system-spec/auth.md（qa-v27 (1)(2)）。

2026-10-19〜20 の追加: レポートは保存した写しを持たず、開くたびに確定済みの評価と評価の項目からサーバーで作る。評価期間に評価セットの指定が無いときの扱い（会社の有効なもの）は resolveSchemeForCycle の中に閉じ込め、呼ぶ側に分岐を持たせない。
根拠: qa-z01（system-spec/backend.md）

2026-10-21〜22 の追加: 設定とアンケートの境界が両方向になる。下書きのアンケートで設定とつながった設問を足す・外す・文を直すと保存と同時に元の設定へ反映し、設定を保存すると同じ設定を使うアンケートと確定前の評価が追従する。見本のデータは、手元の seed（scripts/seed-data.mjs。scripts/seed-target.mjs が --remote を断る）と本番の見本の会社（scripts/sample-data.mjs）の両方に置き、本番への投入は既存の db:sample:remote の手順で、実行の前に利用者の確認を取る。本物の会社のデータには入れず、公開リポジトリなので実データも置かない。評価レポートの追加では、回答から回答の id に対応した見てよい評価へつなぎ、全体管理者は今の会社の切り替えで選んだ会社の全てのメンバーを見られる。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab05-evaluation-build-showcase-observed、qa-ab12-showcase-data-location、qa-aa01-report-access-print、G27、G28（system-spec/backend.md）

## Container and component view

共通の入口は runAction（書き込み）と runRead（控えを開くなど読むだけ。描き直さない）である。送り元の検査と認可（apiViewer）→ 大きさの上限（413）→ zod による入力の検証 → 本体 → 成功時だけ next/cache の refresh の順を持ち、結果を {ok, message} で返す。src/actions の Server Functions（19 ファイル）は業務の書き込みだけを書き、複数の表の守り方を D1 batch・withCompensation・rollForward の3つの型から選ぶ。追加要件で足す部品は次のとおり。等級の呼び名を作る共通の関数（区分名・行動指針のセット名・昇格の段階名・警告文・アンケートの既定のタイトル・評価の基準の見出しの唯一の作り手）。route-ledger.json の各ページに足す権限の定義（ページ名・主な操作・役割ごとの可否・説明。ページを開ける役割 accessClass と同じ台帳に置く。D-007 ①）。サイドバー（nav.ts）・requireRole・ActionSpec.role・session.ts の canEdit〜 は、この台帳から引く。cookie で選んでいる会社への所属から作る getViewer（D-004）と、全ての役割に開く会社の切り替えの処理（switchCompanyScope）。提出状況を返す処理。設定不足を構造で返す作り手群（setup-readiness・scheme-steps・評価期間とアンケートの作成の 409・form-sync・評価期間の古さの通知）。並び順の全体を受ける保存処理。データの持ち主は D1（drizzle の schema）で、権限の定義は DB の表に持たず route-ledger.json に置く。配る単位は OpenNext でビルドした1つの Worker である。根拠: qa-r-backend-4 (2)(3)、qa-v30 (1)〜(9)、qa-v25、D-004、D-007、system-spec/backend.md、system-spec/database.md（qa-v26 (9)）。

2026-10-19〜20 の追加: buildEvaluationReport（会社・対象の人・見る人）は、確定済みの評価を評価期間の開始日の順に読み、今の判定・点数・項目ごとの判定と点数・その等級にいた期の点数と同じ等級の平均と幅（3人未満なら作らない）・等級ごとの平均・期ごとの実績を作る。resolveSchemeForCycle は formSyncGaps と comparison-gap-loader・form-build・evaluate・レポートが使う。formTransitions は updateForm・延長・催促・画面の操作の出し分けが使う。finalDecision はレポート・評価の詳細の読み出し・本人の結果・評価期間の一覧・CSV の書き出しが使う。ズレの比較は等級要件（要件の系列で比べる）・行動指針・KPI 項目に広げ、各行に種類・項目の名前・直す画面の href を持たせる。
根拠: qa-z01（system-spec/backend.md）

2026-10-20〜21 の追加: 『buildEvaluationReport（会社・対象の人・見る人）が確定済みの評価を読む』形を改めた：今は、純粋な関数 buildEvaluationReport（src/lib/domain/report.ts、確定した評価の行・評価の項目・同じ等級の点数から EvaluationReport の empty／reviewer／self を作る）と、読む側の loadEvaluationReport（src/lib/report-data.ts、会社・対象の人・見せる形を受けて確定した評価だけを読む）に分ける。『同じ等級の平均と幅は3人未満なら作らない』も改めた：今は reviewer でも重ならない社員が3人以上（REPORT_PEER_MIN、レポートの本人も数に入る）のときだけ作る。self の形は、点数の数値と比べる値の鍵を持たない。ズレの警告は、同じ評価期間・等級の新しい版が下書きの間は公開中の古い版の警告を消さずに「第N版の下書きを開く」を添え、その下書きが今の設定と一致しているときは、公開すれば古い版が締め切られる旨の注記も添える。新しい版が今の設定と一致した状態で公開されたら古い版に警告を出さず、一致していない新しい版があれば版の状態を問わず古い版にも警告を出す。
根拠: DD-022、DD-024 の3・4・10、I23（qa-z05・qa-z06・qa-z07 で改めた文）（system-spec/backend.md）

2026-10-21〜22 の追加: 書き戻しと追従の部品は、決まり（評価セットの等級区分ごとの項目数・固定枠・20点枠と、KPI の計算に要る分子・分母などの設問）に合うかを判定する domain の純粋な関数、回答0件の下書きを作り直す今の rebuildFormQuestions、回答のある公開中のアンケートに次の版の下書きを1つだけ作る処理（すでにあれば作り直す）、確定前の評価を集計し直す今の impact の判定である。写しを持つ場所を『参照』『追従』『確定した時点の写し』に分けた一覧の定義を1つ持ち、契約テストがコードと突き合わせる。行動指針の既定は data/grades.json・drizzle/seed.sql・src/lib/domain/behavior.ts の DEFAULT_BAND_SETS の3か所で同じ値を保ち、行動指針の画面の初期設定の説明は固定の文をやめていまの割り当てから作る。見本は buildSeed を使い回し、新しい生成の道を作らない。評価の詳細の基準帯の黒い縦線は、src/lib/domain/evaluation-view.ts の buildThresholdScale が実績値を基準の数値軸へ置いて 0〜100% に収めた位置で、獲得点ではない。
根拠: qa-ab11-survey-writeback-rule-conflict、qa-ab08-published-form-follow、qa-ab09-finalized-evaluation-keep、qa-ab02-behavior-band-default-observed、qa-aa07-report-threshold-marker-audit、G25、G27、G28（system-spec/backend.md）

## Cross-cutting contracts

認可は画面の表示だけでなくサーバー処理で判定する。等級名を変える処理（saveMaster の等級の表と BehaviorBandAssignmentEditor から呼ぶ処理）は、システム全体管理者か自社の会社の管理者だけを通す（qa-v02 問1）。等級と点数は、見てよくない役割からの呼び出しでは値そのものを作らない。権限は、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、台帳を1つにする（D-007 ①）。サイドバー（nav.ts。今も台帳を読んでいる）・ページの入口の判定（requireRole）・サーバー処理の役割の指定（ActionSpec.role）・session.ts の canEdit〜 などの判定は、この台帳から引く。権限一覧の表示も同じ台帳から作る。台帳と突き合わせる契約テストで食い違いを落とし、権限一覧の表示と実際の判定を食い違わせない。誤りと回復は次の3つで揃える。例外ではなく {ok, message} の値で返す。並べ替えで送られた id の集まりが今と違えば 409 で取り直しを求める。compensation_failed・rollforward_failed を、個人情報を除いた構造化ログとして Workers Logs に残す。互換は、pointGroup を結合キーとして値を変えず表示に使わないこと、今の向き（先頭へ・上へ・下へ・末尾へ）で並べ替える形も全体を送る形と同じ結果になるよう残すことで守る。根拠: qa-v30 (1)(2)(3)(4)(8)、qa-r-backend-4 (2)(3)、qa-v25、D-007、system-spec/backend.md、system-spec/auth.md（qa-v27 (4)）、system-spec/security.md（qa-v28 (6)）。

2026-10-19〜20 の追加: 確定の入力で、昇給と昇格のどちらかの判断が無い・override で理由が空白だけ・理由が 2000 字を超える、のどれかなら確定せずに 400 を返す。記録した人と時刻も同じ更新で書く。コメントだけの保存では判断を変えない。確定を戻しても判断は消さず、評価を作り直すと判断も消えて次の確定で選び直す。
根拠: qa-z01（system-spec/backend.md）

2026-10-20〜21 の追加: 昇給と昇格の理由は本人にも同じ文で見せるので、保存のときに本人に見せられない語（点数・配点・必要点数につながる表現）を一覧 CRITERIA_LEAK_PATTERNS で検査し、引っかかった語を名指しして断る。上司コメント（evaluatorComment）にも、保存のときに同じ検査をかける。本人には、上司が書いたとおりの文を出す。
根拠: qa-z03、DD-023、DD-024 の3・8、I25（qa-z05 で改めた文）（system-spec/backend.md）

2026-10-21〜22 の追加: 決まりに合わない保存はアンケートも設定も変えずに断り、合わない決まりと直す画面の href を、画面の押せない理由と同じ文で返す。設定を保存した結果の文で、どのアンケートと評価が変わったかを示し、保存の後は関係する全ての画面を取り直して他のタブにも知らせる（製品仕様 §27）。締め切ったアンケート・確定した評価・評価レポートは、後から設定を変えても変えない。評価レポートの本人向けの形には、点数の数値・割合・同じ等級の平均を持たせない今の射影を保ち、満点や項目の構成が違う点数の大小だけで優劣を決めない。
根拠: qa-ab11-survey-writeback-rule-conflict、qa-ab09-finalized-evaluation-keep、qa-aa06-report-score-grade-design、G27（system-spec/backend.md）

## Subtype architecture

合成対象の subtype と該当テンプレート:

- Frontend: N/A: subtype 非選択
- Backend: 合成済み (`architecture-backend.md`)
- Infrastructure: N/A: subtype 非選択
- Data: N/A: subtype 非選択
- Security: N/A: subtype 非選択

### Backend architecture

#### Runtime and architecture pattern

実行環境は Next.js 16 系（16.3.8 へ上げる）の App Router を OpenNext Cloudflare 1.20 系で Cloudflare Workers に載せ、D1 を drizzle で、認証を better-auth で扱う。型は Clean Architecture の依存の向きに沿った『共通の入口＋薄い業務関数』である。書き込みの順序を各関数に書かず runAction に集め、各関数は業務の書き込みと複数の表の守り方の型の選択だけを持つ。Server Function の中で呼ぶ refresh は今の画面の描画を同じ応答に載せるので、成功の知らせと一覧の更新が一度の往復でそろう。退けた案は、Route Handler のまま画面側で router.refresh を呼ぶ形（opt-route-refresh）である。Route Handler の revalidatePath は印を付けるだけで表示中の画面を変えず、入口で鮮度を保証できない（qa-d01）。追加要件でも同じ向きを保つ。等級の呼び名と設定不足の構造をそれぞれ一つの関数に、権限の定義を route-ledger.json に置き、画面やサーバー処理はそこを呼ぶだけにする（qa-v30 (1)(2)(7)、D-007 ①）。根拠: qa-r-backend-4 (2)、qa-d01、qa-v30、D-002、D-007、system-spec/backend.md（上流指針・適用された設計知識）。

2026-10-20〜21 の追加: 上司の判断でも、共通の入口 runAction の順序（送り元と認可→大きさの上限→入力の検証→本体）を崩さない。入力の検証の段（zod）では判断の値の形だけを見て、中身の検査は本体で行う。判断の中身（どちらかが無い・override で理由が空白だけ・2000 字超・理由に見せられない語）は、画面の押せない理由と同じ関数 validateDecisionInput で決め、引っかかったら語を名指しした同じ文で返す。
根拠: qa-z03、DD-023（system-spec/backend.md）

2026-10-21〜22 の追加: 書き戻しと追従にも『共通の入口＋薄い業務関数』の型を当てる。アンケートから設定への書き戻しと、設定からアンケート・評価への追従は、どちらも runAction を通るサーバー処理として書き、画面の部品は追従の規則を持たない。決まりに合うかの判定は domain の純粋な関数に置き、合わない保存はその関数が返す決まりと直す画面で断る。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab11-survey-writeback-rule-conflict、G27（system-spec/backend.md）

#### Domain and module boundaries

中核の領域は会社・利用者・制度設定（等級以下）・評価期間・アンケートと回答・評価・改善要望で、会社をまたぐ参照を作らないことが不変条件である（qa-f02）。追加要件で境界を3つ足す。1つ目は等級の呼び名の作り手で、唯一の共通の関数である。pointGroup は結合キーとして内側に閉じ、値を変えず、表示に使わない。2つ目は権限の定義である。ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、台帳を1つにする（D-007 ①）。nav.ts・requireRole・ActionSpec.role・session.ts の canEdit〜 は、この台帳から引く側である。3つ目は所属で、getViewer が cookie で選んでいる会社への所属から会社・役割・等級を作る（D-004）。viewer.companyId の読み手は、所属の値をそのまま使う。依存の向きは内向きである。書き込みの順序は入口に、表の構成や chunk の分け方は永続化層に閉じ、業務関数が知るのは操作の成否だけにする（上流指針 data-access）。設定不足の直す画面の道筋は既存の道筋の関数（schemeStepPath など）から作り、文に pointGroup を出さず等級名を使う。根拠: qa-v30 (1)(2)(5)(7)、qa-v25、D-004、D-007、qa-f02、system-spec/backend.md。

ComparisonGap 型は、比べている2つのページの名前と href、項目ごとの有無を必須に持つ。formSyncGaps はこの型で返す形に改める。ページ名はルート台帳の親の画面名と見出しをつないで作り（pointGroupLabel＋stepTitle("select")、formRowTitle）、リンクは schemeStepPath とアンケートの道筋で作る。根拠: qa-w08／system-spec/backend.md

2026-10-19〜20 の追加: src/lib/domain/kgi.ts・kgi-results・kgi-apply を消す。domain に buildEvaluationReport・resolveSchemeForCycle・formTransitions・finalDecision を置き、画面やサーバー処理に同じ規則を書き直さない。
根拠: qa-z01（system-spec/backend.md）

2026-10-20〜21 の追加: 最終の可否は domain の finalDecision（点数の判定・判断）だけで出し、結果を列に保存しない。点数の判定は書き換えずに残し、判断は確定の入力で別の値として受ける。
根拠: qa-z03、DD-024 の8・9（system-spec/backend.md）

2026-10-21〜22 の追加: 設定の写しを持つ全ての場所（アンケートの設問、回答の見出し、評価の項目・行動指針・等級要件、ズレの表、評価レポート、CSV など）を『参照』『追従』『確定した時点の写し』のどれかに決める。『参照』はいまの設定を読み、『追従』は保存のときに作り直し、『確定した時点の写し』は確定した評価とレポートとして読むだけにする。行動指針の既定の割り当ては等級の内部の識別子で引き、呼び名に頼らない。まとまりは等級名ではなくセットの code と等級の display_order で決まる（src/lib/domain/behavior-band-range.ts の bandRuns）ので、等級名の変更は割り当てを変えない。
根拠: qa-ab09-finalized-evaluation-keep、qa-ab02-behavior-band-default-observed、G25、G27（system-spec/backend.md）

#### API and service contracts

画面からの書き込みは Server Functions で受ける。外部のエージェント向けの API（Bearer 鍵・端末の承認）・利用記録・外観の選択・認証・読むだけの検索と書き出しは Route Handler で受ける。要求の流れは、送り元の検査と認可（apiViewer。Next.js の Origin 検査に加え、入口の assertSameOrigin でも確かめる二重の検査）→ 大きさの上限（413）→ zod による入力の検証 → 本体 → 成功したときだけ refresh である。結果を {ok, message} で返すので、本番で例外の中身が隠れても画面に理由を出せる。誤りの約束は三つある。認可されない等級名の変更の拒否。並べ替えで id の集まりが今と違うときの 409（取り直しを求める）。評価期間とアンケートの作成で設定が足りないときの 409 である。設定不足は『何が足りない・どう直す・直す画面の道筋と名前』の構造で返す。並べ替えは並び順の全体（id の並び）を受ける形を足し、ドラッグとキーボードの結果を1回で送る。今の向き（先頭へ・上へ・下へ・末尾へ）の形も、同じ結果になるよう残す。会社の切り替えの処理（switchCompanyScope）は全ての役割に開き、送り元のオリジンを確かめる Server Action で受け、所属していない会社は拒否する。提出状況は対象者ごとの状態（提出済み・入力途中・未回答）と提出日時を返し、アンケートの一覧には状態ごとの人数を返す。根拠: qa-r-backend-4 (1)(2)、qa-u24 問4、qa-v30 (3)(5)(6)(7)(8)、system-spec/backend.md、system-spec/auth.md（qa-v27 (2)）、system-spec/security.md（qa-v28 (3)）。

アンケート1本ぶんのズレを読む処理を足す。使うKPIを選ぶの画面のために、その区分の等級に当たり、受付前か受付中の評価期間にある、下書きか公開中のアンケートのズレを、会社の範囲で一度に読む処理を足す（同じ評価期間・等級にこれより新しい下書きがあるかも返す）。新しい版は既存の createForms に gradeIds を1件渡して作り、新しい書き込みの処理は足さない。根拠: qa-w08／system-spec/backend.md

2026-10-19〜20 の追加: updateEvaluation の確定（finalize）の入力に、昇給と昇格それぞれの判断（follow／override）と override のときの理由を足す。欠け・空白だけの理由・2000 字超は 400。CSV の列に最終の結論・点数の判定・上司の判断・判断の理由を持たせ、見える範囲は canViewEvaluationOf のまま。
根拠: qa-z01（system-spec/backend.md）

2026-10-20〜21 の追加: 評価の更新の本体は、評価が会社の中に無ければ 404、自分自身の評価と部下でない人の評価なら中身の検査の前に 403、上司コメントや判断の中身が検査に引っかかれば語を名指しした文で 400 を返す。CSV の『見える範囲は canViewEvaluationOf のまま』を改めた：今は CSV の書き出しの行を上司側の判定 canReviewEmployeeEvaluation で絞り（DD-021 の4）、レポートを開ける人の判定の関数は使わない。
根拠: qa-z03、DD-021 の4、DD-023、I20（qa-z05・qa-z06 で改めた文）（system-spec/backend.md）

2026-10-21〜22 の追加: 下書きのアンケートの保存で、設定とつながった設問を足す（設定の項目を選んで足す）・外す・文を直すと、同じ保存で元の設定（KPI の設問の文・評価セットの項目・行動指針の観点・等級要件）へ反映する。決まりに合わない保存は、アンケートも設定も変えずに、合わない決まりと直す画面の href を返して断る。設定の保存は、回答0件の下書きを作り直し（設定とつながらない設問は残す）、回答のある公開中のアンケートには次の版の下書きを作り（すでにあれば作り直す。公開は人が行う）、確定前の評価を集計し直し、変わったアンケートと評価を結果の文で返す。評価の集計の処理は、employeeIds を指定しなければ全員、空の配列なら対象なしとして扱う。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab11-survey-writeback-rule-conflict、qa-aa02-empty-evaluation-scope、G27（system-spec/backend.md）

#### Data and transaction behavior

一つの操作で複数の表を書くときは3つの型に限る。1回の D1 batch に入るものは batch で書く（全部書けるか、何も書かれないか）。batch に入りきらない会社の追加だけ、段階ごとの書く処理と取り消す処理の組を逆順に戻す withCompensation で書く。取り消せない認証ライブラリの書き込み（パスワード変更）の続きは1回の batch にし、失敗したら1回だけやり直す rollForward で書く。新しく足す書き込みもまず batch に入るかを確かめ、batch の外で2つ以上の表を書く関数は write-atomicity-contract.test.ts で落とす。一覧の等級と点数は、確定した最新の評価（KPI評価点・等級要件の達成率・評価期間）を一覧ぶんまとめて1回の問い合わせで取り、人数に比例して問い合わせを増やさない。写しの列を作らず評価の確定済みの最新から読む扱いと、等級名を含む表示名を保存せず表示のたびに作る扱いは、system-spec/database.md の qa-v26 と同じである。権限の定義は DB の表に持たず、編集画面も作らない。route-ledger.json に置く（qa-v26 (9)、D-007 ①）。アンケートの選択肢の値は、今は数で振るため消した後に足すと重なる。重ならない振り方に改め、保存のときも重複を拒否する。サーバー側のキャッシュは持たない（force-dynamic）。将来入れるときの無効化（revalidatePath・revalidateTag）の置き場は入口に持つ。根拠: qa-r-backend-4 (2)(3)、qa-v30 (4)(9)、qa-v26、D-003、D-007、system-spec/backend.md、system-spec/database.md。

ズレを読む処理は読み取りだけで、書き込みは既存の createForms（1等級ぶん）に限る。根拠: qa-w08／system-spec/backend.md

2026-10-19〜20 の追加: 判断と記録した人と時刻は、確定と同じ評価の1行の更新（1文）で書く。確定を戻しても判断を消さない。公開のときに古い版を締め切る処理と版の番号を決める処理を会社の条件で絞る。
根拠: qa-z01（system-spec/backend.md）

2026-10-20〜21 の追加: 403 と、語の検査による 400 は、判断・記録した人・時刻を確定と同じ1文で書く前に済ませる。レポートの読み出しは loadEvaluationReport（src/lib/report-data.ts）に閉じ、確定した評価だけを評価期間の開始日の順に読む。I4 の batch で書く例から、消した機能の実績の書き込みを外した。
根拠: qa-z03、DD-023、DD-024 の3・4、I4（qa-z05 で改めた文）（system-spec/backend.md）

2026-10-21〜22 の追加: 書き戻しは、権限と会社の範囲→決まりの判定→設定とアンケートを書く→追従の順に1つの処理で行い、どの段で断っても何も書かない。確定前の評価の集計し直しは今の impact の判定を使い、確定した評価の行には書かない。行動指針の既定への移行が書き換えるのは等級とまとまりの割り当てだけで、観点の文と会社が足した観点は残す。評価レポートの推移は、過去の期を評価の時点の等級のまま示して今の等級へ置き換えず、期や等級をまたぐ図は評価者向けに保存した KPI 合計と満点の割合を使う（本人向けは等級要件の達成率）。保存した得点と判定は、基準帯に合わせて計算し直したり上書きしたりしない。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、qa-ab09-finalized-evaluation-keep、qa-ab10-band-drift-rewrite、qa-aa06-report-score-grade-design、qa-aa07-report-threshold-marker-audit、G27（system-spec/backend.md）

#### Async processing

この章にキュー・イベント・定期実行の生産者と消費者の契約は無く、書き込みは要求の中で同期に完了させ、成功した応答に新しい画面を載せる。再試行は rollForward の1回だけのやり直しに限り、それでも失敗したら rollforward_failed を、会社の追加の取り消しまで失敗したら compensation_failed を Workers Logs に残し、画面には結果と管理者への連絡を出して手作業の手順で直す。他のタブへの通知（BroadcastChannel）とタブ復帰・bfcache 復元時の取り直しは画面側の担当（system-spec/frontend.md、D-001）で、別の利用者の画面への即時配信は範囲外である。根拠: qa-r-backend-4 (3)、D-001、scope.out、system-spec/backend.md。

2026-10-21〜22 の追加: 追従（回答0件の下書きの作り直し・次の版の下書き・確定前の評価の集計し直し）は、保存と同じ1つの処理の中で行う。保存の後は関係する全ての画面を取り直し、他のタブにも知らせる（製品仕様 §27。今は runAction と refresh で取り直し、他のタブは FreshnessSync と BroadcastChannel で取り直す）。
根拠: qa-ab04-setting-copy-propagation-observed、qa-ab08-published-form-follow、G27（system-spec/backend.md）

#### Security and resilience

認証と認可は入口で毎回行う。送り元のサイト・今のセッション・役割を確かめてから本体を呼び、認可に失敗した要求では書き込みも画面の作り直しも行わない。等級名を変える処理は、システム全体管理者か自社の会社の管理者かをサーバーで判定し、マネージャー・一般の社員・他社の会社の管理者を拒否する。等級と確定した最新の評価は、見てよくない役割からの呼び出しでは値を作らない。全ての読み書きを、選んでいる会社の所属で絞る。選んでいる会社の cookie（hr_company）の値はそのまま信じず、getViewer が要求のたびにサーバーで所属を確かめる（D-004）。会社の切り替えは送り元のオリジンを確かめる Server Action で受け、所属していない会社は拒否する。権限一覧の表示は実際の判定と同じ定義（route-ledger.json）から作り、表示と判定の食い違いをテストで落とす。権限の定義は、画面から編集できるようにしない（D-007 ①）。入力は大きさの上限（413）と zod で検証し、選択肢の値の重複は保存のときに拒否する。再試行は rollForward の1回だけで、並べ替えの競合は自動でやり直さず 409 で取り直しを求める。根拠: qa-r-backend-4 (2)(3)、qa-v30 (2)(3)(4)(5)(8)(9)、qa-u24 問4、D-004、D-007、system-spec/backend.md、system-spec/auth.md（qa-v27 (1)(2)）、system-spec/security.md（qa-v28 (3)(6)）。

2026-10-20〜21 の追加: 評価レポートを開ける人を判定する関数を1つにまとめ（本人・全体管理者・会社の管理者・直属の上司）、レポートの画面だけがそれを使い、台帳にレポートのページを足す。レポートは誰が開いても確定した評価だけから作り、評価の詳細の2画面は今の判定のままにする。メモの読み出しは今の公開範囲の判定で絞り、公開範囲ごとにその段階以上の権限の人が全員読める。書ける公開範囲は読める公開範囲と同じで、マネージャーには「管理者のみ」を出さず、サーバーでも受け付けない。本番にあった漏れ2件は、別の PR を出さずにこの作業の変更の中で直した。自分を評価する側にも立つ人が自分について見られる情報は O19 の外に置き、SECURITY-013 で決める。
根拠: qa-z03、qa-z04、DD-021 の4・6、I20（qa-z05・qa-z06 で改めた文）、O19（qa-z05 で改めた文）（system-spec/backend.md）

2026-10-21〜22 の追加: アンケートから設定への反映も、設定の保存と同じ権限（会社の管理者以上）・会社の絞り込み・同時に保存したときの 409・制度の変更の記録を通す。見本のデータは見本の会社に紐づく行だけを INSERT で足して他社の行に触れず、氏名と会社に見本の印を持たせ、公開リポジトリなので実データを置かない。評価レポートの追加では、閲覧の権限・本人向けに数値を出さないこと・確定の条件・計算・スキーマを変えない。
根拠: qa-ab07-survey-to-setting-direction、qa-ab12-showcase-data-location、qa-aa01-report-access-print、qa-aa06-report-score-grade-design、G27、G28（system-spec/backend.md）

#### Operations and verification

記録は Workers Logs に残す。取り消し・やり直しまで失敗した事実を、compensation_failed・rollforward_failed として個人情報を除いた構造化ログで残す。静的・契約の検査は三つある。server-actions-contract.test.ts（入口を通らない書き込みを0件。例外の sendBeacon と外観の選択の記録は理由付きで列挙）。write-atomicity-contract.test.ts（batch の外で2つ以上の表を書く関数を0件）。action-origin.test.ts（送り元の二重の検査）。結合テストは、会社の追加の途中の段階と取り消しの失敗、パスワード変更の後片付けの2回の失敗、CSV 取込と評価の集計の batch の途中の失敗を確かめる。追加要件は次を確かめる。等級名の変更の反映（O6）。役割ごとの拒否（O7）。route-ledger.json の権限の定義と、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の canEdit〜 の突き合わせと、権限一覧ページと利用者一覧のモーダルが同じ定義から描かれること（O8）。確定直後の点数の更新と一般の社員の応答（O9）。2社目への所属と会社の切り替え、所属していない会社の拒否（O10）。対象者全員の提出状況（O11）。設定不足の道筋の欠落0件（O12）。全体の保存と 409（O13）。選択肢の値の重複の拒否（O14）。根拠: qa-r-backend-4 (3)(4)、qa-r-ops-3 (1)、qa-v30、D-007、system-spec/backend.md（受入条件）。

ComparisonGap の全件が2つのページを持つこと、新しい版はその等級の版だけが増えることをテストで確かめる。根拠: qa-w08, qa-w10／system-spec/backend.md・system-spec/maintenance-ops.md

2026-10-19〜20 の追加: レポート・評価セットの決め方・アンケートの状態の規則・最終の可否・確定の入力の検査の単体テストと契約テストを pnpm test に入れる。
根拠: qa-z01、qa-y16（system-spec/backend.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: P13 は、手動の公開ではなく、CI の実行番号と backup、本番の読み取りを記録する役にする（qa-z03 の2問目）。O17 の静的検査は、src・docs・route-ledger・nav で消した仕組みの参照が0件であることを見て、docs のうち経緯を残す5種類（受領書・バックログの履歴・レビューの記録・判断の記録・デプロイ時の注意）は走査から外し、外す先が実在することも同じ検査で確かめる。2回目の公開（P08 の PR のマージで Deploy workflow が動く）の後に、本番 DB に3つの表と2列が無いことを読み取りで確かめる。
根拠: qa-z03、O17（qa-z05 で改めた測り方）（system-spec/backend.md）

2026-10-21〜22 の追加: O25・O27・O28 の単体・結合・契約のテストと E2E を加え、写しを持つ場所の一覧（文書）とコードの一致は契約テストで落とす。手元の見本で『提出済みの回答から評価を作る』を押し、評価の一覧と詳細まで進める E2E を置く。評価の集計の対象が空の配列のときの不具合は、直す前に失敗する回帰テストを2件足して直し、直属のメンバーが0人のマネージャーが他の人の確認中の評価と内訳を変えないことを Server Action から確かめた。
根拠: qa-aa02-empty-evaluation-scope、G25、G27、G28（system-spec/backend.md）

## Architecture decisions

D-002（採択 opt-server-functions）：画面からの書き込みを今回すべて Server Functions へ移し、成功したら同じ応答で表示中の画面を作り直す。AI の推奨だった opt-route-refresh（Route Handler のまま画面側で router.refresh を呼ぶ）は採らなかった。Route Handler から呼ぶ revalidatePath は印を付けるだけで表示中の画面を変えず（qa-d01）、入口で鮮度を保証できないからである。利用者は移行の規模を承知で全面移行を選んだ（qa-u18）。D-003（採択 opt-batch-first）：batch に入るものは batch、入りきらない会社の追加は補償、戻せない書き込みの続きはやり直しとする。全部を1回の batch（opt-d1-batch）や全部を補償（opt-compensation）にする案より、実装の実態と原子性の両立を取った（qa-u23・qa-u24）。代わりに会社の追加は取り消しまで失敗したときだけ中途状態が残り得るので、記録と手順で直す。D-004（採択 opt-membership-cookie）：自前の所属の表を作り、選んでいる会社を cookie（hr_company）で持つ。利用者が選んだ（qa-v12）。cookie の会社への所属の確認を1か所でも漏らすと所属外の会社のデータが見えるので、getViewer で要求のたびに確かめる。D-005（opt-pointer-hook）と D-006（opt-combined）も利用者が選んだ。どちらも画面側の決定で、本章は並び順の全体を1回で受ける保存と、権限の定義でこれを支える。D-007（採択 opt-route-ledger-extend）：ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、台帳を1つにする。利用者が3案の比較を見たうえで、推奨の印の無い問で名指しで選んだ（qa-v25、2026-10-13T03:40:15Z）。利用者は先にこの選択を AI に任せ、AI は別の案を選んでいた。委任による AI の選択は利用者が選んだ決定と同じ強さの記録ではない、と完成度の評価が指摘したので、中立に問い直した。この案では、サイドバーと判定が同じ台帳を読むので、表示と判定のずれを route-ledger のテストで見つけられ、G8 を満たせる。代わりに、説明の文言を直すたびに仕様の台帳が変わる。一覧の値を一覧ぶん1回の問い合わせで取ること、並び順の全体を受ける形と 409、選択肢の値の振り方は qa-v30 の文面にある。本章の要件は、2026-10-13T00:03:46Z に全文で承認された文面のうち、AI が選んだ別の案を前提にした項目 (2) だけを①に直し、旧と新を逐語で示して承認を取り直したものである（qa-v30、2026-10-13T03:48:20Z）。根拠: qa-u18、qa-u23、qa-u24、qa-d01、qa-v12、qa-v25、qa-v30、D-007、system-spec/backend.md（本章に効く確定意思決定）。

2026-10-14 の会社所属の現在の契約：既存アカウントへ別の会社の所属を足すのは全体管理者だけの専用操作（addMembership）とする（qa-w11、D-008）。選んでいる会社が無いとき（cookie が無い・所属していない会社を指す）は、有効な所属のうち会社名の順で最初の会社を開く（同名は会社 id の順。qa-w12、D-009）。委任（qa-v32）に基づく DD-009 の『最も古い有効な所属』は利用者の選択で取り消し、実装は 2026-10-15 に会社名の順へ直した（src/lib/memberships.ts の activeMembershipsByCompanyName。users の写しの基準は古い順のまま。DD-009 の更新）。どちらの順でも、リクエストのたびに所属をサーバーで確かめることは変わらない。根拠: qa-w11, qa-w12, qa-v27／system-spec/auth.md・system-spec/security.md・docs/product/design-decisions.md

2026-10-19〜20 の追加: 賞与（仮）は個人Pt＝KPI評価点の合計（整数に四捨五入）、賞与額＝個人Pt×1点あたりの円（0なら出さない）とする（qa-x02 で利用者が KGI 無しの式で残す形を選んだ）。レポートは並び順・丸め（小数第1位）・同じ開始日の期の選び方（score-visibility と同じ）を固定し、期や等級をまたぐ図は満点に対する割合で比べる。アンケートは締切済みから公開中、下書きから締切済みへの変更を拒否し、締切後に受け付けを続けたいときは延長を使う。判断は評価の1行の更新（1文）で書き、半分だけ書かれた状態を作らない。最終の可否は、判定どおりなら点数の判定、override なら逆、判断の無い古い確定なら点数の判定に『記録なし』の印を付けて返す。
根拠: qa-x02、qa-y03、qa-z01（system-spec/backend.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 計画レビューで見つかった食い違いは、DD-020〜DD-024 と計画レビューの記録に先に確定させ、spec-state への反映は P12 でまとめて行う案を利用者が選んだ（qa-z03 の1問目）。そのため本章の qa-z01 の答えは当時の逐語のまま残し、食い違うときは 2026-10-20T21:45:11Z の訂正の側を正とする。本人にも同じ文で見せる上司の理由は、表示のときに決まった文へ差し替える案と検査しない案を採らず、保存のときに語を名指しして書き直してもらう案を選んだ（qa-z03 の4問目）。賞与額を出さない条件の『0なら出さない』を改めた：今は1点あたりの円が0以下なら賞与額を出さない（O17 の測り方）。
根拠: qa-z03、DD-020〜DD-024、O17（qa-z05 で改めた測り方）（system-spec/backend.md）

2026-10-21〜22 の追加: 利用者が選択肢を見て選んだのは、アンケートの設定とつながった設問の変更を保存と同時に設定へ反映すること、回答のある公開中のアンケートには次の版の下書きを自動で作ること、確定した評価とレポートを確定した時点のまま残すこと、既定からずれた会社の行動指針の割り当てをデータで既定へ書き換えること、決まりに合わない保存を断って理由と直す所を示すこと、見本のデータを手元と本番の見本の会社の両方に置くことである。この書き戻しと作り直しは、DD-015（新しい設問を KPI 項目に紐づけず、紐づけは作り直しのときにだけサーバーが書く）と DD-016 が却下した『聞き方の保存で下書きを書き換える』を改めるので、改める DD を書いてから実装し、公開の前の検査（staleAskingItems）は残す。あわせて DD-010 の『移行で書き換えない』と、製品仕様 §14 の『受付中の期は作らない』も改める。評価レポートの印刷は用紙の初期選択を A4 縦のままにし、A3 横は選んだときに標準1枚、収まらなければ A4 の全文の印刷へ案内する（A3 を既定にする案は採らない）。紙に出る URL と日時は @page margin:0 と本文の 12mm の余白のページごとの繰り返しで抑え、評価の詳細の印刷は『評価の詳細を印刷』としてレポートと分けて未確定の評価でも残す。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab09-finalized-evaluation-keep、qa-ab10-band-drift-rewrite、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、qa-ab16-foundation-018-approval、appr-foundation-018、qa-aa08-report-marker-detail-print-design、qa-aa09-report-print-final-alignment（system-spec/backend.md）

## Delivery, migration and rollback

配る形は今の OpenNext の Worker のままである。足す書き込みは全て共通の包み（I1）を通し、成功の表示と同じ描画で一覧が新しくなる契約を守る（qa-v30 (10)）。所属への移行では、次を行う。getViewer を、cookie（hr_company）で選んでいる会社への所属から作る形に改める（D-004）。利用者の作成・メンバーの追加・会社の追加・CSV の取り込みの重複の検査は、システム全体でメールアドレスの重複を拒否する今の形を保ち、他社に既にアカウントがある人への所属の追加は全体管理者だけの addMembership で行う（D-008）。会社の切り替えの処理（switchCompanyScope）を全ての役割に開く。users.company_id を読む約33か所と viewer.companyId を読む約140か所を、所属の値にそろえる。所属の表の追加と移し替え、等級名の一律の書き換えは D1 のマイグレーション（drizzle/migrations の 0033 以降）で行う。流し方と戻し方は system-spec/infrastructure.md（qa-v29）に従う。Deploy の後の読み取りで英語の区分名が残っているなど受入が崩れたときは、書き換え前の値の記録から戻す手順を使う（qa-v29 (2)・qa-v31 (4)）。根拠: qa-v30 (5)(10)、qa-v29、qa-v31 (4)、D-004、system-spec/backend.md、system-spec/infrastructure.md、system-spec/maintenance-ops.md。

2026-10-19〜20 の追加: KGI の削除は2回の Deploy に分け、1回目でコードから KGI の読み書きを全て外し、2回目で表と列を消す。判断の列は足すだけなので、コードより先に当てても今のコードが動く。CSV は昇給と昇格の列を最終の結論にし、『点数の判定』『上司の判断』『判断の理由』の列を足す。
根拠: qa-z01、qa-x15、qa-y15（system-spec/backend.md、system-spec/infrastructure.md、system-spec/database.md）

2026-10-20〜21 の追加: 事業所の達成率の仕組みを消す2回の公開は、main にマージすると自動で本番に出る仕組みに合わせて読み替え、1回目を P05 のマージ、2回目を P08 のマージとする（qa-z03 の2問目）。P05 をマージする前に、P06 の自動テストと bundle の大きさ・cf:dry-run を P05 の PR の上で通すことを条件にし、計画は作り直さない。CSV の『昇給と昇格の列を最終の結論にし、3つの列を足す』形を改めた：今は先頭の23列をそのまま（「昇格可否」を最終の結論にする）にし、末尾に7列（昇給・昇給の点数の判定・昇給の上司の判断・昇給の判断の理由・昇格の点数の判定・昇格の上司の判断・昇格の判断の理由）を足す。
根拠: qa-z03、DD-024 の8・9（system-spec/backend.md）

2026-10-21〜22 の追加: 行動指針の既定の割り当て（beginner・regular を1つ目のまとまり、chief・am1・am2 を2つ目のまとまり、manager1・manager2 は出さない）へ書き換えるデータの移行を足す。書き換えるのは等級とまとまりの割り当てだけで、観点の文と会社が足した観点は残し、既定のまとまりが無い会社は書き換えずに件数を報告する。移行の後に会社が割り当てを変えたときはその変更を正とし、書き換えた会社のアンケートは I29 の規則で追従させる。いまずれている下書きは、更新時刻の新しい方へそろえる。本番の見本の会社には受付中の評価期間を1つ足し（INSERT だけ・見本の会社に紐づく行だけ）、既存の db:sample:remote の手順で利用者の確認を取ってから入れる。
根拠: qa-ab10-band-drift-rewrite、qa-ab12-showcase-data-location、G25、G27、G28（system-spec/backend.md）

## Risks and verification

前提として、本章の要件は利用者の承認を得た文面である（qa-v30、2026-10-13T03:48:20Z）。2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (2) だけを①に直し、旧と新を逐語で示して承認を取り直した。D-004 と D-007 は、どちらも利用者が選んだ（qa-v12・qa-v25）。危険の一つは所属への移行である。約33か所と約140か所をそろえる広い変更で、cookie の会社への所属の確認を1か所でも漏らすと、所属していない会社のデータが見える（D-004 のリスク）。これは、所属していない会社を指定した要求が拒否されるテスト（O10）と、一般の社員への応答に他人の等級・点数が無いテスト（O9）で確かめる。もう一つは、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の canEdit〜 のどれかが台帳と食い違い、権限一覧の表示と実際の判定がずれることである。route-ledger.json の権限の定義とこれらの判定を突き合わせる契約テスト（O8）で落とす。鮮度と原子性は、server-actions-contract.test.ts（入口を通らない書き込みを0件）と write-atomicity-contract.test.ts（batch の外で2つ以上の表を書く関数を0件）で確かめる。会社の追加は途中の段階と取り消しを失敗させる結合テストで、パスワード変更は後片付けを2回とも失敗させる試験で確かめる。追加要件は、等級名を変える結合テスト（O6）、役割ごとの等級名の変更の拒否（O7）、権限一覧ページと利用者一覧のモーダルが同じ定義から描かれること（O8）、設定不足の全件が直す画面への道筋を持つ契約テスト（O12）、全体の保存と 409（O13）、選択肢の値の重複の拒否（O14）で確かめる。根拠: qa-v30、qa-v12、qa-v25、D-004、D-007、qa-r-backend-4 (3)(4)、system-spec/backend.md（受入条件）。

2026-10-19〜20 の追加: リスクは、処理ごとに評価セットの決め方や状態の規則や最終の可否を書き直してずれること、公開時の古い版の締切と版の番号の処理が他社の版に触れることである。検査として、レポートの単体テスト（同じ入力で同じ出力・軸の数・3人未満で平均を出さない・本人向けに点数が無い）、4つの処理が同じ関数から評価セットを得る契約テスト、状態の変更の組ごとの単体テスト、finalDecision の5通りの単体テスト（domain のカバレッジ 100%）と確定の入力の検査を置く。
根拠: qa-z01、qa-y16（system-spec/backend.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: レポートの検査の『3人未満で平均を出さない』を改めた：今は同じ等級の重ならない社員が3人未満なら、平均と幅を出さないことをテストで確かめる。レポートの判定の関数を呼ぶのがレポートの画面だけで、CSV の書き出しとメモの読み出しが使わないことを契約テストで確かめる（O19）。ズレの警告は、公開中の版の警告が、新しい版が下書きの間は消えず、今の設定と一致した新しい版の公開の後は出ず、一致していない新しい版があれば版の状態を問わず出ることをテストで確かめる（O22）。
根拠: O19（qa-z05 で改めた測り方）、O22（qa-z05・qa-z07 で改めた測り方）、DD-022、DD-024 の4・10（system-spec/backend.md）

2026-10-21〜22 の追加: 本番の見本の会社に受付中の期を作ると、本番の未回答の一覧に見本の人が並ぶので、その影響を製品仕様 §14 を改める記録に記す。行動指針の検査は、既定へ戻す移行のテスト（等級1だけが2つ目のまとまりへ移った会社が戻る・既定の会社は変わらない・呼び名を変えた会社も識別子で戻る・観点の中身は変わらない）と、新しい会社が既定で始まる結合テストである（O25）。追従の検査は、両方向の反映と断る保存のサーバー処理のテスト、回答0件の下書きの作り直しと次の版の下書きが1つだけできること・締め切ったアンケートと確定した評価とレポートが変わらないこと・確定前の評価が集計し直されることの結合テスト、写しを持つ場所の一覧とコードの契約テスト、保存の直後の E2E である（O27）。見本の検査は、生成のテスト（受付中の期が1つ・提出済みと下書きと未回答が混ざる・評価はまだ無い・見本の印・他社の行に触れない）と、評価を作るまで進める E2E である（O28）。
根拠: qa-ab12-showcase-data-location、G25、G27、G28（system-spec/backend.md）


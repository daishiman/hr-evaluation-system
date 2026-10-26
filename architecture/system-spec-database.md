---
graph_node_id: "arch-system-spec-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "データ設計：D1 の原子的な書き込み、会社への所属、上司の判断の列、本番 DB の写しの置き場と Time Travel"
project_id: "hr-evaluation-system"
domain: "database"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応", "脆弱性対策"]
file_path: "architecture/system-spec-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "stale"
confirmation_evidence: {"evaluated_digest": "99a3115c741d72093eedd0ba30c70c1cf8051840c4a268cd392a5360c5b9cf52", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-report.json"}
source_lineage: {"imported_at": "2026-10-22T13:49:14Z", "origin_kind": "system-spec-harness", "source_digest": "99a3115c741d72093eedd0ba30c70c1cf8051840c4a268cd392a5360c5b9cf52", "source_path": "system-spec/database.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-database.md", "confidence": 0.92}, {"artifact_kind": "specification", "candidate_path": "specs/system-spec-database.md", "confidence": 0.4}]
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

Cloudflare D1（SQLite 互換）を drizzle-orm/d1 で使い、getDb() が要求ごとに env.DB から drizzle を作る1つのデータベースの構成を保つ。書き込みの原子性は、1回の D1 batch に入るものは batch、入りきらない会社追加だけ段階ごとの書き込みと取り消しの組（withCompensation）、取り消せない認証ライブラリの書き込みの続きはやり直し、の3つの型で守る。読み取りは primary に届く今の方式で、書き込みを確定した後の読み取りは同じ要求でも次の要求でも最新を返す。2026-10-12 の追加で、会社ごとの役割・等級・事業所・上司は所属の表を正とする（D-004）。等級名を含む表示名・一覧の等級と点数・アンケートの提出状況は保存せず、既存の表から表示のたびに作る。権限の定義は業務データではなく仕様の台帳（route-ledger.json）の定義なので、DB に持たない（D-007）。
根拠: qa-v26、qa-r-database-3、qa-f07、D-004、D-007（system-spec/database.md）

2026-10-19〜20 の追加: KGI の3つの表（kgi_coefficients・office_kgi_results・office_kgi_revisions）と評価の表の2列（office_achievement_rate・kgi_coefficient）を消す。レポートのための新しい表は作らず、確定済みの評価と評価の項目から作る。評価の表に上司の判断の6列（NULL 可）を足す。シードに、複数の期の確定済みの評価・アンケートの各状態・ズレの3種類・直属の部下の関係・判断の5通りを足す。
根拠: qa-y15（system-spec/database.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビュー（SYS-EVAL-REPORT-P01）で見つかった食い違いは、DD-020〜DD-024 と計画レビューの受領書に先に確定させ、spec-state への反映は P12 でまとめて行った。main へのマージで本番に出る仕組みに合わせ、1回目の公開を P05 のマージ、KGI の表と列を消す2回目の公開を P08 のマージと読み替えた。上司が書く昇給・昇格の理由と上司コメントは、保存のときに本人に見せられない語を検査し、引っかかった語を名指しして断る。本番にあった権限の漏れ2件（マネージャーが CSV で会社全員分の結果を取れる・管理者だけのメモがマネージャーに見える）は、別の PR を出さずに同じ作業ツリーの変更の中で直した。
根拠: qa-z03、qa-z05、DD-020、DD-021、DD-023、DD-024（system-spec/database.md）

2026-10-21〜22 の追加: 行動指針のまとまりの割り当てを既定（beginner・regular で1つ、chief・am1・am2 で1つ、manager1・manager2 は出さない）へ書き換えるデータの移行を足し、書き換えるのは割り当てだけで観点の行には触れない（G25）。設定とアンケートの設問は、どちらを後から変えても後から変えた方を正とし、アンケートからの書き戻しは設定の保存と同じ永続化層の関数を通して同じ batch で書く（G27）。確定した評価と評価レポートは確定した時点の写しのまま残し、確定前の評価だけを集計し直す。見本の会社（cmp_sample）に提出済み・下書き・未回答が混ざった受付中の評価期間を足し、手元の seed の受付中の期にも評価を作れる人数の提出済みを持たせる（G28）。本章の serves_goals に足したのは G25・G27・G28 で、G26（行動指針と KPI・評価セットの画面の認知の負荷）と G29（共通部品のグラデーションと色使い。appr-foundation-017 でボタン以外のカードや表などへ広げた）は、要件の土台の承認の問としてだけ本章に出る。
根拠: qa-ab09-finalized-evaluation-keep、qa-ab10-band-drift-rewrite、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、qa-ab13-foundation-016-approval、qa-ab15-foundation-017-approval、G25、G27、G28、appr-foundation-016、appr-foundation-017（system-spec/database.md）

2026-10-19〜20 の追加: 事業所の達成率の3つの表と評価の表の2列を消す。レポートのための新しい表は作らず、確定済みの評価と評価の項目から作る。評価の表に上司の判断の6列（NULL 可）を足す。シードに、複数の期の確定済みの評価・アンケートの各状態・ズレの3種類・直属の部下の関係・判断の5通りを足す。
2026-10-22 の追加: 本番 DB の写しを、公開リポジトリとその成果物・ログに置かない（G30）。戻すときの元は D1 の Time Travel（無料のプランで7日。D-010）だけで、restore は DB 全体を戻す。新しい表と列は足さない。
根拠: qa-ac12 (16)(18)、G30（system-spec/database.md）

## Context and drivers

業務の文脈は、書き込みの結果が一覧へすぐ出ず、会社追加が会社・管理者・所属を別々に書いて途中の失敗で中途状態が残り得たことにある。加えて、等級名に英語の区分名が混ざり、users.email が一意で会社への所属を表す表が無いため、2社目に登録できない。優先する品質は、書き込み直後の読み取りの鮮度（G2）、途中失敗で一部を残さない原子性（G5）、等級名の一貫した反映（G6）、実際の判定と食い違わない権限の一覧（G8）、確定済みの最新評価との一致（G9）、所属による会社の境界（G10）、対象者全員の提出状況（G11）、並び順の全体の保存（G13）である。制約は、D1 に対話的なトランザクションが無いこと、1文の bound parameter を99個以下に分けること（chunkRowsForD1）、Workers・D1 の構成を変えないこと、本番 DB は読み取り専用で調べることである。
根拠: qa-f02、qa-f06、qa-f07、qa-v01、qa-v26、D-003（system-spec/database.md、system-spec/00-requirements-definition.md の U2・U8）

2026-10-19〜20 の追加: 2026-10-19 の依頼（KGI の削除・評価レポート・全ての項目を確かめられるテストデータ）と 2026-10-20 の依頼（上司の判断）で、表の削除・列の追加・シードの拡張が必要になった。優先する品質は、本番のデータを壊さずに消すこと（G17）、テストデータで全ての画面と項目が出ること（G20）、判断を記録してもとの点数の判定を書き換えないこと（G24）である。
根拠: qa-x01、qa-y01、qa-y15（system-spec/database.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビュー（SYS-EVAL-REPORT-P01）で、節番号が2系統あること、canViewEvaluationOf と既存の関数の関係、DD-012 を改めたこと、Deploy の手順などの食い違いが見つかった。計画は『P13 で手動で2回公開する』としていたが、main にマージすると自動で本番に出る。本番には、マネージャーが CSV で会社全員分の結果を取れる漏れと、管理者だけのメモがマネージャーに見える漏れの2件があった。上司が書く昇給・昇格の理由は本人にも同じ文で見せるので、点数などが書かれると本人へ漏れる恐れがあった。
根拠: qa-z03（system-spec/database.md）

2026-10-21〜22 の追加: 2026-10-22 の依頼（画像5枚と本文）で、行動指針の既定の分け方、後から設定した方を正とする追従、評価を作る画面を試す仮のデータが求められた。調べると、画像の分け方は等級1だけが g3_4 へ移った状態で、製品仕様 §28-12 と DD-010 に記録された本番の状態と一致した。設定とアンケートは『制度が正・アンケートは写し』で、アンケートから設定へ戻す経路が無く、updated_at は src/lib/impact.ts の集計し直しの判定にしか使われていない。本番の見本の会社は5期すべて締め済みで、提出済みの回答を持つ受付中の期が無い。優先する品質は、既定の分け方が新しい会社と既存の会社の両方で成り立つこと（G25）、両方向の追従と確定した時点の写しの保持（G27）、仮のデータで評価を作れること（G28）である。
根拠: qa-ab01-settings-ui-overhaul-request、qa-ab02-behavior-band-default-observed、qa-ab04-setting-copy-propagation-observed、qa-ab05-evaluation-build-showcase-observed、G25、G27、G28（system-spec/database.md）

2026-10-19〜20 の追加: 2026-10-19 の依頼（事業所の達成率の削除・評価レポート・全ての項目を確かめられるテストデータ）と 2026-10-20 の依頼（上司の判断）で、表の削除・列の追加・シードの拡張が必要になった。優先する品質は、本番のデータを壊さずに消すこと（G17）、テストデータで全ての画面と項目が出ること（G20）、判断を記録してもとの点数の判定を書き換えないこと（G24）である。
2026-10-22 の追加: 依頼（qa-ac01）を受けた監査を経て、Actions の成果物にあった本番 D1 のバックアップ4件を 2026-10-22 に削除した。戻す元は Time Travel だけにする（qa-ab02、D-010）。
根拠: qa-ac01、qa-ab02、qa-ac12 (16)（system-spec/database.md、system-spec/00-requirements-definition.md）

## Goals and non-goals

Goals: 複数の表を書く書き込みの中途状態を0件にする（G5）。書き込み直後の再読み込みが必ず結果を含む（G2）。等級名の変更が次の表示から全てに反映される（G6）。権限の定義を DB に持たず、表示と判定が route-ledger.json の同じ定義を読む（G8）。一覧の等級と点数がいつ見ても確定済みの最新と一致する（G9）。同じ人が1つのアカウントのまま複数の会社に所属できる（G10）。提出状況を対象者全員について既存の表から求められる（G11）。並び順の全体を1回の batch で保存できる（G13）。Non-goals: 読み取りの複製（read replication）を今は入れない。提出状況のための新しい表や一覧用の写しの列を作らない。権限の定義の表と編集画面を作らない。控えの掃除のために決まった時刻に動く仕組みを足さない。等級名の一律の書き換えを除く本番データの移行・修正を行わず、等級の id と pointGroup の値を変えない。
根拠: qa-v26、qa-r-database-3、D-007（system-spec/database.md の To-Be / Delta）

2026-10-19〜20 の追加: Goals: KGI の表と列を2回目の Deploy で消す。判断の列を既存の行を書き換えずに足す。シードを2回流しても同じ結果にする。Non-goals: レポートの写しの表、判断の履歴の表、本番 DB へのテストデータの投入、確定済みの評価の個人Pt・賞与額・根拠の文の作り直し。
根拠: qa-y15、qa-y07（system-spec/database.md、system-spec/00-requirements-definition.md の U7）

2026-10-21〜22 の追加: Goals: 既定からずれた会社の割り当てを移行で既定へ戻し、新しい会社は既定で始める（O25）。両方向の反映を保存の処理に組み込み、写しを持つ全ての場所に追従の規則を決める（O27）。手元の seed と本番の見本の会社に受付中の評価期間を用意する（O28）。Non-goals: 範囲の外の『本番データの移行・修正』の除外に、行動指針の既定の割り当てへの書き換え（I26）と、この仕様で足した移行のうち行を書き換えるもの（0032〜0039 のうち6本）を挙げ、それ以外は行わない。『本番 DB へのテストデータの投入』は手元の seed と E2E のデータを指し、本番の見本の会社への仮のデータ（G28・I31）は除く。
根拠: qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、G25、G27、G28、appr-foundation-019、appr-foundation-020（system-spec/database.md）

2026-10-19〜20 の追加: Goals: 事業所の達成率の表と列を2回目の Deploy で消す。判断の列を既存の行を書き換えずに足す。シードを2回流しても同じ結果にする。Non-goals: レポートの写しの表、判断の履歴の表、本番 DB へのテストデータの投入、確定済みの評価の個人Pt・賞与額・根拠の文の作り直し。
2026-10-22 の追加: Goals: 公開物に本番のデータを置く工程を0件にする（O30）。Non-goals: 新しい表と列は足さない。#97 で消した事業所の達成率の3つの表と2列は戻さない（qa-ac05）。
根拠: qa-ac05、qa-ac12 (17)(18)、O30（system-spec/database.md、system-spec/00-requirements-definition.md）

## System context and boundaries

書き込み元は、画面から呼ぶ Server Functions（runAction）、外部のエージェント向け API（Bearer 鍵）と端末の承認、利用記録である。スマホ・タブレットのブラウザも同じ API と D1 を使うため、端末による違いは無い。会社の境界は companyId で、所属の導入後は、cookie が指す会社への所属をサーバーがリクエストのたびに確かめて決めた会社になる（D-004）。会社をまたぐ参照を作らず、会社追加の集約の外にある他社の行には触れない。秘密の境界として、初期パスワードの控えは平文の列を持たず、暗号の鍵は DB に置かない。データの形の変更は drizzle/migrations を通し、本番は Deploy の自動マイグレーションで反映する。
根拠: qa-r-database-3、qa-f02、qa-v26、qa-v27、qa-v29、qa-r-security-3、D-004（system-spec/database.md、system-spec/auth.md、system-spec/infrastructure.md、system-spec/security.md）

2026-10-21〜22 の追加: アンケートから設定への書き戻しも、設定の保存と同じ権限（会社の管理者以上）・会社の絞り込み・同時に保存したときの 409・制度の変更の記録を通す（I28）。見本の受付中の期は見本の会社（cmp_sample）に紐づく行だけに INSERT し、他社の行に触れない（I31）。手元の seed（scripts/seed-data.mjs）は scripts/seed-target.mjs が --remote を断るローカル専用のままにする。仮のデータの氏名は実在しない『サンプル』などにし、本物の会社のデータには入れない。
根拠: qa-ab05-evaluation-build-showcase-observed、qa-ab12-showcase-data-location、qa-ab13-foundation-016-approval、G27、G28、appr-foundation-016（system-spec/database.md）

## Container and component view

D1 データベース（env.DB）が唯一の永続化先で、src/db/schema.ts の表（会社・事業所・利用者・セッションとアカウント・等級以下の制度設定・評価期間・アンケートと回答・評価・改善要望など）を持つ。永続化層（src/lib）は getDb()、一括挿入を分ける chunkRowsForD1、会社追加の制度ひな形を複製する copyCompanyMasters（src/lib/template.ts）、段階と取り消しの組を持つ withCompensation を受け持ち、取り消しを書き込みの関数の中に散らさない。追加で、所属の表とその読み書きの関数、等級名の書き換え前の値を残す記録用の表、等級名の変更と所属の追加・削除を残す監査ジャーナル、表示名の生成元になる等級の呼び名の共通の関数を置く。権限の定義は route-ledger.json に足し、DB の表を足さない（D-007）。配置は Cloudflare Workers（OpenNext）と D1 の今の構成のまま変えない。
根拠: qa-f02、qa-f07、qa-r-database-3、qa-v26、qa-v29、qa-v30、D-007（system-spec/database.md、system-spec/backend.md、system-spec/infrastructure.md）

2026-10-19〜20 の追加: 評価の表（evaluations）に raise_decision・promotion_decision（'follow' か 'override'。NULL は記録なし）、raise_decision_reason・promotion_decision_reason（文字列、NULL 可）、decision_recorded_by（利用者の参照。evaluator_id と同じ扱い）、decision_recorded_at（時刻）を足す。点数の判定の列（raise_eligible・promotion_eligible と理由の列）は変えない。個人Pt・賞与額・根拠の文の列と、昇給の設定の1点あたりの円は残し、評価と回答の事業所の写し（office_id）はレポートの見出しに使うので残す。
根拠: qa-y15（system-spec/database.md）

2026-10-21〜22 の追加: アンケートから設定への書き戻しは、設定の保存と同じ永続化層の関数を通し、アンケートの設問と元の設定（KPI の設問の文・評価セットの項目・行動指針の観点・等級要件）を同じ batch で書く（I28）。設定の保存は、同じ設定を使う回答0件の下書きを作り直し（今の rebuildFormQuestions は全設問を1つの batch で入れ直す）、回答のある公開中のアンケートには次の版の下書きを作る（I29）。設定の写しを持つ場所（アンケートの設問、回答の見出し、評価の項目・行動指針・等級要件、ズレの表、評価レポート、CSV など）の一覧を文書に置き、『参照』『追従』『確定した時点の写し』のどれかに決めて契約テストで抜けを落とす（I30）。行動指針の初期設定の説明の文（src/app/admin/behavior/page.tsx）は固定の文をやめ、いまの割り当てから作る（I26）。
根拠: qa-ab02-behavior-band-default-observed、qa-ab04-setting-copy-propagation-observed、qa-ab08-published-form-follow、qa-ab13-foundation-016-approval、G25、G27、appr-foundation-016（system-spec/database.md）

## Cross-cutting contracts

識別とアクセス: 全ての読み書きを選んでいる会社の所属で絞る。選んでいる会社は cookie の値をそのまま信じず、リクエストのたびに所属で確かめて決める（D-004）。一般の社員への応答には、他人の等級と点数をデータを作る段階で含めない。エラーと回復性: batch は全部書けるか何も書かれないかで、会社追加は逆順に取り消す。制度マスタの同時保存は後のほうの batch を丸ごと失敗させて 409 で断り、自動でやり直さない。可観測性と監査: 取り消しの失敗は compensation_failed として Workers Logs に残す。等級名の変更と所属の追加・削除は監査ジャーナルに変更前と変更後を、一律の書き換えは書き換え前の値を残す。設定と秘密: 控えの表は暗号文・初期化ベクトル・鍵の版だけを持ち、鍵は Workers の secret に置く。互換性: 等級の id と pointGroup を変えず、マイグレーションは2回流しても結果が変わらない。
根拠: qa-r-database-3、qa-r-backend-4、qa-v26、qa-v28、qa-r-security-3、D-004（system-spec/database.md、system-spec/security.md）

2026-10-19〜20 の追加: 評価の表に（会社・人・状態）で引ける索引があるかを確かめ、無ければ足す。テストデータの人名と値・判断の理由の文は架空にし、本番の設定ではシードを動かさない。
根拠: qa-y15（system-spec/database.md）

2026-10-20〜21 の追加: 本人に見せる文: 昇給・昇格の理由は本人にも同じ文で見せるので、保存のときに本人に見せられない語（点数・配点・必要点数につながる表現）を検査し、引っかかった語を名指しして断る（I25）。上司コメント（evaluatorComment）にも、保存のときに同じ検査をかける。表示のときに文を差し替えないので、本人には書いたとおりの文が届き、数値も漏れない。
根拠: qa-z03（4問目）、qa-z05（問4）、DD-023（system-spec/database.md）

2026-10-21〜22 の追加: エラーと回復性: 評価セットの決まり（等級区分ごとの項目数・固定枠・20点枠）や KPI の計算に要る設問（分子・分母など）に合わなくなる書き戻しは、batch を作る前にアンケートも設定も変えずに断り、合わない決まりと直す画面を示す。同じ設定を2人が同時に保存したときの 409 を書き戻しと自動の下書きにも当て、後の保存が黙って上書きしないようにする。可観測性と監査: 書き戻しも制度の変更の記録を通し、どのアンケートと評価が変わったかを保存の結果の文で示す。鮮度: 保存の後は関係する全ての画面を取り直し、他のタブにも知らせる（製品仕様 §27）。
根拠: qa-ab04-setting-copy-propagation-observed、qa-ab11-survey-writeback-rule-conflict、qa-ab13-foundation-016-approval、G27、appr-foundation-016（system-spec/database.md）

2026-10-22 の追加: 可観測性: DB エラーのログに渡した値を出さず、種類と場所だけを出す（G35）。
根拠: qa-ac10 (25)（system-spec/backend.md、system-spec/database.md）

## Subtype architecture

合成対象の subtype と該当テンプレート:

- Frontend: N/A: subtype 非選択
- Backend: N/A: subtype 非選択
- Infrastructure: N/A: subtype 非選択
- Data: 合成済み (`architecture-data.md`)
- Security: N/A: subtype 非選択

2026-10-22 の追加: Data に、本番 DB の写しの置き場・戻す元・#97 を戻さないこと・回数制限の表の上限を足す（G30・G36）。
根拠: qa-ac12（system-spec/database.md）

### Data architecture

#### Data domains and ownership

記録の正本は D1 の1つのデータベースで、表の定義は src/db/schema.ts、形の変更は drizzle/migrations が持つ。会社が所有の単位で、制度設定（等級・要件・行動指針など）・評価期間・アンケート・評価は会社ごとに持ち、会社をまたぐ参照を作らない。利用者の会社ごとの役割・等級・事業所・上司は、『利用者と会社の組』である所属の表が正で、users はメールアドレスで一意のアカウントを表す。権限の定義は業務データではなく仕様の台帳（route-ledger.json）の定義なので、D1 に持たない（D-007）。所属していない会社のデータは読めず、一般の社員には他人の等級と点数を返さない。
根拠: qa-f02、qa-v26、qa-v28、D-004、D-007（system-spec/database.md、system-spec/security.md）

2026-10-21〜22 の追加: 行動指針のまとまりの割り当ては等級の集約の中の値として扱う。まとまりは等級名ではなくセットの code と等級の display_order で決まる（src/lib/domain/behavior-band-range.ts の bandRuns）ので、等級名の変更は割り当てを変えない。評価セットの決まり（等級区分ごとの項目数・固定枠・20点枠）と KPI の計算に要る設問（分子・分母など）は、評価セットと KPI 項目の集約が持つ不変条件とする。確定した評価とレポートは確定した時点の写しとして集約の外から書き換えず、見本の受付中の期は見本の会社（cmp_sample）の集約の中だけに作る。
根拠: qa-ab02-behavior-band-default-observed、qa-ab09-finalized-evaluation-keep、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、G25、G27、G28（system-spec/database.md）

2026-10-22 の追加: 監査の台帳は docs/security/ に置き、DB の表にしない。
根拠: qa-ac12 (18)（system-spec/database.md）

#### Logical and physical model

所属の表は利用者・会社・役割・等級・事業所・上司・作成日時を持ち、利用者と会社の組を一意にし、上司は同じ会社の所属を指す。等級は id と pointGroup（結合キー）を変えずに名前を持ち、既定名は『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』で、data/grades.json・seed-data.mjs・seed-grade-schemes.mjs・drizzle/seed.sql・copyCompanyMasters の全てをそろえる。行動指針のセット名と、利用者が自分で付けていないアンケートの既定のタイトルは保存せず、割り当てた等級の名前から作る。initial_credential_memos は利用者ごとに1行で暗号文・初期化ベクトル・鍵の版・発行者・発行時刻を持って平文の列を持たず、constitution_events は実体ごとの番号を一意にする（uq_ce_entity_seq）。評価の表は確定済み（finalized）の KPI評価点（totalScore）と等級要件の達成率（requirementRate）を持ち、一覧はここから読む。
根拠: qa-v26、qa-r-database-3（system-spec/database.md）

2026-10-19〜20 の追加: KGI の3つの表と評価の2列を消し、評価の表に判断の6列（NULL 可）を足す。レポートは新しい表を持たず、確定済みの評価と評価の項目から作る。
根拠: qa-y15（system-spec/database.md）

2026-10-21〜22 の追加: 行動指針の既定の分け方の正本は data/grades.json の band、drizzle/seed.sql、src/lib/domain/behavior.ts の DEFAULT_BAND_SETS の3つで、等級1・等級2が g1_2、等級3・等級4-1・等級4-2が g3_4、等級5-1・等級5-2が出さない（null）、観点は各5件である。新しい会社はテンプレート会社の等級・セット・観点を写すだけで、既定を当て直す処理は無い。form_questions、form_answers の question_*、evaluations と evaluation_* は作った時点の写しである。updated_at は多くの表にあるが、使うのは src/lib/impact.ts の集計し直しの判定だけである。
根拠: qa-ab02-behavior-band-default-observed、qa-ab04-setting-copy-propagation-observed、G25、G27（system-spec/database.md）

2026-10-19〜20 の追加: 事業所の達成率の3つの表と評価の2列を消し、評価の表に判断の6列（NULL 可）を足す。レポートは新しい表を持たず、確定済みの評価と評価の項目から作る。
2026-10-22 の追加: 新しい表と列は足さない。自前の回数制限の表には、件数の上限と古いものの掃除を入れる（G36。system-spec/backend.md）。
根拠: qa-ac10 (23)、qa-ac12 (18)（system-spec/database.md、system-spec/backend.md）

#### Access and consistency

読み取りは primary に届き、書き込みを確定した後の読み取りは同じ要求でも次の要求でも最新を返し、読み取りの複製（withSession）を将来入れるなら書き込みの応答の bookmark を次の読み取りへ渡すことを鮮度の契約に含める。一つの操作で複数の表を書く経路は1回の batch（SQL のトランザクションとして扱われる）で書き、ID はアプリ側で先に採番し、bound parameter を99個以下に分けた文も同じ batch に入れる。並び順の保存は全体を受けて display_order を1から振り直す書き込みを1回の batch で行い、版を持つ要件（等級要件・昇格の条件と要件）は新しい版を作る。一覧の等級と点数は一覧ぶんをまとめて1回の問い合わせで取り、提出状況はアンケート・回答・対象者の既存の表から求めて、写しの列を持たない。所属の読み書きは永続化層の関数に閉じ、getViewer と一覧の問い合わせは選んでいる会社の所属を受け取るだけにする。
根拠: qa-f07、qa-r-database-3、qa-v26、qa-v30、D-003、D-004（system-spec/database.md、system-spec/backend.md）

2026-10-20〜21 の追加: I4 で1回の D1 batch に入る書き込みの例は、利用者の発行・メンバー追加・期間・設問・制度設定・改善要望の状態変更・端末の引き取り・利用状況などで、消した KGI 実績の書き込みは例から外した。読み出しでは、マネージャーが CSV で会社全員分の結果を取れる漏れと、管理者だけのメモがマネージャーに見える漏れの2件を、この作業ツリーの変更の中で直した。昇給・昇格の理由と上司コメントは、本人に見せられない語に引っかかると、引っかかった語を名指しして保存を断る。
根拠: qa-z03（3問目・4問目）、qa-z05（問2・問4）、DD-021、DD-023（system-spec/database.md）

2026-10-21〜22 の追加: アンケートからの書き戻しは、アンケートの設問と元の設定を同じ batch で書き、決まりに合わない保存は batch を作る前に断って、片方だけが書かれた状態を作らない（I28）。設定の保存は、回答0件の下書きの作り直し（設定とつながらない設問は残す）、回答のある公開中のアンケートの次の版の下書き（すでにあればそれを作り直す）、確定前の評価の集計し直しを続けて書く（I29）。これらが1回の batch に収まるかは実装の前に見本の会社の件数で見積もり、収まらないときは会社追加と同じく段階に分けて各段階に取り消しを組にする。
根拠: qa-ab08-published-form-follow、qa-ab11-survey-writeback-rule-conflict、qa-ab13-foundation-016-approval、G27、appr-foundation-016（system-spec/database.md）

#### Lifecycle and governance

会社の追加は、会社、制度ひな形の複製、管理者（利用者・ログイン用アカウント・控えを1回の batch）の3段階で書き、途中の失敗では逆順に取り消す。所属を消すときはその会社の所属だけを消し、最後の所属を消したときは今の利用者の削除と同じに扱う。控えは利用者を消すと一緒に消え、発行から14日を過ぎたものは開く・一覧に出す時点で除き、次の発行（会社・利用者・メンバーの追加、再発行、CSV 取込）の batch の先頭で全社分まとめて消す。等級名の変更と所属の追加・削除は監査ジャーナルに変更前と変更後を残し、制度マスタの監査記録は同時保存の後のほうを 409 で断り、文書や見本に実データ（社員名・評価値）を入れない。
根拠: qa-r-database-3、qa-v26、qa-v28（system-spec/database.md、system-spec/security.md、system-spec/00-requirements-definition.md の U8）

2026-10-19〜20 の追加: テストデータ（複数の期の確定済みの評価・受付中の期・アンケートの各状態・ズレの3種類・直属の部下の関係・判断の5通り）は架空の人名と値でシード（scripts/seed-data.mjs）に置き、本番には入れない。
根拠: qa-y15（system-spec/database.md）

2026-10-21〜22 の追加: 設定を保存しても、締め切ったアンケート・確定した評価・評価レポートは変えず、回答のある公開中のアンケートは次の版の下書きを作るだけで、公開は人が行う（I29）。行動指針の割り当ては、既定への移行の後に会社が変えたときはその変更を正とする（I26）。見本の会社の受付中の期は提出済み・下書き・未回答を混ぜ、評価はまだ作らず、氏名と会社に見本の印を持たせる（I31・O28）。
根拠: qa-ab08-published-form-follow、qa-ab09-finalized-evaluation-keep、qa-ab10-band-drift-rewrite、qa-ab12-showcase-data-location、G25、G27、G28（system-spec/database.md）

2026-10-22 の追加: 本番 DB の写しを、公開リポジトリとその成果物・ログに置かない（G30）。#97 で消した3つの表と2列は戻さない（Time Travel で戻せる期限は 2026-10-28T07:49Z ごろ）。個人Pt・賞与額・根拠の文の列は残っている。
根拠: qa-ac05、qa-ac12 (16)(17)（system-spec/database.md）

#### Migration and recovery

所属の表の追加と既存の利用者全員への1件ずつの所属の作成、既存の全社の等級名の一律の書き換えと、既に保存された英語入りの表示名を既定の扱いへ戻すことをマイグレーションで入れ、等級の id と pointGroup は変えない。同じマイグレーションを2回流しても結果が変わらず、書き換え前の値は記録用の表に残して戻せるようにする。会社追加の取り消しが失敗したら compensation_failed を Workers Logs に残し、本番 DB を手で書き換えずに文書の手順（deploy-notes §7）で直す。本番の書き換えの前後は読み取り専用で対象を数え、英語の区分名が残っていないことを確かめる。
根拠: qa-v26、qa-v29、qa-v31、qa-r-ops-3（system-spec/database.md、system-spec/infrastructure.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 判断の列は足すだけのマイグレーションで1回で出す。KGI の表と列は2回目の Deploy で消し、その前に本番 DB を読み取りで数える。消す前の値は Deploy の自動バックアップに残る。
根拠: qa-y15、qa-x15（system-spec/database.md、system-spec/infrastructure.md）

2026-10-20〜21 の追加: KGI の3つの表と評価の2列を消すマイグレーションを当てる2回目の Deploy は、P08 の PR のマージで Deploy workflow が動く2回目の公開で、1回目の公開は P05 のマージである。P13 は、その CI の実行番号と backup、本番の読み取りを記録する役にする。
根拠: qa-z03（2問目）、qa-z05（問2）、DD-020、DD-024（system-spec/database.md）

2026-10-21〜22 の追加: 既定の割り当てへの移行は、等級の内部の識別子（beginner・regular／chief・am1・am2／manager1・manager2）で割り当ての列だけを UPDATE し、観点の文と会社が足した観点には触れない（I26）。既定のまとまりが無い会社は書き換えずに件数を報告する。範囲の外の除外に挙げた行を書き換える移行は、0032（番号の振り直し）・0033（所属の表への既存の利用者の写し）・0034・0035（等級名の書き換え）・0036（取り込みで作った人の所属の補い）・0039（事業所の表の削除）で、0037・0038 は表と列の追加だけである。0021・0023・0025・0030 も行を書き換えるが、この仕様より前に足した移行なので挙げない。
根拠: qa-ab10-band-drift-rewrite、qa-ab18-foundation-020-approval、G25、appr-foundation-020（system-spec/database.md）

2026-10-19〜20 の追加: 判断の列は足すだけのマイグレーションで1回で出す。事業所の達成率の表と列は2回目の Deploy で消し、その前に本番 DB を読み取りで数える。消す前の値は D1 の Time Travel（無料のプランで7日。D-010）で戻せる（2026-10-22 から成果物へのバックアップは使わない）。
2026-10-22 の追加: 戻すときの元は D1 の Time Travel（7日。D-010）だけで、マイグレーションの前に時刻と bookmark を記録する。restore は DB 全体を戻すので、使うかは利用者が決め、外部変更ガードを通す。
根拠: qa-ac06 (7)、qa-ac12 (16)（system-spec/infrastructure.md、system-spec/database.md）

#### Data verification

write-atomicity-contract.test.ts が batch の外で2つ以上の表を書く関数を0件に保ち、会社追加は途中の段階と取り消しを失敗させる結合テストで会社・制度ひな形・利用者・アカウントのどの行も残らずログが出ることを確かめ、CSV 取込と評価の集計も batch の途中の失敗で確かめる。追加分は、等級名を変えたときに全表示が新しい名前になること、既定と移行後の等級名が『等級N』『等級N-M』の形であること、評価確定直後の一覧の点数が新しい値になること、登録済みのメールアドレスで2社目に所属でき所属していない会社が拒否されること、提出状況の数と一覧が合うこと、並び順の全体保存と 409 を確かめる。
根拠: qa-r-database-3、qa-r-ops-3、qa-v31、O5・O6・O9〜O11・O13（system-spec/database.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: シードを2回流しても同じ結果になるテスト、シードの後に全ての画面と項目が空にならずに出る E2E、2回目の Deploy の後の表と列の不在の読み取りの確認を置く。
根拠: qa-y15、qa-y16（system-spec/database.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: 賞与の計算の単体テストは、個人Pt＝KPI評価点の合計と、1点あたりの円が0以下なら賞与額を出さないことを確かめる。本番 DB に3つの表と2列が無いことの読み取りの確認は、2回目の公開（P08 の PR のマージで Deploy workflow が動く）の後に行う。
根拠: qa-z05（問2）、DD-020、DD-024（system-spec/database.md）

2026-10-21〜22 の追加: 移行のテストで、等級1だけが2つ目のまとまりへ移った会社が既定へ戻る、既定の会社は変わらない、呼び名を変えた会社も識別子で戻る、既定のまとまりが無い会社は書き換えずに件数を報告する、観点の中身は変わらない、を確かめる（O25）。書き戻しで元の設定が同じ保存で変わること、決まりに合わない保存が断られること、設定の保存で下書きが作り直され次の版の下書きが1つだけでき、確定した評価とレポートが変わらないことを、サーバー処理と結合テストで確かめる（O27）。写しを持つ場所の一覧とコードの一致は契約テストで確かめる。見本の生成のテストで受付中の期が1つあり他社の行に触れないことを確かめ、手元の見本で評価の一覧と詳細まで進める E2E を置く（O28）。
根拠: qa-ab13-foundation-016-approval、G25、G27、G28、appr-foundation-016（system-spec/database.md）

2026-10-22 の追加: d1-backup の成果物が0件であることを読み取りで確かめ、成果物へ上げる工程が無いことを静的検査で確かめる（O30）。
根拠: qa-ac07 (14)、O30（system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md）

## Architecture decisions

D-003（採択 opt-batch-first）: 1回の batch に入るものは batch、入りきらない会社追加は補償、戻せない書き込みの続きはやり直しにする。代替の『全部を1回の batch』は制度ひな形の複製が数百行になりうるため会社追加が入りきらず、『補償だけ』は補償そのものの失敗で中途状態が残る。多くの経路で書きかけを起こさず補償とやり直しを2か所に限れる利点を取り、補償まで失敗したときは記録と手順で直す負担を受け入れた。D-004（採択 opt-membership-cookie）: 利用者が選んだ（qa-v12）。所属を自前の表にして会社ごとの役割・等級・事業所・上司を持たせ、users.email の一意を残す。代替の better-auth の organization plugin は既存の companies 表と二重になり、等級・上司を member の表の外に持つ必要がある。URL に会社を入れる案は46画面のルートを全て移す。D-007（採択 opt-route-ledger-extend）: 利用者が①（route-ledger.json に操作と説明を足す）を名指しで選んだ（qa-v25、2026-10-13T03:40:15Z）。委任に基づいて AI が選んだ別の案とは違う案である。権限の定義は DB の表に持たず、編集画面も作らず、route-ledger.json に置く。DB の表で編集する案は、表と実際の判定のずれに気づけない（比べたときの不利な点）。①は台帳が1つで済み、画面を足したときの書き漏れを既存の route-ledger のテストで見つけられる。不利な点は、説明を直すたびに仕様文書の変更になることである。D-005 と D-006 は画面側の判断で、system-spec/frontend.md と system-spec/ui-ux.md の章で扱う。利用者は、D-007 ① に合わせて (9) を直した本章の文面を、旧と新を逐語で示されたうえで承認した（qa-v26、2026-10-13T03:48:20Z）。表示名を保存せず表示のたびに作る形、一覧に写しの列を作らない形、書き換え前の値を記録用の表に残す形は、この承認に含まれる。読み取りの複製は入れず、入れる場合は書き込みの応答の bookmark を次の読み取りへ渡すことを条件にする。
根拠: D-003（qa-u23、qa-u24）、D-004（qa-v12）、D-007（qa-v25）、qa-r-database-3、qa-v26（system-spec/database.md、system-spec/spec-state.json）

2026-10-19〜20 の追加: 判断の列のマイグレーションは列を足すだけなので、コードより先に当てても今のコードが動き、本番の Deploy の今の順番のまま1回で出せる。KGI の表と列を消すマイグレーションは、コードが読まなくなった後の2回目の Deploy で当てる（Deploy はマイグレーションをコードより先に当てるため）。判断の履歴は持たず、記録した人と時刻だけを持つ。
根拠: qa-y15、qa-x15（system-spec/database.md、system-spec/infrastructure.md）

2026-10-20〜21 の追加: 計画レビューの食い違いは『今は文書で確定、P12で反映』を選び、DD と計画レビューの記録に確定させて Beads の各 task にリンクを付け、P12 までは本文の古い記述より記録を優先すると明記した。『今 spec-state まで直す』は、取り込み済みの9 node が古い扱いになって next と requirements が止まるので選ばなかった。公開は『自動Deployに合わせて読み替え』を選び、『読み替え＋新画面はP07まで閉じる』と、計画の作り直しと harness の改修が要る『統合ブランチで1回にまとめる』は選ばなかった。権限の漏れ2件は、選択肢に無い答え『prは出さなくて良い』を『別の PR を出さず、この作業ツリーの変更の中で直す』と読んで直した。理由の文は『保存時に語を示して直してもらう』を選び、『同じ文を見せる』決めが崩れる『表示時に共通文へ差し替え』と、数値が漏れる恐れのある『検査しない』は選ばなかった。決めた中身の記録は DD-020〜DD-024（docs/product/design-decisions.md）と計画レビューの受領書である。
根拠: qa-z03、DD-020、DD-021、DD-022、DD-023、DD-024（system-spec/database.md）

2026-10-21〜22 の追加: 既定からずれた会社は、『画面に「既定に戻す」を置く』ではなく『データを既定へ書き換える』を利用者が選び、DD-010 の『移行で書き換えない』を改める DD を書く（qa-ab10）。回答のある公開中のアンケートは『公開中の設問を差し替える』ではなく『次の版の下書きを自動で作る』を、確定した評価と評価レポートは『最新で集計し直す』ではなく『確定した時点のまま残す』を選んだ（qa-ab08・qa-ab09）。書き戻し（I28）と設定の保存での下書きの作り直し（I29）は DD-015 と、DD-016 が却下した『聞き方の保存で下書きを書き換える』を改めるので、改める DD を書いてから実装し、公開の前の検査（staleAskingItems）は残す。仮のデータは『手元の見本だけ』ではなく『手元と本番の見本の会社の両方』を選び、製品仕様 §14 の『受付中の期は作らない』を改める DD を書く（qa-ab12）。
根拠: qa-ab08-published-form-follow、qa-ab09-finalized-evaluation-keep、qa-ab10-band-drift-rewrite、qa-ab12-showcase-data-location、qa-ab16-foundation-018-approval、G25、G27、G28、appr-foundation-018（system-spec/database.md）

2026-10-19〜20 の追加: 判断の列のマイグレーションは列を足すだけなので、コードより先に当てても今のコードが動き、本番の Deploy の今の順番のまま1回で出せる。事業所の達成率の表と列を消すマイグレーションは、コードが読まなくなった後の2回目の Deploy で当てる（Deploy はマイグレーションをコードより先に当てるため）。判断の履歴は持たず、記録した人と時刻だけを持つ。
2026-10-22 の追加: D-010（採択：Time Travel だけ）。公開リポジトリの成果物は第三者が読めるので、成果物へのバックアップは使わない。Time Travel は無料のプランで7日までで、それより前には戻せないことを台帳に残す。#97 は戻さない（qa-ac05）。
根拠: qa-ab02、qa-ac05、qa-ac12 (16)(17)（system-spec/database.md、system-spec/00-requirements-definition.md）

## Delivery, migration and rollback

表の形の変更は drizzle/migrations に積み、既存の 0031（initial_credential_memos）・0032（uq_ce_entity_seq）に続いて、所属の表の追加と既存の利用者全員への今の値どおりの所属の作成、等級名と英語入りの表示名の一律の書き換えを 0033 以降で入れ、本番の Deploy の自動マイグレーションと fail-closed のゲートに乗せる。どのマイグレーションも2回流して結果が変わらず、失敗しても途中の状態を残さない。戻すときは記録用の表に残した書き換え前の値を使う手順を用意する。本番の書き換えの前に読み取り専用で対象（会社数・等級数・英語入りの表示名の数）を数えて書き換え前の値を記録し、外部変更ガードを通して Deploy し、後で英語の区分名が残っていないことを読み取りで確かめる。
根拠: qa-r-database-3、qa-v26、qa-v29、qa-v31（system-spec/database.md、system-spec/infrastructure.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 2回目の Deploy の前に本番 DB を読み取りで数え、消す前の値は Deploy の自動バックアップに残る。判断の列は既存の行を書き換えないので、古い確定は『記録なし』のまま残る。
根拠: qa-y15、qa-x15（system-spec/database.md、system-spec/infrastructure.md）

2026-10-20〜21 の追加: main にマージすると自動で本番に出るので、計画の『P13 で手動で2回公開する』を、1回目＝P05 のマージ、2回目＝P08 のマージと読み替えた。P05 をマージする前に、P06 の自動テストと bundle の大きさ・cf:dry-run を P05 の PR の上で通すことを条件にする。P13 は、CI の実行番号と backup、本番の読み取りを記録する役にする。この読み替えで、計画の作り直しは要らない。
根拠: qa-z03（2問目）、DD-020（system-spec/database.md）

2026-10-21〜22 の追加: 行動指針の既定の割り当てへの移行（I26）は戻せる単位にして、書き換えた会社の数と、既定のまとまりが無くて書き換えなかった会社の数を残す。書き換えた会社のアンケートは I29 の規則で追従させ、いまずれている下書きのアンケートは更新時刻の新しい方へそろえる（I30）。本番の見本の会社への受付中の期の投入は既存の db:sample:remote の手順で行い、実行の前に利用者の確認を取る（I31）。
根拠: qa-ab10-band-drift-rewrite、qa-ab12-showcase-data-location、qa-ab13-foundation-016-approval、G25、G27、G28、appr-foundation-016（system-spec/database.md）

2026-10-19〜20 の追加: 2回目の Deploy の前に本番 DB を読み取りで数え、消す前の値は D1 の Time Travel（無料のプランで7日。D-010）で戻せる（2026-10-22 から成果物へのバックアップは使わない）。判断の列は既存の行を書き換えないので、古い確定は『記録なし』のまま残る。
2026-10-22 の追加: Actions の成果物にあった本番 D1 のバックアップ4件は 2026-10-22 に削除した。マイグレーションの前に時刻と bookmark を記録する。
根拠: qa-ac06 (7)、qa-ac08 (22)（system-spec/infrastructure.md、system-spec/security.md）

## Risks and verification

リスクは、制度ひな形の行数が増えると batch の文の数や Workers の CPU 時間の上限に近づき、会社追加の段階の分け方を見直す必要が出ることである。取り消しやり直しまで失敗したときは手作業の直しが要る。cookie の会社への所属の確認を1か所でも漏らすと、所属していない会社のデータが見える（D-004）。users.company_id を読む約33か所と viewer.companyId を読む約140か所を所属の値へそろえ損ねても、会社の境界が崩れる。適合性の検査として、batch の外で2つ以上の表を書く関数を write-atomicity-contract.test.ts で落とし、会社追加・CSV 取込・評価の集計は途中で失敗させる結合テストで何も残らないことを確かめる。追加分は、評価確定直後の一覧の点数、2社目への所属と所属していない会社のデータが読めないこと、提出状況の数と一覧が合うこと、並び順の全体保存と 409 を検査で確かめる。
根拠: D-003、D-004、qa-r-ops-3、qa-v26、qa-v30、qa-v31（system-spec/database.md、system-spec/backend.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: リスクは、1回目の Deploy の前に表を消して古いコードが失敗すること、シードが2回目で重複すること、テストデータに実データが紛れることである。検査として、シードを2回流しても結果が同じになるテスト、シードの後に全ての画面と項目が出ることの E2E（O20）、2回目の Deploy の後に本番 DB に3つの表と2列が無いことの読み取りの確認（O17）を置く。
根拠: qa-y15、qa-y16（system-spec/database.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: リスクは、本人にも同じ文で見せる上司の理由に点数などが書かれて本人へ漏れることで、保存のときの語の検査で防ぐ（I25）。O17 の KGI の参照を探す静的検査（src・docs・route-ledger・nav で0件）は、docs のうち経緯を残す5種類（受領書・バックログの履歴・レビューの記録・判断の記録・デプロイ時の注意）を走査から外す。外す先が実在することも、同じ検査で確かめる。
根拠: qa-z03（4問目）、qa-z05（問2・問4）、DD-023、DD-024（system-spec/database.md）

2026-10-21〜22 の追加: リスクは、設定の保存に続けて書く行（下書きの作り直し・次の版の下書き・確定前の評価の集計し直し）が1回の batch に収まらないこと、本番の見本の会社に受付中の期を作ると本番の未回答の一覧に見本の人が並ぶこと（製品仕様 §14 が挙げた影響）である。前者は実装の前に見本の会社の件数で見積もる。検査として、既定の割り当てへの移行のテスト（O25）、書き戻しと追従のサーバー処理・結合テストと写しの一覧の契約テスト（O27）、見本の生成のテストと評価を作る画面の E2E（O28）を置く。
根拠: qa-ab12-showcase-data-location、qa-ab13-foundation-016-approval、G25、G27、G28、appr-foundation-016（system-spec/database.md）

2026-10-22 の追加: リスクは、戻せるのが7日までであること（D-010）と、restore が DB 全体を戻すことで、台帳に残す。
根拠: qa-ab02、qa-ac07 (21)（system-spec/database.md、system-spec/maintenance-ops.md）


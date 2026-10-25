---
graph_node_id: "arch-system-spec-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "セキュリティ：鮮度の仕組みと追加要件で守ること（評価の見える範囲と本人向けの制限、設定とアンケートの追従の権限、本番の見本のデータ）"
project_id: "hr-evaluation-system"
domain: "security"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応"]
file_path: "architecture/system-spec-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "4676efe1705118ce25db8c322afba3594f5abe1c07820228f592525f4decddee", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-2026-10-22.json"}
source_lineage: {"imported_at": "2026-10-22T07:58:56Z", "origin_kind": "system-spec-harness", "source_digest": "4676efe1705118ce25db8c322afba3594f5abe1c07820228f592525f4decddee", "source_path": "system-spec/security.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-security.md", "confidence": 0.92}, {"artifact_kind": "specification", "candidate_path": "specs/system-spec-security.md", "confidence": 0.4}]
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

この章は、鮮度の仕組みを入れても守るべきことと、2026-10-12 の追加要件で増える守りを受け持つ。既存の要件の柱は、他タブへの通知に中身を載せないこと、ログイン後の応答を private, no-store にすること、初期パスワードの控えを AES-GCM で暗号化して利用者 ID に結び付けること、別のサイトからの呼び出しを二重に断ることである。追加要件では、等級名の変更の可否をサーバー処理で判定し、等級と点数を見てよい人にだけサーバーで載せ、複数の会社に所属する人の読み書きを選んでいる会社の所属で絞る。選んでいる会社は cookie の値をそのまま信じず、リクエストのたびにサーバーで所属を確かめて決める（D-004）。権限一覧の表示は、実際の判定と同じ定義（route-ledger.json。D-007 ①）から作り、表示と判定の食い違いをテストで落とす。等級名の変更・所属の追加と削除・本番の一律の書き換えは監査に残す。この追加の全文は、D-007 ① に合わせて (6) を直したうえで、利用者が承認した（qa-v28、2026-10-13T03:48:20Z）。上流指針は OWASP ASVS と Secrets Management Cheat Sheet である。根拠: qa-v28, qa-r-security-3, qa-v12, qa-v25／system-spec/security.md

2026-10-14 の追加で、比べる警告のリンク先、ズレを読む処理の範囲、createForms の等級の確かめ方を定めた（G16）。この追加の全文は、利用者が全文のまま承認した（qa-w09、2026-10-14T20:46:24Z）。根拠: qa-w09／system-spec/security.md

2026-10-19〜20 の追加: レポート・評価の中身・CSV・メモの見える範囲をサーバーで絞り（canViewEvaluationOf）、本人向けの応答には点数の数値・満点・他の人との比較の値を含めない。上司の判断はサーバーで権限を確かめてから書き、理由は本人にも見える文として文字のまま出す。KGI の表を消したあとに読み書きする経路が残らないことを静的検査で確かめる。
根拠: qa-z02（system-spec/security.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビュー（SYS-EVAL-REPORT-P01）で見つかった食い違いと、利用者の判断（qa-z03・qa-z04）を受け、qa-z02 の (9) を DD-021 の4・6 と DD-024 の2・4・5 のとおりに読む訂正を足した。「レポート・評価の中身・CSV・メモの見える範囲をサーバーで絞り（canViewEvaluationOf）」を改めた：今は canViewEvaluationOf を使うのはレポートの画面だけで、CSV の書き出しは上司側の判定、メモは公開範囲の判定で絞る。上司の判断の理由と上司コメントは、保存のときに本人に見せられない語を検査して断る（DD-023）。本番にあった2件の権限の漏れ（マネージャーの CSV と「管理者のみ」のメモ）は、別の PR を出さずにこの作業ツリーの変更の中で直した。To-Be の O17・O19・I20・I25 は、この訂正に合わせた文と測り方になった。
根拠: qa-z03、qa-z04、qa-z05、qa-z06、DD-021、DD-023、DD-024（system-spec/security.md）

2026-10-21〜22 の追加: この章の資するゴールに G27（設定とアンケートの設問の、後から変えた方を正とする追従）と G28（評価を作る画面を試す見本のデータ）を足した。アンケートから設定への書き戻しは、画面で操作を隠すだけにせず、サーバーで会社の管理者以上と会社の範囲に絞り、確定した評価とレポートは確定した時点のまま残す。本番の見本の会社には見本の会社に紐づく行だけを INSERT し、投入の前に利用者の確認を取って実データを混ぜない。G29 のグラデーションは globals.css の中だけで作り、外から読み込む資源を足さない。2026-10-21 の評価レポートの A3・A4 の印刷と、キーごとの点数・等級の推移の追加では、認可・本人向けの数値の非表示・判断・計算・確定・スキーマを変えない。要件の土台の追記（G25〜G29）は appr-foundation-016 で承認し、文を改めるたびに 017〜020 で取り直した。
根拠: qa-ab07-survey-to-setting-direction、qa-ab12-showcase-data-location、qa-aa04-report-landscape-onepage-design、qa-ab13-foundation-016-approval、qa-ab18-foundation-020-approval、G27、G28、G29、appr-foundation-016、appr-foundation-020（system-spec/security.md）

## Context and drivers

鮮度の仕組みは他タブへの通知や応答の手がかりを足すので、会社をまたいだ漏れと秘密の露出を防ぐ条件が必要になった。連続作成で発行した控えを一覧から開き直したいという決定（qa-u19）から、控えを保存しつつ平文で持たない設計が求められた。2026-10-12 の依頼（qa-v01）、利用者の決定（qa-v02）、G6〜G15 の全文承認（qa-v03）で、等級名の編集権限、等級と点数の表示範囲、複数会社への所属が加わった。所属と選んでいる会社の持ち方は、利用者が自前の所属の表と cookie の案を選んだ（D-004、qa-v12）。権限の定義の置き場所は、3案を比べて中立に問い直し、利用者が route-ledger.json に操作と説明を足す案を選んだ（D-007 ①、qa-v25）。前提として next.config.ts は全応答に nosniff・X-Frame-Options DENY・HSTS・CSP（connect-src 'self' など）を付けている（qa-f04）。根拠: qa-v28, qa-r-security-3, qa-u19, qa-f04, qa-v12, qa-v25／system-spec/security.md

2026-10-19〜20 の追加: 2026-10-19 の依頼で個人別の評価レポートと直属の部下の閲覧が加わり、今はマネージャーが会社の全員分の CSV と管理者向けのメモを得られることが調査で分かった。2026-10-20 の依頼で、本人にも見える上司の判断の理由が加わった。優先する品質は、範囲の外のデータをサーバーが返さないこと（G19）と、判断と理由を見てよい人に同じ形で示すこと（G24）である。
根拠: qa-x05、qa-y01、qa-z02（system-spec/security.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 計画レビュー（SYS-EVAL-REPORT-P01）で、節番号が2系統あること、canViewEvaluationOf と既存の関数の関係、DD-012 を改めたこと、Deploy の手順などの食い違いが見つかった。main にマージすると自動で本番に出る仕組みが、計画の「P13 で手動で2回公開する」と合わなかった。既存のメモの漏れを直すと、マネージャーが「管理者のみ」で書いたメモが書いた本人の画面から消えると分かり、扱いを利用者に問うた。決めた中身は DD-020〜DD-024 と計画レビューの受領書に記録した。
根拠: qa-z03、qa-z04、DD-020〜DD-024（system-spec/security.md）

2026-10-21〜22 の追加: 2026-10-21 の依頼で、評価レポートを A4 なら切りのいい所で区切った複数枚、A3 なら1枚で出すこと、出力に入る URL を整えること、キーごとの点数と等級の変化が分かる図表が加わった（qa-aa03・qa-aa05 は利用者の逐語）。その作業の中で、対象者を表す employeeIds が空の配列のときに全員を対象にしていた不具合が見つかった。2026-10-22 の依頼とコード調査の結果は、要件の土台の U1・U2 の末尾に足した。書き戻しの扱いは、評価セットの保存（saveScheme）が等級区分ごとの項目数・固定枠・20点枠をサーバーで検査することと、下書きにつながった設問を新しく足せないこと（checkQuestionLinks）を確かめてから問うた。見本のデータの置き場所は、本物の会社のデータには入れないという README の規範を前提に問うた。
根拠: qa-aa03-report-paper-user-revision、qa-aa05-report-score-grade-request、qa-aa02-empty-evaluation-scope、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、qa-ab13-foundation-016-approval（system-spec/security.md）

## Goals and non-goals

ゴールは G2（再読み込みで直前の書き込み結果を含む）、G3（他タブと画面復帰で古い一覧を残さない）、G7（等級名を変えられるのはシステム全体管理者と自社の会社管理者だけ）、G8（権限の表示と判定が食い違わない）、G9（等級と点数は見てよい人にだけ）、G10（同じメールアドレスで複数の会社に所属でき、所属していない会社のデータは見えない）である。非ゴールは、別の利用者の画面への即時配信、オフライン編集と同期、配色・テーマの変更、本番データの移行・修正（等級名の一律の書き換えを除く）、役割の種類の追加、権限の定義を画面から編集できるようにすることである。許可するオリジンを足すことと、CSP の connect-src を広げることはしない。根拠: qa-v28, qa-r-security-3, qa-u24, qa-v27／system-spec/security.md・system-spec/auth.md

2026-10-19〜20 の追加: Goals: 範囲の外の人のレポートの URL を 404 にする。マネージャーの CSV を直属の部下の行だけにする。管理者向けのメモを会社の管理者以上にだけ返す。本人向けの応答に点数の数値を含めない。Non-goals: レポートを PDF などのファイルとしてサーバーで作ること（印刷はブラウザで、別のデータを返す経路を作らない）。
根拠: qa-z02、qa-y07（system-spec/security.md、system-spec/00-requirements-definition.md の U7）

2026-10-20〜21 の追加: O19 の文に、上司の判断は評価の詳細と同じ範囲で見せ、見える人を増やさないことを足した。自分を評価する側にも立つ人が自分について見られる情報は O19 の外に置き、SECURITY-013 で決める。
根拠: qa-z05、DD-021、DD-024（system-spec/security.md）

2026-10-21〜22 の追加: Goals: G27 は、設定（等級要件・行動指針・KPI・評価セット）とアンケートの設問のどちらを後から変えても、後から変えた方を正として、もう一方と写しを持つ全ての画面と機能を追従させる。G28 は、提出済みの回答を含む受付中の評価期間の仮のデータ（氏名は実在しない「サンプル」など）を、手元の見本と本番の見本の会社の両方に用意する。Non-goals: 本番 DB へのテストデータ（手元の seed と E2E のデータ）の投入で、本番の見本の会社への仮のデータ（G28・I31）は除く。範囲の外の「本番データの移行・修正」から除くものに、行動指針の既定の割り当てへの書き換え（I26）と、この仕様で足した行を書き換える移行（0032・0033・0034・0035・0036・0039）を挙げた。評価レポートの推移の図では、新しい列・再計算・判断基準・閲覧権限を足さない。
根拠: G27、G28、qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、qa-aa06-report-score-grade-design（system-spec/security.md）

## System context and boundaries

守る境界は会社で、他社や担当外の対象は区別せず 404 にする（route-ledger の notFound）。セッションは要求ごとに D1 から読み、cookieCache を入れないので、ロールの変更・会社の利用停止・利用者の無効化は次の要求で効く。他タブへの通知は同じブラウザの同じオリジンにしか届かず、別の利用者の画面へは届かない。外部のエージェント向け API（Bearer 鍵）と端末の承認は、今の Route Handler と認可のまま残す。複数の会社に所属する人は、選んでいる会社を cookie（hr_company。httpOnly・Secure・SameSite=Lax）で持つ。cookie の値と送られた会社の id はそのまま信じず、getViewer がリクエストのたびに cookie が指す会社への所属をサーバーで確かめて決める（D-004）。cookie が無いときや所属していない会社を指すときは、有効な所属のうち会社名の順（同名は会社 id の順。D-009）で最初の会社を使い、所属が1つの人は今と同じ動きにする。根拠: qa-v28, qa-r-security-3, qa-f04, qa-u25, qa-v12, qa-v27／system-spec/security.md・system-spec/auth.md

2026-10-19〜20 の追加: 印刷は画面に出ている内容だけをブラウザで刷り、印刷のために別のデータを返す経路を作らないので、本人向けの制限と見える範囲がそのまま紙にも効く。アンケートの状態の変更・延長・催促・公開時の古い版の締切・版の番号の処理は、会社の範囲で絞って他社の版に触れない。
根拠: qa-z02（system-spec/security.md）

2026-10-20〜21 の追加: レポートの URL は、範囲の外の人・他社の人・存在しない人を区別せず同じ 404 にし、応答の違いから人の有無を読ませない。ルート台帳にはレポートのページを足す（I20）。評価の詳細の2画面は今の判定のまま残し、レポートの判定へ寄せるのは SECURITY-013 を決めるときにする。
根拠: qa-z03、qa-z05、qa-z06、DD-021、DD-024（system-spec/security.md）

2026-10-21〜22 の追加: アンケートから設定への書き戻しは、会社の範囲の外の設定や他社の版を読まず、書かない。本番の見本の会社への受付中の期の追加は、見本の会社に紐づく行だけを書き、本物の会社の行に触れない。その影響として本番の未回答の一覧に見本の人が並ぶことを、製品仕様 §14 の改めとして記す。全体管理者は、既存の会社の切り替えで選んだ会社の全メンバーを閲覧できる。評価レポートの印刷では本文のアプリのナビとリンク先の URL を紙に出さず、ブラウザ自身のヘッダーとフッターは全ての環境では強制できないので、残るときは印刷設定でオフにする案内を出す。
根拠: qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、qa-aa01-report-access-print、qa-aa04-report-landscape-onepage-design、qa-aa09-report-print-final-alignment、G28、I31（system-spec/security.md）

## Container and component view

入口は Server Functions の共通の包み runAction・runRead で、送り元の検査と認可（apiViewer）、大きさの上限（413）、入力の検証（zod）、本体、成功時だけの refresh の順に通す。送り元の検査は、Next.js の Server Functions の Origin と Host の一致の検査と、入口の中の assertSameOrigin の二枚で、後者は送り元が読めない・別のサイト（ポートだけ違う場合も含む）なら、ログインを確かめる前に断る。控えは initial_credential_memos の表に暗号化して置き、行に鍵の版を持たせ、鍵 CREDENTIAL_ENC_KEY は Workers の secret にだけ置く。権限の定義は、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、この台帳1つにまとめる（D-007 ①）。サイドバー（nav.ts）・ページの入口（requireRole）・サーバー処理の役割の指定（ActionSpec.role）・session.ts の can〜 の判定・権限一覧の表示は、この台帳だけを読み、台帳と突き合わせる契約テストで食い違いを落とす。権限の定義は DB の表に持たず、画面から編集できるようにはしない。会社の切り替え（switchCompanyScope）は全役割に開き、送り元のオリジンを確かめる Server Action で受けて、所属していない会社は拒否する。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v25, qa-v26, qa-v27, qa-v30／system-spec/security.md・system-spec/database.md・system-spec/auth.md・system-spec/backend.md

2026-10-19〜20 の追加: 見える範囲の判定は canViewEvaluationOf の1か所に置き、マネージャーの CSV の書き出し（今は会社の全員分）を直属の部下の行だけに、管理者向けのメモ（今はマネージャーにも見える）を会社の管理者以上にだけ返す形へ改める。判断の記録は確定の処理の中で、権限の検査（canActOnEmployeeEvaluation）と自己承認の止め方（isOwnEvaluation）を通ってから書く。
根拠: qa-z02、qa-y13（system-spec/security.md、system-spec/auth.md）

2026-10-20〜21 の追加: 「見える範囲の判定は canViewEvaluationOf の1か所に置き」を改めた：今は canViewEvaluationOf（本人・会社の管理者以上・直属の上長）を呼ぶのはレポートの画面だけで、評価の詳細の2画面は今の判定のままにする。マネージャーの CSV の書き出しは canReviewEmployeeEvaluation で直属の部下の行だけに絞り、canViewEvaluationOf は使わない。管理者向けのメモは readableNoteVisibilities で会社の管理者以上にだけ返す。
根拠: qa-z03、qa-z05、qa-z06、DD-021、DD-024（system-spec/security.md）

2026-10-21〜22 の追加: 下書きのアンケートで設定とつながった設問を足す・外す・文を直すと、同じ保存で元の設定へ反映し、その反映も設定の保存と同じ権限（会社の管理者以上）・会社の絞り込み・同時に保存したときの 409・制度の変更の記録を通す。設定を保存すると、回答0件の下書きを作り直し、回答のある公開中のアンケートには次の版の下書きを作るが、公開は人が行う。設定の写しを持つ全ての場所を一覧にして文書に置き、「参照」「追従」「確定した時点の写し」のどれかに決め、保存の後は関係する画面を取り直して他のタブにも知らせる。この書き戻しと作り直しは DD-015・DD-016 を改めるので、改める DD を書いてから実装し、公開の前の検査（staleAskingItems）は残す。見本は scripts/sample-data.mjs の見本の会社に buildSeed の使い回しで足し、INSERT だけで書く。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab16-foundation-018-approval、I28、I29、I30、I31（system-spec/security.md）

## Cross-cutting contracts

他タブへの通知には資源の種類（companies・users・forms など）と時刻だけを載せ、会社名・氏名・控えは載せず、受け手はサーバーから取り直し、認可は毎回サーバーが判定する。ログイン後の HTML と API は private, no-store で返して共有のキャッシュに載せず、将来サーバー側のキャッシュを入れるなら会社の ID と利用者のロールをキーに含める。応答に付ける鮮度の手がかり（生成時刻など）に個人情報や内部の ID を含めない。役割による表示の制限はサーバーがデータを作る段階で行い、一般の社員への応答に他人の等級と点数を含めない。根拠: qa-v28, qa-r-security-3／system-spec/security.md

2026-10-19〜20 の追加: 判断の理由は今のコメントと同じく HTML として解釈せず文字として出す。見える範囲の外の人に判断と理由を返さない。本人向けの応答には点数の数値を含めない今の制限をそのまま当て、判断の理由は含める。
根拠: qa-z02（system-spec/security.md）

2026-10-20〜21 の追加: メモは、公開範囲ごとにその段階以上の権限の人が全員読み、書ける公開範囲は読める公開範囲と同じにする（docs/product/spec.md §3 の11）。見える範囲の判定は用途ごとに分け、レポートの判定の関数を CSV の書き出しとメモの読み出しに使わない。
根拠: qa-z04、qa-z05、DD-021（system-spec/security.md）

2026-10-21〜22 の追加: 設定とアンケートの追従では、締め切ったアンケート・確定した評価・評価レポートを変えず、確定前の評価だけを自動で集計し直す。設定の決まりに合わなくなる書き戻しの保存は、アンケートも設定も変えずに断る。色と手応えの変更（G29）は応答のデータの形を変えない。評価レポートの推移の図では、過去の期は評価の時点の等級を保ち、今の等級へ置き換えない。保存された得点と判定は、図の帯に合わせて再計算・上書きしない。
根拠: G27、I29、qa-ab11-survey-writeback-rule-conflict、G29、qa-aa06-report-score-grade-design、qa-aa07-report-threshold-marker-audit（system-spec/security.md）

## Subtype architecture

合成対象の subtype と該当テンプレート:

- Frontend: N/A: subtype 非選択
- Backend: N/A: subtype 非選択
- Infrastructure: N/A: subtype 非選択
- Data: N/A: subtype 非選択
- Security: 合成済み (`architecture-security.md`)

### Security architecture

#### Assets, actors and threat model

資産は、会社ごとの人事評価のデータ（等級・KPI評価点・等級要件の達成率を含む）、初期パスワードの控え、暗号化の鍵 CREDENTIAL_ENC_KEY、セッションである。行為者は4役割（システム全体管理者・会社の管理者・マネージャー・一般の社員）と、外部のエージェント、別のサイトである。主な脅威は、別のサイトからの書き込みの呼び出し、会社をまたいだ読み書き（送られた会社の id を偽る要求や、選んでいる会社の cookie を所属していない会社に書き換えた要求を含む）、共有のキャッシュや通知を経た漏れ、一般の社員による他人の等級と点数の閲覧、権限の無い役割や他社の会社管理者による等級名の変更、権限一覧の表示と実際の判定の食い違いである。根拠: qa-v28, qa-r-security-3, qa-v12／system-spec/security.md

2026-10-19〜20 の追加: 守る資産に、個人別の評価レポート・評価の中身・管理者向けのメモ・上司の判断と理由を足す。悪用の例に、範囲の外の人のレポートの URL を直接開く、マネージャーが CSV で会社の全員分を得る、本人が応答から点数の数値を読む、少人数の等級の平均から個人の点数を推し量る、を足す。
根拠: qa-z02（system-spec/security.md）

2026-10-20〜21 の追加: 悪用や事故の例に、レポートの URL の応答の違いから他社の人や存在しない人の有無を読む、上司が書く理由や上司コメントに点数などが入って本人へ漏れる、を足す。マネージャーが「管理者のみ」のメモを書いて読める状態も、守る対象の漏れとして直した。
根拠: qa-z03、qa-z04、DD-021、DD-023（system-spec/security.md）

2026-10-21〜22 の追加: 守る対象に、設定（等級要件・行動指針・KPI・評価セット）とつながった設問からの書き戻しと、本番の見本の会社の仮のデータを足す。悪用や事故の例に、会社の管理者未満の役割や他社の人が書き戻しで設定を変える、見本の投入で本物の会社の行に触れる・実データが見本に混ざる、を足す。直属の部下が0人のマネージャーの操作で、対象者を表す空の配列が全員と扱われ、他の人の確認中の評価を変えうる不具合が見つかり、直した。
根拠: qa-ab07-survey-to-setting-direction、qa-ab12-showcase-data-location、qa-aa02-empty-evaluation-scope、G27、G28（system-spec/security.md）

#### Identity and authorization

セッションは要求ごとに D1 から読み、cookieCache を入れないので、利用停止や無効化は次の要求で効く。認可はサーバーが毎回判定し、他社や担当外は区別せず 404 にする。等級名の変更はシステム全体管理者と自社の会社管理者だけに許す。他の役割には画面に変更の欄を出さず、saveMaster の等級の表と行動指針の割り当てから呼ぶ処理でも 403 にし、他社の等級を指す要求はサーバー処理で拒否する。複数の会社に所属する人は選んでいる会社の所属で全ての読み書きを絞る。選んでいる会社は cookie（hr_company。httpOnly・Secure・SameSite=Lax）で持ち、getViewer がリクエストのたびに cookie が指す会社への所属をサーバーで確かめてから、その所属の会社・役割・等級を作る。cookie が無いときや所属していない会社を指すときは、有効な所属のうち会社名の順（同名は会社 id の順。D-009）で最初の会社を使う。会社の切り替え（switchCompanyScope）は全役割に開き、送り元のオリジンを確かめる Server Action で受け、所属していない会社は拒否する。システム全体管理者は今どおり全社から選べる。役割の種類は増やさない。既存アカウントに新しい会社の所属を足すのは全体管理者の専用処理だけ。会社管理者の新規登録は既存メールを汎用文面で拒否し、他社の所属先を知らせない。パスワードと控えは変更・発行せず、専用追加は所属・必要な写し・監査を同じ batch で書く（DD-009）。所属の削除はその会社の分だけで、他社の所属が残る人のアカウントとセッションは消さず、最後の所属なら今の利用者の削除と同じに扱う。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v12, qa-v27／system-spec/security.md・system-spec/auth.md

比べる警告のリンク先は、ルート台帳にあり、見る人の役割で開けるページに限る。createForms は役割の指定と送り元の確認を通し、自社のものでない gradeId が1件でもあれば、何も作らずに拒否する（今は他社の ID を黙って外し、残りだけ作る）。根拠: qa-w09／system-spec/security.md

2026-10-19〜20 の追加: レポート・評価の中身・CSV・メモの認可はサーバーの canViewEvaluationOf で行い、範囲の外は 404 にする。判断の記録はサーバーで権限を確かめてから書き（画面でボタンを隠すだけにしない）、自分自身の評価への記録は isOwnEvaluation で止める。
根拠: qa-z02（system-spec/security.md）

2026-10-20〜21 の追加: 「レポート・評価の中身・CSV・メモの認可はサーバーの canViewEvaluationOf で行い」を改めた：今は canViewEvaluationOf はレポートを開ける人（本人・全体管理者・会社の管理者・直属の上司）の判定で、評価の詳細の2画面は今の判定のまま、CSV の書き出しは上司側の判定、メモの読み出しは今の公開範囲の判定で絞る。「管理者のみ」のメモはマネージャーの入力欄に出さず、マネージャーからの保存はサーバーでも 403 にする。すでにマネージャーが書いた「管理者のみ」のメモは、書いた本人の画面からは見えなくなり、管理者には見える。
根拠: qa-z03、qa-z04、qa-z05、qa-z06、DD-021、DD-024（system-spec/security.md）

2026-10-21〜22 の追加: アンケートから設定への書き戻しは、設定の保存と同じく会社の管理者以上に限り、画面で設問の操作を隠すだけにせず、サーバーの処理でも会社の管理者以上と会社の範囲で拒否する。評価を集計する処理（src/lib/evaluate.ts）では、対象者の指定が無いときは全員、空の配列のときは対象なしと扱う。評価レポートの印刷と推移の追加では閲覧権限を足さず、全体管理者は既存の会社の切り替えで選んだ会社の全メンバーを閲覧する。
根拠: qa-ab07-survey-to-setting-direction、I28、G27、qa-aa02-empty-evaluation-scope、qa-aa01-report-access-print、qa-aa06-report-score-grade-design（system-spec/security.md）

#### Data and secret protection

控えは平文で保存せず、AES-GCM で暗号化して利用者 ID に結び付け（別の人の行へ写しても開けない）、行に鍵の版を持たせて鍵の入れ替えに備える。鍵はリポジトリにも DB にも置かず、Workers の secret にだけ置く。開けるのはシステム全体管理者と同じ会社の管理者だけで、開くたびにサーバーで認可し、本人がパスワードを変えたら消し、再発行したら置き換え、発行から14日を過ぎたら開けず一覧にも出さず、次の発行の batch で消す（CSV 取込で発行した分も同じ）。ログイン後の応答は private, no-store で共有のキャッシュに載せず、等級と点数は見てよい人への応答にだけ載せる。出典は cloudflare-workers-web-crypto である。根拠: qa-v28, qa-r-security-3／system-spec/security.md

ズレを読む処理は会社の範囲で絞り、他社の名前を含めない。他社の区分を指す URL は今どおり notFound にする。根拠: qa-w09／system-spec/security.md

2026-10-19〜20 の追加: 本人向けの応答には点数の数値・満点・他の人との比較の値を含めず、同じ等級の平均は人数が3人未満なら作らない。判断の理由は本人にも見える文として扱う。
根拠: qa-z02（system-spec/security.md）

2026-10-20〜21 の追加: 「同じ等級の平均は人数が3人未満なら作らない」を改めた：今は同じ等級の重ならない社員が3人未満なら、平均と幅を出さない。上司の判断の理由と上司コメントは、本人に見せられない語を保存の段階で止めるので、本人には上司が書いたとおりの文が届き、点数の数値は漏れない。レポートは、誰が開いても確定した評価だけから作る（I20）。
根拠: qa-z03、qa-z05、qa-z06、DD-023、DD-024（system-spec/security.md）

2026-10-21〜22 の追加: 見本の氏名は全員『サンプル ○○』の架空の値にし、公開リポジトリなので実データは見本にも試験にも置かない。断った書き戻しの保存には、合わない決まりと直す画面だけを返す。評価レポートの推移の図は、評価者向けには保存した KPI 合計と満点の割合、本人向けには等級要件の達成率を使い、本人向けに点数の数値・割合・同じ等級の平均を持たせない。印刷ではリンク先の URL を出さず、ブラウザが余白に出す URL・日時は @page margin:0 と本文の余白のページごとの反復で抑える。
根拠: qa-ab05-evaluation-build-showcase-observed、qa-ab12-showcase-data-location、qa-ab11-survey-writeback-rule-conflict、qa-aa06-report-score-grade-design、qa-aa09-report-print-final-alignment、G28（system-spec/security.md）

#### Application and supply-chain controls

別のサイトからの呼び出しは、Next.js の Server Functions の検査（Origin と Host の一致、serverActions.allowedOrigins を足さない）と、runAction・runRead の中の assertSameOrigin の二重で断る。会社の切り替えも、送り元のオリジンを確かめる Server Action で受ける（D-004）。入口では大きさの上限（413）と zod による入力の検証を通す。全応答に nosniff・X-Frame-Options DENY・HSTS・CSP（connect-src 'self' など）が付き、BroadcastChannel は同じオリジンの中だけで動くので CSP を広げない（出典 mdn-broadcast-channel）。供給網の面では、Next.js を脆弱性の修正を含む 16.3.8 にし、Next.js 16 系・OpenNext・Workers・D1 の構成を変えない。並べ替えは Pointer Events で自作して新しい依存を足さないので、依存の更新と脆弱性の確認の対象も増えない（D-005）。根拠: qa-v28, qa-r-security-3, qa-f04, qa-u25, qa-v12, qa-v13, qa-v29／system-spec/security.md・system-spec/infrastructure.md

2026-10-19〜20 の追加: 判断の理由は HTML として解釈せず文字として出す。KGI の表を消したあとに読み書きする経路が残っていないことを静的検査で確かめる。図は既存の recharts で描き、新しい依存を足さない。
根拠: qa-z02、qa-y11（system-spec/security.md、system-spec/frontend.md）

2026-10-20〜21 の追加: 上司の判断の理由と上司コメントの保存に、本人に見せられない語（点数・配点・必要点数につながる表現）の一覧 CRITERIA_LEAK_PATTERNS での検査を足し、引っかかった語を名指しして断る（DD-023）。表示のときに決まった文へ差し替える形にはせず、本人にも同じ文を見せるという決めを保つ。OWASP ASVS のアクセス制御の要求（認可はサーバーで、既定で拒否する）に沿い、CSV とメモの絞り込みをサーバーの処理に置く。
根拠: qa-z03、qa-z05、DD-023（system-spec/security.md）

2026-10-21〜22 の追加: G29 のグラデーションと色の変化は、外から読み込む資源を足さず globals.css の中だけで作り、応答のデータの形を変えない。G29 の範囲はボタンだけでなく、カード・見出しの面・選ぶ部品・状態の印・進み具合・知らせ・表などの共通部品へ広げた。I33 で、押せる面を 44px 四方以上にし、段階的な開示と境界のはっきりしたカードを共通部品で全ての画面へ当て、画面の組み替えは I27 の2画面（G26 の行動指針と KPI・評価セットの画面）と評価を作る画面に限る。書き戻しの保存も、同時に保存したときは設定の保存と同じく 409 を返す。
根拠: G29、I32、I33、G26、qa-ab14-ui-scope-beyond-buttons、qa-ab15-foundation-017-approval、I28（system-spec/security.md）

#### Detection and response

誰が誰の控えを開いたかを、値を含めずに Workers Logs へ残す。等級名の変更・所属の追加と削除・本番の一律の書き換えは監査に残し、書き換え前の値を記録する。等級名の変更と所属の追加・削除は、監査ジャーナルに変更前と変更後を残す。会社の追加の取り消しが失敗した記録（compensation_failed）とパスワード変更の続きが失敗した記録（rollforward_failed）は Workers Logs で見つけ、本番 DB を手で書き換えずに文書の手順で直す。反映されないという報告は、応答の生成時刻のヘッダー（x-generated-at）、Workers Logs、ゾーンのキャッシュ規則を読み取りだけで順に確かめて切り分ける（deploy-notes §7）。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v26／system-spec/security.md・system-spec/database.md

2026-10-21〜22 の追加: アンケートからの書き戻しも、設定の保存と同じく制度の変更の記録を通す。設定を保存したときは、どのアンケートと評価が変わったかを保存の結果の文で示す。
根拠: I28、I29、G27（system-spec/security.md）

#### Security verification

送り元の二重の検査は action-origin.test.ts で固定し、入口を通らない書き込み（server-actions-contract.test.ts）と batch の外で2つ以上の表を書く関数（write-atomicity-contract.test.ts）とあわせて、pnpm test で違反0件を条件にする。O7 は等級名の変更を役割ごとに画面とサーバー処理の両方で拒否する結合テスト、O8 は route-ledger.json の権限の定義を、サイドバー（nav.ts）・ページの入口（requireRole）・サーバー処理の役割の指定（ActionSpec.role）・session.ts の can〜 の判定と突き合わせる契約テスト、O9 は一般の社員への応答に他人の等級・点数が含まれないことのテスト、O10 は2社目への追加と会社の切り替え、所属していない会社を指定した要求（会社の切り替えを含む）の拒否、所属していない会社のデータが読めないことのテストで確かめる。O2 はリリース後の本番で、作成直後の強制再読み込みと生成時刻のヘッダーを確かめ、ゾーンに HTML・/api を保存するキャッシュ規則が無いことを読み取りだけで確かめる（作成は利用者のふだんの操作で行い、エージェントは本番に書き込まない）。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v12, qa-v25, qa-v30, qa-v31／system-spec/security.md・system-spec/backend.md・system-spec/maintenance-ops.md

リンク先が台帳にあり見る人の役割で開けることを契約テストで、他社の等級を渡した createForms が何も作らずに拒否されることをテストで確かめる。根拠: qa-w09, qa-w10／system-spec/security.md・system-spec/maintenance-ops.md

2026-10-19〜20 の追加: 役割と直属の部下の組ごとに見える・404 を確かめる結合テストと E2E、本人向けの応答に点数と比べる値のキーが無いことの契約テスト、3人未満で平均を出さないテスト、KGI の参照が0件であることの静的検査を置く。
根拠: qa-z02、qa-y16（system-spec/security.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: O19 の見える・404 を確かめる組は、全体管理者・会社の管理者・マネージャー（直属の部下と、部下でない人）・本人・他の社員とし、レポートの判定の関数を呼ぶのがレポートの画面だけであることを契約テストで確かめる。「3人未満で平均を出さないテスト」を改めた：今は同じ等級の重ならない社員が3人未満なら平均と幅を出さないテストにする。O17 の静的検査は src・docs・route-ledger・nav を走査し、docs のうち経緯を残す5種類（受領書・バックログの履歴・レビューの記録・判断の記録・デプロイ時の注意）を外し、外す先が実在することも同じ検査で確かめる。賞与の計算の単体テストでは、1点あたりの円が0以下なら賞与額を出さないことを確かめる。
根拠: qa-z05、DD-020、DD-021、DD-024（system-spec/security.md）

2026-10-21〜22 の追加: O27 は、下書きのアンケートで設定とつながった設問を足す・外す・文を直すと元の設定が同じ保存で変わり、決まりに合わない保存が断られることのサーバー処理のテスト、設定の変更で締め切ったアンケート・確定した評価・レポートが変わらないことの結合テスト、写しを持つ場所の一覧とコードが一致することの契約テスト、保存の直後に関係する画面と他のタブが新しい内容で出る E2E で確かめる。O28 は、受付中の期が1つあり、評価はまだ作られておらず、氏名と会社が見本の印を持ち、他社の行に触れないことを見本の生成のテストで、手元の見本で評価の一覧と詳細まで進めることを E2E で確かめる。空の配列の不具合は、修正前に足した2件のテストが落ち、修正後に関連する5スイート129件が通ることで確かめた。
根拠: O27、O28、qa-aa02-empty-evaluation-scope（system-spec/security.md）

## Architecture decisions

控えの持ち方は、平文で持たず利用者 ID に結び付けて AES-GCM で暗号化し、本人の変更・再発行・発行から14日のいちばん早い時点で終える案を利用者が選んだ（qa-u24、qa-u25）。別のサイトからの呼び出しは、Next.js の検査と入口の assertSameOrigin の二重の検査を続ける案を選び、serverActions.allowedOrigins は足さない。D-001 の BroadcastChannel は同じオリジンの中だけで動くので CSP を変えない。D-004（opt-membership-cookie）は利用者が選んだ案で、AI の推奨と同じである（qa-v12）。所属を自前の表に持ち、選んでいる会社を cookie（hr_company。httpOnly・Secure・SameSite=Lax）で持つ。cookie の会社への所属の確認を1か所でも漏らすと、所属していない会社のデータが見えるので、確認は getViewer でリクエストのたびに行う。D-007（opt-route-ledger-extend）は利用者が選んだ案で、AI が委任に基づいて選んだ別の案とは違う（qa-v25）。権限の定義を route-ledger.json 1つにまとめ、表示と判定を同じ定義から作る（qa-v27 (4)）。サイドバー・ページの入口の判定・サーバー処理の役割の指定はこの台帳から引き、台帳と突き合わせる契約テストで食い違いを落とす（qa-v30 (2)）。他社にアカウントがある人を足すときに足す側へ所属先を知らせないこと、パスワードを変えないこと、所属の削除の範囲は、この章の要件に書いた。D-007 ① に合わせて (6) を直したうえで、利用者が承認した（qa-v28、2026-10-13T03:48:20Z）。根拠: qa-v28, qa-r-security-3, qa-u24, qa-u25, qa-v12, qa-v25, qa-v27, qa-v30／system-spec/security.md・system-spec/auth.md・system-spec/backend.md

2026-10-14 の会社所属の現在の契約：既存アカウントへ別の会社の所属を足すのは全体管理者だけの専用操作（addMembership）とする（qa-w11、D-008）。選んでいる会社が無いとき（cookie が無い・所属していない会社を指す）は、有効な所属のうち会社名の順で最初の会社を開く（同名は会社 id の順。qa-w12、D-009）。委任（qa-v32）に基づく DD-009 の『最も古い有効な所属』は利用者の選択で取り消し、実装は 2026-10-15 に会社名の順へ直した（src/lib/memberships.ts の activeMembershipsByCompanyName。users の写しの基準は古い順のまま。DD-009 の更新）。どちらの順でも、リクエストのたびに所属をサーバーで確かめることは変わらない。根拠: qa-w11, qa-w12, qa-v27／system-spec/auth.md・system-spec/security.md・docs/product/design-decisions.md

2026-10-19〜20 の追加: 同じ等級の平均は人数が3人未満なら作らない（個人が分かるのを防ぐ）。本人向けのデータの形には点数のキーを持たせず、画面で隠すのではなく形の段階で落とす。印刷用のデータの経路を作らない（qa-x08 の A4 の印刷はブラウザで行う）。
根拠: qa-z02、qa-x04、qa-x08（system-spec/security.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 計画レビューで見つかった食い違いは、DD-020〜DD-024 と計画レビューの受領書で先に確定し、spec-state への反映は P12 の compile でまとめて行う案を利用者が選んだ（qa-z03 の1問目）。章では答を当時の逐語のまま凍結し、本文と食い違うときは後から足した訂正を正とする。上司の理由に点数などが書かれて本人へ漏れるのは、保存のときに語を示して直してもらう案で防ぎ、表示のときに共通の文へ差し替える案と検査しない案は採らなかった（4問目）。「管理者のみ」のメモは、利用者の答えを、その段階以上の権限の人が全員読める形と読み、マネージャーには選ばせない形で直した（qa-z04）。「同じ等級の平均は人数が3人未満なら作らない」を改めた：今は同じ等級の重ならない社員が3人未満なら、平均と幅を作らない。
根拠: qa-z03、qa-z04、qa-z05、DD-020〜DD-024（system-spec/security.md）

2026-10-21〜22 の追加: 利用者は、アンケートで足し外した設問を保存と同時に設定へ反映する案、決まりに合わなくなる保存は断って理由と直す所を示す案、見本のデータを手元と本番の見本の会社の両方に置く案を、それぞれ『今回は決めない』を含む3択から選んだ。見本の置き場所の決定に合わせて、製品仕様 §14 の「受付中の期は作らない」を改める DD を書く。要件の土台の追記は appr-foundation-016 で承認し、その後 completeness evaluator の指摘で文を改めるたびに appr-foundation-017〜020 で承認を取り直し、それぞれが前の承認を置き換えた。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、qa-ab15-foundation-017-approval、qa-ab18-foundation-020-approval、appr-foundation-016、appr-foundation-020（system-spec/security.md）

## Delivery, migration and rollback

鍵 CREDENTIAL_ENC_KEY（32 バイトを base64 にしたもの）は、ローカルでは .dev.vars、本番では wrangler secret put で置き、手順を deploy-notes §6 に書く。本番への設定は外部への変更として確認を取ってから行い、本番 DB は読み取りだけで調べ、外部への変更系の通信は preview → CONFIRM → authorize → execute のガードを通す。等級名の本番での一律の書き換えは監査に残し、書き換え前の値を記録する。複数の表を書く書き込みが途中で失敗したときは、batch に入るものは batch、会社の追加は補償、パスワード変更の続きはやり直しで揃え、それも失敗したら Workers Logs に記録を残して手順で直す（D-003）。Next.js は脆弱性の修正を含む 16.3.8 にする。根拠: qa-v28, qa-r-security-3, qa-u24, qa-u25／system-spec/security.md

2026-10-19〜20 の追加: 見える範囲の絞り込みとメモの返し方の変更は、マイグレーションを伴わないコードの変更として出す。KGI の削除は2回の Deploy で、1回目の後に KGI を読み書きする経路が残らないことを静的検査で確かめる。
根拠: qa-z02、qa-x15（system-spec/security.md、system-spec/infrastructure.md）

2026-10-20〜21 の追加: main にマージすると自動で本番に出る仕組みに合わせ、計画の「P13 で手動で2回公開する」を、1回目＝P05 のマージ、2回目＝P08 のマージと読み替えた（qa-z03 の2問目）。P05 をマージする前に、P06 の自動テストと bundle の大きさ・cf:dry-run を P05 の PR の上で通すことを条件にし、P13 は CI の実行番号と backup、本番の読み取りを記録する役にした。2回目の公開（P08 の PR のマージで Deploy workflow が動く）の後に、本番 DB に3つの表と2列が無いことを読み取りで確かめる（O17）。
根拠: qa-z03、qa-z05、DD-020、DD-024（system-spec/security.md）

2026-10-21〜22 の追加: 本番の見本の会社への投入は既存の db:sample:remote の手順で行い、実行の前に利用者の確認を取る。行動指針の既定の分け方へのデータの書き換え（I26）は、範囲の外の「本番データの移行・修正」から除いた。この仕様で足した移行のうち行を書き換える 0032・0033・0034・0035・0036・0039 も同じく除き、0037・0038 は表と列の追加だけなので挙げない。0021・0023・0025・0030 も行を書き換えるが、この仕様より前（2026-08〜09）に足した移行なので挙げない。評価レポートの印刷と推移の追加では、スキーマを変えない。
根拠: qa-ab12-showcase-data-location、qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、qa-aa01-report-access-print、I26、I31（system-spec/security.md）

## Risks and verification

危険は、会社をまたいだ漏れ（キャッシュ・通知・所属の取り違え、選んでいる会社の cookie への所属の確認の漏れ）、秘密の露出（控えの値・鍵）、表示と判定の食い違い（サイドバー・ページの入口・サーバー処理の役割の指定のどれかが route-ledger.json の権限の定義と食い違うずれを含む）、画面だけで止めてサーバーで止めない権限の抜けである。O7 は役割ごとの結合テストで、マネージャー・一般の社員・他社の会社管理者による等級名の変更が画面とサーバー処理の両方で拒否されることを確かめる。O8 は route-ledger.json の権限の定義と、サイドバー・ページの入口・サーバー処理の役割の指定を突き合わせる契約テスト、O9 は一般の社員への応答に他人の等級・点数が含まれないことのテスト、O10 は2社目への追加と会社の切り替え、所属していない会社を指定した要求の拒否のテストで確かめる。送り元の二重の検査は action-origin.test.ts で固定し、O2 はリリース後の本番で作成直後の強制再読み込みと生成時刻ヘッダーを確かめる。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v12, qa-v25, qa-v30／system-spec/security.md・system-spec/backend.md

2026-10-19〜20 の追加: リスクは、一覧の部品だけで範囲を絞って CSV やメモの経路が漏れること、本人向けの応答に点数のキーが残ること、判断の理由に書いた文が HTML として描かれることである。検査として、役割と直属の部下の組ごとの結合テストと E2E、本人向けの応答に点数と比べる値のキーが無いことの契約テスト、3人未満で平均を出さないテスト（O19）を置く。
根拠: qa-z02、qa-y16（system-spec/security.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: リスクに、上司が書く昇給・昇格の理由に点数などが書かれて本人へ漏れることを足し、保存のときの検査で防ぐ。O19 の検査に、レポートの判定の関数を呼ぶのがレポートの画面だけで、CSV の書き出しとメモの読み出しが使わないことの契約テストを足した。「3人未満で平均を出さないテスト（O19）」を改めた：今は同じ等級の重ならない社員が3人未満なら、平均と幅を出さないことを確かめる。
根拠: qa-z03、qa-z05、DD-021、DD-023（system-spec/security.md）

2026-10-21〜22 の追加: リスクは、書き戻しを画面で隠すだけにしてサーバーで止めないこと、写しを持つ場所の抜けで確定した評価やレポートが変わること、見本の投入で本物の会社の行に触れることである。検査として、書き戻しのサーバー処理のテスト、追従の結合テスト、写しを持つ場所の一覧とコードの一致の契約テスト（O27）、見本の生成のテスト（O28）を置く。直属の部下が0人のマネージャーが他の人の確認中の評価と全内訳を変えないことは、Server Action からの回帰テストで確かめた。
根拠: O27、O28、qa-ab07-survey-to-setting-direction、qa-ab12-showcase-data-location、qa-aa02-empty-evaluation-scope（system-spec/security.md）


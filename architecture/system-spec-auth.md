---
graph_node_id: "arch-system-spec-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "認証と認可：セッションの鮮度、会社への所属、権限の1つの定義、評価の見える範囲、認証の口の許可制と鍵の分離"
project_id: "hr-evaluation-system"
domain: "auth"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応", "脆弱性対策"]
file_path: "architecture/system-spec-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "stale"
confirmation_evidence: {"evaluated_digest": "0889635fb3aff96f90a2f06bf6a4209055331eda4a4ca3d1c380830b1db2d6c9", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-report.json"}
source_lineage: {"imported_at": "2026-10-22T13:49:14Z", "origin_kind": "system-spec-harness", "source_digest": "0889635fb3aff96f90a2f06bf6a4209055331eda4a4ca3d1c380830b1db2d6c9", "source_path": "system-spec/auth.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-auth.md", "confidence": 0.92}, {"artifact_kind": "specification", "candidate_path": "specs/system-spec-auth.md", "confidence": 0.4}]
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

better-auth のメールアドレスとパスワードによるログイン（本人登録は閉じる）で、セッションは要求ごとに D1 から読んで cookieCache を入れず、ロールの変更や会社の利用停止を次の要求から効かせる。画面からの書き込みと控えの読み出しは、Server Functions の共通の入口 runAction・runRead が送り元のサイト・セッション・役割の順に確かめてから本体を呼ぶ。認可に失敗したら、書き込みも画面の作り直しも他タブへの通知も行わない。2026-10-12 の追加で、1つのアカウントが複数の会社に所属できるようにする。選んでいる会社は cookie（hr_company。httpOnly・Secure・SameSite=Lax）を全員に広げて持ち、getViewer はリクエストのたびに cookie が指す会社への有効な所属を確かめてから会社・役割・等級を作る（D-004）。役割ごとに開けるページ（accessClass）に加え、ページでできる主な操作・役割ごとの可否・説明も route-ledger.json の各ページに足し、権限の定義をこの台帳1つにまとめる（D-007）。サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の can〜 の判定・権限一覧の表示は、この台帳だけを読む。
根拠: qa-v27、qa-r-auth-3、qa-f03、D-004、D-007（system-spec/auth.md）

2026-10-19〜20 の追加: 評価の中身とレポートを開ける人を canViewEvaluationOf の1つの関数で決める（全体管理者は全社、会社の管理者は自社の全員、マネージャーは直属の部下と自分、一般の社員は自分だけで、間接の部下は含めない）。レポートの画面・評価の詳細・CSV の書き出し・メモの読み出しがこれを使う。上司の判断を記録できる人は評価を確定できる人（canActOnEmployeeEvaluation）と同じにし、新しい役割や見える範囲は作らない。
根拠: qa-y13、qa-y07（system-spec/auth.md）

2026-10-20〜21 の追加: 評価の詳細・CSV の書き出し・メモの読み出しも canViewEvaluationOf を使うとした点を改めた：今は、この関数を呼ぶのはレポートの画面（/reports/[id]）だけである。評価の詳細の2画面は今の判定のまま残し、SECURITY-013 を決めるときに寄せる。CSV の書き出しは canReviewEmployeeEvaluation で、メモの読み出しは公開範囲ごとにその段階以上の人が全員読める readableNoteVisibilities で絞る。『確定した後だけ』の条件は判定の関数から外し、確定した評価だけを読む loadEvaluationReport に置いた。この読み方は qa-y13 の訂正として記録し、2026-10-21 に推奨の印の無い問（qa-z06 の問4）で利用者が確認済みとして閉じ、I20 の文も承認された（appr-foundation-014）。
根拠: qa-z03、qa-z04、qa-z06、appr-foundation-014、DD-021、DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: 本章が資するゴールに G27（設定とアンケートの設問のどちらを後から変えても、後から変えた方を正として追従し、確定した評価と評価レポートは確定した時点のまま残す）を足す。下書きのアンケートの保存から設定へ書き戻す処理は新しい入口にせず、設定の保存と同じ runAction を通して、会社の管理者以上・会社の絞り込み・同時に保存したときの 409・制度の変更の記録（constitution_events）を同じ順で当てる。設定の保存が自動で作り直す下書きと次の版の下書きは、保存した人の会社の中だけに作り、公開は人が行う。KPI・評価セットの画面を分けても（G26）分けた画面の入口ごとに今の役割の判定を当て、色と手応えの変更（G29）も今の認可の判定をそのまま使う。見本の会社への受付中の期の追加（G28）は既存の db:sample:remote の手順だけで行い、新しい役割や入口を足さない。要件の土台へのこれらの追記は appr-foundation-016〜020 で承認した。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、G26〜G29、appr-foundation-016〜020（system-spec/auth.md）

2026-10-22 の追加: 2026-10-22 の依頼（PHP と Node.js の脆弱性を受けた全体の確認）を受け、認証の入口を許可制にする。better-auth の口は、使っているものだけをコードとログで確かめてから許可リストに入れ、ほかは 404 にする。氏名とパスワードの変更は src/actions/account.ts の口だけで受け、会社の設定・長さの上限・控えの削除・変更が必要の印の解除を必ず通す。回数制限は Cloudflare が付ける送り手の IP で人を見分け、better-auth と自前の両方に当てる。パスワードの最小の長さ（10文字）は1つの関数に置き、作成・初期・本人の変更・better-auth の設定で同じにする。認証の秘密は別の用途に流用せず、用途ごとに鍵を導く（G31・G34）。
根拠: qa-ac09 (9)〜(12)、G31・G34（system-spec/auth.md、system-spec/00-requirements-definition.md）

## Context and drivers

書き込み結果がすぐ見えない問題を Server Functions への移行で解く際、Server Function は外から直接呼べる公開の入口になるため、入口での検査と認可の鮮度を保つ必要がある。2026-10-12 の依頼で、複数の会社に所属するマネージャーを2社目に登録できないこと、等級名を編集できる人を限る必要、役割ごとにできることを確かめる手段が無いことが示された。優先する品質は、権限の取り消しがすぐ効くこと（G2）、共通の入口の適用漏れが検査で落ちること（G4）、等級名の変更権限の制限（G7）、表示と判定の一致（G8）、所属による会社の境界（G10）である。制約として better-auth と構成を変えず、役割の種類（SUPER_ADMIN・COMPANY_ADMIN・MANAGER・EMPLOYEE）を増やさない。
根拠: qa-r-auth-3、qa-v01、qa-v27、qa-f03（system-spec/auth.md、system-spec/00-requirements-definition.md）

2026-10-19〜20 の追加: 2026-10-19 の依頼（直属の部下の結果を見られる人の設定・個人別の評価レポート・KGI の削除）と 2026-10-20 の依頼（昇給と昇格に上司の判断を含める）で、評価の中身を見られる人の判定が画面ごとに分かれていることと、判断を記録する人を決める必要が示された。優先する品質は、見てよい人にだけ見せること（G19）と、判断と理由を本人・直属の上司・管理者に同じ形で示すこと（G24）である。
根拠: qa-x01、qa-x03、qa-y01〜qa-y05、qa-y13（system-spec/auth.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビュー（SYS-EVAL-REPORT-P01）で、節番号が2系統あること・canViewEvaluationOf と既存の関数の関係・DD-012 を改めたこと・Deploy の手順などの食い違いが見つかった。本番には、マネージャーが CSV で会社の全員分の結果を取れることと、管理者だけのメモがマネージャーに見えることの、2件の権限の漏れが既にあった。メモの漏れを直すと、マネージャーが『管理者のみ』で書いたメモが書いた本人の画面から消えると分かり、公開範囲の読み方を決め直す必要が出た。決めた中身は DD-020〜DD-024 と計画レビューの受領書に記録した。
根拠: qa-z03、qa-z04、DD-020〜DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: 2026-10-22 の依頼とコード調査の結果を要件の土台（U1・U2）に足し、G25〜G29 を置いた。調べた時点では、評価セットの保存（saveScheme）が等級区分ごとの項目数・固定枠・20点枠をサーバーで検査し、下書きにつながった設問は新しく足せなかった（checkQuestionLinks）。アンケートから設定への反映（I28）と、設定の保存での下書きの作り直し（I29）は、DD-015（新しい設問を KPI 項目に紐づけない）と、DD-016 が却下した『聞き方の保存で下書きを書き換える』を改める。
根拠: qa-ab11-survey-writeback-rule-conflict、qa-ab13-foundation-016-approval、qa-ab16-foundation-018-approval、G25〜G29（system-spec/auth.md）

2026-10-19〜20 の追加: 2026-10-19 の依頼（直属の部下の結果を見られる人の設定・個人別の評価レポート・事業所の達成率の削除）と 2026-10-20 の依頼（昇給と昇格に上司の判断を含める）で、評価の中身を見られる人の判定が画面ごとに分かれていることと、判断を記録する人を決める必要が示された。優先する品質は、見てよい人にだけ見せること（G19）と、判断と理由を本人・直属の上司・管理者に同じ形で示すこと（G24）である。
2026-10-22 の追加: 依頼（qa-ac01）は、PHP の脆弱性と Node.js の 2026 年10月のセキュリティリリースを受け、同じ観点とそれより踏み込んだ観点でシステム全体を確かめて対策することである。上位概念（qa-ab01）は問題の本質を、(A) アプリより前の層が攻撃者の入力を処理する、(B) リクエストをまたいで状態が残る、(C) 資源の枯渇で処理が打ち切られ不整合が残る、(D) 既定でオンの機能が攻撃面を広げる、(E) 自分が書いたかを確かめずにデシリアライズする、の5点にまとめる。認証では、(A)(D) に当たる認証の入口の広さと、(B) に当たる回数制限の見分け方が対象になる。優先する品質は、漏えいの恐れがあるときに利用者の判断で安全に秘密を替えられること（G31）と、認証の入口を許可制にすること（G34）である。
根拠: qa-ac01、qa-ab01、qa-ac09（system-spec/auth.md、system-spec/00-requirements-definition.md）

## Goals and non-goals

Goals: 認可に失敗した要求では何も書かず、作り直さず、通知しない。ロールの変更や利用停止を次の要求で効かせる。等級名の変更を、システム全体管理者と自社の会社の管理者に画面とサーバー処理の両方で限る。route-ledger.json の権限の定義から一覧を描き、判定とのずれを0件にする。同じメールアドレスの人が1つのアカウントのまま会社ごとの役割・等級・上司で使え、所属していない会社は拒否する。Non-goals: cookieCache は入れない（入れる場合は鮮度の契約を見直す）。役割の種類を増やさない（『システム開発者』の役割は作らず、画面名を『Claude Code連携（システム開発者専用）』に変えるだけ）。等級名の変更権限を除く役割ごとの権限の中身を変えない。権限の定義を画面から編集できるようにはしない。外部のエージェント向け API（Bearer 鍵）と端末の承認の認可方式を変えない。
根拠: qa-r-auth-3、qa-v03、qa-v27、qa-v28、D-007（system-spec/auth.md、system-spec/00-requirements-definition.md の U7）、system-spec/security.md

2026-10-19〜20 の追加: Goals: 見える範囲を1つの関数で判定し、レポート・評価の詳細・CSV・メモで同じ結果にする。判断を記録できる人を、評価を確定できる人と同じにする。判断と理由は本人には確定した後だけ見せる。Non-goals: 間接の部下（部下の部下）の閲覧、新しい役割や見える範囲の追加、上司の判断で等級を自動で変えること。
根拠: qa-y13、qa-y07（system-spec/auth.md、system-spec/00-requirements-definition.md の U7）

2026-10-20〜21 の追加: Goals の『見える範囲を1つの関数で判定し、レポート・評価の詳細・CSV・メモで同じ結果にする』を改めた：今は、入口ごとに判定の関数を1つに決め、画面ごとに条件を写して食い違う穴を作らない。上司の判断は評価の詳細と同じ範囲で見せ、見える人を増やさない（O19）。Non-goals: 評価の詳細の2画面の判定は今のまま変えない（I20）。自分を評価する側にも立つ人が自分について見られる情報は O19 の外に置き、SECURITY-013 で決める。
根拠: qa-z05（O19・I20）、qa-z06、appr-foundation-014、DD-020〜DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: Goals: 設定（等級要件・行動指針・KPI・評価セット）とアンケートの設問のどちらを後から変えても、後から変えた方を正として、もう一方と写しを持つ全ての画面と機能が追従する（G27）。書き戻しで変わる設定は、それぞれの設定の画面を保存できる人と同じ判定で絞る。Non-goals: 確定した評価と評価レポートは確定した時点のまま残し、追従させない。アンケートの下書きを直せることだけで、設定を変えられるようにはしない。自動で作った下書きの公開は人が行い、見本の会社のために新しい役割や入口は足さない。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、G27、G28（system-spec/auth.md）

2026-10-22 の追加: Goals: 使っていない認証の口と偽れる識別を0件にする（O34）。どの口でもパスワードを10文字以上にする。秘密を替えると古いセッションが使えなくなり、控えが新しい鍵で読めることをローカルで確かめる（O31）。Non-goals: 新しい役割・見える範囲は作らない。本番での秘密の交換・セッションの失効・パスワードの強制変更は利用者が決め、外部変更ガードを通して行う（この章は手順と仕組みまでを扱う）。
根拠: qa-ac09 (11)〜(13)、G31・G34、O31・O34（system-spec/auth.md、system-spec/00-requirements-definition.md）

## System context and boundaries

利用者は4つの役割のブラウザ（PC・スマホ・タブレット）で、外部の主体は Bearer 鍵で API を呼ぶエージェントと端末の承認である。信頼の境界は、Server Functions の入口（runAction・runRead）、外部向けの Route Handler（Bearer 鍵）、D1 に持つ better-auth のセッションで、一つの入口に二つの認可方式を混ぜない。データの境界は選んでいる会社の所属である。選んでいる会社の cookie は利用者が書き換えられる入力として扱い、そのまま信じず、リクエストのたびにサーバーで所属を確かめて決める（D-004）。会社の切り替えは、送り元のオリジンを確かめる Server Action で受ける。他タブへの通知は同じブラウザの同じオリジンにしか届かず、受け取ったタブはその時点のセッションで認可を受け直すので、通知が認可の代わりになる経路は無い。
根拠: qa-r-auth-3、qa-v27、qa-v28、D-004（system-spec/auth.md、system-spec/security.md）

2026-10-19〜20 の追加: 個人別の評価レポートの入口は、管理者（利用者一覧と社員の一覧）・マネージャー（担当チームのメンバー一覧と評価の画面）・本人（『評価・結果を確認する』）の3つで、どの入口でもサーバーが canViewEvaluationOf で範囲を確かめてからデータを作る。印刷はブラウザで画面の内容だけを刷るので、印刷のための別の入口は無い。
根拠: qa-y13、qa-y10、qa-z02（system-spec/auth.md、system-spec/ui-ux.md、system-spec/security.md）

2026-10-20〜21 の追加: セッションを要求ごとに D1 から読む今の形のまま、レポートの画面（/reports/[id]）は、その要求のセッションから見る人を作り直してから canViewEvaluationOf を当てる。CSV の書き出しの canReviewEmployeeEvaluation と、メモの読み出しの readableNoteVisibilities も、その要求のセッションから作った見る人に当てる。どの入口もセッションの写しを持ち越さない。
根拠: qa-z02 の訂正、qa-z06、appr-foundation-014、DD-020〜DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: 下書きのアンケートの保存から設定（KPI の設問の文・評価セットの項目・行動指針の観点・等級要件）へ書き戻す経路を足すが、信頼の境界は増やさず、設定の保存と同じ runAction の入口を通す。この処理も、その要求のセッションから作った見る人で会社の管理者以上を確かめてから本体へ進む。設定の保存が自動で作る下書きは、保存した人の会社のアンケートだけを対象にする。見本の会社への受付中の期の追加は、既存の db:sample:remote の手順に利用者の確認を挟んで行い、新しい入口を足さない。
根拠: qa-ab07-survey-to-setting-direction、qa-ab12-showcase-data-location、G27、G28（system-spec/auth.md）

2026-10-22 の追加: 認証の Route Handler（better-auth）は、許可リストに入れた口だけを通し、ほかは 404 にする。氏名とパスワードの変更は better-auth の口ではなく src/actions/account.ts の Server Action だけで受け、アプリの決まり（会社の設定・長さの上限・控えの削除・変更が必要の印の解除）を通す。
根拠: qa-ac09 (9)、G34（system-spec/auth.md）

## Container and component view

better-auth（メールとパスワード、セッションの有効期間7日・更新間隔1日、cookieCache なし）がセッションとアカウントを D1 に持つ。getViewer は cookie が指す会社への有効な所属を確かめてから会社・役割・等級を作り、cookie が無いときや所属していない会社を指すときは、有効な所属のうち会社名の順（同名は会社 id の順。D-009）で最初の会社を使う（D-004）。requireRole がページの入口で、apiViewer と ActionSpec.role が Server Functions の入口で役割を判定する。権限の定義として、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置く（D-007）。サイドバー（nav.ts。今も台帳を読んでいる）・requireRole・ActionSpec.role・session.ts の canEdit〜 などの判定をこの台帳から引き、台帳と突き合わせる契約テストで食い違いを落とす。権限一覧のページとモーダルの表とカードも、この台帳から描く。会社の切り替えの処理（switchCompanyScope）は全ての役割に開いて所属を確かめ、所属していない会社を拒否する。会社の切り替えの部品（CompanyScopeSwitcher）は、所属が2社以上の人にも出す。等級名を変える処理（saveMaster の等級の表と BehaviorBandAssignmentEditor から呼ぶ処理）が役割と会社を判定する。
根拠: qa-f03、qa-r-auth-3、qa-v27、qa-v30、D-004、D-007（system-spec/auth.md、system-spec/backend.md）

2026-10-19〜20 の追加: canViewEvaluationOf（見る人・対象の人・会社）を session.ts の判定の並びに置き、確定と判断の記録を許す canActOnEmployeeEvaluation（全体管理者・会社の管理者・直属の上司のマネージャー。自分自身の評価は不可）と並べる。route-ledger.json にレポートのページと操作を足し、KGI のページと操作を消し、評価の確定の操作の説明に『昇給と昇格の判断を記録する』を足す。権限一覧はこの台帳から描くので、表示も同時に変わる。
根拠: qa-y13（system-spec/auth.md）

2026-10-20〜21 の追加: canViewEvaluationOf の引数を『見る人・対象の人・会社』とした点を改めた：今は見る人と対象の人の2つの引数で、会社の境界を問い合わせで閉じてから判定する。本人なら役割にかかわらず self、会社の管理者以上と直属の上長（canReviewEmployeeEvaluation）には reviewer、ほかは null を返す。『確定した後だけ』の条件はこの関数に持たせず、確定した評価だけを読む loadEvaluationReport に置くので、レポートは誰が開いても確定した評価だけから作る。期をまたぐレポートでは、どの評価の状態で判定するかが決まらないためである。確定と判断の記録は、作り直した見る人で canManageEmployee（中で canActOnEmployeeEvaluation）を当てる。
根拠: qa-z06、appr-foundation-014、DD-021、DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: アンケートの保存からの書き戻しは、設定の保存と同じ runAction を通り、会社の管理者以上・会社の絞り込み・同時に保存したときの 409・制度の変更の記録（constitution_events）を同じ順で当てる。KPI・評価セットの作業を別の画面に分けたときは、どの画面の入口にも今の役割の判定を当て、そのページを route-ledger.json に足す（I27）。公開の前の検査（staleAskingItems）は残す。設定の写しを持つ全ての場所（アンケートの設問、回答の見出し、評価の項目・行動指針・等級要件、ズレの表、評価レポート、CSV など）を一覧にして文書に置き、それぞれを『参照』『追従』『確定した時点の写し』のどれかに決める（I30）。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、qa-ab16-foundation-018-approval、G26、G27（system-spec/auth.md）

2026-10-19〜20 の追加: canViewEvaluationOf（見る人・対象の人・会社）を session.ts の判定の並びに置き、確定と判断の記録を許す canActOnEmployeeEvaluation（全体管理者・会社の管理者・直属の上司のマネージャー。自分自身の評価は不可）と並べる。route-ledger.json にレポートのページと操作を足し、事業所の達成率のページと操作を消し、評価の確定の操作の説明に『昇給と昇格の判断を記録する』を足す。権限一覧はこの台帳から描くので、表示も同時に変わる。
2026-10-22 の追加: パスワードの最小の長さを1つの関数に置き、利用者の作成・初期パスワード・本人の変更・better-auth の最小の長さの設定がこれを読む。認証の秘密から用途ごとの鍵を導く関数を置き、セッションと控えの暗号化など、用途ごとに別の鍵を使う。
根拠: qa-ac09 (11)(12)、G31（system-spec/auth.md）

## Cross-cutting contracts

識別とアクセス: 入口は送り元の検査（Next.js の Origin と Host の一致と assertSameOrigin の二重）、セッション、役割の順に確かめる。他社や担当外の対象は区別せず 404、等級名の変更の権限違反は 403 にする。エラーと回復性: 認可の失敗では書き込み・作り直し・通知のどれも動かず、会社の利用停止や利用者の無効化は次の要求で拒否される。可観測性と監査: 等級名の変更・所属の追加と削除・本番の一律の書き換えを監査に残し、控えを開いた記録は値を含めず Workers Logs に残す。設定と秘密: セッションは要求ごとに D1 から読み、控えの鍵は Workers の secret（CREDENTIAL_ENC_KEY）だけに置く。選んでいる会社の cookie（hr_company）は httpOnly・Secure・SameSite=Lax で持つ。互換性: 所属が1つの人は今と同じ動きにし、システム全体管理者の全社からの会社の切り替えは残す。
根拠: qa-r-auth-3、qa-r-security-3、qa-f04、qa-v27、qa-v28（system-spec/auth.md、system-spec/security.md）

2026-10-19〜20 の追加: 範囲の外の人のレポートの URL と評価の中身は、他社や担当外と同じく区別せず 404 にする。判断と理由は、評価の中身を見られる人（本人・直属の上司・管理者）にだけ返し、本人には確定した後だけ返す。
根拠: qa-y13、qa-z02（system-spec/auth.md、system-spec/security.md）

2026-10-20〜21 の追加: 識別とアクセス: 判断の記録は、自分自身の評価と部下でない人の評価を 403 で断る。上司の判断と理由を見せる範囲は、確定前の評価の詳細と同じ範囲（本人は確定した後だけ）と読み、見える人を増やさない。入力の検査: 昇給・昇格の判断の理由と上司コメント（evaluatorComment）は本人にも同じ文で見せるので、保存のときに本人に見せられない語（点数・配点・必要点数につながる表現）を検査し、引っかかった語を名指しして断る。メモは公開範囲ごとにその段階以上の権限の人が全員読め、書ける公開範囲は読める公開範囲と同じにする。
根拠: qa-z03、qa-z04、qa-z05（I25）、DD-021（system-spec/auth.md）

2026-10-21〜22 の追加: 識別とアクセス: 書き戻しで変わる設定は、それぞれの設定の画面を保存できる人と同じ判定で絞る。エラーと回復性: 評価セットの決まり（等級区分ごとの項目数・固定枠・20点枠）や KPI の計算に要る設問（分子・分母など）に合わなくなる保存は、アンケートも設定も変えずに断り、合わない決まりと直す画面を示す。断った保存は理由を返しても、他社の設定の名前や有無を返さない。同時に保存したときは 409 にする。可観測性と監査: 反映も制度の変更の記録を通し、どのアンケートと評価が変わったかを保存の結果の文で示し、保存の後は関係する全ての画面を取り直して他のタブにも知らせる（製品仕様 §27）。
根拠: qa-ab11-survey-writeback-rule-conflict、G27（system-spec/auth.md）

2026-10-22 の追加: 識別とアクセス: 回数制限は Cloudflare が付ける送り手の IP で人を見分け、better-auth の回数制限と自前の回数制限の両方に同じ見分け方を当てる。パスワードの長さの決まりは、どの口でも同じ関数で確かめる。
根拠: qa-ac09 (10)(11)、G34（system-spec/auth.md）

## Subtype architecture

合成対象の subtype と該当テンプレート:

- Frontend: N/A: subtype 非選択
- Backend: N/A: subtype 非選択
- Infrastructure: N/A: subtype 非選択
- Data: N/A: subtype 非選択
- Security: 合成済み (`architecture-security.md`)

2026-10-22 の追加: Security に、認証の入口の許可制・回数制限の見分け方・パスワードの決まり・用途ごとの鍵（G31・G34）を足す。台帳と再発を止める静的検査は system-spec/maintenance-ops.md、入口の量の上限は system-spec/backend.md の担当。
根拠: qa-ac09、qa-ac07、qa-ac10（system-spec/auth.md）

### Security architecture

#### Assets, actors and threat model

守る資産は、セッションとアカウント、会社ごとの制度設定（等級名を含む）、各人の等級と確定済みの評価点、初期パスワードの控え、誰がどの会社に所属しているかという所属の情報である。主体は4つの役割の利用者と外部のエージェントで、悪用の例は、Server Function を外から直接呼ぶ・別のサイトから呼ばせる、選んでいる会社の cookie を書き換えて所属していない会社を読み書きする、マネージャーや他社の管理者が等級名を変える、一般の社員が他人の等級と点数を得る、他社に既にいる人を足すときにその人の所属を知る、である。信頼の境界は入口（runAction・runRead）・外部向けの Route Handler・セッションで、他タブへの通知は中身を持たず認可の代わりにならない。
根拠: qa-r-auth-3、qa-r-security-3、qa-v27、qa-v28、D-004（system-spec/auth.md、system-spec/security.md）

2026-10-19〜20 の追加: 守る資産に、個人別の評価レポート・評価の中身（項目ごとの判定と根拠）・上司の判断と理由を足す。悪用の例に、マネージャーが部下でない人のレポートの URL を開く・CSV で会社の全員分を得る、本人が点数の数値や他の人との比較の値を得る、自分自身の評価に判断を記録する、を足す。
根拠: qa-y13、qa-z02（system-spec/auth.md、system-spec/security.md）

2026-10-20〜21 の追加: 悪用の例のうち、マネージャーが CSV で会社の全員分の結果を取ることと、管理者だけのメモがマネージャーに見えることは、本番に既にあった権限の漏れだった。脅威に、上司が昇給・昇格の理由や上司コメントに点数などを書き、本人へ数値が漏れることを足す。自分を評価する側にも立つ人が自分について見られる情報は O19 の外に置き、SECURITY-013 で決める。
根拠: qa-z03、qa-z05（O19・I25）（system-spec/auth.md）

2026-10-21〜22 の追加: 守る資産に、アンケートの保存から書き戻される設定（KPI の設問の文・評価セットの項目・行動指針の観点・等級要件）を足す。悪用の例に、アンケートの下書きを直せる人が書き戻しで設定を変える、断られた保存の理由から他社の設定の名前や有無を知る、設定の保存で他社のアンケートの下書きを作り直させる、を足す。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、G27（system-spec/auth.md）

2026-10-22 の追加: 守る資産に、認証の秘密と、そこから導く用途ごとの鍵を足す。脅威の観点は本質の (A)〜(E) で、使っていない認証の口・回数制限の見分け方・口ごとに違うパスワードの決まりを対象にする（細部は台帳にも書かない）。
根拠: qa-ac09 (9)〜(12)、G31・G34（system-spec/auth.md、system-spec/security.md）

#### Identity and authorization

認証は better-auth のメールアドレスとパスワード（本人登録なし、セッション7日・更新1日、cookieCache なし）である。アカウントは1つで所属は複数持てるが、ログインとセッションはアカウントの単位のまま1つにし、会社ごとに資格情報を分けない。認可は入口で送り元・セッション・役割の順に確かめ、認可に失敗したら何もしない既定拒否で、権限の無い画面は 404 かログイン画面になる。テナントの境界は選んでいる会社の所属である。getViewer がリクエストのたびに cookie が指す会社への所属を確かめ、所属が無ければ有効な所属のうち会社名の順（同名は会社 id の順。D-009）で最初の会社を使う。会社の切り替えはセッションを作り直さず cookie だけを変え、所属していない会社への切り替えは拒否する（システム全体管理者は全社から選べる）。全ての読み書きをその所属で絞る（D-004）。等級名の変更はシステム全体管理者と自社の会社の管理者だけで、他社の等級を指す要求は拒否する。開けるページ（accessClass）とできる操作・役割ごとの可否・説明は route-ledger.json の各ページから引き、サイドバー・ページの入口・サーバー処理の役割の指定・session.ts の can〜 の判定・権限一覧がこの台帳だけを読む（D-007）。権限の定義を画面から編集できるようにはしない。
根拠: qa-f03、qa-r-auth-3、qa-v27、qa-v28、D-004、D-007（system-spec/auth.md、system-spec/security.md）

2026-10-19〜20 の追加: 評価の中身とレポートの認可は canViewEvaluationOf の1か所で決め、レポートの画面・評価の詳細・CSV の書き出し・メモの読み出しが同じ判定を使う。上司の判断の記録は canActOnEmployeeEvaluation（確定と同じ）で認可し、自分自身の評価は拒否する。
根拠: qa-y13（system-spec/auth.md）

2026-10-20〜21 の追加: レポートの画面・評価の詳細・CSV の書き出し・メモの読み出しが同じ判定を使うとした点を改めた：今は新しい入口ごとに判定の関数を1つに決め、レポートの画面は canViewEvaluationOf（本人は self、会社の管理者以上と直属の上長は reviewer、ほかは null）だけを使う。評価の詳細の2画面は今の判定のまま残す。CSV の書き出しは canReviewEmployeeEvaluation で絞り、会社の管理者以上は自社の全員、マネージャーは直属の部下の行だけで、本人の枝を持たない。メモの読み出しは readableNoteVisibilities で絞る。判断の記録は canActOnEmployeeEvaluation で認可し、自分自身の評価と部下でない人の評価は 403 で断る。
根拠: qa-z02 の訂正、qa-z03、qa-z04、qa-z06、appr-foundation-014、DD-021、DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: アンケートの保存から設定へ書き戻す処理は、その要求のセッションから作った見る人で会社の管理者以上を確かめてから本体へ進み、書き戻しで変わる設定はそれぞれの設定の画面を保存できる人と同じ判定で絞る。アンケートの下書きを直せることだけで、設定を変えられるようにはしない。KPI・評価セットの作業を別の画面に分けても、どの画面の入口にも今の役割の判定を当て、route-ledger.json に足す。見本の会社への投入にも新しい役割を作らない。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、G26、G27、G28（system-spec/auth.md）

2026-10-22 の追加: better-auth の口は許可リストに入れたものだけを通し、ほかは 404 にする。許可リストには、使っている口をコードとログで確かめてから入れる。氏名とパスワードの変更は src/actions/account.ts の口だけで受ける。回数制限は Cloudflare が付ける送り手の IP で人を見分け、better-auth と自前の両方に当てる。パスワードは、作成・初期・本人の変更・better-auth の設定のどれでも10文字以上にする。
根拠: qa-ac09 (9)〜(11)、G34（system-spec/auth.md）

#### Data and secret protection

ログイン後の HTML と API の応答は private, no-store で共有のキャッシュに載せず、他タブへの通知と鮮度の手がかり（生成時刻）には個人情報や内部の ID を載せない。初期パスワードの控えは AES-GCM で暗号化して利用者 ID に結び付け、鍵は Workers の secret（CREDENTIAL_ENC_KEY）だけに置き、開けるのはシステム全体管理者と同じ会社の管理者で、14日を過ぎたら開けず次の発行で消す。既存アカウントへ新しい会社所属を足すのは全体管理者の専用処理だけで、新しいアカウントを作らず、パスワードと資格情報の控えを変更・発行しない。所属・必要な元所属の写し・監査を同じ batch で書く。会社管理者の新規登録は既存メールを汎用文面で拒否し、他社の所属先を知らせない（DD-009）。所属を消すときはその会社の所属だけを消し、他の所属が残る人のアカウントとセッションは消さず、最後の所属を消したら今の利用者の削除と同じに扱う。
根拠: qa-r-security-3、qa-v28（system-spec/security.md、system-spec/auth.md）

2026-10-20〜21 の追加: 昇給・昇格の判断の理由と上司コメントは、保存のときに点数・配点・必要点数につながる語を検査して断り、本人に数値が漏れないようにする。同じ等級の重ならない社員が3人未満なら、平均と幅を出さない。『管理者のみ』のメモは会社の管理者以上だけが書いて読み、マネージャーの入力欄には出さない。
根拠: qa-z03、qa-z04、qa-z05（O19・I25）（system-spec/auth.md）

2026-10-21〜22 の追加: 設定の保存が自動で作り直す下書きと次の版の下書きは、保存した人の会社の範囲の中だけに作る。断った保存は理由と直す画面を返しても、他社の設定の名前や有無を返さない。本番に入れる仮のデータは見本の会社の分（G28・I31）に限り、手元の seed と E2E のデータは本番 DB に入れない。
根拠: qa-ab08-published-form-follow、qa-ab11-survey-writeback-rule-conflict、qa-ab17-foundation-019-approval、G27、G28（system-spec/auth.md）

2026-10-22 の追加: 認証の秘密を別の用途に流用せず、用途ごとに鍵を導く。秘密を替えると古いセッションが使えなくなることと、控えが新しい鍵で読めることをローカルで確かめる。本番での交換・失効・強制変更は利用者が判断し、外部変更ガードを通す（G31）。
根拠: qa-ac09 (12)、G31、O31（system-spec/auth.md、system-spec/security.md）

#### Application and supply-chain controls

Server Functions の入口は送り元の検査と認可の後に大きさの上限（413）と zod による入力の検証を行い、別のサイトからの呼び出しは Next.js の検査（allowedOrigins を足さない）と assertSameOrigin の二重で断る。画面から書き込みの fetch を直接呼ぶ箇所と入口を通らない Server Function を静的検査で落とし、例外（sendBeacon の利用記録・外観の選択の記録）は理由付きで列挙する。並べ替えは Pointer Events で自作して新しい依存を足さない（D-005）。権限の定義は route-ledger.json に足し、DB の表を足さない（D-007）。Next.js は脆弱性の修正を含む 16.3.8 へ上げる。外部への変更系通信は preview → CONFIRM → authorize → execute のガードを通し、PR は利用者の確認を取ってから作る。
根拠: qa-r-backend-4、qa-r-security-3、qa-r-infrastructure-3、qa-v29、D-005、D-007（system-spec/backend.md、system-spec/security.md、system-spec/infrastructure.md、system-spec/00-requirements-definition.md の U8）

2026-10-20〜21 の追加: OWASP ASVS のアクセス制御の要求（サーバー側で、既定で拒否する）に沿い、新しい入口ごとに判定の関数を1つに決め、画面ごとに条件を写して食い違う穴を作らない。理由の文と上司コメントの検査は、表示のときではなく保存のときにかけ、本人には書いたとおりの文を届ける。本番へは main へのマージで自動で出るので、P05 をマージする前に P06 の自動テストと bundle の大きさ・cf:dry-run を P05 の PR の上で通す。
根拠: qa-z03、qa-z05（I25）、DD-020〜DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: アンケートの保存からの書き戻しは新しい入口にせず、設定の保存と同じ runAction を通して、会社の管理者以上・会社の絞り込み・同時に保存したときの 409・制度の変更の記録（constitution_events）を同じ順で当てる。反映（I28）と下書きの作り直し（I29）は DD-015・DD-016 を改める DD を書いてから実装し、公開の前の検査（staleAskingItems）は残す。見本の会社への受付中の期の追加は既存の db:sample:remote の手順に利用者の確認を挟んで行い、新しい役割や入口を足さない。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、qa-ab12-showcase-data-location、qa-ab16-foundation-018-approval、G27、G28（system-spec/auth.md）

Server Functions の入口は送り元の検査と認可の後に大きさの上限（413）と zod による入力の検証を行い、別のサイトからの呼び出しは Next.js の検査（allowedOrigins を足さない）と assertSameOrigin の二重で断る。画面から書き込みの fetch を直接呼ぶ箇所と入口を通らない Server Function を静的検査で落とし、例外（sendBeacon の利用記録・外観の選択の記録）は理由付きで列挙する。並べ替えは Pointer Events で自作して新しい依存を足さない（D-005）。権限の定義は route-ledger.json に足し、DB の表を足さない（D-007）。Next.js は脆弱性の修正を含む 16.4.1 以上へ上げる。外部への変更系通信は preview → CONFIRM → authorize → execute のガードを通し、PR は利用者の確認を取ってから作る。
2026-10-22 の追加: Next.js の版は G32 で 16.4.1 以上と決めた。認証の口を許可制にして、ライブラリの既定でオンの口が攻撃面を広げないようにする（本質の (A)(D)、G34）。
根拠: qa-ac02、qa-ac09 (9)、G32・G34（system-spec/auth.md、system-spec/00-requirements-definition.md）

#### Detection and response

監査として、等級名の変更・所属の追加と削除・本番の一律の書き換えを残して書き換え前の値を記録し、誰が誰の控えを開いたかを値を含めずに Workers Logs へ残す。会社の利用停止や利用者の無効化は次の要求で拒否されることで即時に効く。所属を外された会社は、cookie がその会社を指していても次のリクエストから使われない。他タブは通知か画面復帰で取り直した時点で権限の無い画面が 404 やログイン画面になる。ログアウトやログインし直しの後は、その時点のセッションで取り直す。脆弱性への対応として、今回は Next.js を修正を含む 16.3.8 へ上げる。
根拠: qa-r-auth-3、qa-r-security-3、qa-r-infrastructure-3、qa-v27、qa-v28（system-spec/auth.md、system-spec/security.md）

2026-10-20〜21 の追加: どの入口もセッションの写しを持ち越さないので、所属の上司が変わったり役割を外されたりしたら、次の要求から見えなくなり記録もできなくなる。本番に既にあった権限の漏れ2件（マネージャーの CSV・管理者だけのメモ）は、別の PR を出さず、この作業ツリーの変更の中で直した。
根拠: qa-z02 の訂正、qa-z03、DD-020〜DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: アンケートからの書き戻しも、設定の保存と同じ制度の変更の記録（constitution_events）に残す。設定を保存したときは、どのアンケートと評価が変わったかを保存の結果の文で示し、締め切ったアンケート・確定した評価・評価レポートは変えない。
根拠: qa-ab07-survey-to-setting-direction、G27（system-spec/auth.md）

監査として、等級名の変更・所属の追加と削除・本番の一律の書き換えを残して書き換え前の値を記録し、誰が誰の控えを開いたかを値を含めずに Workers Logs へ残す。会社の利用停止や利用者の無効化は次の要求で拒否されることで即時に効く。所属を外された会社は、cookie がその会社を指していても次のリクエストから使われない。他タブは通知か画面復帰で取り直した時点で権限の無い画面が 404 やログイン画面になる。ログアウトやログインし直しの後は、その時点のセッションで取り直す。脆弱性への対応として、今回は Next.js を修正を含む 16.4.1 以上へ上げる。
2026-10-22 の追加: 漏えいの恐れがあるときの手順（秘密の交換・セッションの失効・パスワードの変更）の手順書を docs/security/ に置き、ローカルで確かめる。実行するかは利用者が決める（G31）。
根拠: qa-ac07 (16)、qa-ac09 (12)、G31（system-spec/maintenance-ops.md、system-spec/auth.md）

#### Security verification

server-actions-contract.test.ts（入口を通らない書き込みを0件に保つ）と action-origin.test.ts（送り元の二重の検査）を pnpm test で回す。追加の検査として、等級名を変えられる役割が限られていること、ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致すること（台帳と突き合わせる契約テスト）、権限一覧の表とカードが同じ内容を出すこと、一般の社員の応答に他人の等級と点数が無いこと、所属していない会社のデータが読めず指定した要求が拒否されることを確かめる。役割ごとの結合テストで、マネージャー・一般の社員・他社の会社の管理者による等級名の変更が画面とサーバー処理の両方で拒否されることを確かめる。
根拠: qa-r-ops-3、qa-v28、qa-v31、D-007、O7・O8・O10（system-spec/maintenance-ops.md、system-spec/auth.md）、system-spec/security.md

2026-10-19〜20 の追加: 役割（全体管理者・会社の管理者・マネージャー・一般の社員）と直属の部下の組ごとに、レポート・評価の中身・CSV・メモが見える・404 になることを結合テストと E2E で確かめる。判断の記録を自分自身・部下でない人に拒否することをサーバー処理のテストで確かめる。
根拠: qa-y13、qa-y16（system-spec/auth.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: レポートの判定の関数（canViewEvaluationOf）を呼ぶのがレポートの画面だけで、CSV の書き出しとメモの読み出しが使わないことを契約テストで確かめる（O19）。同じ等級の重ならない社員が3人未満なら、平均と幅を出さないことをテストで確かめる。
根拠: qa-z05（O19）（system-spec/auth.md）

2026-10-21〜22 の追加: 評価セットの決まりや KPI の計算に要る設問に合わなくなる書き戻しの保存が断られ、合わない決まりと直す画面が示されることを、サーバー処理のテストで確かめる（O27）。設定を変えても、締め切ったアンケート・確定した評価・レポートが変わらないことを結合テストで、写しを持つ場所の一覧とコードが一致することを契約テストで確かめる。
根拠: qa-ab11-survey-writeback-rule-conflict、O27、G27（system-spec/auth.md）

2026-10-22 の追加: 使っていない認証の口と偽れる識別が0件であることを確かめる（O34。細部は書かない）。秘密を替えると古いセッションが使えなくなること・控えが新しい鍵で読めること・鍵が用途ごとに分かれることを、ローカルと単体テストで確かめる（O31）。パスワードの長さの決まりがどの口でも同じことを単体テストで確かめる。
根拠: qa-ac09 (9)〜(12)、O31・O34（system-spec/auth.md、system-spec/00-requirements-definition.md）

## Architecture decisions

D-002（採択 opt-server-functions）: 画面からの書き込みを Server Functions へすべて移し、成功したら同じ応答で画面を作り直す。代替の『Route Handler のまま画面側で router.refresh を呼ぶ』は変更が小さいが、利用者は Next.js が勧める即時更新の経路を選んだ。移行中に認可が抜ける危険は、入口（runAction・runRead）に検査の順序を固定して抑えた。セッション: cookieCache を入れると、ロールの変更や会社の利用停止が最大でキャッシュの期間だけ遅れて反映されるため、要求ごとに D1 から読む形を保つ。D-004（採択 opt-membership-cookie）: 利用者が選んだ（qa-v12）。今システム全体管理者だけが使う hr_company の cookie と会社の切り替えの部品を全員に広げ、所属は自前の表に持つ。代替の better-auth の organization plugin は既存の companies 表と二重になり、等級・上司を member の表の外に持ち、版上げへの追随が要る。URL に会社を入れる案は46画面のルートとリンクを全て移す。この案の危険は、cookie の会社への所属の確認を1か所でも漏らすと所属していない会社のデータが見えることで、getViewer がリクエストのたびに確かめる形で抑える。D-007（採択 opt-route-ledger-extend）: 利用者が①（route-ledger.json に操作と説明を足す）を名指しで選んだ（qa-v25、2026-10-13T03:40:15Z）。委任に基づいて AI が選んだ別の案とは違う案である。3案は権限の定義の正本の置き場所の択一で、全てに持つと正本が複数になる。①は、開けるページ（accessClass）に加え、主な操作・役割ごとの可否・説明も route-ledger.json の各ページに置き、権限の定義を台帳1つにまとめる。サイドバーと判定が同じ台帳を読むので、表示と判定のずれを既存の route-ledger のテストで見つけられる。DB の表で編集する②は、表と実際の判定のずれに気づけない（比べたときの不利な点）。①の不利な点は、説明を直すたびに仕様文書の変更になることである。役割の種類は増やさない。利用者は、D-007 ① に合わせて (4) を直した本章の文面を、旧と新を逐語で示されたうえで承認した（qa-v27、2026-10-13T03:48:20Z）。
根拠: D-002（qa-u18）、D-004（qa-v12）、D-007（qa-v25）、qa-r-auth-3、qa-v27（system-spec/auth.md、system-spec/spec-state.json）

2026-10-14 の会社所属の現在の契約：既存アカウントへ別の会社の所属を足すのは全体管理者だけの専用操作（addMembership）とする（qa-w11、D-008）。選んでいる会社が無いとき（cookie が無い・所属していない会社を指す）は、有効な所属のうち会社名の順で最初の会社を開く（同名は会社 id の順。qa-w12、D-009）。委任（qa-v32）に基づく DD-009 の『最も古い有効な所属』は利用者の選択で取り消し、実装は 2026-10-15 に会社名の順へ直した（src/lib/memberships.ts の activeMembershipsByCompanyName。users の写しの基準は古い順のまま。DD-009 の更新）。どちらの順でも、リクエストのたびに所属をサーバーで確かめることは変わらない。根拠: qa-w11, qa-w12, qa-v27／system-spec/auth.md・system-spec/security.md・docs/product/design-decisions.md

2026-10-19〜20 の追加: 見える範囲は所属の上司（直属）だけで決め、組織の階層をたどらない（間接の部下を含めない。qa-x03 で本人も見られる形を利用者が選んだ）。判断を記録する権限を新しく作らず、確定の権限に重ねる（役割の種類を増やさない制約 U8 に沿う）。
根拠: qa-x03、qa-y05、qa-y13（system-spec/auth.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 計画レビューの食い違いは、DD-020〜DD-024 と計画レビューの受領書に先に確定させ、spec-state への反映は P12 でまとめて行う案を利用者が選んだ（もう一方の『今 spec-state まで直す』案は、取り込み済みの9 node が古い扱いになり next と requirements が止まる）。上司の理由の文に点数が書かれる恐れには、表示のときに共通の文へ差し替える案（『同じ文を見せる』決めが崩れる）や検査しない案ではなく、保存のときに語を示して直してもらう案を選んだ。『管理者のみ』のメモは、利用者の自由記述の答えを『公開範囲ごとに、その段階以上の権限の人が全員読める』と読み、マネージャーには出さずサーバーでも受け付けない形で直した。qa-y13 (6) の読み替えは推奨の印の付いた 2026-10-20 の問を根拠にしていたので、2026-10-21 に推奨の印の無い2択（qa-z06 の問4）で確かめ直し、確認済みとして閉じた。
根拠: qa-z03、qa-z04、qa-z06、appr-foundation-014、DD-020〜DD-024（system-spec/auth.md）

2026-10-21〜22 の追加: アンケートの設問を後から足したり外したりした変更は、波及先を見せてから反映する案ではなく、保存と同時に元の設定へ反映する案を利用者が選んだ。評価セットの決まりや KPI の計算に要る設問に合わなくなる保存は、反映して食い違いを知らせる案ではなく、断って理由と直す所を示す案を選んだ。この反映（I28）と設定の保存での下書きの作り直し（I29）は DD-015・DD-016 を改めるので、改める DD を書いてから実装し、公開の前の検査（staleAskingItems）は残す。G29 の色使いはボタンだけでなく、カード・見出しの面・選ぶ部品・状態の印・進み具合・数の面・知らせ・表・いまいる場所の印まで広げたが、色と手応えの変更（G29）と画面の分け方（G26）は新しい権限を作らず今の認可の判定をそのまま使う。要件の土台への追記は appr-foundation-016〜020 で承認し、後の承認が前の承認を置き換えた。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、qa-ab13-foundation-016-approval、qa-ab15-foundation-017-approval、qa-ab16-foundation-018-approval、qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、G26、G27、G29、appr-foundation-016〜020（system-spec/auth.md）

2026-10-22 の追加: 公開の入口は workers.dev のまま（D-012）とし、アプリより前の層の防御が無いことは台帳に残す。その分、認証の口をアプリの側で許可制にする。新しい役割・見える範囲は作らない。
根拠: qa-ab04（D-012）、qa-ac09 (9)(13)（system-spec/auth.md、system-spec/infrastructure.md）

## Delivery, migration and rollback

Server Functions への移行は今回すべて終えており、画面からしか呼ばれなくなった Route Handler は消して書き込みの経路を二重にしていない。所属の導入は、所属の表の追加と既存の利用者全員への所属の作成をマイグレーションで行う。getViewer を cookie で選んでいる会社への所属から作る形へ移し、users.company_id を読む約33か所と viewer.companyId を読む約140か所を所属の値へそろえる（D-004）。ルート台帳には権限一覧のページを足し（46画面から47画面）、全てのページに主な操作・役割ごとの可否・説明の欄を足す（D-007）。そのときは route-ledger.test.mjs・nav.test.ts・check:docs を合わせ、『Claude Code連携の鍵』の名前をルート台帳・README・docs・テストで改める。リリースは外部変更ガードを通した Deploy で行い、PR は実装後に利用者の確認を取ってから作る。
根拠: D-002、D-004、qa-r-backend-4、qa-v26、qa-v30、qa-v31（system-spec/auth.md、system-spec/backend.md、system-spec/maintenance-ops.md）、system-spec/database.md

2026-10-19〜20 の追加: 台帳の更新（レポートのページの追加・KGI の行の削除・確定の操作の説明）は、route-ledger.test.mjs・nav.test.ts・check:docs と同じ変更で合わせる。KGI のページは1回目の Deploy で台帳とナビから消え、開くと 404 になる。
根拠: qa-y13、qa-y16（system-spec/auth.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: main へのマージで自動で本番に出る仕組みに合わせ、計画の『P13 で手動で2回公開する』を、1回目＝P05 のマージ、2回目＝P08 のマージと読み替えた。P05 をマージする前に、P06 の自動テストと bundle の大きさ・cf:dry-run を P05 の PR の上で通すことを条件にした。P13 は、CI の実行番号と backup、本番の読み取りを記録する役にした。
根拠: qa-z03（system-spec/auth.md）

2026-10-21〜22 の追加: 範囲の外の『本番データの移行・修正』の除外に、行動指針の既定の割り当てへの書き換え（I26・G25）と、この仕様で足した移行のうち行を書き換える 0032〜0036 と 0039 を挙げた（0037・0038 は表と列の追加だけ）。本番 DB へのテストデータ（手元の seed と E2E のデータ）の投入は範囲の外のままで、本番の見本の会社への仮のデータ（G28・I31）だけを除く。見本の会社への受付中の期の追加は、既存の db:sample:remote の手順だけで行う。いまずれている下書きのアンケートは、更新時刻の新しい方へそろえる（I30）。
根拠: qa-ab12-showcase-data-location、qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、G25、G27、G28、appr-foundation-019、appr-foundation-020（system-spec/auth.md）

2026-10-19〜20 の追加: 台帳の更新（レポートのページの追加・事業所の達成率の行の削除・確定の操作の説明）は、route-ledger.test.mjs・nav.test.ts・check:docs と同じ変更で合わせる。事業所の達成率のページは1回目の Deploy で台帳とナビから消え、開くと 404 になる。
2026-10-22 の追加: 許可リストは、使っている口をコードとログで確かめてから入れる。秘密の交換などの手順はローカルで確かめるまでとし、本番での実行は利用者の判断で外部変更ガードを通す。
根拠: qa-ac09 (9)(12)、G31（system-spec/auth.md）

## Risks and verification

リスクは、Server Function が外から直接呼べるため、入口を通らない書き込みが残ると認可が抜けることである。cookie の会社への所属の確認を1か所でも漏らすと、所属していない会社のデータが見える（D-004）。所属の値へのそろえ漏れでも、会社の境界が崩れる。サイドバー・ページの入口・サーバー処理の役割の指定・session.ts の判定のどれかが route-ledger.json の権限の定義と食い違うと、権限一覧の表示と実際の判定がずれる（D-007）。説明の小さな直しのたびに仕様の台帳が変わり、仕様の変更の記録が文言の直しで埋まるおそれもある。検査として、server-actions-contract.test.ts が入口を通らない書き込みを、action-origin.test.ts が送り元の二重の検査を固定し、pnpm test で違反0件を求める。追加分は、マネージャー・一般の社員・他社の会社の管理者による等級名の変更が画面とサーバー処理の両方で拒否されることを確かめる。ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストと、権限一覧の表とカードが同じ内容を出すことも確かめる。会社を切り替えると役割・等級・上司で画面と権限が変わり、所属していない会社が拒否されることを結合テストで確かめる。
根拠: qa-r-auth-3、qa-r-ops-3、qa-v31、D-004、D-007、O7・O8・O10（system-spec/auth.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: リスクは、画面ごとに見える範囲を書き直して判定がずれること、マネージャーが CSV で部下でない人の行を得ること、判断の記録が画面で隠すだけになることである。検査として、役割と直属の部下の組ごとに見える・404 を確かめる結合テストと E2E（O19）、判断の記録を自分自身・部下でない人に拒否するサーバー処理のテスト（O24）を置く。
根拠: qa-y13、qa-y16（system-spec/auth.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: リスクは、P12 で反映するまで system-spec の本文に古い記述が残ることで、本文と食い違う箇所は qa-y13 の答の直後のような訂正を正として読む。検査として、O19 の測り方に、レポートの判定の関数を呼ぶのがレポートの画面だけで、CSV の書き出しとメモの読み出しが使わないことの契約テストを足した。同じ等級の重ならない社員が3人未満なら、平均と幅を出さないことをテストで確かめる。
根拠: qa-z03、qa-z05（O19）、qa-z06（system-spec/auth.md）

2026-10-21〜22 の追加: リスクは、アンケートを直せることから設定を直せる権限を推し量って書き戻しの判定が抜けることと、断った保存の理由に他社の設定の名前や有無が混ざることである。検査として、下書きのアンケートで設定とつながった設問を足す・外す・文を直すと元の設定が同じ保存で変わり、決まりに合わなくなる保存は断られて合わない決まりと直す画面が示されることを、サーバー処理のテストで確かめる（O27）。設定を変えると、回答0件の下書きが作り直され、回答のある公開中のアンケートには次の版の下書きが1つだけでき、締め切ったアンケート・確定した評価・レポートは変わらず、確定前の評価は集計し直されることを結合テストで確かめる。写しを持つ場所の一覧とコードが一致することを契約テストで、保存の直後に関係する画面と他のタブが新しい内容で出ることを E2E で確かめる。
根拠: qa-ab07-survey-to-setting-direction、qa-ab11-survey-writeback-rule-conflict、O27、G27（system-spec/auth.md）

2026-10-22 の追加: リスクは、許可リストに入れ忘れた口が使えなくなることで、コードとログで確かめてから入れて抑える。回数制限の数が isolate ごとに持たれることは、残るリスクとして台帳に載せる。検査は O31・O34。
根拠: qa-ac09 (9)、qa-ac07 (21)、qa-ac08 (18)（system-spec/auth.md、system-spec/maintenance-ops.md、system-spec/security.md）


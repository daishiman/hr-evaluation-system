---
graph_node_id: "arch-system-spec-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "フロントエンド：鮮度の共通口、追加要件の共通部品、評価レポートのテンプレートとA3一枚の印刷、設定画面の段階的な開示と両方向の追従、テーマの変数から作る色使い"
project_id: "hr-evaluation-system"
domain: "frontend"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応"]
file_path: "architecture/system-spec-frontend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "96bb42732219f0c8ce93fd867c2e221acbf07d696ac191d841c3cbb296cab10d", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-2026-10-22.json"}
source_lineage: {"imported_at": "2026-10-22T07:58:56Z", "origin_kind": "system-spec-harness", "source_digest": "96bb42732219f0c8ce93fd867c2e221acbf07d696ac191d841c3cbb296cab10d", "source_path": "system-spec/frontend.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-frontend.md", "confidence": 0.92}, {"artifact_kind": "specification", "candidate_path": "specs/system-spec-frontend.md", "confidence": 0.4}]
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

この章は、画面側の部品と実装の構造を受け持つ。書き込みは useSaveAction から Server Functions を呼び、応答に載った新しい描画で成功の知らせと一覧・件数・会社切替メニュー（layout）を同じ描画で更新し、createCommitGate で新しい描画が終わってから成功を返す。他タブと画面復帰は、画面の骨格に1回だけ置いた FreshnessSync が受け持つ。2026-10-12 の追加では、等級名をサーバーから受け取って出す部品、並べ替えの共通の部品（D-005）、権限一覧の部品（表・役割のタブ・スマホのカード・説明の吹き出し。D-006）、設定不足の共通の部品、アンケートの回答と見本の部品、端末ごとの状態の置き場、画面ごとの段組みを足す。この追加の全文は、利用者が全文のまま承認した（qa-v22、2026-10-13T00:03:46Z）。根拠: qa-v22, qa-r-frontend-3, qa-v13, qa-v14／system-spec/frontend.md

2026-10-14 の追加で、比べる警告の部品（ComparisonGapNotice）を1つ作り、アンケートの一覧・アンケート1本・使うKPIを選ぶの3画面はこれだけを使う（G16・I17）。この追加の全文は、利用者が全文のまま承認した（qa-w07、2026-10-14T20:46:24Z）。根拠: qa-w07, qa-w01, qa-w03／system-spec/frontend.md

2026-10-19〜20 の追加: KGI の画面・部品・ナビの項目を消し、レポートの部品を1つのテンプレート（ReportTemplate）にしてサーバーで作ったデータの形だけを受けて描く。図は既存の Charts.tsx（recharts）を広げてレーダー図・折れ線・棒を足し、新しい依存は足さない。結論の表示は共通の部品（DecisionBadge）にまとめ、確定の画面の判断の欄は評価者向けの部品に足す。印刷は @page と @media print で作る。
根拠: qa-y11（system-spec/frontend.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビューで見つかった食い違いは、DD-020〜DD-024 と計画レビューの受領書で先に確定させ、spec-state への反映は P12 でまとめて行った（それまでは記録のほうが優先）。その反映で、frontend の資するゴールに G19 を足した。G23 は frontend に対応する項目が無いので足さず、backend の (14) と database が担う。見える範囲は、レポートの画面だけが使う判定の関数と、CSV とメモのそれぞれの判定でサーバーが絞る。上司の判断の理由と上司コメントは保存のときに語を検査し、比べる警告は新しい版が今の設定と一致しているかで出し分ける。
根拠: qa-z03、qa-z04、G19、I20、I23、I25、DD-020〜DD-024（system-spec/frontend.md）

2026-10-21〜22 の追加: 資するゴールに G25・G26・G27・G29 を足す。段階的な開示（Disclosure・HintToggle・RevealToggle・InlineDetail）と境界のはっきりしたカード（Card・CardHead）を共通部品に置き、画面ごとの組み替えは行動指針と KPI・評価セットの2画面と評価を作る画面に限る。色と手応えは globals.css の部品クラスに閉じ、部品は主・副・選んだ・開いたの状態をクラスで渡すだけにして、TSX に色を書かない。設定とアンケートの書き戻しと追従の結果はサーバーの応答をそのまま出して他のタブへは今の FreshnessSync で知らせ、初期設定の説明の文はサーバーから受け取ったいまの割り当てから作る。評価レポートには、A3 横を選べば1枚に収める印刷、キーごとの獲得点と全確定期の等級の推移、紙用の図とフォントの背景での準備を足す（2026-10-21）。要件の土台の追記は appr-foundation-016 から appr-foundation-020 まで承認を重ね、後の承認が前の承認を置き換えた。
根拠: qa-ab14-ui-scope-beyond-buttons、qa-ab06-shared-ui-theme-contract-observed、qa-aa06-report-score-grade-design、qa-aa09-report-print-final-alignment、qa-aa10-report-print-background-preparation、G25、G26、G27、G29、appr-foundation-016、appr-foundation-020（system-spec/frontend.md）

## Context and drivers

以前は useRefreshAfterSave（34ファイルが使う）が router.refresh を呼ぶ唯一の入口で、呼んだタブだけが作り直され、連続作成フォームは控えを出している間 refresh を遅らせていたため、追加直後の一覧が古かった（qa-f05）。この観測と D-001・D-002 の採択が、鮮度の共通口を作る駆動要因になった。追加要件は 2026-10-12 の依頼（qa-v01）、利用者の決定（qa-v02）、G6〜G15 の全文承認（qa-v03）から来る。並べ替えは、利用者が Pointer Events で自作する案を選んだ（D-005、qa-v13）。権限一覧は、利用者が表・タブ・カードの組み合わせを求めた（D-006、qa-v14）。権限の定義の置き場所は、3案を比べて中立に問い直し、利用者が route-ledger.json に操作と説明を足す案を選んだ（D-007 ①、qa-v25）。上流指針は Apple HIG（操作の結果をすぐ、はっきり示す）と Clean Architecture（方針を詳細から切り離す）である。根拠: qa-v22, qa-r-frontend-3, qa-f05, qa-v13, qa-v14, qa-v25／system-spec/frontend.md

2026-10-19〜20 の追加: 2026-10-19 の依頼（評価レポート・ズレの警告・アンケートの操作）、A4 の印刷の依頼（qa-x08・qa-y08）、2026-10-20 の上司の判断で、部品と印刷の体裁を足す必要が生じた。テーマの契約テストと globals.css 冒頭の宣言は変えない。
根拠: qa-x01、qa-x08、qa-y01、qa-y08、qa-y11（system-spec/frontend.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビュー（SYS-EVAL-REPORT-P01）で、節番号が2系統あること・canViewEvaluationOf と既存の関数の関係・DD-012 を改めたこと・Deploy の手順などの食い違いが見つかった。本番には権限の漏れが2件あった（マネージャーが CSV で会社全員分の結果を取れる、管理者だけのメモがマネージャーに見える）。答え『prは出さなくて良い』を『別の PR を出さず、この作業ツリーの変更の中で直す』と読み、2件をここで直した（計画レビューの受領書 §6）。上司が書く昇給・昇格の理由は本人にも同じ文で見せるので、点数などが本人へ漏れるのを防ぐ必要も生じた。
根拠: qa-z03、DD-020〜DD-024（system-spec/frontend.md）

2026-10-21〜22 の追加: 2026-10-22 の依頼（画像5枚）は、行動指針と KPI・評価セットの画面の認知の負荷、行動指針の既定の分け方、後から設定した方を正とする追従、評価を作る画面を試す仮のデータ、共通部品の見た目を求めた。調べると、/admin/behavior は説明・警告・折りたたみ・注記を同じ面に並べて同じ文が2か所に出ており、/admin/scheme は7つの作業を1画面に並べ、KpiItemEditor は聞くことと計算式を全角空白でつないだ1行で出していた。「行動指針の初期設定について」の文はいまの割り当てを読まず画面のカードと食い違って見え、ズレ表は項目の集合の差だけを比べて更新時刻を比べず、アンケートから設定へ戻す経路は無かった。グラデーションの既存利用は .card.hero-tint だけで、契約の内側の方法は globals.css の部品クラスとして既存トークンだけで書くことになる。2026-10-21 には、評価レポートの用紙・枚数・URL の出力、キーごとの点数と等級の推移、基準帯の黒い縦線、印刷の待機についての追加依頼があった。
根拠: qa-ab01-settings-ui-overhaul-request、qa-ab02-behavior-band-default-observed、qa-ab03-settings-pages-load-observed、qa-ab04-setting-copy-propagation-observed、qa-ab06-shared-ui-theme-contract-observed、qa-aa01-report-access-print、qa-aa03-report-paper-user-revision、qa-aa05-report-score-grade-request、qa-aa10-report-print-background-preparation（system-spec/frontend.md）

## Goals and non-goals

ゴールは G1（同じタブ）、G3（他タブと画面復帰）、G4（鮮度の保証を共通の契約にし、適用漏れを検査で落とす）、G6（等級名）、G8（権限の表示と判定が食い違わない）、G12（設定不足）、G13（並べ替え）、G14（選択肢）、G15（余白）である。非ゴールは、別の利用者の画面への即時配信、オフライン編集と同期、配色・テーマの変更である。globals.css の配色・テーマの宣言とテーマの契約テストは変えず（AGENTS.md）、page.tsx の main に max-w を書かない決まりも守る。並べ替えのために新しい依存は足さない。根拠: qa-v22, qa-r-frontend-3, qa-u24／system-spec/frontend.md

2026-10-19〜20 の追加: Goals: レポートを1つのテンプレートで描く、本人向けとそれ以外でデータの形を分ける、結論と印の文言を1か所に置く、操作の出し分けと押せない理由をサーバーと同じ関数で決める。Non-goals: 新しい図の依存、平賀配色への移行、印刷用の別のデータの経路。
根拠: qa-y11（system-spec/frontend.md）

2026-10-20〜21 の追加: Goals に G19 を足した。レポートと評価結果の中身は見てよい人にだけ見せ、全体管理者と会社の管理者は会社の全員、マネージャーは直属の部下と自分、本人は自分の分を見る。範囲の外のデータは、CSV の書き出しとメモを含めてサーバーが返さない。G22 では、回答を集めている古い版の警告を、新しい版が下書きの間は消さず、今の設定と一致した新しい版を公開して古い版が締め切られたら出さない。Non-goals: 自分を評価する側にも立つ人が自分について見られる情報は、この目標の外に置く（SECURITY-013 で決める）。
根拠: qa-z03、G19、G22、O19（system-spec/frontend.md）

2026-10-21〜22 の追加: Goals: G25（行動指針の既定の分け方を、新しい会社と既定からずれた会社の両方で、呼び名を変えた会社でも等級の内部の識別子で成り立たせ、初期設定の説明はいまの割り当てを読んで示す）、G26（2つの画面は最初に判断に要る状態・件数・次にやることだけを見せ、情報は消さず見せ方を変える）、G27（設定とアンケートの設問のどちらを後から変えても後から変えた方を正とし、確定した評価と評価レポートは確定した時点のまま残す）、G29（全ての画面の共通部品に、いまのテーマの変数から作るグラデーションと色の変化と手応えを持たせる）。Non-goals: 平賀配色への移行、テーマの契約テストと globals.css 冒頭の宣言の書き換え、I27 の2画面と評価を作る画面のほかの画面の組み替え。評価レポートの追加では、新しい列・再計算・判断基準・閲覧権限、新しい API・永続ジョブ・外部送信・スキーマを足さず、本人向けに点数の数値・割合・同じ等級の平均を持たせない形を保つ。
根拠: G25、G26、G27、G29、qa-ab14-ui-scope-beyond-buttons、qa-aa06-report-score-grade-design、qa-aa10-report-print-background-preparation、appr-foundation-017（system-spec/frontend.md）

## System context and boundaries

画面側は Server Functions の共通の入口（runAction・runRead）を呼ぶ側で、認可や入力の検証は持たない。外部のエージェントが呼ぶ API（Bearer 鍵・端末の承認）、離脱時の利用記録（sendBeacon）、外観の選択の記録、認証、読むだけの検索・書き出しは Route Handler のまま残る。他タブとの連携は同じブラウザの同じオリジンの中だけで、別の利用者には届けない。対象はスマホ・タブレット・PC のブラウザで、route-ledger の 46 画面の page.tsx（権限一覧のページを足して 47 画面になる）を4役割と4幅で検証する。根拠: qa-v22, qa-r-frontend-3, qa-u25, qa-f01, qa-v31／system-spec/frontend.md・system-spec/maintenance-ops.md

2026-10-20〜21 の追加: 役割ごとに、レポート・評価の中身・上司の判断・CSV・メモの見える範囲をサーバーで絞る。上司の判断は評価の詳細と同じ範囲で見せ、見える人を増やさない。評価レポートは、誰が開いても確定した評価だけから作る。
根拠: O19、I20（system-spec/frontend.md）

2026-10-21〜22 の追加: 評価レポートの印刷はブラウザの印刷のまま作り、ブラウザ・OS の印刷ダイアログ自身は背景化しない。ブラウザ自身のヘッダーとフッターは全ての環境で強制できないので、残るときは印刷設定でオフにする案内を出す。全体管理者は既存の会社切替で選んだ会社の全メンバーを閲覧でき、権限・本人向けの数値の非表示・確定の条件・計算・スキーマは変えない。アンケートから設定への反映も、設定の保存と同じ権限（会社の管理者以上）と会社の絞り込みの内側で行う。
根拠: qa-aa01-report-access-print、qa-aa04-report-landscape-onepage-design、qa-aa09-report-print-final-alignment、qa-aa10-report-print-background-preparation、G27（system-spec/frontend.md）

## Container and component view

鮮度の部品は、書き込みを呼ぶ useSaveAction、成功を新しい描画の後まで待たせる createCommitGate、他タブと画面復帰を受ける FreshnessSync、連続作成フォームの RecordForm（generate 経路）からなる。追加の共通部品は、等級名をサーバーから受け取って出す表示、並べ替えの部品（Pointer Events による長押しと押したままのドラッグ・矢印のボタン・キーボード・aria-live での読み上げ。D-005）、権限一覧の部品（表・役割のタブ・スマホのカード・説明の吹き出し。D-006）、設定不足の部品（何が・どう直す・リンク）である。権限一覧の部品はページとモーダルで共用し、表は table 要素、タブは APG の tabs の形、モーダルは dialog 要素で作る。説明は aria-describedby で結び、フォーカスとタップでも出す。表とカードは画面の幅で切り替え、どちらも同じデータから描く。等級要件・昇格の条件と要件・アンケートの設問と選択肢の編集は並べ替えの部品へ寄せ、設定不足を出している ReasonNote は新しい部品へ置き換え、他の用途の ReasonNote は残す。アンケートの回答の部品は設問名の label を入力の要素へ結んで選択肢を label の全面で押せるようにし、見本の部品は試しに選べる状態を持ち送信の操作を出さない。根拠: qa-v22, qa-r-frontend-3, qa-v13, qa-v14／system-spec/frontend.md

ComparisonGapNotice は、閉じた1行（件数）と、開いた中のリンク2行・表・ボタンを1つの部品に収める。開閉は既存の InlineDetail で作り、画面ごとに <details> を書かない。ボタンは ActionButton を使う。SetupGapList（公開前の不足など）は今の形のまま残す。根拠: qa-w07／system-spec/frontend.md

2026-10-19〜20 の追加: ReportTemplate はサーバーが作った形だけを受け、本人向けの形には点数のキーを持たせない。Charts.tsx にレーダー図・折れ線・棒を足し、図に role="img" と aria-label と同じ内容の表を付ける。ComparisonGapNotice の表に種類の列と行ごとのリンク（項目の位置へのアンカー付き）を足し、KpiItemEditor は URL の項目の指定が変わったときにも開き直す。アンケートの操作の出し分けは、サーバーから受け取る『できる操作』の一覧で決める。DecisionBadge は評価の詳細・本人の結果・評価期間の一覧・レポートが使う。
根拠: qa-y11（system-spec/frontend.md）

2026-10-20〜21 の追加: ComparisonGapNotice は、同じ評価期間・等級の新しい版が下書きの間、公開中の古い版の警告に「第N版の下書きを開く」を添える。その下書きが今の設定と一致しているときは、公開すれば古い版が締め切られる旨の注記も添える。
根拠: I23、G22（system-spec/frontend.md）

2026-10-21〜22 の追加: 行動指針の画面は冒頭を1文とまとまりの状態（数・飛び飛びの有無）にして理由・初期設定・点数の注記は開いたときだけ出し、BehaviorBandAssignmentEditor・BehaviorBandSetEditor・BehaviorGuidelineEditor にある同じ説明の繰り返しを1か所にまとめる。KPI・評価セットの入口は等級区分ごとのカード（等級の並び・項目数・配点の合計・状態・次にやること）とほかの作業への入口だけにし、表の形は使わず境界のあるカードとブロックで並べる。KpiItemEditor は名前と分類を見出しにして聞くこと A・B…を1行ずつ並べ、計算式と実績区分・単位・向きは開いたときに出す。評価レポートは評価者向けの KPI 一覧にキーごとの獲得点 / 配点・判定を足して図と並べ、⑤は全確定期の等級ラベルと達成率を時系列の折れ線と表で示し、等級名は分類のラベルなので線で結ばない。評価の詳細の ThresholdBand（EvaluationDetail.tsx）は、黒線を実績値の位置、棒を得点の割合として凡例で分け、実績値と単位を title と aria にも入れる。
根拠: qa-ab03-settings-pages-load-observed、qa-aa06-report-score-grade-design、qa-aa07-report-threshold-marker-audit、qa-aa08-report-marker-detail-print-design、G26、appr-foundation-017（system-spec/frontend.md）

## Cross-cutting contracts

画面から書き込みの fetch（POST・PUT・PATCH・DELETE）を直接呼ばず、全て useSaveAction と Server Functions を通す。これを server-actions-contract.test.ts が静的に検査し、例外（利用記録の sendBeacon・外観の選択の記録）は検査の中に理由付きで列挙する。クライアントの部品は英語の区分名を持たず、等級名はサーバーから受け取る。端末ごとに覚える状態（開閉など）は localStorage に置き、読めないときも既定の状態で動く。読み取り専用の .chip はポインターの形とホバーの変化を出さない。根拠: qa-v22, qa-r-frontend-3／system-spec/frontend.md

2026-10-19〜20 の追加: 色はテーマの変数から取り、印刷では明るい値で刷る。判断の値と理由は確定の操作と一緒に1回で送り、別の保存ボタンは作らない。押せない理由はサーバーと同じ入力の検査の関数で決め、部品の中で規則を書き直さない。
根拠: qa-y11（system-spec/frontend.md）

2026-10-20〜21 の追加: メモは、公開範囲ごとにその段階以上の権限の人が全員読め、書ける公開範囲は読める公開範囲と同じにする。「管理者のみ」は会社の管理者以上だけが書いて読む。本人にも同じ文で見せる昇給・昇格の理由と上司コメントは、保存のときに本人に見せられない語を検査する。
根拠: qa-z04、qa-z03、I25、DD-021 の4・6（system-spec/frontend.md）

2026-10-21〜22 の追加: グラデーションと色の変化は globals.css の部品クラスに、既存の意味のトークンと color-mix・linear-gradient だけで書き、系統は骨格のトークンを上書きするだけのまま全ての系統と明暗に効かせる。TSX には色を書かず、テーマの契約テスト（theme-contract・palette-contract・ui-rules・aidd-kit-boundary）は書き換えずに通す。見出しの面の微グラデ（hero-tint）は1画面1箇所を保って使えない状態・印刷・コントラストを強くする設定では平らな面に戻し、押せる部品の光の動きは短く控えめにして prefers-reduced-motion では止める。押す・選ぶ・開く部品は指を乗せた・押した・選んだ・開いた・focus-visible の状態を見分けられるようにし、開いた・閉じたは色だけでなく印と文で示す。押せる面は 44px 四方以上を保ち、1つの面で主の操作は1つにして最も強く見せる。
根拠: qa-ab06-shared-ui-theme-contract-observed、qa-ab14-ui-scope-beyond-buttons、qa-ab15-foundation-017-approval、G26、G29、appr-foundation-017（system-spec/frontend.md）

## Subtype architecture

合成対象の subtype と該当テンプレート:

- Frontend: 合成済み (`architecture-frontend.md`)
- Backend: N/A: subtype 非選択
- Infrastructure: N/A: subtype 非選択
- Data: N/A: subtype 非選択
- Security: N/A: subtype 非選択

### Frontend architecture

#### Rendering and application pattern

書き込みを Next.js 16 の Server Functions に集め、成功したら next/cache の refresh で表示中の画面を作り直し、新しい描画を同じ応答に載せる。画面側は useSaveAction で呼び、createCommitGate で新しい描画が終わってから成功を呼び出し元へ返すので、成功の言葉だけが先に出て古い一覧が残ることがない。他タブと画面復帰では router.refresh で取り直し、Next.js の文書のとおり影響を受けない useState とスクロール位置を保つ（出典 nextjs-refresh、nextjs-client-cache）。根拠: qa-v22, qa-r-frontend-3, qa-d02／system-spec/frontend.md

2026-10-21〜22 の追加: 評価レポートの印刷はブラウザの印刷のまま、@page margin:0 と本文の12mm の padding と box-decoration-break:clone（webkit 併記）で各ページの余白を繰り返し、ブラウザが余白に出す URL と日時を抑える。A3 横を選んだときは①〜④と上長コメントを左、⑤〜⑦の推移・実績を右に置いて1枚にし、A4 は後半を新しい紙から始め、長文や長い実績も続きのページへ送って全文を残す。A3 に収まらないときは切り詰めや極端な縮小をせずに印刷を開かず、A4 で全文を印刷する操作へ案内する。評価の詳細の印刷も named page に同じ余白の形を当て、保存・確定などの操作パネルは紙へ出さない。
根拠: qa-aa04-report-landscape-onepage-design、qa-aa08-report-marker-detail-print-design、qa-aa09-report-print-final-alignment（system-spec/frontend.md）

#### Routes, screens and navigation

route-ledger は 46 画面の page.tsx（権限一覧のページを足して 47 画面になる）を正本とし、4役割（SUPER_ADMIN・COMPANY_ADMIN・MANAGER・EMPLOYEE）と4幅（375・768・1280・1600）で期待結果を検証する。権限一覧のページはルート台帳に足す。会社切替メニューは layout 側で作られるので、書き込みの応答で layout ごと作り直して新しい会社を出す。権限一覧のページとモーダルは同じ部品（表・役割のタブ・カード）を使い、ページを開ける役割・主な操作・役割ごとの可否・説明は route-ledger.json の各ページから読む（D-007 ①）。『Claude Code連携（システム開発者専用）』の名前は見出し・サイドバー・権限一覧でそろえる。余白の見直しは各画面の構成（段組み・補足の列）で行い、page.tsx の main に max-w を書かない。根拠: qa-v22, qa-r-frontend-3, qa-f01, qa-f05, qa-v31, qa-v25／system-spec/frontend.md・system-spec/maintenance-ops.md

2026-10-19〜20 の追加: KGI の画面とナビの項目を消し、個人別の評価レポートの画面を足す。
根拠: qa-y11（system-spec/frontend.md）

2026-10-20〜21 の追加: レポートの画面は、開ける人（本人・全体管理者・会社の管理者・直属の上司）を判定する1つの関数を使う。評価の詳細の2画面は、その関数を使わず今の判定のままにする。
根拠: I20（system-spec/frontend.md）

2026-10-21〜22 の追加: KPI・評価セットの入口（/admin/scheme）から、等級区分ごとの設定、全等級区分に共通の設定（昇給の条件）、KPI 項目の追加と修正、KPI カテゴリへ、それぞれ別の画面で進めるようにする。画面ごとの組み替えは、行動指針の画面（/admin/behavior）と KPI・評価セットの画面と評価を作る画面に限る。評価レポートには社員詳細への直リンクを足してレポートが最新の確定評価であることを示し、回答からは回答 ID に対応した閲覧できる評価へつなぐ。評価の詳細の既存の印刷は「評価の詳細を印刷」として確定レポートへの入口と分け、未確定の評価でも残す。印刷の紙面にはアプリのナビとリンク先の URL を出さない。
根拠: qa-aa01-report-access-print、qa-aa04-report-landscape-onepage-design、qa-aa08-report-marker-detail-print-design、G26、appr-foundation-017（system-spec/frontend.md）

#### Component and design-system boundaries

共通部品は、並べ替え（Pointer Events の長押しと押したままのドラッグ・矢印のボタン・キーボード・aria-live での読み上げ、新しい依存なし。D-005）、権限一覧（表・役割のタブ・スマホのカード・説明の吹き出しをページとモーダルで共用。D-006）、設定不足（何が・どう直す・リンク）、アンケートの回答（label を入力へ結び、全面で押せる）と見本（試しに選べ、送信の操作を出さない）である。権限一覧の表は table 要素、タブは APG の tabs の形、モーダルは dialog 要素で作り、説明は aria-describedby で結んでフォーカスとタップでも出す。並べ替えの方針（持ち上げる・動かす・置く・戻す・読み上げる）は部品に置き、入力の詳細はその内側に閉じる。ReasonNote は設定不足の用途だけを新しい部品へ置き換え、他の用途は残す。読み取り専用の .chip はポインターの形とホバーの変化を出さない。globals.css の配色・テーマの宣言とテーマの契約テストは変えない（AGENTS.md、DD-003）。出典は mdn-pointer-events、mdn-dialog-element、w3c-apg-tabs、w3c-apg-tooltip、mdn-aria-live-regions である。根拠: qa-v22, qa-v13, qa-v14／system-spec/frontend.md

比べる警告の表は table 要素で、列見出しの th に scope を付け、○ と — に『ある』『ない』の読み上げの文字を添える。根拠: qa-w07／system-spec/frontend.md

2026-10-19〜20 の追加: ReportTemplate・Charts.tsx の拡張（レーダー図・折れ線・棒）・DecisionBadge・ComparisonGapNotice の種類の列と行ごとのリンクを足す。色はテーマの変数から取り、新しい依存は足さない。
根拠: qa-y11（system-spec/frontend.md）

2026-10-20〜21 の追加: メモの入力欄では、マネージャーに「管理者のみ」の公開範囲を出さない。上司の判断の理由と上司コメント（evaluatorComment）の入力は、保存のときに引っかかった語を名指しして、上司に書き直してもらう。
根拠: qa-z04、qa-z03、DD-021 の4・6（system-spec/frontend.md）

2026-10-21〜22 の追加: 部品クラスを使う共通部品は、ボタン（Button・LinkButton・DownloadButton・ActionButton・ConfirmButton。主の操作を最も強いグラデーション、副の操作を薄い色）、カード（Card・CardHead・CardRow・OptionCard）、見出し（PageTitle・SectionHeading）、選ぶ部品（Segmented・ChoiceChip・ChipLink・ChipTag・OptionCheck）、状態の印（Badge・DecisionBadge・RankMark・ProvisionalMark）、進み具合（StepFlow・StepMark・StepBlock）、数の面（Bar・StatGrid・Num と Charts の系列の色）、知らせ（NoteBlock・ReasonNote・EmptyState・ComparisonGapNotice）、表（DataTable の見出しの行と選んだ行）、いまいる場所の印（AppSidebar・HeaderNav）である。段階的な開示（Disclosure・HintToggle・RevealToggle・InlineDetail）と境界のはっきりしたカード（Card・CardHead）も共通部品に入れ、同じ部品を使う全ての画面に効かせる。出典は mdn-css-color-mix、mdn-css-linear-gradient、mdn-prefers-reduced-motion、mdn-prefers-contrast、w3c-wcag22-contrast-minimum、w3c-wcag22-non-text-contrast、w3c-wcag22-focus-visible、w3c-wcag22-target-size-enhanced である。
根拠: qa-ab06-shared-ui-theme-contract-observed、qa-ab14-ui-scope-beyond-buttons、qa-ab15-foundation-017-approval、G26、G29、appr-foundation-017（system-spec/frontend.md）

#### State and data flow

書き込みの結果は {ok, message} で返り、一覧・件数・layout の値は応答の新しい描画に入る。連続作成フォーム（RecordForm の generate 経路）も一覧の更新を省略せず、控えは成功の知らせの後ろに畳み、畳んでいる間は値を画面に置かない（暗号化して残せない鍵の無い環境だけ最初から開く）。他タブへは BroadcastChannel（hr-evaluation:freshness）で資源の種類と時刻だけを送り、受け手は1.5秒に1回へ間引いて router.refresh を呼ぶ。開閉の状態など端末ごとのものは localStorage に置き、読めないときは既定の状態で動く。権限一覧の表とカードは同じデータから描き、幅で切り替えるだけにして内容をずらさない。等級名はクライアントで持たず、サーバーから受け取った値を出す。根拠: qa-v22, qa-r-frontend-3, qa-v14／system-spec/frontend.md

比べる警告の件数の行は閉じていても出し、開閉の状態は覚えない。根拠: qa-w07／system-spec/frontend.md

2026-10-19〜20 の追加: アンケートの操作はサーバーの『できる操作』の一覧で、確定のボタンの押せない理由はサーバーと同じ入力の検査の関数で決める。判断の値は確定の操作と一緒に1回で送る。
根拠: qa-y11（system-spec/frontend.md）

2026-10-20〜21 の追加: 比べる警告は、新しい版の状態と今の設定との一致で出し分ける。同じ評価期間・等級の新しい版が下書きの間は、公開中の古い版の警告を消さない。新しい版が今の設定と一致した状態で公開されたら、古い版には警告を出さない。一致していない新しい版があるときは、その版の状態にかかわらず古い版にも警告を出す。
根拠: I23、G22（system-spec/frontend.md）

2026-10-21〜22 の追加: 下書きのアンケートで設定とつながった設問を足す・外す・文を直すと、保存と同時に元の設定（KPI の設問の文・評価セットの項目・行動指針の観点・等級要件）へ反映する。設定を保存すると、回答0件の下書きを作り直し（設定とつながらない設問は残す）、回答のある公開中のアンケートには次の版の下書きを作り、締め切ったアンケート・確定した評価・評価レポートは変えず、確定前の評価は集計し直す。設定の写しを持つ場所はそれぞれ「参照」「追従」「確定した時点の写し」のどれかに決め、保存の後は変わったアンケートと評価を結果の文で示して関係する画面を取り直し、他のタブへは FreshnessSync で知らせる。評価レポートの紙用の図とフォントの準備の結果は、同じ会社・社員・閲覧形・レポートの内容の画面の中だけで使い回し、どれかが変わるか画面を離れたら捨てる。⑤は評価者向けに保存した KPI 合計 / 満点の割合、本人向けに等級要件の達成率を使い、過去の期は評価の時点の等級を保つ。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-aa06-report-score-grade-design、qa-aa10-report-print-background-preparation、G27（system-spec/frontend.md）

#### Backend integration

画面は Server Functions の共通の入口 runAction（送り元の検査と認可、大きさの上限 413、zod による入力の検証、本体、成功時だけ next/cache の refresh）を通して書き、結果を {ok, message} の形で受け取る。読むだけの処理は runRead を通す。画面から書き込みの fetch を直接呼ぶ箇所は server-actions-contract.test.ts で落とし、sendBeacon と外観の選択の記録だけを理由付きの例外にする。並べ替えの保存には並び順の全体を送る形を足す（I14）。送った集まりが今の集まりと違うときは 409 になり、取り直しを求める。権限一覧は route-ledger.json の各ページに置いた権限の定義から描き、サイドバー（nav.ts）・ページの入口（requireRole）・ActionSpec.role・session.ts の canEdit〜 などの判定も同じ台帳から引く（D-007 ①）。根拠: qa-v22, qa-r-frontend-3, qa-u25, qa-v30, qa-v25, qa-v27, qa-v28／system-spec/frontend.md・system-spec/backend.md・system-spec/auth.md・system-spec/security.md

ComparisonGapNotice は、サーバーが返す ComparisonGap（比べている2つのページの名前と href、項目ごとの有無）をそのまま描き、ページ名やリンクを画面の側で組み立てない。根拠: qa-w07, qa-w08／system-spec/frontend.md・system-spec/backend.md

2026-10-20〜21 の追加: CSV の書き出しは上司側の判定で、メモの読み出しは今の公開範囲の判定で絞り、どちらもレポートの判定の関数を使わない。上司の判断の理由と上司コメントは、保存のときに本人に見せられない語（点数・配点・必要点数につながる表現）を検査し、引っかかった語を名指しして断る。
根拠: I20、I25（system-spec/frontend.md）

2026-10-21〜22 の追加: アンケートから設定への反映も、設定の保存と同じく、同時に保存したときの 409 と制度の変更の記録を通す。評価セットの決まり（等級区分ごとの項目数・固定枠・20点枠）や KPI の計算に要る設問（分子・分母など）に合わなくなる保存は、アンケートも設定も変えずに断り、合わない決まりと直す画面を示す。基準帯の buildThresholdScale（evaluation-view.ts）は実績値を基準の数値軸に置いて0〜100% に収める形のままで、保存した得点と判定を再計算も上書きもせず、範囲の外は markerClamped の below・above で方向を説明する。
根拠: qa-ab11-survey-writeback-rule-conflict、qa-ab04-setting-copy-propagation-observed、qa-aa07-report-threshold-marker-audit、qa-aa08-report-marker-detail-print-design、G27（system-spec/frontend.md）

#### Performance and observability

他タブの取り直しは1.5秒に1回へ間引き、通知の受信またはタブ復帰から1秒以内に最新化する（O3）。visibilitychange・online・pageshow（persisted）でも同じ入口で取り直し、スマホ・タブレットでアプリを切り替えて戻った場合も同じに扱う。応答には Worker が作った時刻 x-generated-at が付き、反映されないという報告の切り分けに使う。根拠: qa-v22, qa-r-frontend-3, qa-u25／system-spec/frontend.md

2026-10-19〜20 の追加: 図は印刷のときに決まった大きさで描き、印刷の幅でも崩れないようにする。
根拠: qa-y11（system-spec/frontend.md）

2026-10-21〜22 の追加: 評価レポートは画面を出した後に紙用の全てのグラフとフォントを背景で準備し、A3 を選んだときだけ紙面の測定を先に行う。準備の間も用紙の選択と別の画面への移動ができ、取り消しと再試行を出す。印刷は準備が終わった後に利用者が押したときだけ開き、背景の完了から window.print を勝手に呼ばない。図と文字は15秒を上限に待ち、揃わなければ印刷を開かずに理由と再試行を示す。
根拠: qa-aa01-report-access-print、qa-aa10-report-print-background-preparation（system-spec/frontend.md）

#### Frontend verification

pnpm test に、入口を通らない書き込みの検査（server-actions-contract.test.ts）、batch の外で2つ以上の表を書く関数の検査（write-atomicity-contract.test.ts）、送り元の二重の検査（action-origin.test.ts）を入れ、違反が0件でなければ失敗にする。画面の通し試験（Playwright、pnpm test:e2e）で6つの経路と控えの畳み方を確かめ、375px・768px の幅でも回し、相手はローカルの preview に限る（LOCAL_HOSTS）。追加要件では、並べ替えの3つの操作の一致と全編集画面での部品の使用（O13。タッチでのスクロールとの区別はテストを厚くする）、等級名の結合テストと英語の区分名の静的検査（O6）、ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定の一致の検査（O8）、権限一覧の表とカードが同じ内容を出す検査、設定不足の契約テスト（O12）、選択肢のテスト（O14）、4幅の撮影（O15）で確かめる。根拠: qa-v22, qa-r-frontend-3, qa-u25, qa-v13, qa-v31／system-spec/frontend.md・system-spec/maintenance-ops.md

3画面が ComparisonGapNotice だけを使うこと、閉じた1行と開いた表が出ることをテストで確かめる。根拠: qa-w07, qa-w10／system-spec/frontend.md・system-spec/maintenance-ops.md

2026-10-19〜20 の追加: 図に表と aria-label があること、本人向けの形に点数のキーが無いこと、印刷で⑤の前で改ページされ図と表が切れないことを、部品のテストと E2E で確かめる。
根拠: qa-y11、qa-y16（system-spec/frontend.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: O22 は、等級要件・行動指針・KPI 項目のそれぞれで足りない・余分を出す単体テストと、全ての行にリンクがあってリンク先が台帳にあり見る人が開けることの契約テストで確かめる。警告が、新しい版が下書きの間は消えず、今の設定と一致した新しい版の公開の後は出ず、一致していない新しい版があれば版の状態を問わず出ることもテストする。O17 は、src・docs・route-ledger・nav で消した事業所の達成率の仕組みの参照を探す静的検査を0件にし、docs のうち経緯を残す5種類（受領書・バックログの履歴・レビューの記録・判断の記録・デプロイ時の注意）は走査から外して、外す先が実在することも同じ検査で確かめる。賞与の計算の単体テストでは、1点あたりの円が0以下なら賞与額を出さない。
根拠: O22、O17（system-spec/frontend.md）

2026-10-21〜22 の追加: 初期表示で見える説明文の数と1文の長さ（製品仕様 §22 の40字）と、同じ文が1画面に2回出ないことを画面のテストで固定し、KPI・評価セットの入口から4つの作業へ別の画面で進めること、等級区分ごとのカードに等級の並び・項目数・配点の合計・状態が出ること、KPI 項目の聞くことが1行ずつ出ること、スマホとタブレットの幅ではみ出さないことを E2E で確かめる（O26）。初期設定の説明がいまの割り当てと一致し、既定と違うときに違いを示すことを画面のテストで確かめる（O25）。保存の直後に関係する画面と他のタブが新しい内容で出ることを E2E で確かめる（O27）。I32・I33 の部品が部品クラスを使って TSX に色を書いていないこと、全ての系統と明暗でグラデーションの両端と文字の色の比が 4.5:1 以上（大きな文字と部品の縁は 3:1 以上）であること、focus-visible の印、prefers-reduced-motion と平らな面への戻りを新しいテストで確かめ、主要な画面の明暗の見た目を記録する（O29）。評価レポートと評価の詳細の印刷は、改訂後の実ブラウザの試験と実 PDF の証拠を受領書へ追記し、合格を先取りしない。
根拠: qa-aa07-report-threshold-marker-audit、qa-aa09-report-print-final-alignment、G25、G26、G27、G29、appr-foundation-017（system-spec/frontend.md）

## Architecture decisions

D-001（opt-broadcast）により、他タブへの通知は BroadcastChannel（hr-evaluation:freshness）で資源の種類と時刻だけを送り、受け手は router.refresh で取り直す。D-002（opt-server-functions）により書き込みを Server Functions へ移し、その後、表示中の画面の作り直しは next/cache の refresh にそろえ、revalidatePath は将来サーバー側にキャッシュを入れるときの無効化の置き場として残した。Clean Architecture の適用として、BroadcastChannel・visibilitychange・online・pageshow の詳細は FreshnessSync の内側に閉じ、各画面は useSaveAction の結果 {ok, message} を出すだけにする。D-005（opt-pointer-hook）は利用者が選んだ案で、AI の推奨と同じである（qa-v13）。Pointer Events の共通の hook を自作し、新しい依存は足さない。矢印のボタンは WCAG 2.2 の SC 2.5.7（ドラッグの代わりの操作）として残す。並べ替えの方針（持ち上げる・動かす・置く・戻す・読み上げる）は共通の部品に置き、長押し・矢印のボタン・キーボードという入力の詳細はその内側に閉じる。D-006（opt-combined）は、利用者が自由記述で①②③の組み合わせを求めたので足した案で、AI の推奨（opt-single-table）とは別の案である（qa-v14）。表・タブ・カード・説明は同じデータから描く共通の部品にし、ページとモーダルで使い回す。D-007（opt-route-ledger-extend）は利用者が選んだ案で、AI が委任に基づいて選んだ別の案とは違う（qa-v25）。ページを開ける役割（accessClass）・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、権限一覧の部品はこの台帳だけから描く。dialog 要素と aria-describedby を使うこと、localStorage が読めないときの既定、ReasonNote の他の用途を残すことは、この章の全文に書いて示し、利用者が全文のまま承認した（qa-v22、2026-10-13T00:03:46Z）。根拠: qa-v22, qa-r-frontend-3, qa-v13, qa-v14, qa-v25, qa-v27, qa-v30／system-spec/frontend.md・system-spec/auth.md・system-spec/backend.md

2026-10-19〜20 の追加: 印刷用の配置は @media print の中だけで組み替え、HTML の順（読み上げの順）は画面と同じにする。⑤の前で改ページし（break-before: page）、図と表のまとまりに break-inside: avoid を付ける。図は印刷のときに決まった大きさで描き、画面の幅に合わせる部品の幅に頼らない（qa-y09 の2枚組）。
根拠: qa-y11、qa-y09（system-spec/frontend.md、system-spec/00-requirements-definition.md）

2026-10-20〜21 の追加: 計画レビューの食い違いは、今 spec-state まで直す案を採らず、文書（DD-020〜DD-024 と計画レビューの受領書）で確定して P12 で反映する案を選んだ。本人へ漏れるのを防ぐ方法は、表示のときに決まった文へ差し替える案と検査しない案を採らず、保存のときに引っかかった語を名指しして上司に書き直してもらう案を選んだ。本人には書いたとおりの文が届き、既存の上司コメント（evaluatorComment）にも同じ検査をかける。「管理者のみ」のメモは、書いた本人も読める案と注意を添える案を採らず、利用者の自由記述の答えを公開範囲ごとにその段階以上の権限の人が全員読める形と読んで、マネージャーには出さずサーバーでも受け付けない形で直した。
根拠: qa-z03、qa-z04、DD-020〜DD-024、DD-021 の4・6（system-spec/frontend.md）

2026-10-21〜22 の追加: 利用者は、下書きのアンケートで設定とつながった設問を変えたら保存と同時に設定へ反映する案、公開中のアンケートには次の版の下書きを自動で作る案、既定からずれた会社はデータを既定へ書き換える案、評価セットの決まりや KPI の計算に合わなくなる保存は断って理由と直す所を示す案を選んだ。I26 のために DD-010 の「移行で書き換えない」を改める DD を書き、アンケートから設定への反映（I28）と設定の保存での下書きの作り直し（I29）のために DD-015・DD-016 を改める DD を書いてから実装し、公開の前の検査（staleAskingItems）は残す。配色は DD-003 のとおり平賀配色へ移さない。評価レポートの用紙は初期選択を A4 縦のままにし、A3 を既定にする案と空の余白ボックスを宣言する案は採らず、URL と日時は @page margin:0 と本文の12mm の padding と box-decoration-break:clone（webkit 併記）だけで抑える（DD-025）。
根拠: qa-ab07-survey-to-setting-direction、qa-ab08-published-form-follow、qa-ab10-band-drift-rewrite、qa-ab11-survey-writeback-rule-conflict、qa-ab16-foundation-018-approval、qa-aa09-report-print-final-alignment、appr-foundation-018（system-spec/frontend.md）

## Delivery, migration and rollback

Server Functions への移行は終えており、二つの書き込み経路の混在は残っていない（D-002 の 2026-10-01 追記）。新しい画面を足すときは鮮度の契約を使うことを README の文書の入口から辿れるようにし、pnpm test と pnpm run check:docs を通す。追加要件の部品は、並び順を持つ編集画面と設定不足の ReasonNote を置き換える形で入れ、ReasonNote の他の用途は残す。並べ替えは Pointer Events で自作して新しい依存を足さず（D-005）、権限の定義は route-ledger.json に足して DB の表を足さない（D-007 ①）。権限一覧のページはルート台帳に足し（46 画面 → 47 画面）、全てのページに主な操作・役割ごとの可否・説明の欄を足す。route-ledger.test.mjs の件数と新しい欄の検査・nav.test.ts・check:docs を合わせる。Next.js は脆弱性の修正を含む 16.3.8 にし、Next.js 16 系・OpenNext・Workers・D1 の構成は変えない。根拠: qa-v22, qa-r-frontend-3, qa-u25, qa-v25, qa-v29, qa-v31／system-spec/frontend.md・system-spec/infrastructure.md・system-spec/maintenance-ops.md

2026-10-19〜20 の追加: KGI の部品とナビの項目は1回目の Deploy で消す。判断の欄と DecisionBadge は判断の列と同じ Deploy で出す。テーマの契約テストと globals.css 冒頭の宣言は変えない。
根拠: qa-y11（system-spec/frontend.md）

2026-10-20〜21 の追加: 旧の「1回目の Deploy」を改めた：今は main へのマージで自動で本番に出る仕組みに合わせ、1回目の公開を P05 の PR のマージ、2回目を P08 の PR のマージと読み替える。P05 をマージする前に、P06 の自動テストと bundle の大きさ・cf:dry-run を P05 の PR の上で通す。P13 は、CI の実行番号と backup、本番の読み取りを記録する役にする。2回目の公開（P08 の PR のマージで Deploy workflow が動く）の後に、本番 DB に3つの表と2列が無いことを読み取りで確かめる。
根拠: qa-z03、O17（system-spec/frontend.md）

2026-10-21〜22 の追加: 既定からずれた会社は、データの移行で既定の割り当て（beginner・regular を1つ目のまとまり、chief・am1・am2 を2つ目のまとまり、manager1・manager2 は出さない）へ書き換える。書き換えるのは等級とまとまりの割り当てだけで、観点の文と会社が足した観点は残し、移行の後に会社が割り当てを変えたときはその変更を正とする。範囲の外の「本番データの移行・修正」の除外には、この書き換え（I26）と、この仕様で足した行を書き換える移行（0032・0033・0034・0035・0036・0039）を挙げる。本番 DB へのテストデータ（手元の seed と E2E のデータ）の投入は範囲の外のままで、評価を作る画面を試す本番の見本の会社への仮のデータ（G28・I31）はそこから除く。いまずれている下書きは、更新時刻の新しい方へそろえる。
根拠: qa-ab10-band-drift-rewrite、qa-ab13-foundation-016-approval、qa-ab17-foundation-019-approval、qa-ab18-foundation-020-approval、G25、G27、appr-foundation-019、appr-foundation-020（system-spec/frontend.md）

## Risks and verification

危険は、共通口を通らない書き込みが紛れ込むこと、bfcache から戻した直後の取り直しがルーターの復元とぶつかること、並べ替えの3つの操作で結果がずれること、タッチでのスクロールとドラッグの区別が甘くスマホで誤って並びが変わること、権限一覧の表とカードの片方だけを直して内容がずれること、localStorage が使えない環境で欄が動かなくなることである。bfcache のときはルーターが画面を戻し終えた後（次のタスク）に取り直し、通知による取り直しは1.5秒に1回へ間引き、localStorage が読めないときは既定の状態で動かす。タッチとスクロールの区別はテストを厚くし（D-005）、表とカードは同じデータから描く（D-006）。O4 は静的検査で共通の包みを通らない Server Function と直接の書き込みの fetch を0件と報告し、O13 は並べ替えの部品のテストと全編集画面がその部品を使う静的検査で確かめる。O1・O3 は作成系 E2E と2タブ E2E、O6・O8・O12・O14・O15 は等級名の結合テスト、ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定の一致の検査、設定不足の契約テスト、選択肢のテスト、4幅の撮影で確かめる。権限一覧の表とカードが同じ内容を出すことも検査する。根拠: qa-v22, qa-r-frontend-3, qa-v13, qa-v14, qa-v31／system-spec/frontend.md・system-spec/maintenance-ops.md

2026-10-19〜20 の追加: リスクは、部品の中で状態や規則を判定してサーバーとずれること、印刷の幅で図が崩れることである。部品のテストと、4つの幅と A4 の PDF の E2E で確かめる。
根拠: qa-y11、qa-y16（system-spec/frontend.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: 危険は、権限の判定がずれて範囲の外の CSV やメモが返ること、上司の理由やコメントから点数などが本人へ漏れることである。O19 は、全体管理者・会社の管理者・マネージャー（直属の部下と、部下でない人）・本人・他の社員の組ごとに、見える・404 を結合テストと E2E で確かめる。レポートの判定の関数を呼ぶのがレポートの画面だけで、CSV の書き出しとメモの読み出しが使わないことは契約テストで確かめる。同じ等級の重ならない社員が3人未満なら、平均と幅を出さないこともテストする。
根拠: qa-z03、O19、I25（system-spec/frontend.md）

2026-10-21〜22 の追加: 危険は、片方の画面だけを直してもう一方の写しが古いまま残ること、アンケートからの書き戻しで評価セットの決まりや KPI の計算に要る設問が崩れること、グラデーションで系統・明暗・コントラストを強くする設定・印刷の読みやすさが落ちること、基準帯の黒線を得点と読み違えて現在の基準の帯と保存した判定を混同することである。写しを持つ場所の一覧とコードの一致は契約テストで、合わない保存が断られることはサーバー処理のテストで、色の比は新しいテストで確かめる（O27・O29）。黒線は実績値の位置として凡例で示し、現在の基準の帯を保存したランクで塗らず、集計時の判定とランクを下に別に書く。移行は、既定のまとまりが無い会社を書き換えずに件数を報告することを移行のテストで確かめる（O25）。
根拠: qa-ab01-settings-ui-overhaul-request、qa-ab11-survey-writeback-rule-conflict、qa-aa07-report-threshold-marker-audit、qa-aa08-report-marker-detail-print-design、G25、G27、G29（system-spec/frontend.md）


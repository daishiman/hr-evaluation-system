---
graph_node_id: "spec-system-spec-requirements"
artifact_kind: "specification"
artifact_subtypes: []
title: "要件定義：保存結果の鮮度保証、等級・権限・所属の整理、KGI の削除と評価レポート・上司の判断"
project_id: "hr-evaluation-system"
domain: "requirements"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応"]
file_path: "specs/system-spec-requirements.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ed811756055334c47d38b98d1a49452bbf61f21b495b4b923c78421c67e0aabe", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-2026-10-20-z.json"}
source_lineage: {"imported_at": "2026-10-19T22:19:04Z", "origin_kind": "system-spec-harness", "source_digest": "ed811756055334c47d38b98d1a49452bbf61f21b495b4b923c78421c67e0aabe", "source_path": "system-spec/00-requirements-definition.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
created_at: "2026-10-19T23:20:31.845015Z"
updated_at: "2026-10-19T23:20:31.845015Z"
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
classification_reason: "要件定義書（U1〜U9）で、目的・範囲・機能要件・受入条件を記す specification の取込。"
classification_candidates: [{"artifact_kind": "specification", "candidate_path": "specs/system-spec-requirements.md", "confidence": 0.92}, {"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-requirements.md", "confidence": 0.35}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-19T23:20:31.845015Z", "missing_sections": [], "status": "complete"}
---

# 目的と成功状態

利用者が作成・変更・削除した結果を、成功表示の直後・再読み込み・他のタブ・画面復帰のどれでも必ず確かめられ、『本当に保存できたのか』を疑わずに次の作業へ進める状態をシステムとして保証する（U1、G1〜G5）。あわせて、等級の呼び名・役割ごとにできること・各人の等級と確定済みの評価・アンケートの提出状況・設定の不足を、どの画面でも同じ言葉で、見てよい人にだけ示す（G6〜G15）。成功時には、会社追加の直後に会社一覧・件数・会社切替メニューへ新しい会社が出て（連続作成で控えを出したままでも）、強制再読み込み・直接 URL・別タブ・スマホの画面復帰でも古い一覧が残らず、複数の表を書く書き込みが途中で失敗しても一部だけが残らない。さらに、等級名を『等級4-1』の形に変えると行動指針・評価セット・昇格の要件・警告・アンケートのタイトル・ボタンのすべてがその名前で出て、権限一覧のページとモーダル、一覧の等級と点数、2社目への所属、提出状況の一覧、リンク付きの設定不足の表示、『Claude Code連携（システム開発者専用）』への改名、長押しドラッグでの並べ替え、押せる選択肢、右側の余白の解消がそろう（U5）。
根拠: qa-u01、qa-v01、qa-v03（appr-foundation-008）、qa-u26（appr-foundation-007）（system-spec/00-requirements-definition.md の U1・U3・U5）

2026-10-14 の追加で、ゴールに G16（2つのページの内容を比べて出す警告は、比べている両方のページを階層つきのページ名とリンクで示し、項目ごとにどちらのページにあってどちらに無いかを表で示す。既定ではズレがあることと件数だけを1行で出し、中身は押すと開く。どちらのページから見ても、相手のページへ1回の操作で移れる）を足した。成功基準には『ズレの警告から、比べている両方のページへ、ページ名を見て1回の操作で移れる』『ズレの警告は既定で1行に収まり、押すと直すところが表で出る』を足した。背景は、アンケート一覧の警告がどのページとどのページの内容が食い違っているかを示さず、たどれないという報告（qa-w01）と、警告の文が長く並んで読みにくいので既定では出さずに押すと出す形にするよう求めた追加の指示（qa-w03）である。根拠: qa-w05, qa-w01, qa-w03／system-spec/00-requirements-definition.md

2026-10-19〜20 の追加: 2026-10-19 の依頼（qa-x01）でゴール G17〜G23、2026-10-20 の依頼（qa-y01）で G24 を足した。G17 は KGI の仕組みを残さず消し、賞与（仮）を KGI を使わない式で出し続けること、G18 は個人別の評価レポートを図とグラフで同じテンプレートから作ること、G19 は見てよい人にだけ見せること、G20 は全ての画面と項目を確かめられるテストデータ、G21 はアンケートの状態に合った操作、G22 はズレを3種類で比べ直すリンク、G23 は評価期間の評価セットを基準にしたつながり、G24 は点数の判定と上司の判断を合わせた昇給と昇格の可否である。成功基準には、KGI が画面と DB に無いこと、レポートを A4 縦2枚に刷れること、マネージャーが直属の部下だけを見られること、上司が判断を選ばずに確定できないこと、結論と理由が本人にも同じ文で見えることなどを足した。
根拠: qa-x01、qa-x07、qa-y01、qa-y07、qa-y09、appr-foundation-011、appr-foundation-012（system-spec/00-requirements-definition.md の U3・U5）

## スコープ

In: 全ての作成・更新・削除（会社・利用者・メンバー・アンケート・評価セットと期間・制度設定・CSV 取込・改善要望など）の後の表示鮮度を、同じタブ・再読み込み・他のタブ・画面復帰の4経路で保証すること、一つの操作で複数の表を書く書き込みを途中で失敗しても一部だけ残さないこと（batch・補償・やり直し）、鮮度契約の静的検査と E2E と反映されない報告の切り分け手段。2026-10-12 の追加として、等級名の表示の統一と動的な反映（既定の等級名の変更と、既存の会社の等級名と等級名を含む表示名の一律の書き換えを含む）、等級名を変えられる役割の制限、権限一覧のページと利用者一覧の権限一覧モーダル、3つの一覧への今の等級と確定済みの最新評価点の表示、1つのアカウントでの複数の会社への所属と切り替え、アンケートの提出状況の一覧、設定不足の表示の書き方と直す画面へのリンク、『Claude Code連携の鍵』の画面名の変更、全ての並べ替えへの長押しドラッグとキーボード操作、選択肢を押しても選べない不具合、右側の余白が目立つ画面の配置も対象にする。Out: 別の利用者が開いている画面への即時配信（WebSocket 等の push）、オフライン編集と同期、配色・テーマの変更（AGENTS.md と DD-003）、等級名の一律の書き換えを除く本番データの移行・修正、役割の種類の追加（『システム開発者』の役割は作らない）、等級名の変更権限を除く役割ごとの権限の中身の変更。
根拠: qa-u23、qa-v03（system-spec/00-requirements-definition.md の U7）

2026-10-14 の追加で、対象に『比べる警告（評価項目とアンケートのズレ）の、両方のページ名とリンク・3画面への表示・畳んだ表示・この等級だけ新しい版を作る操作』を足し、対象外に『比べる警告以外の設定不足の一覧（公開前の不足など）の表示の形の変更』を足した。根拠: qa-w05, qa-w02／system-spec/00-requirements-definition.md

2026-10-19〜20 の追加: 対象に、KGI の仕組みの削除と賞与（仮）の式の変更、個人別の評価レポート（管理者・直属の上司・本人向け）と A4 で印刷できる体裁、見える範囲をサーバーで絞ること（CSV とメモを含む）、テストデータ、アンケートの状態と案内の整理、ズレの比べる範囲の拡張、評価セットを決める処理の一本化、上司の判断と全ての表示先での結論と印を足した。対象外に、KGI に代わる仕組み、レポートをサーバーでファイルにすること、間接の部下の閲覧、本番 DB へのテストデータの投入、確定済みの評価の個人Pt・賞与額・根拠の文の作り直し、上司の判断で等級を自動で変えること、上司の判断を賞与（仮）に効かせること、判断の履歴を足した。
根拠: qa-x07、qa-y07（system-spec/00-requirements-definition.md の U7）

## 用語と主体

主体は、システム全体管理者（SUPER_ADMIN。全社を切り替えて会社と利用者を発行する）、会社の管理者（COMPANY_ADMIN。メンバー・アンケート・評価セット・制度設定を作り、自社の等級名を変えられる）、マネージャー（MANAGER。担当チームのメンバーと評価・結果を見る）、一般の社員（EMPLOYEE。評価入力と回答を行い、他人の等級と点数は見えない）の4役割で、役割の種類は増やさない。関係者として、開発・運用担当は反映されない報告の切り分けと鮮度保証の維持を担い、複数の会社に所属する人は1つのアカウントで会社を切り替えて使う。『等級名』は会社ごとに付ける等級の呼び名（既定は『等級1』〜『等級5-2』）、『区分（pointGroup）』は表どうしを結ぶキーで画面には出さないもの、『所属』は利用者・会社・役割・等級・事業所・上司の組である。『選んでいる会社』は cookie（hr_company）が指す会社で、サーバーがリクエストのたびに所属を確かめて決める（D-004）。『権限の定義』は、route-ledger.json の各ページに置く、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を指し、この台帳1つにまとめる（D-007）。『鮮度契約』は画面からの書き込みを共通の入口 runAction に通し、成功したら同じ応答で画面を作り直して他タブへ知らせる約束を指す。『確定済みの最新評価』は評価の表で finalized の最新のもので、KPI評価点（totalScore）と等級要件の達成率（requirementRate）を指す。
根拠: qa-f03、qa-r-backend-4、qa-v18、qa-v26、qa-v27、qa-v30、D-004、D-007（qa-v25）（system-spec/00-requirements-definition.md の U6、system-spec/auth.md）、system-spec/database.md、system-spec/ui-ux.md、system-spec/backend.md

2026-10-19〜20 の追加: 『個人別の評価レポート』は開くたびに確定済みの評価から作る1人分の報告で、①〜⑦の7つの部分を持つ。『点数の判定』は raiseEligible・promotionEligible と理由の文で、上司の判断で書き換えない。『上司の判断』は昇給と昇格それぞれの follow（判定どおり）／override（変える）と理由・記録した人・時刻で、『最終の可否』は finalDecision が点数の判定と判断から出す結論である。『評価セットの決め方』は resolveSchemeForCycle が評価期間から決める1つの規則である。主体に、評価の確定のときに判断と理由を記録する直属の上司と、自分のレポートで判定と過去の推移を確かめる被評価者（本人）を足した。
根拠: qa-y06、qa-y07、qa-x07（system-spec/00-requirements-definition.md の U6、system-spec/backend.md）

## ユースケースとユーザーフロー

(1) システム全体管理者が会社や利用者を連続作成すると、成功の知らせと同じ描画で一覧・件数・会社切替メニューに新しい行が出る。仮パスワードの控えは知らせの後ろに畳まれ、発行から14日以内なら一覧の行から開き直せる。(2) 会社の管理者がメンバー・アンケート・評価セット・制度設定を保存すると、同じタブ・強制再読み込み・別タブ・スマホやタブレットの画面復帰のどれでも結果が見え、入力中の内容とスクロール位置は失われない。(3) 等級名を管理する人（システム全体管理者と会社の管理者）が等級名を変えると、次の表示から行動指針・評価セット・昇格の要件・警告・アンケートのタイトル・ボタンがその名前になる。(4) 複数の会社に所属するマネージャーは、同じメールアドレスの1つのアカウントでヘッダーから会社を切り替え、その会社の役割・等級・上司で画面と権限が変わる。会社の切り替えの部品は所属が2社以上の人にも出し、所属が1つの人は今と同じ動きになる。(5) 管理者とマネージャーは一覧で各人の等級と確定済みの最新評価点、アンケートの提出状況を確かめ、設定不足の表示のリンクから直す画面へ1回で移る。権限一覧では、表で役割どうしを比べ、役割のタブで1つの役割に絞り、スマホではページごとのカードで、開けるページとできる操作を確かめる。(6) 並び順を持つ編集画面では、長押しのドラッグ・矢印のボタン・キーボードのどれでも並べ替えられ、回答者はアンケートの設問名や選択肢のどこを押しても選べる。
根拠: qa-i01、qa-r-uiux-3、qa-v18、qa-v27、D-006（system-spec/00-requirements-definition.md、system-spec/ui-ux.md）、system-spec/auth.md

2026-10-19〜20 の追加: (7) 管理者・マネージャー・本人は、それぞれの入口から個人別の評価レポートを開き、評価に値するか・点数・レーダー図・その等級の推移と平均・等級ごとの点数・過去の実績を見て、『印刷する』から A4 縦2枚に刷る。(8) マネージャーは評価を確定するとき、昇給と昇格のそれぞれで『点数の判定どおりにする／変える』を選び、変えるときは結論と理由を書いてから確定する。本人は結果とレポートで最終の結論・『上司の判断』の印・同じ理由の文を見る。(9) 回答者は配布 URL から、ログイン・等級・締切に応じて回答画面か理由を見る。管理者は状態に合った操作だけでアンケートを公開・締め切り・延長する。
根拠: qa-x07、qa-y07、qa-y09（system-spec/00-requirements-definition.md、system-spec/ui-ux.md）

## 機能要件

FR-001: 画面からの書き込みは Server Functions の共通の入口 runAction を通し、成功したときだけ next/cache の refresh で同じ応答に新しい画面を載せる（I1、D-002）。FR-002: 書き込みの成功を BroadcastChannel で同じブラウザの他タブへ知らせ、visibilitychange・online・pageshow（persisted）でも取り直す（I3、D-001）。FR-003: 複数の表を書く書き込みは1回の D1 batch で書き、batch に入りきらない会社追加は withCompensation（書き込みと取り消しの組）、パスワード変更の続きは rollForward（やり直し）で守る（I4、D-003）。FR-004: 等級の呼び名を作る共通の関数を置いて全表示をそこから作り、既定の等級名を『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』にして既存の会社を一律に書き換える（I7）。FR-005: 等級名を変えられる役割を限り、画面とサーバー処理の両方で判定する（I8）。権限の定義は、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置く（D-007）。サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の can〜 の判定・権限一覧の表示は、この台帳だけを読む。権限一覧はページとモーダルで同じ部品を使い、表・役割のタブ・スマホのカードで見せ、説明はポインター・フォーカス・タップのどれでも出す（I9、D-006）。あわせて、画面名の改名、3つの一覧への等級と点数、所属の表と cookie で選ぶ会社の切り替え（D-004）、提出状況の一覧、設定不足の『何が足りない・どう直す・直す画面へのリンク』、Pointer Events で自作する並べ替えの共通部品と並び順の全体保存（D-005）、選択肢の修正、余白の見直しを入れる（I8〜I16）。
根拠: qa-r-backend-4、qa-r-frontend-3、qa-r-database-3、qa-v18・qa-v22・qa-v26〜qa-v30、D-004（qa-v12）、D-005（qa-v13）、D-006（qa-v14）、D-007（qa-v25）（system-spec/00-requirements-definition.md の U9）、system-spec/database.md、system-spec/frontend.md、system-spec/ui-ux.md、system-spec/backend.md、system-spec/auth.md、system-spec/security.md、system-spec/infrastructure.md

I17：比べる警告の型に、2つのページ（階層つきのページ名とリンク）と項目ごとの有無を持たせる。ズレの警告をアンケートの一覧・アンケート1本・使うKPIを選ぶの3画面に、既定は1行・押すと表で開く形で出す。公開後のズレには『この等級だけ新しい版の下書きを作る』を添える（G16）。根拠: qa-w05, qa-w02／system-spec/00-requirements-definition.md

2026-10-19〜20 の追加: I18：KGI のメニュー・画面・サーバー処理・計算・テスト・台帳の行を消し、賞与（仮）を個人Pt＝KPI評価点の合計で出す（G17）。I19：レポートのデータを1つの関数で作り、本人向けの形に落とし、1つのテンプレートで描いて A4 縦で印刷できる体裁を付ける（G18・G19）。I20：見える範囲の判定を1つの関数にまとめる（G19）。I21：シードと E2E で全ての画面と項目を確かめる（G20・G21）。I22：アンケートの状態の規則を1つの関数にまとめる（G21）。I23：ズレの比較を3種類に広げ、行ごとに直すリンクを持たせる（G22）。I24：評価セットを決める関数を1つにし、依存関係を図にする（G23）。I25：上司の判断を評価に足し、最終の可否を1つの関数で出して全ての表示先が使う（G24）。
根拠: qa-x07、qa-y07（system-spec/00-requirements-definition.md の U9）

## 非機能要件

性能: 他タブは通知受信またはタブ復帰から1秒以内に最新化し（O3）、通知の取り直しは1.5秒に1回へ間引く。一覧の等級と点数は一覧ぶんをまとめて1回の問い合わせで取り、人数に比例して問い合わせを増やさない。信頼性: 複数の表を書く書き込みの中途状態を0件にし、取り消し・やり直しまで失敗したときは compensation_failed・rollforward_failed を Workers Logs に必ず残す（O5）。アクセシビリティ: 並べ替えはドラッグだけに頼らず、矢印のボタンとキーボードでも同じ操作ができて結果を読み上げる。矢印のボタンは WCAG 2.2 の SC 2.5.7（ドラッグの代わりの操作）として残す。ポインターを載せたときだけ出る情報を作らず、色だけに頼らない表示にし、375・768・1280・1600 の4幅で同じ振る舞いにする。セキュリティと保守性: ログイン後の応答は private, no-store にし、役割による表示の制限は画面で隠すだけでなくサーバーが返すデータの段階で行う。構成（Next.js 16 系・OpenNext Cloudflare・Workers・D1・better-auth）は変えない。並べ替えは Pointer Events で自作して新しい依存を足さず（D-005）、権限の定義は route-ledger.json に足して DB の表を足さない（D-007）。
根拠: qa-r-frontend-3、qa-r-security-3、qa-v18、qa-v29、qa-v30、D-005（qa-v13）、D-007（qa-v25）（system-spec/00-requirements-definition.md の U4・U8）、system-spec/ui-ux.md、system-spec/infrastructure.md、system-spec/backend.md

2026-10-14 の追加で、制約に『警告のリンク先は、ルート台帳にあり、見ている人の役割で開けるページに限る』『警告を畳むときも、ズレがあることと件数は畳まずに出す（仕様 §22-2・§22-4）』を足した。根拠: qa-w05／system-spec/00-requirements-definition.md

2026-10-19〜20 の追加: 制約に、KGI の削除は2回の Deploy に分けること、レポートは保存した写しを持たず同じ入力から同じ出力になるよう並び順・丸め・期の選び方を固定すること、同じ等級の平均は3人未満なら出さないこと、マネージャーの範囲を直属の部下に限りサーバーで絞ること、テストデータに実在の人名と値を使わないこと、図は既存の recharts で描き新しい依存を足さないこと、判断の理由は行動や事実で書くよう画面で促すこと、点数の判定を上司の判断で書き換えないことを足した。
根拠: qa-x07、qa-y07（system-spec/00-requirements-definition.md の U8）

## UI・状態遷移

書き込みの成功は新しい画面が描き終わってから呼び出し元へ返す（createCommitGate）。成功の言葉と一覧・件数・会社切替メニューが同じ描画でそろい、取り直しの間も画面全体を読み込み中に切り替えない。控えは『仮パスワードの控えを見る』で開閉し、発行の日時と期限を出し、14日を過ぎると一覧の行にボタンを出さず再発行を案内する。並べ替えは、つまみにフォーカスして Space で持ち上げ、↑↓で動かし、Space で置き、Esc で戻す遷移を持つ。動かしている間は落とす位置を示し、タッチでは長押しで持ち上げてスクロールと取り違えない。権限一覧は、広い画面ではページ名を行・4つの役割を列にした1つの表で示し、表の上の役割のタブ（APG の tabs）で1つの役割に絞り、スマホの幅ではページごとのカードに切り替える（D-006）。表とカードは同じデータから描く。説明は、表ではポインター・フォーカス・タップで出し、カードでは常に見せる。権限一覧のモーダルはページと同じ部品を dialog 要素で出し、開いたらフォーカスを中に移し、閉じるボタンと Esc で閉じて元のボタンへ戻す。利用者一覧の『役割ごとにできること』欄の開閉状態は端末ごとに覚え、読めなければ既定の状態で動く。確定した評価が無い人は『確定した評価なし』、見本画面では『見本のため送信できません』と理由を出し、読み取り専用の表示は押せるように見せない。設定不足は件数が多ければ直す画面ごとにまとめて初めの数件を出す。
根拠: qa-r-uiux-3、qa-r-frontend-3、qa-v18、qa-v22、D-006（qa-v14）（system-spec/00-requirements-definition.md、system-spec/ui-ux.md、system-spec/frontend.md）

比べる警告は、閉じた1行（注意の印・『評価項目とのズレ ◯件（足りない◯・余分◯）』・『直すところを見る』）と、押すとその場で開く中身（『下記の内容を変更・修正してください』・2つのページへのリンク・項目ごとの表・直す操作のボタン1つ）の2つの状態を持つ。開閉の状態は覚えない。根拠: qa-w06, qa-w07／system-spec/ui-ux.md・system-spec/frontend.md

2026-10-19〜20 の追加: レポートは①〜⑦を4つの幅で同じ順に並べ、印刷では1枚目に①②③④と上長からのコメント、2枚目に⑤⑥⑦を載せる。確定の画面の判断の欄は、昇給と昇格のそれぞれで未選択→判定どおり／変える→（変えるなら）結論と理由の入力と進み、両方が揃うまで確定のボタンは押せず、押せない理由を1行で出す。アンケートは下書き・公開中・締切済みの状態ごとに出す操作を決め、締切済みから公開中・下書きから締切済みへは移さない。
根拠: qa-y09、qa-y10、qa-x09（system-spec/ui-ux.md、system-spec/frontend.md）

## ビジネスルールと検証

BR-001: 等級の呼び名はその会社の等級名だけで表し、英語（Beginner・Regular・Chief・AM・Manager）やカタカナの区分名を画面に出さず、pointGroup は結合キーとして値を変えず表示に使わない。BR-002: 等級名を変えられるのはシステム全体管理者と自社の会社の管理者だけで、マネージャー・一般の社員・他社の会社の管理者には変更の欄を出さず、サーバー処理でも 403 にする。BR-003: 一覧の点数は確定済み（finalized）の最新の評価だけを使い、一般の社員への応答には他人の等級と点数を含めない。BR-004: 会社管理者の新規登録では既存メールを汎用文面で拒否し、他社の所属先を知らせない。既存アカウントへの新しい会社所属の追加は全体管理者の専用処理だけが行い、パスワードと資格情報の控えを変更・発行せず、所属・必要な写し・監査を同じ batch で書く（DD-009）。BR-005: 並び順の全体保存で送られた id の集まりが今の集まりと違えば 409 で取り直しを求め、アンケートの選択肢の値の重複は保存時に拒否する。
根拠: qa-v02、qa-v27、qa-v28、qa-v30（system-spec/00-requirements-definition.md）、system-spec/auth.md、system-spec/security.md、system-spec/backend.md

2026-10-14 の会社所属の現在の契約：既存アカウントへ別の会社の所属を足すのは全体管理者だけの専用操作（addMembership）とする（qa-w11、D-008）。選んでいる会社が無いとき（cookie が無い・所属していない会社を指す）は、有効な所属のうち会社名の順で最初の会社を開く（同名は会社 id の順。qa-w12、D-009）。委任（qa-v32）に基づく DD-009 の『最も古い有効な所属』は利用者の選択で取り消し、実装は 2026-10-15 に会社名の順へ直した（src/lib/memberships.ts の activeMembershipsByCompanyName。users の写しの基準は古い順のまま。DD-009 の更新）。どちらの順でも、リクエストのたびに所属をサーバーで確かめることは変わらない。根拠: qa-w11, qa-w12, qa-v27／system-spec/auth.md・system-spec/security.md・docs/product/design-decisions.md

2026-10-19〜20 の追加: 最終の可否は、判定どおりなら点数の判定、override なら逆、判断の無い古い確定なら点数の判定に『記録なし』の印を付けたものとする。確定の入力で、どちらかの判断が無い・override の理由が空白だけ・理由が 2000 字を超えるなら確定しない。賞与（仮）は個人Pt＝KPI評価点の合計（整数に四捨五入）×1点あたりの円で、0なら出さない。同じ等級の平均は同じ会社の確定済みの評価だけから作り、3人未満なら作らない。
根拠: qa-z01、qa-x02、qa-y03、qa-y06（system-spec/backend.md、system-spec/00-requirements-definition.md）

## API契約

画面から呼ぶ書き込みは Server Functions（src/actions）で受ける。共通の入口 runAction が送り元の検査と認可、大きさの上限（413）、zod による入力の検証、本体、成功時だけの refresh の順に処理して {ok, message} の形で返し、読むだけの呼び出しは runRead で受けて描き直さない。Bearer 鍵で呼ぶ外部のエージェント向け API・端末の承認・sendBeacon の利用記録・外観の選択の記録・認証は Route Handler のまま残し、外部向けの API の契約は今回変えない。追加の契約として、並び順の全体（id の並び）を受ける形（集まりが違えば 409、今の向きの指定も残す）、対象者ごとの状態（提出済み・入力途中・未回答）と提出日時とアンケートごとの人数を返す処理、設定不足を『何が足りない・どう直す・直す画面の道筋と名前』の構造で返す形を足す。会社の切り替え（switchCompanyScope）は全ての役割に開き、送り元のオリジンを確かめる Server Action で受け、所属を確かめて所属していない会社を拒否する。等級名を変える処理（saveMaster の等級の表と BehaviorBandAssignmentEditor から呼ぶ処理）は、許可されない役割と他社を指す要求に 403 を返す。
根拠: qa-r-backend-4、qa-v27、qa-v28、qa-v30、D-004（system-spec/backend.md、system-spec/00-requirements-definition.md）、system-spec/auth.md、system-spec/security.md

2026-10-19〜20 の追加: updateEvaluation の確定（finalize）の入力に、昇給と昇格それぞれの判断（follow／override）と override のときの理由を足し、不正なら 400 を返す。buildEvaluationReport（会社・対象の人・見る人）は、見る人が本人なら点数の数値と比べる値を落とした形を返す。CSV の昇給と昇格の列を最終の結論にし、『点数の判定』『上司の判断』『判断の理由』の列を足す。
根拠: qa-z01（system-spec/backend.md）

## データモデル

会社への所属の表（利用者・会社・役割・等級・事業所・上司・作成日時。利用者と会社の組を一意）を新たに持つ（D-004）。users の会社ごとの列（company_id・role・grade_id・office_id・manager_id）は所属の表を正とし、users.email の一意は残し、上司は同じ会社の所属を指す。等級名を含む表示名（行動指針のセット名、利用者が自分で付けていないアンケートの既定のタイトル）は保存せず、表示のたびに作る。一覧の等級と点数・提出状況は既存の表から求め、写しの列や新しい表を作らない。等級名の書き換え前の値は記録用の表に残し、等級名の変更と所属の追加・削除は監査ジャーナルに変更前と変更後を残す。権限の定義は DB の表に持たず、編集画面も作らず、route-ledger.json に置く（D-007）。初期パスワードの控え（initial_credential_memos）は暗号文・初期化ベクトル・鍵の版・発行者・発行時刻だけを持ち、制度マスタの監査記録（constitution_events）は実体ごとの番号を一意にする（uq_ce_entity_seq）。表の形・移行・整合の詳細は system-spec-database ノードで扱う。
根拠: qa-v26、qa-r-database-3、D-004、D-007（qa-v25）（system-spec/database.md）

2026-10-19〜20 の追加: KGI の3つの表と評価の2列を2回目の Deploy で消す。評価の表に raise_decision・promotion_decision・raise_decision_reason・promotion_decision_reason・decision_recorded_by・decision_recorded_at（どれも NULL 可）を足し、既存の行は書き換えない。レポートの表は作らない。詳細は system-spec-database ノードで扱う。
根拠: qa-y15（system-spec/database.md）

## 認証・認可

ログインは better-auth のメールアドレスとパスワードによるアカウント単位で、本人登録は閉じ、セッションは要求ごとに D1 から読んで cookieCache を入れない。選んでいる会社は、今システム全体管理者だけが使っている cookie（hr_company。httpOnly・Secure・SameSite=Lax）を全員に広げて持つ（D-004）。getViewer はリクエストのたびに cookie が指す会社への有効な所属をサーバーで確かめ、その所属の会社・役割・等級を作る。cookie が無いときや所属していない会社を指すときは、有効な所属のうち会社名の順（同名は会社 id の順。D-009）で最初の会社を使い、所属が1つの人は今と同じ動きにする。会社の切り替え（switchCompanyScope）は全ての役割に開き、所属していない会社は拒否する。システム全体管理者は今どおり全社から選べる。役割ごとに開けるページ（accessClass）に加え、ページでできる主な操作・役割ごとの可否・説明も route-ledger.json の各ページに足し、権限の定義をこの台帳1つにまとめる（D-007）。サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の can〜 の判定・権限一覧の表示は、この台帳だけを読む。全ての読み書きを選んでいる会社の所属で絞り、他社や担当外の対象は区別せず 404 にする。詳細は system-spec-auth ノードで扱う。
根拠: qa-f03、qa-f04、qa-r-auth-3、qa-v27、qa-v28、D-004（qa-v12）、D-007（qa-v25）（system-spec/auth.md、system-spec/security.md）

比べる警告のリンク先は、見る人の役割で開けるページに限る。この等級だけ新しい版を作る操作は既存の createForms を通り、自社のものでない等級が1件でもあれば何も作らずに拒否する。根拠: qa-w09／system-spec/security.md

2026-10-19〜20 の追加: 評価の中身とレポートを開ける人を canViewEvaluationOf の1つの関数で決め（全体管理者は全社、会社の管理者は自社の全員、マネージャーは直属の部下と自分、一般の社員は自分だけ）、範囲の外は 404 にする。上司の判断を記録できる人は評価を確定できる人と同じ（canActOnEmployeeEvaluation。自分自身の評価は不可）にし、判断と理由は本人には確定した後だけ見せる。詳細は system-spec-auth ノードで扱う。
根拠: qa-y13、qa-z02（system-spec/auth.md、system-spec/security.md）

## エラー・例外・回復

認可に失敗した要求では書き込みも画面の作り直しも他タブへの通知も行わず、権限の無い画面は 404 かログイン画面になる。cookie が所属していない会社を指すときは、有効な所属のうち会社名の順（同名は会社 id の順。D-009）で最初の会社を使う。所属していない会社への切り替えの要求は拒否する。入口は大きさの超過を 413、等級名の変更の権限違反を 403、並び順の集まりの食い違いと制度マスタの同時保存を 409 で返し、同時保存は自動でやり直さない。1回の batch に入る書き込みは全部書けるか何も書かれないかで、会社追加は途中の失敗で逆順に取り消す。取り消しも失敗すれば compensation_failed を残し、画面に失敗と管理者への連絡を出す。パスワード変更の続きは1回だけやり直し、それでも失敗すれば rollforward_failed を残して変更は済んだことを伝える。どちらも deploy-notes §7 の手順で、本番 DB を手で書き換えずに直す。マイグレーションは失敗しても途中の状態を残さない。
根拠: qa-r-backend-4、qa-r-auth-3、qa-r-database-3、qa-r-ops-3、qa-v27、qa-v29、qa-v30（system-spec/backend.md、system-spec/auth.md、system-spec/maintenance-ops.md、system-spec/infrastructure.md）

2026-10-19〜20 の追加: 判断の無い確定は 400 で拒み、画面は押せない理由を1行で出す。範囲の外の人のレポートの URL は 404 にする。確定した評価が1件も無いレポートは、その旨と評価の画面へのリンクを出す。確定を戻しても判断は残り、評価を作り直すと判断も消えて次の確定で選び直す。締め切ったアンケートの延長を断るときに、画面に無い操作を案内しない。
根拠: qa-z01、qa-y10（system-spec/backend.md、system-spec/ui-ux.md）

## イベント・非同期処理

サーバー側のキューやイベント配信は持たず（OpenNext の queue は設定していない）、別の利用者の画面への push は範囲外とする。送り手は画面側の共通口で、書き込みの成功後に BroadcastChannel（hr-evaluation:freshness）へ変わった資源の種類と時刻だけを送り、受け手は画面の骨格に1回だけ置いた FreshnessSync で、1.5秒に1回へ間引いて router.refresh で取り直す。通知は中身を持たない合図で、受け取った側はサーバーから取り直して認可もサーバーが毎回判定し、届くのは同じブラウザの同じオリジンのタブだけなので、別の端末の反映は visibilitychange・online・pageshow（persisted）の取り直しで補う。期限切れの控えの掃除も決まった時刻に動く仕組みを持たず、次の発行の batch の先頭で行う。
根拠: qa-f08、qa-r-frontend-3、qa-r-security-3、qa-r-database-3、D-001（system-spec/frontend.md、system-spec/00-requirements-definition.md）

2026-10-19〜20 の追加: 2026-10-19〜20 の追加で、新しい非同期の仕組みは足さない。レポートは開くたびに同期で作り、印刷はブラウザで行う。
根拠: qa-z01、qa-x15（system-spec/backend.md、system-spec/infrastructure.md）

## 可観測性

Worker は成功・失敗どちらの応答にも生成時刻 x-generated-at を Next.js の外側で付け、そこに個人情報や内部の ID を含めない。Workers Logs（observability を有効）に compensation_failed・rollforward_failed と、誰が誰の控えを開いたか（値は含めない）を残す。等級名の変更・所属の追加と削除・本番の一律の書き換えは監査に変更前と変更後、または書き換え前の値を残す。『反映されない』という報告は、生成時刻のヘッダー・Workers Logs・ゾーンのキャッシュ規則を読み取りだけで順に確かめる手順（deploy-notes §7）で切り分ける。
根拠: qa-f08、qa-r-infrastructure-3、qa-r-security-3、qa-r-ops-3、qa-v26、qa-v28（system-spec/infrastructure.md、system-spec/maintenance-ops.md）、system-spec/database.md、system-spec/security.md

2026-10-19〜20 の追加: レポートには作った時刻と元にした評価期間を載せ、同じ入力から同じ出力になることを確かめられるようにする。上司の判断には記録した人と時刻を残す（上書きした前の判断の履歴は持たない）。
根拠: qa-x07、qa-y15（system-spec/00-requirements-definition.md の U8、system-spec/database.md）

## 互換性・移行・リリース

所属の表の追加と既存の利用者全員への今の値どおりの所属の作成、等級名と英語入りの表示名の一律の書き換えは、D1 のマイグレーション（drizzle/migrations の 0033 以降）で行い、本番の Deploy の自動マイグレーションと fail-closed のゲートに乗せる。どのマイグレーションも2回流して結果が変わらず、等級の id と pointGroup を変えず、書き換え前の値を表に残して戻す手順を用意する。本番では書き換えの前に読み取り専用で対象の会社数・等級数・英語入りの表示名の数を数え、外部変更ガード（preview → CONFIRM → authorize → execute）を通して Deploy し、後で英語の区分名が残っていないことを読み取りで確かめる。所属が1つの人は今と同じ動きにする。Workers と D1 の構成は変えず、並べ替えのための依存を足さない（D-005）。権限の定義は route-ledger.json に足し、DB の表を足さない（D-007）。Next.js は脆弱性の修正を含む 16.3.8 へ上げる。ルート台帳は権限一覧のページを足して47画面にし、全てのページに主な操作・役割ごとの可否・説明の欄を足す。PR は実装後に利用者の確認を取ってから作る。
根拠: qa-v26、qa-v27、qa-v29、qa-v31、qa-r-infrastructure-3、D-005、D-007（system-spec/infrastructure.md、system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md の U8）、system-spec/database.md、system-spec/auth.md

2026-10-19〜20 の追加: KGI の削除は2回の Deploy（1回目はコードだけ、2回目でマイグレーション）に分け、2回目の前に本番 DB を読み取りで数える。判断の列は足すだけのマイグレーションで今の順番のまま1回で出し、古い確定は『上司の判断の記録なし（この仕組みより前に確定）』と出す。確定済みの評価の個人Pt・賞与額・根拠の文は作り直さない。
根拠: qa-x15、qa-y15、qa-y16（system-spec/infrastructure.md、system-spec/database.md、system-spec/maintenance-ops.md）

## テストと受入条件

AC-001: 作成系の E2E で成功表示直後の DOM に新しい行と件数が含まれ、強制再読み込み・2タブ（1秒以内）・別の端末・戻る・bfcache からの復元の各経路と 375px・768px の幅でも新しい行が出る（O1〜O3。Playwright の pnpm test:e2e はローカルの preview だけに向ける）。AC-002: server-actions-contract・write-atomicity-contract・action-origin の各検査が違反0件で、会社追加・CSV 取込・評価の集計・パスワード変更の途中失敗の試験で一部だけが残らずログが出る（O4・O5）。AC-003: 等級名を変える結合テストで全表示が新しい名前になって英語の区分名の静的検査が0件、等級名の変更は許可された役割以外で画面とサーバーの両方が拒否する（O6・O7）。AC-004: ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テスト、権限一覧の表とカードが同じ内容を出すこと、評価確定直後の一覧の点数と一般の社員の応答、2社目への所属と所属していない会社の拒否、提出状況の全員表示、設定不足の全件のリンク、並べ替えの3操作の一致と全体保存の 409、選択肢の値の重複拒否、4幅で右側だけが空かないことの撮影を確かめる（O8〜O15）。あわせて pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ。
根拠: qa-r-ops-3、qa-v31、D-006、D-007（system-spec/00-requirements-definition.md の U4、system-spec/maintenance-ops.md）

O16：比べて出す警告の全件に、比べている2つのページの階層つきの名前とリンクを持たせ、既定では1行に畳む。測り方は、比べる警告を作る処理の全件が2つのページを持つことを確かめる契約テスト（欠落 0 件）と、アンケート一覧・アンケート1本・使うKPIを選ぶの3画面で、閉じた状態が1行・開くと2つのリンクと表が出ることを確かめる画面のテストである。根拠: qa-w05, qa-w10／system-spec/00-requirements-definition.md・system-spec/maintenance-ops.md

2026-10-19〜20 の追加: O17：KGI の参照0件の静的検査と賞与の計算の単体テスト、2回目の Deploy の後の表と列の不在の確認。O18：同じデータから2回作ったレポートが一致する単体テスト、軸の数のテスト、4つの幅と A4 縦の印刷の画面のテスト、1人分の PDF が2ページで2枚目が⑤から始まること。O19：役割と直属の部下の組ごとの結合テストと E2E、本人向けの応答のキーの契約テスト、3人未満のテスト。O20：シードの後の E2E と2回流しても同じになるテスト。O21：状態の変更の組ごとの単体テストと配布 URL の E2E。O22：3種類のズレとリンクのテスト。O23：4つの処理が同じ関数から評価セットを得る契約テスト。O24：判断の検査・finalDecision の5通り・全ての表示先の契約テストと E2E。
根拠: qa-x07、qa-y07、qa-y09（system-spec/00-requirements-definition.md の U4、system-spec/maintenance-ops.md）

## 未決事項

未決事項は無い。利用者は保留を残さないと決めている。上位概念は appr-foundation-008（qa-v03）で全文のまま確定し、等級名を編集できる役割・一覧の点数・対象の評価・既存の会社の等級名の扱いも qa-v02 で決めた。4つの設計判断も確定している。D-004（自前の所属の表と cookie）と D-005（Pointer Events で自作）は、利用者が選んだ（qa-v12・qa-v13）。D-006 は、利用者が選択肢を選ばず Other に①②③の組み合わせを求めたので、1つの表・役割のタブ・スマホのカードを併せる案にした（qa-v14）。D-007 は、利用者が①（route-ledger.json に操作と説明を足す）を名指しで選んで確定した（qa-v25、2026-10-13T03:40:15Z）。経緯として、利用者は 2026-10-12T23:30:32Z に案を選ばず、最もよい方法の選択を AI に任せた（qa-v15）。2026-10-13T00:00:51Z の中立な問い直しにも、同じ逐語で任せた（qa-v24、回答 2026-10-13T00:03:46Z）。AI は委任に基づいて別の案を選んだ。完成度の評価が、委任に基づく AI の選択は利用者が選んだ決定と同じ強さの記録ではないと指摘した。そこで3案を比べて中立に問い直し、利用者が①を選んだ。qa-v15・qa-v24 は qa-v25 で置き換えた。各章の設計は、利用者が文面を見て承認した。ui-ux（qa-v18）と frontend（qa-v22）は、第4版の全文のまま承認した（2026-10-13T00:03:46Z）。database・auth・security・infrastructure・backend・maintenance-ops は、AI が選んだ別の案を前提にした項目を①に直し、旧と新を逐語で示して承認を取り直した（qa-v26〜qa-v31、2026-10-13T03:48:20Z）。これで第4版の6章の承認（qa-v16・qa-v17・qa-v19〜qa-v21・qa-v23）を置き換えた。その前の qa-v04〜qa-v11 は、第4版の承認で置き換わっている。
根拠: qa-v02、qa-v03、qa-v12〜qa-v14・qa-v18・qa-v22・qa-v25〜qa-v31（system-spec/00-requirements-definition.md、system-spec/spec-state.json）、system-spec/ui-ux.md、system-spec/frontend.md、system-spec/maintenance-ops.md、system-spec/database.md、system-spec/auth.md、system-spec/security.md、system-spec/infrastructure.md、system-spec/backend.md

2026-10-19〜20 の追加: 2026-10-19〜20 の追加分に、利用者の判断を待つ事項は無い。完成度評価（eval-log/system-spec-completeness-2026-10-20-z.json、PASS）の残りの指摘として、backend と security の章の適用記述が qa-y12・qa-y14 を指したままであること（low）、記録の後に更新された W3C APG のページがあること（low）を記録する。
根拠: qa-z01、qa-z02（system-spec/backend.md、system-spec/security.md、eval-log/system-spec-completeness-2026-10-20-z.json）


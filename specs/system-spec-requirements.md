---
graph_node_id: "spec-system-spec-requirements"
artifact_kind: "specification"
artifact_subtypes: []
title: "要件定義：保存結果の鮮度保証と、等級・権限・所属の整理"
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
confirmation_evidence: {"evaluated_digest": "ab8facee57d0e3d9fb4b61b116663cc9f29c44bd12c14a7c9419bb9909a27480", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json"}
source_lineage: {"imported_at": "2026-10-13T05:04:21Z", "origin_kind": "system-spec-harness", "source_digest": "ab8facee57d0e3d9fb4b61b116663cc9f29c44bd12c14a7c9419bb9909a27480", "source_path": "system-spec/00-requirements-definition.md", "source_plugin": "system-spec-harness", "source_version": "0.1.21"}
created_at: "2026-10-13T05:05:39.858264Z"
updated_at: "2026-10-13T05:05:39.858264Z"
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
classification_confidence: 0.95
classification_reason: "system-spec-harness が確定した章 system-spec/00-requirements-definition.md の取り込み"
classification_candidates: [{"artifact_kind": "specification", "candidate_path": "specs/system-spec-requirements.md", "confidence": 0.95}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-13T05:05:39.858264Z", "missing_sections": [], "status": "complete"}
---


2026-10-14 の現行契約は [DD-009](../docs/product/design-decisions.md) と `system-spec/spec-state.json` の `qa-v27` / `qa-v28` の訂正を優先する。旧 `source_lineage`・`confirmation_evidence` の digest と評価は取り込み時点の記録であり、今回の訂正後に独立評価を再実行した証跡ではない。利用者の委任は `qa-v32-delegated-membership-policy` に逐語で記録し、具体案の選択はエージェントの裁定として区別する。

# 目的と成功状態

利用者が作成・変更・削除した結果を、成功表示の直後・再読み込み・他のタブ・画面復帰のどれでも必ず確かめられ、『本当に保存できたのか』を疑わずに次の作業へ進める状態をシステムとして保証する（U1、G1〜G5）。あわせて、等級の呼び名・役割ごとにできること・各人の等級と確定済みの評価・アンケートの提出状況・設定の不足を、どの画面でも同じ言葉で、見てよい人にだけ示す（G6〜G15）。成功時には、会社追加の直後に会社一覧・件数・会社切替メニューへ新しい会社が出て（連続作成で控えを出したままでも）、強制再読み込み・直接 URL・別タブ・スマホの画面復帰でも古い一覧が残らず、複数の表を書く書き込みが途中で失敗しても一部だけが残らない。さらに、等級名を『等級4-1』の形に変えると行動指針・評価セット・昇格の要件・警告・アンケートのタイトル・ボタンのすべてがその名前で出て、権限一覧のページとモーダル、一覧の等級と点数、2社目への所属、提出状況の一覧、リンク付きの設定不足の表示、『Claude Code連携（システム開発者専用）』への改名、長押しドラッグでの並べ替え、押せる選択肢、右側の余白の解消がそろう（U5）。
根拠: qa-u01、qa-v01、qa-v03（appr-foundation-008）、qa-u26（appr-foundation-007）（system-spec/00-requirements-definition.md の U1・U3・U5）

## スコープ

In: 全ての作成・更新・削除（会社・利用者・メンバー・アンケート・評価セットと期間・制度設定・CSV 取込・改善要望など）の後の表示鮮度を、同じタブ・再読み込み・他のタブ・画面復帰の4経路で保証すること、一つの操作で複数の表を書く書き込みを途中で失敗しても一部だけ残さないこと（batch・補償・やり直し）、鮮度契約の静的検査と E2E と反映されない報告の切り分け手段。2026-10-12 の追加として、等級名の表示の統一と動的な反映（既定の等級名の変更と、既存の会社の等級名と等級名を含む表示名の一律の書き換えを含む）、等級名を変えられる役割の制限、権限一覧のページと利用者一覧の権限一覧モーダル、3つの一覧への今の等級と確定済みの最新評価点の表示、1つのアカウントでの複数の会社への所属と切り替え、アンケートの提出状況の一覧、設定不足の表示の書き方と直す画面へのリンク、『Claude Code連携の鍵』の画面名の変更、全ての並べ替えへの長押しドラッグとキーボード操作、選択肢を押しても選べない不具合、右側の余白が目立つ画面の配置も対象にする。Out: 別の利用者が開いている画面への即時配信（WebSocket 等の push）、オフライン編集と同期、配色・テーマの変更（AGENTS.md と DD-003）、等級名の一律の書き換えを除く本番データの移行・修正、役割の種類の追加（『システム開発者』の役割は作らない）、等級名の変更権限を除く役割ごとの権限の中身の変更。
根拠: qa-u23、qa-v03（system-spec/00-requirements-definition.md の U7）

## 用語と主体

主体は、システム全体管理者（SUPER_ADMIN。全社を切り替えて会社と利用者を発行する）、会社の管理者（COMPANY_ADMIN。メンバー・アンケート・評価セット・制度設定を作り、自社の等級名を変えられる）、マネージャー（MANAGER。担当チームのメンバーと評価・結果を見る）、一般の社員（EMPLOYEE。評価入力と回答を行い、他人の等級と点数は見えない）の4役割で、役割の種類は増やさない。関係者として、開発・運用担当は反映されない報告の切り分けと鮮度保証の維持を担い、複数の会社に所属する人は1つのアカウントで会社を切り替えて使う。『等級名』は会社ごとに付ける等級の呼び名（既定は『等級1』〜『等級5-2』）、『区分（pointGroup）』は表どうしを結ぶキーで画面には出さないもの、『所属』は利用者・会社・役割・等級・事業所・上司の組である。『選んでいる会社』は cookie（hr_company）が指す会社で、サーバーがリクエストのたびに所属を確かめて決める（D-004）。『権限の定義』は、route-ledger.json の各ページに置く、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を指し、この台帳1つにまとめる（D-007）。『鮮度契約』は画面からの書き込みを共通の入口 runAction に通し、成功したら同じ応答で画面を作り直して他タブへ知らせる約束を指す。『確定済みの最新評価』は評価の表で finalized の最新のもので、KPI評価点（totalScore）と等級要件の達成率（requirementRate）を指す。
根拠: qa-f03、qa-r-backend-4、qa-v18、qa-v26、qa-v27、qa-v30、D-004、D-007（qa-v25）（system-spec/00-requirements-definition.md の U6、system-spec/auth.md）、system-spec/database.md、system-spec/ui-ux.md、system-spec/backend.md

## ユースケースとユーザーフロー

(1) システム全体管理者が会社や利用者を連続作成すると、成功の知らせと同じ描画で一覧・件数・会社切替メニューに新しい行が出る。仮パスワードの控えは知らせの後ろに畳まれ、発行から14日以内なら一覧の行から開き直せる。(2) 会社の管理者がメンバー・アンケート・評価セット・制度設定を保存すると、同じタブ・強制再読み込み・別タブ・スマホやタブレットの画面復帰のどれでも結果が見え、入力中の内容とスクロール位置は失われない。(3) 等級名を管理する人（システム全体管理者と会社の管理者）が等級名を変えると、次の表示から行動指針・評価セット・昇格の要件・警告・アンケートのタイトル・ボタンがその名前になる。(4) 複数の会社に所属するマネージャーは、同じメールアドレスの1つのアカウントでヘッダーから会社を切り替え、その会社の役割・等級・上司で画面と権限が変わる。会社の切り替えの部品は所属が2社以上の人にも出し、所属が1つの人は今と同じ動きになる。(5) 管理者とマネージャーは一覧で各人の等級と確定済みの最新評価点、アンケートの提出状況を確かめ、設定不足の表示のリンクから直す画面へ1回で移る。権限一覧では、表で役割どうしを比べ、役割のタブで1つの役割に絞り、スマホではページごとのカードで、開けるページとできる操作を確かめる。(6) 並び順を持つ編集画面では、長押しのドラッグ・矢印のボタン・キーボードのどれでも並べ替えられ、回答者はアンケートの設問名や選択肢のどこを押しても選べる。
根拠: qa-i01、qa-r-uiux-3、qa-v18、qa-v27、D-006（system-spec/00-requirements-definition.md、system-spec/ui-ux.md）、system-spec/auth.md

## 機能要件

FR-001: 画面からの書き込みは Server Functions の共通の入口 runAction を通し、成功したときだけ next/cache の refresh で同じ応答に新しい画面を載せる（I1、D-002）。FR-002: 書き込みの成功を BroadcastChannel で同じブラウザの他タブへ知らせ、visibilitychange・online・pageshow（persisted）でも取り直す（I3、D-001）。FR-003: 複数の表を書く書き込みは1回の D1 batch で書き、batch に入りきらない会社追加は withCompensation（書き込みと取り消しの組）、パスワード変更の続きは rollForward（やり直し）で守る（I4、D-003）。FR-004: 等級の呼び名を作る共通の関数を置いて全表示をそこから作り、既定の等級名を『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』にして既存の会社を一律に書き換える（I7）。FR-005: 等級名を変えられる役割を限り、画面とサーバー処理の両方で判定する（I8）。権限の定義は、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置く（D-007）。サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の can〜 の判定・権限一覧の表示は、この台帳だけを読む。権限一覧はページとモーダルで同じ部品を使い、表・役割のタブ・スマホのカードで見せ、説明はポインター・フォーカス・タップのどれでも出す（I9、D-006）。あわせて、画面名の改名、3つの一覧への等級と点数、所属の表と cookie で選ぶ会社の切り替え（D-004）、提出状況の一覧、設定不足の『何が足りない・どう直す・直す画面へのリンク』、Pointer Events で自作する並べ替えの共通部品と並び順の全体保存（D-005）、選択肢の修正、余白の見直しを入れる（I8〜I16）。
根拠: qa-r-backend-4、qa-r-frontend-3、qa-r-database-3、qa-v18・qa-v22・qa-v26〜qa-v30、D-004（qa-v12）、D-005（qa-v13）、D-006（qa-v14）、D-007（qa-v25）（system-spec/00-requirements-definition.md の U9）、system-spec/database.md、system-spec/frontend.md、system-spec/ui-ux.md、system-spec/backend.md、system-spec/auth.md、system-spec/security.md、system-spec/infrastructure.md

## 非機能要件

性能: 他タブは通知受信またはタブ復帰から1秒以内に最新化し（O3）、通知の取り直しは1.5秒に1回へ間引く。一覧の等級と点数は一覧ぶんをまとめて1回の問い合わせで取り、人数に比例して問い合わせを増やさない。信頼性: 複数の表を書く書き込みの中途状態を0件にし、取り消し・やり直しまで失敗したときは compensation_failed・rollforward_failed を Workers Logs に必ず残す（O5）。アクセシビリティ: 並べ替えはドラッグだけに頼らず、矢印のボタンとキーボードでも同じ操作ができて結果を読み上げる。矢印のボタンは WCAG 2.2 の SC 2.5.7（ドラッグの代わりの操作）として残す。ポインターを載せたときだけ出る情報を作らず、色だけに頼らない表示にし、375・768・1280・1600 の4幅で同じ振る舞いにする。セキュリティと保守性: ログイン後の応答は private, no-store にし、役割による表示の制限は画面で隠すだけでなくサーバーが返すデータの段階で行う。構成（Next.js 16 系・OpenNext Cloudflare・Workers・D1・better-auth）は変えない。並べ替えは Pointer Events で自作して新しい依存を足さず（D-005）、権限の定義は route-ledger.json に足して DB の表を足さない（D-007）。
根拠: qa-r-frontend-3、qa-r-security-3、qa-v18、qa-v29、qa-v30、D-005（qa-v13）、D-007（qa-v25）（system-spec/00-requirements-definition.md の U4・U8）、system-spec/ui-ux.md、system-spec/infrastructure.md、system-spec/backend.md

## UI・状態遷移

書き込みの成功は新しい画面が描き終わってから呼び出し元へ返す（createCommitGate）。成功の言葉と一覧・件数・会社切替メニューが同じ描画でそろい、取り直しの間も画面全体を読み込み中に切り替えない。控えは『仮パスワードの控えを見る』で開閉し、発行の日時と期限を出し、14日を過ぎると一覧の行にボタンを出さず再発行を案内する。並べ替えは、つまみにフォーカスして Space で持ち上げ、↑↓で動かし、Space で置き、Esc で戻す遷移を持つ。動かしている間は落とす位置を示し、タッチでは長押しで持ち上げてスクロールと取り違えない。権限一覧は、広い画面ではページ名を行・4つの役割を列にした1つの表で示し、表の上の役割のタブ（APG の tabs）で1つの役割に絞り、スマホの幅ではページごとのカードに切り替える（D-006）。表とカードは同じデータから描く。説明は、表ではポインター・フォーカス・タップで出し、カードでは常に見せる。権限一覧のモーダルはページと同じ部品を dialog 要素で出し、開いたらフォーカスを中に移し、閉じるボタンと Esc で閉じて元のボタンへ戻す。利用者一覧の『役割ごとにできること』欄の開閉状態は端末ごとに覚え、読めなければ既定の状態で動く。確定した評価が無い人は『確定した評価なし』、見本画面では『見本のため送信できません』と理由を出し、読み取り専用の表示は押せるように見せない。設定不足は件数が多ければ直す画面ごとにまとめて初めの数件を出す。
根拠: qa-r-uiux-3、qa-r-frontend-3、qa-v18、qa-v22、D-006（qa-v14）（system-spec/00-requirements-definition.md、system-spec/ui-ux.md、system-spec/frontend.md）

## ビジネスルールと検証

BR-001: 等級の呼び名はその会社の等級名だけで表し、英語（Beginner・Regular・Chief・AM・Manager）やカタカナの区分名を画面に出さず、pointGroup は結合キーとして値を変えず表示に使わない。BR-002: 等級名を変えられるのはシステム全体管理者と自社の会社の管理者だけで、マネージャー・一般の社員・他社の会社の管理者には変更の欄を出さず、サーバー処理でも 403 にする。BR-003: 一覧の点数は確定済み（finalized）の最新の評価だけを使い、一般の社員への応答には他人の等級と点数を含めない。BR-004: 会社管理者の新規登録では既存メールを汎用文面で拒否し、他社の所属先を知らせない。既存アカウントへの新しい会社所属の追加は全体管理者の専用処理だけが行い、パスワードと資格情報の控えを変更・発行せず、所属・必要な写し・監査を同じ batch で書く（DD-009）。BR-005: 並び順の全体保存で送られた id の集まりが今の集まりと違えば 409 で取り直しを求め、アンケートの選択肢の値の重複は保存時に拒否する。
根拠: qa-v02、qa-v27、qa-v28、qa-v30（system-spec/00-requirements-definition.md）、system-spec/auth.md、system-spec/security.md、system-spec/backend.md

## API契約

画面から呼ぶ書き込みは Server Functions（src/actions）で受ける。共通の入口 runAction が送り元の検査と認可、大きさの上限（413）、zod による入力の検証、本体、成功時だけの refresh の順に処理して {ok, message} の形で返し、読むだけの呼び出しは runRead で受けて描き直さない。Bearer 鍵で呼ぶ外部のエージェント向け API・端末の承認・sendBeacon の利用記録・外観の選択の記録・認証は Route Handler のまま残し、外部向けの API の契約は今回変えない。追加の契約として、並び順の全体（id の並び）を受ける形（集まりが違えば 409、今の向きの指定も残す）、対象者ごとの状態（提出済み・入力途中・未回答）と提出日時とアンケートごとの人数を返す処理、設定不足を『何が足りない・どう直す・直す画面の道筋と名前』の構造で返す形を足す。会社の切り替え（switchCompanyScope）は全ての役割に開き、送り元のオリジンを確かめる Server Action で受け、所属を確かめて所属していない会社を拒否する。等級名を変える処理（saveMaster の等級の表と BehaviorBandAssignmentEditor から呼ぶ処理）は、許可されない役割と他社を指す要求に 403 を返す。
根拠: qa-r-backend-4、qa-v27、qa-v28、qa-v30、D-004（system-spec/backend.md、system-spec/00-requirements-definition.md）、system-spec/auth.md、system-spec/security.md

## データモデル

会社への所属の表（利用者・会社・役割・等級・事業所・上司・作成日時。利用者と会社の組を一意）を新たに持つ（D-004）。users の会社ごとの列（company_id・role・grade_id・office_id・manager_id）は所属の表を正とし、users.email の一意は残し、上司は同じ会社の所属を指す。等級名を含む表示名（行動指針のセット名、利用者が自分で付けていないアンケートの既定のタイトル）は保存せず、表示のたびに作る。一覧の等級と点数・提出状況は既存の表から求め、写しの列や新しい表を作らない。等級名の書き換え前の値は記録用の表に残し、等級名の変更と所属の追加・削除は監査ジャーナルに変更前と変更後を残す。権限の定義は DB の表に持たず、編集画面も作らず、route-ledger.json に置く（D-007）。初期パスワードの控え（initial_credential_memos）は暗号文・初期化ベクトル・鍵の版・発行者・発行時刻だけを持ち、制度マスタの監査記録（constitution_events）は実体ごとの番号を一意にする（uq_ce_entity_seq）。表の形・移行・整合の詳細は system-spec-database ノードで扱う。
根拠: qa-v26、qa-r-database-3、D-004、D-007（qa-v25）（system-spec/database.md）

## 認証・認可

ログインは better-auth のメールアドレスとパスワードによるアカウント単位で、本人登録は閉じ、セッションは要求ごとに D1 から読んで cookieCache を入れない。選んでいる会社は、今システム全体管理者だけが使っている cookie（hr_company。httpOnly・Secure・SameSite=Lax）を全員に広げて持つ（D-004）。getViewer はリクエストのたびに cookie が指す会社への有効な所属をサーバーで確かめ、その所属の会社・役割・等級を作る。cookie が無いときや所属していない会社を指すときは、有効な所属の createdAt 昇順（同時刻は id 昇順）の先頭を使い、所属が1つの人は今と同じ動きにする。会社の切り替え（switchCompanyScope）は全ての役割に開き、所属していない会社は拒否する。システム全体管理者は今どおり全社から選べる。役割ごとに開けるページ（accessClass）に加え、ページでできる主な操作・役割ごとの可否・説明も route-ledger.json の各ページに足し、権限の定義をこの台帳1つにまとめる（D-007）。サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の can〜 の判定・権限一覧の表示は、この台帳だけを読む。全ての読み書きを選んでいる会社の所属で絞り、他社や担当外の対象は区別せず 404 にする。詳細は system-spec-auth ノードで扱う。
根拠: qa-f03、qa-f04、qa-r-auth-3、qa-v27、qa-v28、D-004（qa-v12）、D-007（qa-v25）（system-spec/auth.md、system-spec/security.md）

## エラー・例外・回復

認可に失敗した要求では書き込みも画面の作り直しも他タブへの通知も行わず、権限の無い画面は 404 かログイン画面になる。cookie が所属していない会社を指すときは、有効な所属の createdAt 昇順（同時刻は id 昇順）の先頭を使う。所属していない会社への切り替えの要求は拒否する。入口は大きさの超過を 413、等級名の変更の権限違反を 403、並び順の集まりの食い違いと制度マスタの同時保存を 409 で返し、同時保存は自動でやり直さない。1回の batch に入る書き込みは全部書けるか何も書かれないかで、会社追加は途中の失敗で逆順に取り消す。取り消しも失敗すれば compensation_failed を残し、画面に失敗と管理者への連絡を出す。パスワード変更の続きは1回だけやり直し、それでも失敗すれば rollforward_failed を残して変更は済んだことを伝える。どちらも deploy-notes §7 の手順で、本番 DB を手で書き換えずに直す。マイグレーションは失敗しても途中の状態を残さない。
根拠: qa-r-backend-4、qa-r-auth-3、qa-r-database-3、qa-r-ops-3、qa-v27、qa-v29、qa-v30（system-spec/backend.md、system-spec/auth.md、system-spec/maintenance-ops.md、system-spec/infrastructure.md）

## イベント・非同期処理

サーバー側のキューやイベント配信は持たず（OpenNext の queue は設定していない）、別の利用者の画面への push は範囲外とする。送り手は画面側の共通口で、書き込みの成功後に BroadcastChannel（hr-evaluation:freshness）へ変わった資源の種類と時刻だけを送り、受け手は画面の骨格に1回だけ置いた FreshnessSync で、1.5秒に1回へ間引いて router.refresh で取り直す。通知は中身を持たない合図で、受け取った側はサーバーから取り直して認可もサーバーが毎回判定し、届くのは同じブラウザの同じオリジンのタブだけなので、別の端末の反映は visibilitychange・online・pageshow（persisted）の取り直しで補う。期限切れの控えの掃除も決まった時刻に動く仕組みを持たず、次の発行の batch の先頭で行う。
根拠: qa-f08、qa-r-frontend-3、qa-r-security-3、qa-r-database-3、D-001（system-spec/frontend.md、system-spec/00-requirements-definition.md）

## 可観測性

Worker は成功・失敗どちらの応答にも生成時刻 x-generated-at を Next.js の外側で付け、そこに個人情報や内部の ID を含めない。Workers Logs（observability を有効）に compensation_failed・rollforward_failed と、誰が誰の控えを開いたか（値は含めない）を残す。等級名の変更・所属の追加と削除・本番の一律の書き換えは監査に変更前と変更後、または書き換え前の値を残す。『反映されない』という報告は、生成時刻のヘッダー・Workers Logs・ゾーンのキャッシュ規則を読み取りだけで順に確かめる手順（deploy-notes §7）で切り分ける。
根拠: qa-f08、qa-r-infrastructure-3、qa-r-security-3、qa-r-ops-3、qa-v26、qa-v28（system-spec/infrastructure.md、system-spec/maintenance-ops.md）、system-spec/database.md、system-spec/security.md

## 互換性・移行・リリース

所属の表の追加と既存の利用者全員への今の値どおりの所属の作成、等級名と英語入りの表示名の一律の書き換えは、D1 のマイグレーション（drizzle/migrations の 0033 以降）で行い、本番の Deploy の自動マイグレーションと fail-closed のゲートに乗せる。どのマイグレーションも2回流して結果が変わらず、等級の id と pointGroup を変えず、書き換え前の値を表に残して戻す手順を用意する。本番では書き換えの前に読み取り専用で対象の会社数・等級数・英語入りの表示名の数を数え、外部変更ガード（preview → CONFIRM → authorize → execute）を通して Deploy し、後で英語の区分名が残っていないことを読み取りで確かめる。所属が1つの人は今と同じ動きにする。Workers と D1 の構成は変えず、並べ替えのための依存を足さない（D-005）。権限の定義は route-ledger.json に足し、DB の表を足さない（D-007）。Next.js は脆弱性の修正を含む 16.3.8 へ上げる。ルート台帳は権限一覧のページを足して47画面にし、全てのページに主な操作・役割ごとの可否・説明の欄を足す。PR は実装後に利用者の確認を取ってから作る。
根拠: qa-v26、qa-v27、qa-v29、qa-v31、qa-r-infrastructure-3、D-005、D-007（system-spec/infrastructure.md、system-spec/maintenance-ops.md、system-spec/00-requirements-definition.md の U8）、system-spec/database.md、system-spec/auth.md

## テストと受入条件

AC-001: 作成系の E2E で成功表示直後の DOM に新しい行と件数が含まれ、強制再読み込み・2タブ（1秒以内）・別の端末・戻る・bfcache からの復元の各経路と 375px・768px の幅でも新しい行が出る（O1〜O3。Playwright の pnpm test:e2e はローカルの preview だけに向ける）。AC-002: server-actions-contract・write-atomicity-contract・action-origin の各検査が違反0件で、会社追加・CSV 取込・評価の集計・パスワード変更の途中失敗の試験で一部だけが残らずログが出る（O4・O5）。AC-003: 等級名を変える結合テストで全表示が新しい名前になって英語の区分名の静的検査が0件、等級名の変更は許可された役割以外で画面とサーバーの両方が拒否する（O6・O7）。AC-004: ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テスト、権限一覧の表とカードが同じ内容を出すこと、評価確定直後の一覧の点数と一般の社員の応答、2社目への所属と所属していない会社の拒否、提出状況の全員表示、設定不足の全件のリンク、並べ替えの3操作の一致と全体保存の 409、選択肢の値の重複拒否、4幅で右側だけが空かないことの撮影を確かめる（O8〜O15）。あわせて pnpm test と pnpm run check:docs が通り、domain のカバレッジ 100% を保つ。
根拠: qa-r-ops-3、qa-v31、D-006、D-007（system-spec/00-requirements-definition.md の U4、system-spec/maintenance-ops.md）

## 未決事項

未決事項は無い。利用者は保留を残さないと決めている。上位概念は appr-foundation-008（qa-v03）で全文のまま確定し、等級名を編集できる役割・一覧の点数・対象の評価・既存の会社の等級名の扱いも qa-v02 で決めた。4つの設計判断も確定している。D-004（自前の所属の表と cookie）と D-005（Pointer Events で自作）は、利用者が選んだ（qa-v12・qa-v13）。D-006 は、利用者が選択肢を選ばず Other に①②③の組み合わせを求めたので、1つの表・役割のタブ・スマホのカードを併せる案にした（qa-v14）。D-007 は、利用者が①（route-ledger.json に操作と説明を足す）を名指しで選んで確定した（qa-v25、2026-10-13T03:40:15Z）。経緯として、利用者は 2026-10-12T23:30:32Z に案を選ばず、最もよい方法の選択を AI に任せた（qa-v15）。2026-10-13T00:00:51Z の中立な問い直しにも、同じ逐語で任せた（qa-v24、回答 2026-10-13T00:03:46Z）。AI は委任に基づいて別の案を選んだ。完成度の評価が、委任に基づく AI の選択は利用者が選んだ決定と同じ強さの記録ではないと指摘した。そこで3案を比べて中立に問い直し、利用者が①を選んだ。qa-v15・qa-v24 は qa-v25 で置き換えた。各章の設計は、利用者が文面を見て承認した。ui-ux（qa-v18）と frontend（qa-v22）は、第4版の全文のまま承認した（2026-10-13T00:03:46Z）。database・auth・security・infrastructure・backend・maintenance-ops は、AI が選んだ別の案を前提にした項目を①に直し、旧と新を逐語で示して承認を取り直した（qa-v26〜qa-v31、2026-10-13T03:48:20Z）。これで第4版の6章の承認（qa-v16・qa-v17・qa-v19〜qa-v21・qa-v23）を置き換えた。その前の qa-v04〜qa-v11 は、第4版の承認で置き換わっている。
根拠: qa-v02、qa-v03、qa-v12〜qa-v14・qa-v18・qa-v22・qa-v25〜qa-v31（system-spec/00-requirements-definition.md、system-spec/spec-state.json）、system-spec/ui-ux.md、system-spec/frontend.md、system-spec/maintenance-ops.md、system-spec/database.md、system-spec/auth.md、system-spec/security.md、system-spec/infrastructure.md、system-spec/backend.md


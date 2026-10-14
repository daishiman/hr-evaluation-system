---
graph_node_id: "arch-system-spec-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "認証と認可：セッションの鮮度、会社への所属、権限の1つの定義"
project_id: "hr-evaluation-system"
domain: "auth"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応"]
file_path: "architecture/system-spec-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "07b0352821bf986a91bebb4d27ada51f3761a86442d84423c95b7db4e9eebd67", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json"}
source_lineage: {"imported_at": "2026-10-13T05:04:21Z", "origin_kind": "system-spec-harness", "source_digest": "07b0352821bf986a91bebb4d27ada51f3761a86442d84423c95b7db4e9eebd67", "source_path": "system-spec/auth.md", "source_plugin": "system-spec-harness", "source_version": "0.1.21"}
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
classification_reason: "system-spec-harness が確定した章 system-spec/auth.md の取り込み"
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-auth.md", "confidence": 0.95}]
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

# Architecture overview

better-auth のメールアドレスとパスワードによるログイン（本人登録は閉じる）で、セッションは要求ごとに D1 から読んで cookieCache を入れず、ロールの変更や会社の利用停止を次の要求から効かせる。画面からの書き込みと控えの読み出しは、Server Functions の共通の入口 runAction・runRead が送り元のサイト・セッション・役割の順に確かめてから本体を呼ぶ。認可に失敗したら、書き込みも画面の作り直しも他タブへの通知も行わない。2026-10-12 の追加で、1つのアカウントが複数の会社に所属できるようにする。選んでいる会社は cookie（hr_company。httpOnly・Secure・SameSite=Lax）を全員に広げて持ち、getViewer はリクエストのたびに cookie が指す会社への有効な所属を確かめてから会社・役割・等級を作る（D-004）。役割ごとに開けるページ（accessClass）に加え、ページでできる主な操作・役割ごとの可否・説明も route-ledger.json の各ページに足し、権限の定義をこの台帳1つにまとめる（D-007）。サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の can〜 の判定・権限一覧の表示は、この台帳だけを読む。
根拠: qa-v27、qa-r-auth-3、qa-f03、D-004、D-007（system-spec/auth.md）

## Context and drivers

書き込み結果がすぐ見えない問題を Server Functions への移行で解く際、Server Function は外から直接呼べる公開の入口になるため、入口での検査と認可の鮮度を保つ必要がある。2026-10-12 の依頼で、複数の会社に所属するマネージャーを2社目に登録できないこと、等級名を編集できる人を限る必要、役割ごとにできることを確かめる手段が無いことが示された。優先する品質は、権限の取り消しがすぐ効くこと（G2）、共通の入口の適用漏れが検査で落ちること（G4）、等級名の変更権限の制限（G7）、表示と判定の一致（G8）、所属による会社の境界（G10）である。制約として better-auth と構成を変えず、役割の種類（SUPER_ADMIN・COMPANY_ADMIN・MANAGER・EMPLOYEE）を増やさない。
根拠: qa-r-auth-3、qa-v01、qa-v27、qa-f03（system-spec/auth.md、system-spec/00-requirements-definition.md）

## Goals and non-goals

Goals: 認可に失敗した要求では何も書かず、作り直さず、通知しない。ロールの変更や利用停止を次の要求で効かせる。等級名の変更を、システム全体管理者と自社の会社の管理者に画面とサーバー処理の両方で限る。route-ledger.json の権限の定義から一覧を描き、判定とのずれを0件にする。同じメールアドレスの人が1つのアカウントのまま会社ごとの役割・等級・上司で使え、所属していない会社は拒否する。Non-goals: cookieCache は入れない（入れる場合は鮮度の契約を見直す）。役割の種類を増やさない（『システム開発者』の役割は作らず、画面名を『Claude Code連携（システム開発者専用）』に変えるだけ）。等級名の変更権限を除く役割ごとの権限の中身を変えない。権限の定義を画面から編集できるようにはしない。外部のエージェント向け API（Bearer 鍵）と端末の承認の認可方式を変えない。
根拠: qa-r-auth-3、qa-v03、qa-v27、qa-v28、D-007（system-spec/auth.md、system-spec/00-requirements-definition.md の U7）、system-spec/security.md

## System context and boundaries

利用者は4つの役割のブラウザ（PC・スマホ・タブレット）で、外部の主体は Bearer 鍵で API を呼ぶエージェントと端末の承認である。信頼の境界は、Server Functions の入口（runAction・runRead）、外部向けの Route Handler（Bearer 鍵）、D1 に持つ better-auth のセッションで、一つの入口に二つの認可方式を混ぜない。データの境界は選んでいる会社の所属である。選んでいる会社の cookie は利用者が書き換えられる入力として扱い、そのまま信じず、リクエストのたびにサーバーで所属を確かめて決める（D-004）。会社の切り替えは、送り元のオリジンを確かめる Server Action で受ける。他タブへの通知は同じブラウザの同じオリジンにしか届かず、受け取ったタブはその時点のセッションで認可を受け直すので、通知が認可の代わりになる経路は無い。
根拠: qa-r-auth-3、qa-v27、qa-v28、D-004（system-spec/auth.md、system-spec/security.md）

## Container and component view

better-auth（メールとパスワード、セッションの有効期間7日・更新間隔1日、cookieCache なし）がセッションとアカウントを D1 に持つ。getViewer は cookie が指す会社への有効な所属を確かめてから会社・役割・等級を作り、cookie が無いときや所属していない会社を指すときは、有効な所属の createdAt 昇順（同時刻は id 昇順）の先頭を使う（D-004）。requireRole がページの入口で、apiViewer と ActionSpec.role が Server Functions の入口で役割を判定する。権限の定義として、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置く（D-007）。サイドバー（nav.ts。今も台帳を読んでいる）・requireRole・ActionSpec.role・session.ts の canEdit〜 などの判定をこの台帳から引き、台帳と突き合わせる契約テストで食い違いを落とす。権限一覧のページとモーダルの表とカードも、この台帳から描く。会社の切り替えの処理（switchCompanyScope）は全ての役割に開いて所属を確かめ、所属していない会社を拒否する。会社の切り替えの部品（CompanyScopeSwitcher）は、所属が2社以上の人にも出す。等級名を変える処理（saveMaster の等級の表と BehaviorBandAssignmentEditor から呼ぶ処理）が役割と会社を判定する。
根拠: qa-f03、qa-r-auth-3、qa-v27、qa-v30、D-004、D-007（system-spec/auth.md、system-spec/backend.md）

## Cross-cutting contracts

識別とアクセス: 入口は送り元の検査（Next.js の Origin と Host の一致と assertSameOrigin の二重）、セッション、役割の順に確かめる。他社や担当外の対象は区別せず 404、等級名の変更の権限違反は 403 にする。エラーと回復性: 認可の失敗では書き込み・作り直し・通知のどれも動かず、会社の利用停止や利用者の無効化は次の要求で拒否される。可観測性と監査: 等級名の変更・所属の追加と削除・本番の一律の書き換えを監査に残し、控えを開いた記録は値を含めず Workers Logs に残す。設定と秘密: セッションは要求ごとに D1 から読み、控えの鍵は Workers の secret（CREDENTIAL_ENC_KEY）だけに置く。選んでいる会社の cookie（hr_company）は httpOnly・Secure・SameSite=Lax で持つ。互換性: 所属が1つの人は今と同じ動きにし、システム全体管理者の全社からの会社の切り替えは残す。
根拠: qa-r-auth-3、qa-r-security-3、qa-f04、qa-v27、qa-v28（system-spec/auth.md、system-spec/security.md）

## Subtype architecture

Security: architecture-security.md を合成し、subtype_sections の security に記す。Frontend: N/A: 権限一覧の部品（表・役割のタブ・スマホのカード）・モーダル・説明の出し方は system-spec/frontend.md と system-spec/ui-ux.md の章で扱う。Backend: N/A: runAction の処理の順序と書き込みの型は system-spec/backend.md の章で扱い、本ノードはその中の認可の部分だけを扱う。Data: N/A: 所属の表の形と移行は system-spec/database.md の章（system-spec-database ノード）で扱う。Infrastructure: N/A: 鍵の置き方と配信は system-spec/infrastructure.md の章で扱う。
根拠: qa-v27、D-006（system-spec/auth.md）

### Security architecture

#### Assets, actors and threat model

守る資産は、セッションとアカウント、会社ごとの制度設定（等級名を含む）、各人の等級と確定済みの評価点、初期パスワードの控え、誰がどの会社に所属しているかという所属の情報である。主体は4つの役割の利用者と外部のエージェントで、悪用の例は、Server Function を外から直接呼ぶ・別のサイトから呼ばせる、選んでいる会社の cookie を書き換えて所属していない会社を読み書きする、マネージャーや他社の管理者が等級名を変える、一般の社員が他人の等級と点数を得る、他社に既にいる人を足すときにその人の所属を知る、である。信頼の境界は入口（runAction・runRead）・外部向けの Route Handler・セッションで、他タブへの通知は中身を持たず認可の代わりにならない。
根拠: qa-r-auth-3、qa-r-security-3、qa-v27、qa-v28、D-004（system-spec/auth.md、system-spec/security.md）

#### Identity and authorization

認証は better-auth のメールアドレスとパスワード（本人登録なし、セッション7日・更新1日、cookieCache なし）である。アカウントは1つで所属は複数持てるが、ログインとセッションはアカウントの単位のまま1つにし、会社ごとに資格情報を分けない。認可は入口で送り元・セッション・役割の順に確かめ、認可に失敗したら何もしない既定拒否で、権限の無い画面は 404 かログイン画面になる。テナントの境界は選んでいる会社の所属である。getViewer がリクエストのたびに cookie が指す会社への所属を確かめ、所属が無ければ有効な所属の createdAt 昇順（同時刻は id 昇順）の先頭を使う。会社の切り替えはセッションを作り直さず cookie だけを変え、所属していない会社への切り替えは拒否する（システム全体管理者は全社から選べる）。全ての読み書きをその所属で絞る（D-004）。等級名の変更はシステム全体管理者と自社の会社の管理者だけで、他社の等級を指す要求は拒否する。開けるページ（accessClass）とできる操作・役割ごとの可否・説明は route-ledger.json の各ページから引き、サイドバー・ページの入口・サーバー処理の役割の指定・session.ts の can〜 の判定・権限一覧がこの台帳だけを読む（D-007）。権限の定義を画面から編集できるようにはしない。
根拠: qa-f03、qa-r-auth-3、qa-v27、qa-v28、D-004、D-007（system-spec/auth.md、system-spec/security.md）

#### Data and secret protection

ログイン後の HTML と API の応答は private, no-store で共有のキャッシュに載せず、他タブへの通知と鮮度の手がかり（生成時刻）には個人情報や内部の ID を載せない。初期パスワードの控えは AES-GCM で暗号化して利用者 ID に結び付け、鍵は Workers の secret（CREDENTIAL_ENC_KEY）だけに置き、開けるのはシステム全体管理者と同じ会社の管理者で、14日を過ぎたら開けず次の発行で消す。既存アカウントへ新しい会社所属を足すのは全体管理者の専用処理だけで、新しいアカウントを作らず、パスワードと資格情報の控えを変更・発行しない。所属・必要な元所属の写し・監査を同じ batch で書く。会社管理者の新規登録は既存メールを汎用文面で拒否し、他社の所属先を知らせない（DD-009）。所属を消すときはその会社の所属だけを消し、他の所属が残る人のアカウントとセッションは消さず、最後の所属を消したら今の利用者の削除と同じに扱う。
根拠: qa-r-security-3、qa-v28（system-spec/security.md、system-spec/auth.md）

#### Application and supply-chain controls

Server Functions の入口は送り元の検査と認可の後に大きさの上限（413）と zod による入力の検証を行い、別のサイトからの呼び出しは Next.js の検査（allowedOrigins を足さない）と assertSameOrigin の二重で断る。画面から書き込みの fetch を直接呼ぶ箇所と入口を通らない Server Function を静的検査で落とし、例外（sendBeacon の利用記録・外観の選択の記録）は理由付きで列挙する。並べ替えは Pointer Events で自作して新しい依存を足さない（D-005）。権限の定義は route-ledger.json に足し、DB の表を足さない（D-007）。Next.js は脆弱性の修正を含む 16.3.8 へ上げる。外部への変更系通信は preview → CONFIRM → authorize → execute のガードを通し、PR は利用者の確認を取ってから作る。
根拠: qa-r-backend-4、qa-r-security-3、qa-r-infrastructure-3、qa-v29、D-005、D-007（system-spec/backend.md、system-spec/security.md、system-spec/infrastructure.md、system-spec/00-requirements-definition.md の U8）

#### Detection and response

監査として、等級名の変更・所属の追加と削除・本番の一律の書き換えを残して書き換え前の値を記録し、誰が誰の控えを開いたかを値を含めずに Workers Logs へ残す。会社の利用停止や利用者の無効化は次の要求で拒否されることで即時に効く。所属を外された会社は、cookie がその会社を指していても次のリクエストから使われない。他タブは通知か画面復帰で取り直した時点で権限の無い画面が 404 やログイン画面になる。ログアウトやログインし直しの後は、その時点のセッションで取り直す。脆弱性への対応として、今回は Next.js を修正を含む 16.3.8 へ上げる。
根拠: qa-r-auth-3、qa-r-security-3、qa-r-infrastructure-3、qa-v27、qa-v28（system-spec/auth.md、system-spec/security.md）

#### Security verification

server-actions-contract.test.ts（入口を通らない書き込みを0件に保つ）と action-origin.test.ts（送り元の二重の検査）を pnpm test で回す。追加の検査として、等級名を変えられる役割が限られていること、ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致すること（台帳と突き合わせる契約テスト）、権限一覧の表とカードが同じ内容を出すこと、一般の社員の応答に他人の等級と点数が無いこと、所属していない会社のデータが読めず指定した要求が拒否されることを確かめる。役割ごとの結合テストで、マネージャー・一般の社員・他社の会社の管理者による等級名の変更が画面とサーバー処理の両方で拒否されることを確かめる。
根拠: qa-r-ops-3、qa-v28、qa-v31、D-007、O7・O8・O10（system-spec/maintenance-ops.md、system-spec/auth.md）、system-spec/security.md

## Architecture decisions

D-002（採択 opt-server-functions）: 画面からの書き込みを Server Functions へすべて移し、成功したら同じ応答で画面を作り直す。代替の『Route Handler のまま画面側で router.refresh を呼ぶ』は変更が小さいが、利用者は Next.js が勧める即時更新の経路を選んだ。移行中に認可が抜ける危険は、入口（runAction・runRead）に検査の順序を固定して抑えた。セッション: cookieCache を入れると、ロールの変更や会社の利用停止が最大でキャッシュの期間だけ遅れて反映されるため、要求ごとに D1 から読む形を保つ。D-004（採択 opt-membership-cookie）: 利用者が選んだ（qa-v12）。今システム全体管理者だけが使う hr_company の cookie と会社の切り替えの部品を全員に広げ、所属は自前の表に持つ。代替の better-auth の organization plugin は既存の companies 表と二重になり、等級・上司を member の表の外に持ち、版上げへの追随が要る。URL に会社を入れる案は46画面のルートとリンクを全て移す。この案の危険は、cookie の会社への所属の確認を1か所でも漏らすと所属していない会社のデータが見えることで、getViewer がリクエストのたびに確かめる形で抑える。D-007（採択 opt-route-ledger-extend）: 利用者が①（route-ledger.json に操作と説明を足す）を名指しで選んだ（qa-v25、2026-10-13T03:40:15Z）。委任に基づいて AI が選んだ別の案とは違う案である。3案は権限の定義の正本の置き場所の択一で、全てに持つと正本が複数になる。①は、開けるページ（accessClass）に加え、主な操作・役割ごとの可否・説明も route-ledger.json の各ページに置き、権限の定義を台帳1つにまとめる。サイドバーと判定が同じ台帳を読むので、表示と判定のずれを既存の route-ledger のテストで見つけられる。DB の表で編集する②は、表と実際の判定のずれに気づけない（比べたときの不利な点）。①の不利な点は、説明を直すたびに仕様文書の変更になることである。役割の種類は増やさない。利用者は、D-007 ① に合わせて (4) を直した本章の文面を、旧と新を逐語で示されたうえで承認した（qa-v27、2026-10-13T03:48:20Z）。
根拠: D-002（qa-u18）、D-004（qa-v12）、D-007（qa-v25）、qa-r-auth-3、qa-v27（system-spec/auth.md、system-spec/spec-state.json）

## Delivery, migration and rollback

Server Functions への移行は今回すべて終えており、画面からしか呼ばれなくなった Route Handler は消して書き込みの経路を二重にしていない。所属の導入は、所属の表の追加と既存の利用者全員への所属の作成をマイグレーションで行う。getViewer を cookie で選んでいる会社への所属から作る形へ移し、users.company_id を読む約33か所と viewer.companyId を読む約140か所を所属の値へそろえる（D-004）。ルート台帳には権限一覧のページを足し（46画面から47画面）、全てのページに主な操作・役割ごとの可否・説明の欄を足す（D-007）。そのときは route-ledger.test.mjs・nav.test.ts・check:docs を合わせ、『Claude Code連携の鍵』の名前をルート台帳・README・docs・テストで改める。リリースは外部変更ガードを通した Deploy で行い、PR は実装後に利用者の確認を取ってから作る。
根拠: D-002、D-004、qa-r-backend-4、qa-v26、qa-v30、qa-v31（system-spec/auth.md、system-spec/backend.md、system-spec/maintenance-ops.md）、system-spec/database.md

## Risks and verification

リスクは、Server Function が外から直接呼べるため、入口を通らない書き込みが残ると認可が抜けることである。cookie の会社への所属の確認を1か所でも漏らすと、所属していない会社のデータが見える（D-004）。所属の値へのそろえ漏れでも、会社の境界が崩れる。サイドバー・ページの入口・サーバー処理の役割の指定・session.ts の判定のどれかが route-ledger.json の権限の定義と食い違うと、権限一覧の表示と実際の判定がずれる（D-007）。説明の小さな直しのたびに仕様の台帳が変わり、仕様の変更の記録が文言の直しで埋まるおそれもある。検査として、server-actions-contract.test.ts が入口を通らない書き込みを、action-origin.test.ts が送り元の二重の検査を固定し、pnpm test で違反0件を求める。追加分は、マネージャー・一般の社員・他社の会社の管理者による等級名の変更が画面とサーバー処理の両方で拒否されることを確かめる。ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致することを突き合わせる契約テストと、権限一覧の表とカードが同じ内容を出すことも確かめる。会社を切り替えると役割・等級・上司で画面と権限が変わり、所属していない会社が拒否されることを結合テストで確かめる。
根拠: qa-r-auth-3、qa-r-ops-3、qa-v31、D-004、D-007、O7・O8・O10（system-spec/auth.md、system-spec/maintenance-ops.md）


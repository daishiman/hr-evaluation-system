---
graph_node_id: "arch-system-spec-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "セキュリティ：鮮度の仕組みと追加要件で守ること"
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
evaluation_status: "stale"
confirmation_evidence: {"evaluated_digest": "c9654a902609f97d9131f60903dc12343178c810e665501f47c950a4733809fb", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-report.json"}
source_lineage: {"imported_at": "2026-10-15T00:07:42Z", "origin_kind": "system-spec-harness", "source_digest": "c9654a902609f97d9131f60903dc12343178c810e665501f47c950a4733809fb", "source_path": "system-spec/security.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
created_at: "2026-10-15T01:28:34.699201Z"
updated_at: "2026-10-15T08:18:18.870953Z"
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
classification_reason: "system-spec-harness が確定した章 system-spec/security.md の取り込み"
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-security.md", "confidence": 0.95}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-15T08:18:18.870953Z", "missing_sections": [], "status": "complete"}
---

# Architecture overview

この章は、鮮度の仕組みを入れても守るべきことと、2026-10-12 の追加要件で増える守りを受け持つ。既存の要件の柱は、他タブへの通知に中身を載せないこと、ログイン後の応答を private, no-store にすること、初期パスワードの控えを AES-GCM で暗号化して利用者 ID に結び付けること、別のサイトからの呼び出しを二重に断ることである。追加要件では、等級名の変更の可否をサーバー処理で判定し、等級と点数を見てよい人にだけサーバーで載せ、複数の会社に所属する人の読み書きを選んでいる会社の所属で絞る。選んでいる会社は cookie の値をそのまま信じず、リクエストのたびにサーバーで所属を確かめて決める（D-004）。権限一覧の表示は、実際の判定と同じ定義（route-ledger.json。D-007 ①）から作り、表示と判定の食い違いをテストで落とす。等級名の変更・所属の追加と削除・本番の一律の書き換えは監査に残す。この追加の全文は、D-007 ① に合わせて (6) を直したうえで、利用者が承認した（qa-v28、2026-10-13T03:48:20Z）。上流指針は OWASP ASVS と Secrets Management Cheat Sheet である。根拠: qa-v28, qa-r-security-3, qa-v12, qa-v25／system-spec/security.md

2026-10-14 の追加で、比べる警告のリンク先、ズレを読む処理の範囲、createForms の等級の確かめ方を定めた（G16）。この追加の全文は、利用者が全文のまま承認した（qa-w09、2026-10-14T20:46:24Z）。根拠: qa-w09／system-spec/security.md

## Context and drivers

鮮度の仕組みは他タブへの通知や応答の手がかりを足すので、会社をまたいだ漏れと秘密の露出を防ぐ条件が必要になった。連続作成で発行した控えを一覧から開き直したいという決定（qa-u19）から、控えを保存しつつ平文で持たない設計が求められた。2026-10-12 の依頼（qa-v01）、利用者の決定（qa-v02）、G6〜G15 の全文承認（qa-v03）で、等級名の編集権限、等級と点数の表示範囲、複数会社への所属が加わった。所属と選んでいる会社の持ち方は、利用者が自前の所属の表と cookie の案を選んだ（D-004、qa-v12）。権限の定義の置き場所は、3案を比べて中立に問い直し、利用者が route-ledger.json に操作と説明を足す案を選んだ（D-007 ①、qa-v25）。前提として next.config.ts は全応答に nosniff・X-Frame-Options DENY・HSTS・CSP（connect-src 'self' など）を付けている（qa-f04）。根拠: qa-v28, qa-r-security-3, qa-u19, qa-f04, qa-v12, qa-v25／system-spec/security.md

## Goals and non-goals

ゴールは G2（再読み込みで直前の書き込み結果を含む）、G3（他タブと画面復帰で古い一覧を残さない）、G7（等級名を変えられるのはシステム全体管理者と自社の会社管理者だけ）、G8（権限の表示と判定が食い違わない）、G9（等級と点数は見てよい人にだけ）、G10（同じメールアドレスで複数の会社に所属でき、所属していない会社のデータは見えない）である。非ゴールは、別の利用者の画面への即時配信、オフライン編集と同期、配色・テーマの変更、本番データの移行・修正（等級名の一律の書き換えを除く）、役割の種類の追加、権限の定義を画面から編集できるようにすることである。許可するオリジンを足すことと、CSP の connect-src を広げることはしない。根拠: qa-v28, qa-r-security-3, qa-u24, qa-v27／system-spec/security.md・system-spec/auth.md

## System context and boundaries

守る境界は会社で、他社や担当外の対象は区別せず 404 にする（route-ledger の notFound）。セッションは要求ごとに D1 から読み、cookieCache を入れないので、ロールの変更・会社の利用停止・利用者の無効化は次の要求で効く。他タブへの通知は同じブラウザの同じオリジンにしか届かず、別の利用者の画面へは届かない。外部のエージェント向け API（Bearer 鍵）と端末の承認は、今の Route Handler と認可のまま残す。複数の会社に所属する人は、選んでいる会社を cookie（hr_company。httpOnly・Secure・SameSite=Lax）で持つ。cookie の値と送られた会社の id はそのまま信じず、getViewer がリクエストのたびに cookie が指す会社への所属をサーバーで確かめて決める（D-004）。cookie が無いときや所属していない会社を指すときは、有効な所属のうち会社名の順（同名は会社 id の順。D-009）で最初の会社を使い、所属が1つの人は今と同じ動きにする。根拠: qa-v28, qa-r-security-3, qa-f04, qa-u25, qa-v12, qa-v27／system-spec/security.md・system-spec/auth.md

## Container and component view

入口は Server Functions の共通の包み runAction・runRead で、送り元の検査と認可（apiViewer）、大きさの上限（413）、入力の検証（zod）、本体、成功時だけの refresh の順に通す。送り元の検査は、Next.js の Server Functions の Origin と Host の一致の検査と、入口の中の assertSameOrigin の二枚で、後者は送り元が読めない・別のサイト（ポートだけ違う場合も含む）なら、ログインを確かめる前に断る。控えは initial_credential_memos の表に暗号化して置き、行に鍵の版を持たせ、鍵 CREDENTIAL_ENC_KEY は Workers の secret にだけ置く。権限の定義は、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、この台帳1つにまとめる（D-007 ①）。サイドバー（nav.ts）・ページの入口（requireRole）・サーバー処理の役割の指定（ActionSpec.role）・session.ts の can〜 の判定・権限一覧の表示は、この台帳だけを読み、台帳と突き合わせる契約テストで食い違いを落とす。権限の定義は DB の表に持たず、画面から編集できるようにはしない。会社の切り替え（switchCompanyScope）は全役割に開き、送り元のオリジンを確かめる Server Action で受けて、所属していない会社は拒否する。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v25, qa-v26, qa-v27, qa-v30／system-spec/security.md・system-spec/database.md・system-spec/auth.md・system-spec/backend.md

## Cross-cutting contracts

他タブへの通知には資源の種類（companies・users・forms など）と時刻だけを載せ、会社名・氏名・控えは載せず、受け手はサーバーから取り直し、認可は毎回サーバーが判定する。ログイン後の HTML と API は private, no-store で返して共有のキャッシュに載せず、将来サーバー側のキャッシュを入れるなら会社の ID と利用者のロールをキーに含める。応答に付ける鮮度の手がかり（生成時刻など）に個人情報や内部の ID を含めない。役割による表示の制限はサーバーがデータを作る段階で行い、一般の社員への応答に他人の等級と点数を含めない。根拠: qa-v28, qa-r-security-3／system-spec/security.md

## Subtype architecture

security の観点だけを持ち、内容は subtype_sections の security に置く。Frontend は N/A: 画面の部品と見え方は system-spec-frontend と system-spec-ui-ux が担い、この章は画面の表示だけに頼らずサーバーで判定する前提を決める。Data は N/A: 所属の表や控えの表の構成は database の章が担い、この章は守る条件だけを決める。根拠: qa-v28／system-spec/security.md

### Security architecture

#### Assets, actors and threat model

資産は、会社ごとの人事評価のデータ（等級・KPI評価点・等級要件の達成率を含む）、初期パスワードの控え、暗号化の鍵 CREDENTIAL_ENC_KEY、セッションである。行為者は4役割（システム全体管理者・会社の管理者・マネージャー・一般の社員）と、外部のエージェント、別のサイトである。主な脅威は、別のサイトからの書き込みの呼び出し、会社をまたいだ読み書き（送られた会社の id を偽る要求や、選んでいる会社の cookie を所属していない会社に書き換えた要求を含む）、共有のキャッシュや通知を経た漏れ、一般の社員による他人の等級と点数の閲覧、権限の無い役割や他社の会社管理者による等級名の変更、権限一覧の表示と実際の判定の食い違いである。根拠: qa-v28, qa-r-security-3, qa-v12／system-spec/security.md

#### Identity and authorization

セッションは要求ごとに D1 から読み、cookieCache を入れないので、利用停止や無効化は次の要求で効く。認可はサーバーが毎回判定し、他社や担当外は区別せず 404 にする。等級名の変更はシステム全体管理者と自社の会社管理者だけに許す。他の役割には画面に変更の欄を出さず、saveMaster の等級の表と行動指針の割り当てから呼ぶ処理でも 403 にし、他社の等級を指す要求はサーバー処理で拒否する。複数の会社に所属する人は選んでいる会社の所属で全ての読み書きを絞る。選んでいる会社は cookie（hr_company。httpOnly・Secure・SameSite=Lax）で持ち、getViewer がリクエストのたびに cookie が指す会社への所属をサーバーで確かめてから、その所属の会社・役割・等級を作る。cookie が無いときや所属していない会社を指すときは、有効な所属のうち会社名の順（同名は会社 id の順。D-009）で最初の会社を使う。会社の切り替え（switchCompanyScope）は全役割に開き、送り元のオリジンを確かめる Server Action で受け、所属していない会社は拒否する。システム全体管理者は今どおり全社から選べる。役割の種類は増やさない。既存アカウントに新しい会社の所属を足すのは全体管理者の専用処理だけ。会社管理者の新規登録は既存メールを汎用文面で拒否し、他社の所属先を知らせない。パスワードと控えは変更・発行せず、専用追加は所属・必要な写し・監査を同じ batch で書く（DD-009）。所属の削除はその会社の分だけで、他社の所属が残る人のアカウントとセッションは消さず、最後の所属なら今の利用者の削除と同じに扱う。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v12, qa-v27／system-spec/security.md・system-spec/auth.md

比べる警告のリンク先は、ルート台帳にあり、見る人の役割で開けるページに限る。createForms は役割の指定と送り元の確認を通し、自社のものでない gradeId が1件でもあれば、何も作らずに拒否する（今は他社の ID を黙って外し、残りだけ作る）。根拠: qa-w09／system-spec/security.md

#### Data and secret protection

控えは平文で保存せず、AES-GCM で暗号化して利用者 ID に結び付け（別の人の行へ写しても開けない）、行に鍵の版を持たせて鍵の入れ替えに備える。鍵はリポジトリにも DB にも置かず、Workers の secret にだけ置く。開けるのはシステム全体管理者と同じ会社の管理者だけで、開くたびにサーバーで認可し、本人がパスワードを変えたら消し、再発行したら置き換え、発行から14日を過ぎたら開けず一覧にも出さず、次の発行の batch で消す（CSV 取込で発行した分も同じ）。ログイン後の応答は private, no-store で共有のキャッシュに載せず、等級と点数は見てよい人への応答にだけ載せる。出典は cloudflare-workers-web-crypto である。根拠: qa-v28, qa-r-security-3／system-spec/security.md

ズレを読む処理は会社の範囲で絞り、他社の名前を含めない。他社の区分を指す URL は今どおり notFound にする。根拠: qa-w09／system-spec/security.md

#### Application and supply-chain controls

別のサイトからの呼び出しは、Next.js の Server Functions の検査（Origin と Host の一致、serverActions.allowedOrigins を足さない）と、runAction・runRead の中の assertSameOrigin の二重で断る。会社の切り替えも、送り元のオリジンを確かめる Server Action で受ける（D-004）。入口では大きさの上限（413）と zod による入力の検証を通す。全応答に nosniff・X-Frame-Options DENY・HSTS・CSP（connect-src 'self' など）が付き、BroadcastChannel は同じオリジンの中だけで動くので CSP を広げない（出典 mdn-broadcast-channel）。供給網の面では、Next.js を脆弱性の修正を含む 16.3.8 にし、Next.js 16 系・OpenNext・Workers・D1 の構成を変えない。並べ替えは Pointer Events で自作して新しい依存を足さないので、依存の更新と脆弱性の確認の対象も増えない（D-005）。根拠: qa-v28, qa-r-security-3, qa-f04, qa-u25, qa-v12, qa-v13, qa-v29／system-spec/security.md・system-spec/infrastructure.md

#### Detection and response

誰が誰の控えを開いたかを、値を含めずに Workers Logs へ残す。等級名の変更・所属の追加と削除・本番の一律の書き換えは監査に残し、書き換え前の値を記録する。等級名の変更と所属の追加・削除は、監査ジャーナルに変更前と変更後を残す。会社の追加の取り消しが失敗した記録（compensation_failed）とパスワード変更の続きが失敗した記録（rollforward_failed）は Workers Logs で見つけ、本番 DB を手で書き換えずに文書の手順で直す。反映されないという報告は、応答の生成時刻のヘッダー（x-generated-at）、Workers Logs、ゾーンのキャッシュ規則を読み取りだけで順に確かめて切り分ける（deploy-notes §7）。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v26／system-spec/security.md・system-spec/database.md

#### Security verification

送り元の二重の検査は action-origin.test.ts で固定し、入口を通らない書き込み（server-actions-contract.test.ts）と batch の外で2つ以上の表を書く関数（write-atomicity-contract.test.ts）とあわせて、pnpm test で違反0件を条件にする。O7 は等級名の変更を役割ごとに画面とサーバー処理の両方で拒否する結合テスト、O8 は route-ledger.json の権限の定義を、サイドバー（nav.ts）・ページの入口（requireRole）・サーバー処理の役割の指定（ActionSpec.role）・session.ts の can〜 の判定と突き合わせる契約テスト、O9 は一般の社員への応答に他人の等級・点数が含まれないことのテスト、O10 は2社目への追加と会社の切り替え、所属していない会社を指定した要求（会社の切り替えを含む）の拒否、所属していない会社のデータが読めないことのテストで確かめる。O2 はリリース後の本番で、作成直後の強制再読み込みと生成時刻のヘッダーを確かめ、ゾーンに HTML・/api を保存するキャッシュ規則が無いことを読み取りだけで確かめる（作成は利用者のふだんの操作で行い、エージェントは本番に書き込まない）。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v12, qa-v25, qa-v30, qa-v31／system-spec/security.md・system-spec/backend.md・system-spec/maintenance-ops.md

リンク先が台帳にあり見る人の役割で開けることを契約テストで、他社の等級を渡した createForms が何も作らずに拒否されることをテストで確かめる。根拠: qa-w09, qa-w10／system-spec/security.md・system-spec/maintenance-ops.md

## Architecture decisions

控えの持ち方は、平文で持たず利用者 ID に結び付けて AES-GCM で暗号化し、本人の変更・再発行・発行から14日のいちばん早い時点で終える案を利用者が選んだ（qa-u24、qa-u25）。別のサイトからの呼び出しは、Next.js の検査と入口の assertSameOrigin の二重の検査を続ける案を選び、serverActions.allowedOrigins は足さない。D-001 の BroadcastChannel は同じオリジンの中だけで動くので CSP を変えない。D-004（opt-membership-cookie）は利用者が選んだ案で、AI の推奨と同じである（qa-v12）。所属を自前の表に持ち、選んでいる会社を cookie（hr_company。httpOnly・Secure・SameSite=Lax）で持つ。cookie の会社への所属の確認を1か所でも漏らすと、所属していない会社のデータが見えるので、確認は getViewer でリクエストのたびに行う。D-007（opt-route-ledger-extend）は利用者が選んだ案で、AI が委任に基づいて選んだ別の案とは違う（qa-v25）。権限の定義を route-ledger.json 1つにまとめ、表示と判定を同じ定義から作る（qa-v27 (4)）。サイドバー・ページの入口の判定・サーバー処理の役割の指定はこの台帳から引き、台帳と突き合わせる契約テストで食い違いを落とす（qa-v30 (2)）。他社にアカウントがある人を足すときに足す側へ所属先を知らせないこと、パスワードを変えないこと、所属の削除の範囲は、この章の要件に書いた。D-007 ① に合わせて (6) を直したうえで、利用者が承認した（qa-v28、2026-10-13T03:48:20Z）。根拠: qa-v28, qa-r-security-3, qa-u24, qa-u25, qa-v12, qa-v25, qa-v27, qa-v30／system-spec/security.md・system-spec/auth.md・system-spec/backend.md

2026-10-14 の会社所属の現在の契約：既存アカウントへ別の会社の所属を足すのは全体管理者だけの専用操作（addMembership）とする（qa-w11、D-008）。選んでいる会社が無いとき（cookie が無い・所属していない会社を指す）は、有効な所属のうち会社名の順で最初の会社を開く（同名は会社 id の順。qa-w12、D-009）。委任（qa-v32）に基づく DD-009 の『最も古い有効な所属』は利用者の選択で取り消し、実装は 2026-10-15 に会社名の順へ直した（src/lib/memberships.ts の activeMembershipsByCompanyName。users の写しの基準は古い順のまま。DD-009 の更新）。どちらの順でも、リクエストのたびに所属をサーバーで確かめることは変わらない。根拠: qa-w11, qa-w12, qa-v27／system-spec/auth.md・system-spec/security.md・docs/product/design-decisions.md

## Delivery, migration and rollback

鍵 CREDENTIAL_ENC_KEY（32 バイトを base64 にしたもの）は、ローカルでは .dev.vars、本番では wrangler secret put で置き、手順を deploy-notes §6 に書く。本番への設定は外部への変更として確認を取ってから行い、本番 DB は読み取りだけで調べ、外部への変更系の通信は preview → CONFIRM → authorize → execute のガードを通す。等級名の本番での一律の書き換えは監査に残し、書き換え前の値を記録する。複数の表を書く書き込みが途中で失敗したときは、batch に入るものは batch、会社の追加は補償、パスワード変更の続きはやり直しで揃え、それも失敗したら Workers Logs に記録を残して手順で直す（D-003）。Next.js は脆弱性の修正を含む 16.3.8 にする。根拠: qa-v28, qa-r-security-3, qa-u24, qa-u25／system-spec/security.md

## Risks and verification

危険は、会社をまたいだ漏れ（キャッシュ・通知・所属の取り違え、選んでいる会社の cookie への所属の確認の漏れ）、秘密の露出（控えの値・鍵）、表示と判定の食い違い（サイドバー・ページの入口・サーバー処理の役割の指定のどれかが route-ledger.json の権限の定義と食い違うずれを含む）、画面だけで止めてサーバーで止めない権限の抜けである。O7 は役割ごとの結合テストで、マネージャー・一般の社員・他社の会社管理者による等級名の変更が画面とサーバー処理の両方で拒否されることを確かめる。O8 は route-ledger.json の権限の定義と、サイドバー・ページの入口・サーバー処理の役割の指定を突き合わせる契約テスト、O9 は一般の社員への応答に他人の等級・点数が含まれないことのテスト、O10 は2社目への追加と会社の切り替え、所属していない会社を指定した要求の拒否のテストで確かめる。送り元の二重の検査は action-origin.test.ts で固定し、O2 はリリース後の本番で作成直後の強制再読み込みと生成時刻ヘッダーを確かめる。根拠: qa-v28, qa-r-security-3, qa-u25, qa-v12, qa-v25, qa-v30／system-spec/security.md・system-spec/backend.md


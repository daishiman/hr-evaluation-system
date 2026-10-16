---
graph_node_id: "arch-system-spec-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "バックエンドの書き込み契約と業務ルール"
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
evaluation_status: "stale"
confirmation_evidence: {"evaluated_digest": "25bc9634c3fd9c782f00d0f8c4a63f879d6269db66ceaf16af56539416959179", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-report.json"}
source_lineage: {"imported_at": "2026-10-15T00:07:42Z", "origin_kind": "system-spec-harness", "source_digest": "25bc9634c3fd9c782f00d0f8c4a63f879d6269db66ceaf16af56539416959179", "source_path": "system-spec/backend.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
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
classification_reason: "system-spec-harness が確定した章 system-spec/backend.md の取り込み"
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-backend.md", "confidence": 0.95}]
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

Next.js 16 系（App Router）のサーバー側を OpenNext Cloudflare で Workers に載せ、D1 を drizzle で読み書きするバックエンドである。画面から呼ぶ書き込みは src/actions の Server Functions に集める。共通の入口 runAction が、送り元と認可・大きさ・入力の検証・本体・成功時の refresh を決まった順で行い、成功の表示と同じ応答で今の画面を作り直す（鮮度の契約）。複数の表を書く操作は D1 batch を第一とする。batch に入りきらない会社の追加だけを withCompensation で、取り消せない認証ライブラリの書き込みの続きを rollForward で守る。2026-10-12 の追加要件は、同じ入口と契約の上に足す。足すのは、等級の呼び名を作る共通の関数、権限の定義、所属から作る閲覧者（getViewer）、等級と確定済み最新評価の一覧、提出状況、設定不足の構造、並び順の全体保存、選択肢の値の一意である。権限の定義は、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、この台帳1つにまとめる（D-007 ①）。getViewer は cookie（hr_company）で選んでいる会社への所属から作る（D-004）。根拠: qa-v30（主）、qa-r-backend-4（旧主根拠）、qa-v25、D-004、D-007、system-spec/backend.md。

2026-10-14 の追加で、比べる警告の型 ComparisonGap と、ズレを読む処理を足す（G16・I17）。この追加の全文は、利用者が全文のまま承認した（qa-w08、2026-10-14T20:46:24Z）。根拠: qa-w08, qa-w01／system-spec/backend.md

## Context and drivers

出発点は二つある。一つは、会社追加などの成功表示の後も一覧が古く、強制再読み込みでも出ない報告である（qa-u01・qa-u03）。もう一つは、書き込み後の鮮度を保証する共通の仕組みが無く、会社追加が原子的でないというコード調査である（qa-f06・qa-u02）。2026-10-12 の依頼（qa-v01）と利用者の決定（qa-v02）で、課題が加わった。等級名への英語の区分名の混在、役割ごとの権限を確かめる手段の欠如、2社目に登録できない所属、提出状況と設定不足の分かりにくさ、並べ替えと選択肢の不具合である。所属の持ち方は D-004（opt-membership-cookie）で、権限の定義の置き場は D-007（opt-route-ledger-extend。route-ledger.json に操作と説明を足す）で決まった。どちらも利用者が選んだ（qa-v12・qa-v25）。品質の優先は、書き込み結果の即時の正しさ（G1・G2）、中途状態を残さない原子性（G5）、見てよい人にだけ返す認可（G7・G9・G10）、権限の表示と判定の一致（G8）、検査で守れる共通契約（G4）である。制約は三つある。Next.js 16 系（16.3.8 へ上げる）・OpenNext Cloudflare 1.20 系・Workers・D1・better-auth の構成を変えないこと。pointGroup を結合キーとして値を変えないこと。役割による制限を画面で隠すだけにせず、サーバーがデータを作る段階で行うことである（requirements_foundation の constraints）。根拠: qa-v30、qa-r-backend-4、qa-f06、qa-d01、qa-v12、qa-v25、D-004、D-007、system-spec/backend.md。

## Goals and non-goals

ゴールは backend 章の serves_goals のうち、鮮度と原子性の G1・G2・G4・G5 と、追加要件の G6〜G14 である。G6〜G14 は、等級名の統一と動的反映、等級名を編集できる役割の限定、役割ごとの権限の確認と表示と判定の一致、等級と確定済み最新評価の一覧、複数会社への所属、提出状況、設定不足の構造、並べ替え、選択肢である。受入は O1・O2・O4〜O14 の測り方で判定する。たとえば、共通の包みを通らない書き込みが静的検査で0件、等級名を変える結合テストで全ての表示が新しい名前になる、一般の社員への応答に他人の等級と点数が無い、などである。本章の U9 には I9（権限の定義・権限一覧ページ・『Claude Code連携（システム開発者専用）』への改名）が含まれる。改名は、役割の種類を増やさない名前の変更にとどめる。非ゴールは、別の利用者の画面への即時配信（WebSocket などの push）、オフライン編集、役割の種類の追加、等級名の編集権限以外の役割ごとの権限の中身の変更、等級名の一律の書き換え以外の本番データの移行である（scope.out）。根拠: qa-v30、qa-v03、system-spec/backend.md（To-Be / Delta）。

## System context and boundaries

利用者はシステム全体管理者・会社の管理者・マネージャー・一般の社員である。Web・モバイル・タブレットのブラウザから同じ書き込みの入口を使う（デスクトップのネイティブアプリは appr-platform-001・qa-u08 で対象外）。画面からの書き込みは Server Functions で受ける。外部のエージェントが Bearer 鍵と端末の承認で呼ぶ API・離脱時の利用記録（sendBeacon）・外観の選択の記録・認証・読むだけの検索と書き出しは Route Handler に残す。画面からしか呼ばれなくなった Route Handler は消し、書き込みの経路を二重にしない。信頼の境界は会社で、全ての読み書きを『選んでいる会社』の所属で絞る。選んでいる会社は cookie（hr_company。httpOnly・Secure・SameSite=Lax）で持ち、全員に広げる（D-004）。cookie の値はそのまま信じず、getViewer が要求のたびにサーバーで所属を確かめる。会社の切り替えの処理（switchCompanyScope）は全ての役割に開き、所属を確かめる。扱いは system-spec/security.md・auth.md と同じである。データの境界は D1 の1つのデータベースで、取り消し・やり直しまで失敗した事実は Workers Logs に残す。根拠: qa-r-backend-4 (1)(3)、qa-v30 (5)、D-004、qa-f02、system-spec/backend.md、system-spec/auth.md（qa-v27 (1)(2)）。

## Container and component view

共通の入口は runAction（書き込み）と runRead（控えを開くなど読むだけ。描き直さない）である。送り元の検査と認可（apiViewer）→ 大きさの上限（413）→ zod による入力の検証 → 本体 → 成功時だけ next/cache の refresh の順を持ち、結果を {ok, message} で返す。src/actions の Server Functions（19 ファイル）は業務の書き込みだけを書き、複数の表の守り方を D1 batch・withCompensation・rollForward の3つの型から選ぶ。追加要件で足す部品は次のとおり。等級の呼び名を作る共通の関数（区分名・行動指針のセット名・昇格の段階名・警告文・アンケートの既定のタイトル・評価の基準の見出しの唯一の作り手）。route-ledger.json の各ページに足す権限の定義（ページ名・主な操作・役割ごとの可否・説明。ページを開ける役割 accessClass と同じ台帳に置く。D-007 ①）。サイドバー（nav.ts）・requireRole・ActionSpec.role・session.ts の canEdit〜 は、この台帳から引く。cookie で選んでいる会社への所属から作る getViewer（D-004）と、全ての役割に開く会社の切り替えの処理（switchCompanyScope）。提出状況を返す処理。設定不足を構造で返す作り手群（setup-readiness・scheme-steps・評価期間とアンケートの作成の 409・form-sync・評価期間の古さの通知）。並び順の全体を受ける保存処理。データの持ち主は D1（drizzle の schema）で、権限の定義は DB の表に持たず route-ledger.json に置く。配る単位は OpenNext でビルドした1つの Worker である。根拠: qa-r-backend-4 (2)(3)、qa-v30 (1)〜(9)、qa-v25、D-004、D-007、system-spec/backend.md、system-spec/database.md（qa-v26 (9)）。

## Cross-cutting contracts

認可は画面の表示だけでなくサーバー処理で判定する。等級名を変える処理（saveMaster の等級の表と BehaviorBandAssignmentEditor から呼ぶ処理）は、システム全体管理者か自社の会社の管理者だけを通す（qa-v02 問1）。等級と点数は、見てよくない役割からの呼び出しでは値そのものを作らない。権限は、ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、台帳を1つにする（D-007 ①）。サイドバー（nav.ts。今も台帳を読んでいる）・ページの入口の判定（requireRole）・サーバー処理の役割の指定（ActionSpec.role）・session.ts の canEdit〜 などの判定は、この台帳から引く。権限一覧の表示も同じ台帳から作る。台帳と突き合わせる契約テストで食い違いを落とし、権限一覧の表示と実際の判定を食い違わせない。誤りと回復は次の3つで揃える。例外ではなく {ok, message} の値で返す。並べ替えで送られた id の集まりが今と違えば 409 で取り直しを求める。compensation_failed・rollforward_failed を、個人情報を除いた構造化ログとして Workers Logs に残す。互換は、pointGroup を結合キーとして値を変えず表示に使わないこと、今の向き（先頭へ・上へ・下へ・末尾へ）で並べ替える形も全体を送る形と同じ結果になるよう残すことで守る。根拠: qa-v30 (1)(2)(3)(4)(8)、qa-r-backend-4 (2)(3)、qa-v25、D-007、system-spec/backend.md、system-spec/auth.md（qa-v27 (4)）、system-spec/security.md（qa-v28 (6)）。

## Subtype architecture

Backend: 本ノードの subtype_sections.backend（architecture-backend.md の7節）に記す。Frontend: N/A。画面の共通口・他タブへの通知・並べ替えの部品（D-005）・権限一覧のページと利用者一覧のモーダル（D-006 の表・タブ・カード）は system-spec/frontend.md と system-spec/ui-ux.md の担当。Infrastructure: N/A。配信・キャッシュ・マイグレーションの流し方と戻し方は system-spec/infrastructure.md の担当。Data: N/A。所属の表の列、既定の等級名、等級名を含む表示名を保存しない扱い、権限の定義を DB の表に持たず route-ledger.json に置く扱い、監査ジャーナルは system-spec/database.md の担当。Security: N/A。認可と所属の境界の規範は system-spec/security.md と system-spec/auth.md が持つ。本章はその判定を置く場所（入口・getViewer・等級名を変える処理・一覧の値を作る処理）を決める。根拠: matrix.backend.web（qa_ref は qa-v30）、system-spec/backend.md。

### Backend architecture

#### Runtime and architecture pattern

実行環境は Next.js 16 系（16.3.8 へ上げる）の App Router を OpenNext Cloudflare 1.20 系で Cloudflare Workers に載せ、D1 を drizzle で、認証を better-auth で扱う。型は Clean Architecture の依存の向きに沿った『共通の入口＋薄い業務関数』である。書き込みの順序を各関数に書かず runAction に集め、各関数は業務の書き込みと複数の表の守り方の型の選択だけを持つ。Server Function の中で呼ぶ refresh は今の画面の描画を同じ応答に載せるので、成功の知らせと一覧の更新が一度の往復でそろう。退けた案は、Route Handler のまま画面側で router.refresh を呼ぶ形（opt-route-refresh）である。Route Handler の revalidatePath は印を付けるだけで表示中の画面を変えず、入口で鮮度を保証できない（qa-d01）。追加要件でも同じ向きを保つ。等級の呼び名と設定不足の構造をそれぞれ一つの関数に、権限の定義を route-ledger.json に置き、画面やサーバー処理はそこを呼ぶだけにする（qa-v30 (1)(2)(7)、D-007 ①）。根拠: qa-r-backend-4 (2)、qa-d01、qa-v30、D-002、D-007、system-spec/backend.md（上流指針・適用された設計知識）。

#### Domain and module boundaries

中核の領域は会社・利用者・制度設定（等級以下）・評価期間・アンケートと回答・評価・改善要望で、会社をまたぐ参照を作らないことが不変条件である（qa-f02）。追加要件で境界を3つ足す。1つ目は等級の呼び名の作り手で、唯一の共通の関数である。pointGroup は結合キーとして内側に閉じ、値を変えず、表示に使わない。2つ目は権限の定義である。ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、台帳を1つにする（D-007 ①）。nav.ts・requireRole・ActionSpec.role・session.ts の canEdit〜 は、この台帳から引く側である。3つ目は所属で、getViewer が cookie で選んでいる会社への所属から会社・役割・等級を作る（D-004）。viewer.companyId の読み手は、所属の値をそのまま使う。依存の向きは内向きである。書き込みの順序は入口に、表の構成や chunk の分け方は永続化層に閉じ、業務関数が知るのは操作の成否だけにする（上流指針 data-access）。設定不足の直す画面の道筋は既存の道筋の関数（schemeStepPath など）から作り、文に pointGroup を出さず等級名を使う。根拠: qa-v30 (1)(2)(5)(7)、qa-v25、D-004、D-007、qa-f02、system-spec/backend.md。

ComparisonGap 型は、比べている2つのページの名前と href、項目ごとの有無を必須に持つ。formSyncGaps はこの型で返す形に改める。ページ名はルート台帳の親の画面名と見出しをつないで作り（pointGroupLabel＋stepTitle("select")、formRowTitle）、リンクは schemeStepPath とアンケートの道筋で作る。根拠: qa-w08／system-spec/backend.md

#### API and service contracts

画面からの書き込みは Server Functions で受ける。外部のエージェント向けの API（Bearer 鍵・端末の承認）・利用記録・外観の選択・認証・読むだけの検索と書き出しは Route Handler で受ける。要求の流れは、送り元の検査と認可（apiViewer。Next.js の Origin 検査に加え、入口の assertSameOrigin でも確かめる二重の検査）→ 大きさの上限（413）→ zod による入力の検証 → 本体 → 成功したときだけ refresh である。結果を {ok, message} で返すので、本番で例外の中身が隠れても画面に理由を出せる。誤りの約束は三つある。認可されない等級名の変更の拒否。並べ替えで id の集まりが今と違うときの 409（取り直しを求める）。評価期間とアンケートの作成で設定が足りないときの 409 である。設定不足は『何が足りない・どう直す・直す画面の道筋と名前』の構造で返す。並べ替えは並び順の全体（id の並び）を受ける形を足し、ドラッグとキーボードの結果を1回で送る。今の向き（先頭へ・上へ・下へ・末尾へ）の形も、同じ結果になるよう残す。会社の切り替えの処理（switchCompanyScope）は全ての役割に開き、送り元のオリジンを確かめる Server Action で受け、所属していない会社は拒否する。提出状況は対象者ごとの状態（提出済み・入力途中・未回答）と提出日時を返し、アンケートの一覧には状態ごとの人数を返す。根拠: qa-r-backend-4 (1)(2)、qa-u24 問4、qa-v30 (3)(5)(6)(7)(8)、system-spec/backend.md、system-spec/auth.md（qa-v27 (2)）、system-spec/security.md（qa-v28 (3)）。

アンケート1本ぶんのズレを読む処理を足す。使うKPIを選ぶの画面のために、その区分の等級に当たり、受付前か受付中の評価期間にある、下書きか公開中のアンケートのズレを、会社の範囲で一度に読む処理を足す（同じ評価期間・等級にこれより新しい下書きがあるかも返す）。新しい版は既存の createForms に gradeIds を1件渡して作り、新しい書き込みの処理は足さない。根拠: qa-w08／system-spec/backend.md

#### Data and transaction behavior

一つの操作で複数の表を書くときは3つの型に限る。1回の D1 batch に入るものは batch で書く（全部書けるか、何も書かれないか）。batch に入りきらない会社の追加だけ、段階ごとの書く処理と取り消す処理の組を逆順に戻す withCompensation で書く。取り消せない認証ライブラリの書き込み（パスワード変更）の続きは1回の batch にし、失敗したら1回だけやり直す rollForward で書く。新しく足す書き込みもまず batch に入るかを確かめ、batch の外で2つ以上の表を書く関数は write-atomicity-contract.test.ts で落とす。一覧の等級と点数は、確定した最新の評価（KPI評価点・等級要件の達成率・評価期間）を一覧ぶんまとめて1回の問い合わせで取り、人数に比例して問い合わせを増やさない。写しの列を作らず評価の確定済みの最新から読む扱いと、等級名を含む表示名を保存せず表示のたびに作る扱いは、system-spec/database.md の qa-v26 と同じである。権限の定義は DB の表に持たず、編集画面も作らない。route-ledger.json に置く（qa-v26 (9)、D-007 ①）。アンケートの選択肢の値は、今は数で振るため消した後に足すと重なる。重ならない振り方に改め、保存のときも重複を拒否する。サーバー側のキャッシュは持たない（force-dynamic）。将来入れるときの無効化（revalidatePath・revalidateTag）の置き場は入口に持つ。根拠: qa-r-backend-4 (2)(3)、qa-v30 (4)(9)、qa-v26、D-003、D-007、system-spec/backend.md、system-spec/database.md。

ズレを読む処理は読み取りだけで、書き込みは既存の createForms（1等級ぶん）に限る。根拠: qa-w08／system-spec/backend.md

#### Async processing

この章にキュー・イベント・定期実行の生産者と消費者の契約は無く、書き込みは要求の中で同期に完了させ、成功した応答に新しい画面を載せる。再試行は rollForward の1回だけのやり直しに限り、それでも失敗したら rollforward_failed を、会社の追加の取り消しまで失敗したら compensation_failed を Workers Logs に残し、画面には結果と管理者への連絡を出して手作業の手順で直す。他のタブへの通知（BroadcastChannel）とタブ復帰・bfcache 復元時の取り直しは画面側の担当（system-spec/frontend.md、D-001）で、別の利用者の画面への即時配信は範囲外である。根拠: qa-r-backend-4 (3)、D-001、scope.out、system-spec/backend.md。

#### Security and resilience

認証と認可は入口で毎回行う。送り元のサイト・今のセッション・役割を確かめてから本体を呼び、認可に失敗した要求では書き込みも画面の作り直しも行わない。等級名を変える処理は、システム全体管理者か自社の会社の管理者かをサーバーで判定し、マネージャー・一般の社員・他社の会社の管理者を拒否する。等級と確定した最新の評価は、見てよくない役割からの呼び出しでは値を作らない。全ての読み書きを、選んでいる会社の所属で絞る。選んでいる会社の cookie（hr_company）の値はそのまま信じず、getViewer が要求のたびにサーバーで所属を確かめる（D-004）。会社の切り替えは送り元のオリジンを確かめる Server Action で受け、所属していない会社は拒否する。権限一覧の表示は実際の判定と同じ定義（route-ledger.json）から作り、表示と判定の食い違いをテストで落とす。権限の定義は、画面から編集できるようにしない（D-007 ①）。入力は大きさの上限（413）と zod で検証し、選択肢の値の重複は保存のときに拒否する。再試行は rollForward の1回だけで、並べ替えの競合は自動でやり直さず 409 で取り直しを求める。根拠: qa-r-backend-4 (2)(3)、qa-v30 (2)(3)(4)(5)(8)(9)、qa-u24 問4、D-004、D-007、system-spec/backend.md、system-spec/auth.md（qa-v27 (1)(2)）、system-spec/security.md（qa-v28 (3)(6)）。

#### Operations and verification

記録は Workers Logs に残す。取り消し・やり直しまで失敗した事実を、compensation_failed・rollforward_failed として個人情報を除いた構造化ログで残す。静的・契約の検査は三つある。server-actions-contract.test.ts（入口を通らない書き込みを0件。例外の sendBeacon と外観の選択の記録は理由付きで列挙）。write-atomicity-contract.test.ts（batch の外で2つ以上の表を書く関数を0件）。action-origin.test.ts（送り元の二重の検査）。結合テストは、会社の追加の途中の段階と取り消しの失敗、パスワード変更の後片付けの2回の失敗、CSV 取込と評価の集計の batch の途中の失敗を確かめる。追加要件は次を確かめる。等級名の変更の反映（O6）。役割ごとの拒否（O7）。route-ledger.json の権限の定義と、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の canEdit〜 の突き合わせと、権限一覧ページと利用者一覧のモーダルが同じ定義から描かれること（O8）。確定直後の点数の更新と一般の社員の応答（O9）。2社目への所属と会社の切り替え、所属していない会社の拒否（O10）。対象者全員の提出状況（O11）。設定不足の道筋の欠落0件（O12）。全体の保存と 409（O13）。選択肢の値の重複の拒否（O14）。根拠: qa-r-backend-4 (3)(4)、qa-r-ops-3 (1)、qa-v30、D-007、system-spec/backend.md（受入条件）。

ComparisonGap の全件が2つのページを持つこと、新しい版はその等級の版だけが増えることをテストで確かめる。根拠: qa-w08, qa-w10／system-spec/backend.md・system-spec/maintenance-ops.md

## Architecture decisions

D-002（採択 opt-server-functions）：画面からの書き込みを今回すべて Server Functions へ移し、成功したら同じ応答で表示中の画面を作り直す。AI の推奨だった opt-route-refresh（Route Handler のまま画面側で router.refresh を呼ぶ）は採らなかった。Route Handler から呼ぶ revalidatePath は印を付けるだけで表示中の画面を変えず（qa-d01）、入口で鮮度を保証できないからである。利用者は移行の規模を承知で全面移行を選んだ（qa-u18）。D-003（採択 opt-batch-first）：batch に入るものは batch、入りきらない会社の追加は補償、戻せない書き込みの続きはやり直しとする。全部を1回の batch（opt-d1-batch）や全部を補償（opt-compensation）にする案より、実装の実態と原子性の両立を取った（qa-u23・qa-u24）。代わりに会社の追加は取り消しまで失敗したときだけ中途状態が残り得るので、記録と手順で直す。D-004（採択 opt-membership-cookie）：自前の所属の表を作り、選んでいる会社を cookie（hr_company）で持つ。利用者が選んだ（qa-v12）。cookie の会社への所属の確認を1か所でも漏らすと所属外の会社のデータが見えるので、getViewer で要求のたびに確かめる。D-005（opt-pointer-hook）と D-006（opt-combined）も利用者が選んだ。どちらも画面側の決定で、本章は並び順の全体を1回で受ける保存と、権限の定義でこれを支える。D-007（採択 opt-route-ledger-extend）：ページを開ける役割（accessClass）・ページ名・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、台帳を1つにする。利用者が3案の比較を見たうえで、推奨の印の無い問で名指しで選んだ（qa-v25、2026-10-13T03:40:15Z）。利用者は先にこの選択を AI に任せ、AI は別の案を選んでいた。委任による AI の選択は利用者が選んだ決定と同じ強さの記録ではない、と完成度の評価が指摘したので、中立に問い直した。この案では、サイドバーと判定が同じ台帳を読むので、表示と判定のずれを route-ledger のテストで見つけられ、G8 を満たせる。代わりに、説明の文言を直すたびに仕様の台帳が変わる。一覧の値を一覧ぶん1回の問い合わせで取ること、並び順の全体を受ける形と 409、選択肢の値の振り方は qa-v30 の文面にある。本章の要件は、2026-10-13T00:03:46Z に全文で承認された文面のうち、AI が選んだ別の案を前提にした項目 (2) だけを①に直し、旧と新を逐語で示して承認を取り直したものである（qa-v30、2026-10-13T03:48:20Z）。根拠: qa-u18、qa-u23、qa-u24、qa-d01、qa-v12、qa-v25、qa-v30、D-007、system-spec/backend.md（本章に効く確定意思決定）。

2026-10-14 の会社所属の現在の契約：既存アカウントへ別の会社の所属を足すのは全体管理者だけの専用操作（addMembership）とする（qa-w11、D-008）。選んでいる会社が無いとき（cookie が無い・所属していない会社を指す）は、有効な所属のうち会社名の順で最初の会社を開く（同名は会社 id の順。qa-w12、D-009）。委任（qa-v32）に基づく DD-009 の『最も古い有効な所属』は利用者の選択で取り消し、実装は 2026-10-15 に会社名の順へ直した（src/lib/memberships.ts の activeMembershipsByCompanyName。users の写しの基準は古い順のまま。DD-009 の更新）。どちらの順でも、リクエストのたびに所属をサーバーで確かめることは変わらない。根拠: qa-w11, qa-w12, qa-v27／system-spec/auth.md・system-spec/security.md・docs/product/design-decisions.md

## Delivery, migration and rollback

配る形は今の OpenNext の Worker のままである。足す書き込みは全て共通の包み（I1）を通し、成功の表示と同じ描画で一覧が新しくなる契約を守る（qa-v30 (10)）。所属への移行では、次を行う。getViewer を、cookie（hr_company）で選んでいる会社への所属から作る形に改める（D-004）。利用者の作成・メンバーの追加・会社の追加・CSV の取り込みの重複の検査は、システム全体でメールアドレスの重複を拒否する今の形を保ち、他社に既にアカウントがある人への所属の追加は全体管理者だけの addMembership で行う（D-008）。会社の切り替えの処理（switchCompanyScope）を全ての役割に開く。users.company_id を読む約33か所と viewer.companyId を読む約140か所を、所属の値にそろえる。所属の表の追加と移し替え、等級名の一律の書き換えは D1 のマイグレーション（drizzle/migrations の 0033 以降）で行う。流し方と戻し方は system-spec/infrastructure.md（qa-v29）に従う。Deploy の後の読み取りで英語の区分名が残っているなど受入が崩れたときは、書き換え前の値の記録から戻す手順を使う（qa-v29 (2)・qa-v31 (4)）。根拠: qa-v30 (5)(10)、qa-v29、qa-v31 (4)、D-004、system-spec/backend.md、system-spec/infrastructure.md、system-spec/maintenance-ops.md。

## Risks and verification

前提として、本章の要件は利用者の承認を得た文面である（qa-v30、2026-10-13T03:48:20Z）。2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (2) だけを①に直し、旧と新を逐語で示して承認を取り直した。D-004 と D-007 は、どちらも利用者が選んだ（qa-v12・qa-v25）。危険の一つは所属への移行である。約33か所と約140か所をそろえる広い変更で、cookie の会社への所属の確認を1か所でも漏らすと、所属していない会社のデータが見える（D-004 のリスク）。これは、所属していない会社を指定した要求が拒否されるテスト（O10）と、一般の社員への応答に他人の等級・点数が無いテスト（O9）で確かめる。もう一つは、サイドバー・ページの入口の判定・サーバー処理の役割の指定・session.ts の canEdit〜 のどれかが台帳と食い違い、権限一覧の表示と実際の判定がずれることである。route-ledger.json の権限の定義とこれらの判定を突き合わせる契約テスト（O8）で落とす。鮮度と原子性は、server-actions-contract.test.ts（入口を通らない書き込みを0件）と write-atomicity-contract.test.ts（batch の外で2つ以上の表を書く関数を0件）で確かめる。会社の追加は途中の段階と取り消しを失敗させる結合テストで、パスワード変更は後片付けを2回とも失敗させる試験で確かめる。追加要件は、等級名を変える結合テスト（O6）、役割ごとの等級名の変更の拒否（O7）、権限一覧ページと利用者一覧のモーダルが同じ定義から描かれること（O8）、設定不足の全件が直す画面への道筋を持つ契約テスト（O12）、全体の保存と 409（O13）、選択肢の値の重複の拒否（O14）で確かめる。根拠: qa-v30、qa-v12、qa-v25、D-004、D-007、qa-r-backend-4 (3)(4)、system-spec/backend.md（受入条件）。


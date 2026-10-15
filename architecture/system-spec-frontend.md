---
graph_node_id: "arch-system-spec-frontend"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "フロントエンド：鮮度の共通口と追加要件の共通部品"
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
confirmation_evidence: {"evaluated_digest": "452898d9797aebcf4c071252d8ea792a6dad3fba40265a652f907d282d83d6f8", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-report.json"}
source_lineage: {"imported_at": "2026-10-15T00:07:42Z", "origin_kind": "system-spec-harness", "source_digest": "452898d9797aebcf4c071252d8ea792a6dad3fba40265a652f907d282d83d6f8", "source_path": "system-spec/frontend.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
created_at: "2026-10-15T01:28:34.699201Z"
updated_at: "2026-10-15T01:28:34.699201Z"
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
classification_reason: "system-spec-harness が確定した章 system-spec/frontend.md の取り込み"
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-frontend.md", "confidence": 0.95}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "manual", "reconciled_at": null, "source": null, "status": "not_applicable"}
implementation_readiness: {"checked_at": "2026-10-15T01:28:34.699201Z", "missing_sections": [], "status": "complete"}
---

# Architecture overview

この章は、画面側の部品と実装の構造を受け持つ。書き込みは useSaveAction から Server Functions を呼び、応答に載った新しい描画で成功の知らせと一覧・件数・会社切替メニュー（layout）を同じ描画で更新し、createCommitGate で新しい描画が終わってから成功を返す。他タブと画面復帰は、画面の骨格に1回だけ置いた FreshnessSync が受け持つ。2026-10-12 の追加では、等級名をサーバーから受け取って出す部品、並べ替えの共通の部品（D-005）、権限一覧の部品（表・役割のタブ・スマホのカード・説明の吹き出し。D-006）、設定不足の共通の部品、アンケートの回答と見本の部品、端末ごとの状態の置き場、画面ごとの段組みを足す。この追加の全文は、利用者が全文のまま承認した（qa-v22、2026-10-13T00:03:46Z）。根拠: qa-v22, qa-r-frontend-3, qa-v13, qa-v14／system-spec/frontend.md

2026-10-14 の追加で、比べる警告の部品（ComparisonGapNotice）を1つ作り、アンケートの一覧・アンケート1本・使うKPIを選ぶの3画面はこれだけを使う（G16・I17）。この追加の全文は、利用者が全文のまま承認した（qa-w07、2026-10-14T20:46:24Z）。根拠: qa-w07, qa-w01, qa-w03／system-spec/frontend.md

## Context and drivers

以前は useRefreshAfterSave（34ファイルが使う）が router.refresh を呼ぶ唯一の入口で、呼んだタブだけが作り直され、連続作成フォームは控えを出している間 refresh を遅らせていたため、追加直後の一覧が古かった（qa-f05）。この観測と D-001・D-002 の採択が、鮮度の共通口を作る駆動要因になった。追加要件は 2026-10-12 の依頼（qa-v01）、利用者の決定（qa-v02）、G6〜G15 の全文承認（qa-v03）から来る。並べ替えは、利用者が Pointer Events で自作する案を選んだ（D-005、qa-v13）。権限一覧は、利用者が表・タブ・カードの組み合わせを求めた（D-006、qa-v14）。権限の定義の置き場所は、3案を比べて中立に問い直し、利用者が route-ledger.json に操作と説明を足す案を選んだ（D-007 ①、qa-v25）。上流指針は Apple HIG（操作の結果をすぐ、はっきり示す）と Clean Architecture（方針を詳細から切り離す）である。根拠: qa-v22, qa-r-frontend-3, qa-f05, qa-v13, qa-v14, qa-v25／system-spec/frontend.md

## Goals and non-goals

ゴールは G1（同じタブ）、G3（他タブと画面復帰）、G4（鮮度の保証を共通の契約にし、適用漏れを検査で落とす）、G6（等級名）、G8（権限の表示と判定が食い違わない）、G12（設定不足）、G13（並べ替え）、G14（選択肢）、G15（余白）である。非ゴールは、別の利用者の画面への即時配信、オフライン編集と同期、配色・テーマの変更である。globals.css の配色・テーマの宣言とテーマの契約テストは変えず（AGENTS.md）、page.tsx の main に max-w を書かない決まりも守る。並べ替えのために新しい依存は足さない。根拠: qa-v22, qa-r-frontend-3, qa-u24／system-spec/frontend.md

## System context and boundaries

画面側は Server Functions の共通の入口（runAction・runRead）を呼ぶ側で、認可や入力の検証は持たない。外部のエージェントが呼ぶ API（Bearer 鍵・端末の承認）、離脱時の利用記録（sendBeacon）、外観の選択の記録、認証、読むだけの検索・書き出しは Route Handler のまま残る。他タブとの連携は同じブラウザの同じオリジンの中だけで、別の利用者には届けない。対象はスマホ・タブレット・PC のブラウザで、route-ledger の 46 画面の page.tsx（権限一覧のページを足して 47 画面になる）を4役割と4幅で検証する。根拠: qa-v22, qa-r-frontend-3, qa-u25, qa-f01, qa-v31／system-spec/frontend.md・system-spec/maintenance-ops.md

## Container and component view

鮮度の部品は、書き込みを呼ぶ useSaveAction、成功を新しい描画の後まで待たせる createCommitGate、他タブと画面復帰を受ける FreshnessSync、連続作成フォームの RecordForm（generate 経路）からなる。追加の共通部品は、等級名をサーバーから受け取って出す表示、並べ替えの部品（Pointer Events による長押しと押したままのドラッグ・矢印のボタン・キーボード・aria-live での読み上げ。D-005）、権限一覧の部品（表・役割のタブ・スマホのカード・説明の吹き出し。D-006）、設定不足の部品（何が・どう直す・リンク）である。権限一覧の部品はページとモーダルで共用し、表は table 要素、タブは APG の tabs の形、モーダルは dialog 要素で作る。説明は aria-describedby で結び、フォーカスとタップでも出す。表とカードは画面の幅で切り替え、どちらも同じデータから描く。等級要件・昇格の条件と要件・アンケートの設問と選択肢の編集は並べ替えの部品へ寄せ、設定不足を出している ReasonNote は新しい部品へ置き換え、他の用途の ReasonNote は残す。アンケートの回答の部品は設問名の label を入力の要素へ結んで選択肢を label の全面で押せるようにし、見本の部品は試しに選べる状態を持ち送信の操作を出さない。根拠: qa-v22, qa-r-frontend-3, qa-v13, qa-v14／system-spec/frontend.md

ComparisonGapNotice は、閉じた1行（件数）と、開いた中のリンク2行・表・ボタンを1つの部品に収める。開閉は既存の InlineDetail で作り、画面ごとに <details> を書かない。ボタンは ActionButton を使う。SetupGapList（公開前の不足など）は今の形のまま残す。根拠: qa-w07／system-spec/frontend.md

## Cross-cutting contracts

画面から書き込みの fetch（POST・PUT・PATCH・DELETE）を直接呼ばず、全て useSaveAction と Server Functions を通す。これを server-actions-contract.test.ts が静的に検査し、例外（利用記録の sendBeacon・外観の選択の記録）は検査の中に理由付きで列挙する。クライアントの部品は英語の区分名を持たず、等級名はサーバーから受け取る。端末ごとに覚える状態（開閉など）は localStorage に置き、読めないときも既定の状態で動く。読み取り専用の .chip はポインターの形とホバーの変化を出さない。根拠: qa-v22, qa-r-frontend-3／system-spec/frontend.md

## Subtype architecture

frontend の観点だけを持ち、内容は subtype_sections の frontend に置く。利用者に見える文言と情報の優先度は system-spec-ui-ux が担う。Backend は N/A: 共通の入口と書き込みの型は backend の章が担う。Security は N/A: 送り元の検査・認可・控えの暗号化は system-spec-security が担う。根拠: qa-v22／system-spec/frontend.md

### Frontend architecture

#### Rendering and application pattern

書き込みを Next.js 16 の Server Functions に集め、成功したら next/cache の refresh で表示中の画面を作り直し、新しい描画を同じ応答に載せる。画面側は useSaveAction で呼び、createCommitGate で新しい描画が終わってから成功を呼び出し元へ返すので、成功の言葉だけが先に出て古い一覧が残ることがない。他タブと画面復帰では router.refresh で取り直し、Next.js の文書のとおり影響を受けない useState とスクロール位置を保つ（出典 nextjs-refresh、nextjs-client-cache）。根拠: qa-v22, qa-r-frontend-3, qa-d02／system-spec/frontend.md

#### Routes, screens and navigation

route-ledger は 46 画面の page.tsx（権限一覧のページを足して 47 画面になる）を正本とし、4役割（SUPER_ADMIN・COMPANY_ADMIN・MANAGER・EMPLOYEE）と4幅（375・768・1280・1600）で期待結果を検証する。権限一覧のページはルート台帳に足す。会社切替メニューは layout 側で作られるので、書き込みの応答で layout ごと作り直して新しい会社を出す。権限一覧のページとモーダルは同じ部品（表・役割のタブ・カード）を使い、ページを開ける役割・主な操作・役割ごとの可否・説明は route-ledger.json の各ページから読む（D-007 ①）。『Claude Code連携（システム開発者専用）』の名前は見出し・サイドバー・権限一覧でそろえる。余白の見直しは各画面の構成（段組み・補足の列）で行い、page.tsx の main に max-w を書かない。根拠: qa-v22, qa-r-frontend-3, qa-f01, qa-f05, qa-v31, qa-v25／system-spec/frontend.md・system-spec/maintenance-ops.md

#### Component and design-system boundaries

共通部品は、並べ替え（Pointer Events の長押しと押したままのドラッグ・矢印のボタン・キーボード・aria-live での読み上げ、新しい依存なし。D-005）、権限一覧（表・役割のタブ・スマホのカード・説明の吹き出しをページとモーダルで共用。D-006）、設定不足（何が・どう直す・リンク）、アンケートの回答（label を入力へ結び、全面で押せる）と見本（試しに選べ、送信の操作を出さない）である。権限一覧の表は table 要素、タブは APG の tabs の形、モーダルは dialog 要素で作り、説明は aria-describedby で結んでフォーカスとタップでも出す。並べ替えの方針（持ち上げる・動かす・置く・戻す・読み上げる）は部品に置き、入力の詳細はその内側に閉じる。ReasonNote は設定不足の用途だけを新しい部品へ置き換え、他の用途は残す。読み取り専用の .chip はポインターの形とホバーの変化を出さない。globals.css の配色・テーマの宣言とテーマの契約テストは変えない（AGENTS.md、DD-003）。出典は mdn-pointer-events、mdn-dialog-element、w3c-apg-tabs、w3c-apg-tooltip、mdn-aria-live-regions である。根拠: qa-v22, qa-v13, qa-v14／system-spec/frontend.md

比べる警告の表は table 要素で、列見出しの th に scope を付け、○ と — に『ある』『ない』の読み上げの文字を添える。根拠: qa-w07／system-spec/frontend.md

#### State and data flow

書き込みの結果は {ok, message} で返り、一覧・件数・layout の値は応答の新しい描画に入る。連続作成フォーム（RecordForm の generate 経路）も一覧の更新を省略せず、控えは成功の知らせの後ろに畳み、畳んでいる間は値を画面に置かない（暗号化して残せない鍵の無い環境だけ最初から開く）。他タブへは BroadcastChannel（hr-evaluation:freshness）で資源の種類と時刻だけを送り、受け手は1.5秒に1回へ間引いて router.refresh を呼ぶ。開閉の状態など端末ごとのものは localStorage に置き、読めないときは既定の状態で動く。権限一覧の表とカードは同じデータから描き、幅で切り替えるだけにして内容をずらさない。等級名はクライアントで持たず、サーバーから受け取った値を出す。根拠: qa-v22, qa-r-frontend-3, qa-v14／system-spec/frontend.md

比べる警告の件数の行は閉じていても出し、開閉の状態は覚えない。根拠: qa-w07／system-spec/frontend.md

#### Backend integration

画面は Server Functions の共通の入口 runAction（送り元の検査と認可、大きさの上限 413、zod による入力の検証、本体、成功時だけ next/cache の refresh）を通して書き、結果を {ok, message} の形で受け取る。読むだけの処理は runRead を通す。画面から書き込みの fetch を直接呼ぶ箇所は server-actions-contract.test.ts で落とし、sendBeacon と外観の選択の記録だけを理由付きの例外にする。並べ替えの保存には並び順の全体を送る形を足す（I14）。送った集まりが今の集まりと違うときは 409 になり、取り直しを求める。権限一覧は route-ledger.json の各ページに置いた権限の定義から描き、サイドバー（nav.ts）・ページの入口（requireRole）・ActionSpec.role・session.ts の canEdit〜 などの判定も同じ台帳から引く（D-007 ①）。根拠: qa-v22, qa-r-frontend-3, qa-u25, qa-v30, qa-v25, qa-v27, qa-v28／system-spec/frontend.md・system-spec/backend.md・system-spec/auth.md・system-spec/security.md

ComparisonGapNotice は、サーバーが返す ComparisonGap（比べている2つのページの名前と href、項目ごとの有無）をそのまま描き、ページ名やリンクを画面の側で組み立てない。根拠: qa-w07, qa-w08／system-spec/frontend.md・system-spec/backend.md

#### Performance and observability

他タブの取り直しは1.5秒に1回へ間引き、通知の受信またはタブ復帰から1秒以内に最新化する（O3）。visibilitychange・online・pageshow（persisted）でも同じ入口で取り直し、スマホ・タブレットでアプリを切り替えて戻った場合も同じに扱う。応答には Worker が作った時刻 x-generated-at が付き、反映されないという報告の切り分けに使う。根拠: qa-v22, qa-r-frontend-3, qa-u25／system-spec/frontend.md

#### Frontend verification

pnpm test に、入口を通らない書き込みの検査（server-actions-contract.test.ts）、batch の外で2つ以上の表を書く関数の検査（write-atomicity-contract.test.ts）、送り元の二重の検査（action-origin.test.ts）を入れ、違反が0件でなければ失敗にする。画面の通し試験（Playwright、pnpm test:e2e）で6つの経路と控えの畳み方を確かめ、375px・768px の幅でも回し、相手はローカルの preview に限る（LOCAL_HOSTS）。追加要件では、並べ替えの3つの操作の一致と全編集画面での部品の使用（O13。タッチでのスクロールとの区別はテストを厚くする）、等級名の結合テストと英語の区分名の静的検査（O6）、ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定の一致の検査（O8）、権限一覧の表とカードが同じ内容を出す検査、設定不足の契約テスト（O12）、選択肢のテスト（O14）、4幅の撮影（O15）で確かめる。根拠: qa-v22, qa-r-frontend-3, qa-u25, qa-v13, qa-v31／system-spec/frontend.md・system-spec/maintenance-ops.md

3画面が ComparisonGapNotice だけを使うこと、閉じた1行と開いた表が出ることをテストで確かめる。根拠: qa-w07, qa-w10／system-spec/frontend.md・system-spec/maintenance-ops.md

## Architecture decisions

D-001（opt-broadcast）により、他タブへの通知は BroadcastChannel（hr-evaluation:freshness）で資源の種類と時刻だけを送り、受け手は router.refresh で取り直す。D-002（opt-server-functions）により書き込みを Server Functions へ移し、その後、表示中の画面の作り直しは next/cache の refresh にそろえ、revalidatePath は将来サーバー側にキャッシュを入れるときの無効化の置き場として残した。Clean Architecture の適用として、BroadcastChannel・visibilitychange・online・pageshow の詳細は FreshnessSync の内側に閉じ、各画面は useSaveAction の結果 {ok, message} を出すだけにする。D-005（opt-pointer-hook）は利用者が選んだ案で、AI の推奨と同じである（qa-v13）。Pointer Events の共通の hook を自作し、新しい依存は足さない。矢印のボタンは WCAG 2.2 の SC 2.5.7（ドラッグの代わりの操作）として残す。並べ替えの方針（持ち上げる・動かす・置く・戻す・読み上げる）は共通の部品に置き、長押し・矢印のボタン・キーボードという入力の詳細はその内側に閉じる。D-006（opt-combined）は、利用者が自由記述で①②③の組み合わせを求めたので足した案で、AI の推奨（opt-single-table）とは別の案である（qa-v14）。表・タブ・カード・説明は同じデータから描く共通の部品にし、ページとモーダルで使い回す。D-007（opt-route-ledger-extend）は利用者が選んだ案で、AI が委任に基づいて選んだ別の案とは違う（qa-v25）。ページを開ける役割（accessClass）・主な操作・役割ごとの可否・説明を route-ledger.json の各ページに置き、権限一覧の部品はこの台帳だけから描く。dialog 要素と aria-describedby を使うこと、localStorage が読めないときの既定、ReasonNote の他の用途を残すことは、この章の全文に書いて示し、利用者が全文のまま承認した（qa-v22、2026-10-13T00:03:46Z）。根拠: qa-v22, qa-r-frontend-3, qa-v13, qa-v14, qa-v25, qa-v27, qa-v30／system-spec/frontend.md・system-spec/auth.md・system-spec/backend.md

## Delivery, migration and rollback

Server Functions への移行は終えており、二つの書き込み経路の混在は残っていない（D-002 の 2026-10-01 追記）。新しい画面を足すときは鮮度の契約を使うことを README の文書の入口から辿れるようにし、pnpm test と pnpm run check:docs を通す。追加要件の部品は、並び順を持つ編集画面と設定不足の ReasonNote を置き換える形で入れ、ReasonNote の他の用途は残す。並べ替えは Pointer Events で自作して新しい依存を足さず（D-005）、権限の定義は route-ledger.json に足して DB の表を足さない（D-007 ①）。権限一覧のページはルート台帳に足し（46 画面 → 47 画面）、全てのページに主な操作・役割ごとの可否・説明の欄を足す。route-ledger.test.mjs の件数と新しい欄の検査・nav.test.ts・check:docs を合わせる。Next.js は脆弱性の修正を含む 16.3.8 にし、Next.js 16 系・OpenNext・Workers・D1 の構成は変えない。根拠: qa-v22, qa-r-frontend-3, qa-u25, qa-v25, qa-v29, qa-v31／system-spec/frontend.md・system-spec/infrastructure.md・system-spec/maintenance-ops.md

## Risks and verification

危険は、共通口を通らない書き込みが紛れ込むこと、bfcache から戻した直後の取り直しがルーターの復元とぶつかること、並べ替えの3つの操作で結果がずれること、タッチでのスクロールとドラッグの区別が甘くスマホで誤って並びが変わること、権限一覧の表とカードの片方だけを直して内容がずれること、localStorage が使えない環境で欄が動かなくなることである。bfcache のときはルーターが画面を戻し終えた後（次のタスク）に取り直し、通知による取り直しは1.5秒に1回へ間引き、localStorage が読めないときは既定の状態で動かす。タッチとスクロールの区別はテストを厚くし（D-005）、表とカードは同じデータから描く（D-006）。O4 は静的検査で共通の包みを通らない Server Function と直接の書き込みの fetch を0件と報告し、O13 は並べ替えの部品のテストと全編集画面がその部品を使う静的検査で確かめる。O1・O3 は作成系 E2E と2タブ E2E、O6・O8・O12・O14・O15 は等級名の結合テスト、ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定の一致の検査、設定不足の契約テスト、選択肢のテスト、4幅の撮影で確かめる。権限一覧の表とカードが同じ内容を出すことも検査する。根拠: qa-v22, qa-r-frontend-3, qa-v13, qa-v14, qa-v31／system-spec/frontend.md・system-spec/maintenance-ops.md


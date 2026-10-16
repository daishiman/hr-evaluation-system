---
graph_node_id: "arch-system-spec-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "保守運用の検査・文書・本番手順"
project_id: "hr-evaluation-system"
domain: "maintenance-ops"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応"]
file_path: "architecture/system-spec-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "22ced72298540282563480432d02501ae0cf636217797dd91f909df18ae73782", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-report.json"}
source_lineage: {"imported_at": "2026-10-15T00:07:42Z", "origin_kind": "system-spec-harness", "source_digest": "22ced72298540282563480432d02501ae0cf636217797dd91f909df18ae73782", "source_path": "system-spec/maintenance-ops.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
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
classification_reason: "system-spec-harness が確定した章 system-spec/maintenance-ops.md の取り込み"
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-maintenance-ops.md", "confidence": 0.95}]
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

この章は、鮮度と原子性の契約と 2026-10-12 の追加要件の契約を、人の記憶ではなく検査・文書・手順で守る運用の設計である。pnpm test に3つの契約試験（server-actions-contract.test.ts・write-atomicity-contract.test.ts・action-origin.test.ts）を入れ、違反0件でなければ失敗にする。Playwright の E2E で6つの経路を確かめる。『反映されない』報告の切り分けと、compensation_failed・rollforward_failed の直し方を deploy-notes §7 に置く。追加要件では、ルート台帳に権限一覧のページを足し（46 画面 → 47 画面）、全てのページに主な操作・役割ごとの可否・説明の欄を足す（D-007 ①）。台帳の説明書き（$schemaNote）と、route-ledger.test.mjs の件数と新しい欄の検査も合わせる。『Claude Code 連携の鍵』を『Claude Code連携（システム開発者専用）』に改め、ルート台帳・サイドバー・画面名の定数・文書・テストで同じ名前にそろえる。決まりの文書と文字列を固定したテストを新しい形に合わせ、11 項目の検査を足す。その一つが、ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定の一致である。本番の等級名の一律の書き換えは、前に本番 DB を読み取りで数えて書き換え前の値を記録し、外部変更ガードを通して Deploy する。後に、英語の区分名が残っていないことを読み取りで確かめる。根拠: qa-v31（主）、qa-r-ops-3（旧主根拠）、qa-v25、D-007、system-spec/maintenance-ops.md。

2026-10-14 の追加で、比べる警告のテスト6種と、文書への反映・受領書の置き場所を定めた（O16）。この追加の全文は、利用者が全文のまま承認した（qa-w10、2026-10-14T20:46:24Z）。根拠: qa-w10／system-spec/maintenance-ops.md

## Context and drivers

もともとの検証は pnpm test（vitest）・check:docs・check:bundle-size に限られ、ブラウザを自動操作する E2E は無かった。本番の調べ方は、Workers Logs と読み取り専用の D1 照会だけだった（qa-f09）。強制再読み込みでも出なかった報告（qa-u03）を推測で閉じないため、観測の順序を手順として持つ必要があった（qa-f08）。追加要件は、文書・画面名・権限・文字列に広く触れる。権限の定義はルート台帳に足すので（D-007 ①）、台帳の説明書きと検査も変わる。そのため、文字列を固定したテストや文書が新しい形とぶつかる。本番の等級名の書き換えは、戻せる証跡を要する。品質の優先は、規則を検査で落とすこと（G4）、本番を手で書き換えないこと、文書と実装を食い違わせないことである。制約は四つある。本番 DB は読み取り専用。外部への変更は preview → CONFIRM → authorize → execute のガードを通す。PR は実装後に利用者の確認を取ってから作る。公開リポジトリのため、文書や見本に実データを入れない。根拠: qa-v31、qa-r-ops-3、qa-f09、qa-f08、D-007、constraints、system-spec/maintenance-ops.md。

## Goals and non-goals

ゴールは maintenance-ops 章の serves_goals の G2・G4（鮮度の保証と適用漏れの検出）と、G6〜G15 を検査と文書で裏付けることである。受入は O2・O4・O6〜O15 の測り方（静的検査で0件、役割ごとの結合テスト、375・768・1280・1600 の4つの幅での撮影など）を、pnpm test・pnpm test:e2e・pnpm run check:docs と本番の読み取り確認に割り付けて判定する。domain のカバレッジ 100% を保つ。非ゴールは、エージェントによる本番への書き込み、本番データの移行・修正（等級名と等級名を含む表示名の一律の書き換えを除く）、役割の種類の追加（『システム開発者』の役割は作らず、画面名だけを変える）である。根拠: qa-v31 (3)(4)、qa-r-ops-3、scope.out、system-spec/maintenance-ops.md（To-Be / Delta）。

## System context and boundaries

運用の担い手は、リポジトリで実装と検査を回す開発者とエージェント、本番で操作する利用者である。エージェントは本番に書き込まない（反映の確認に使う作成も、利用者のふだんの操作で行う）。E2E はローカルの preview だけに向け、ローカル以外へ向かないよう LOCAL_HOSTS で止める。本番との境界は、読み取りだけの D1 照会・Workers Logs・応答の生成時刻ヘッダー・ゾーンのキャッシュ規則の確認である。変更は GitHub Actions の Deploy と外部変更ガードを通す。文書の境界は README の文書の入口である。決まりの正本（docs/product/spec.md・system-spec/ の各文書）と反映の受領書（docs/product/spec-receipts/）を、そこから辿る。根拠: qa-r-ops-3 (2)(3)(4)、qa-v31 (2)(4)、O2、system-spec/maintenance-ops.md。

## Container and component view

検査の層は四つある。pnpm test（vitest。3つの契約試験、ルート台帳の route-ledger.test.mjs（件数と新しい欄の検査）、nav.test.ts、ui-rules.test.ts、agent-keys.test.ts、improvement-ux-contracts.test.ts など。追加の11項目の検査もここに足す）。pnpm test:e2e（Playwright。6つの経路と控えの畳み方、375px・768px）。pnpm run check:docs（文書のずれ・リンク切れ）。check:bundle-size。どれも違反0件でなければ失敗にする。文書の層は、deploy-notes（§6 secret の置き方、§7 反映されない報告の切り分けと失敗記録からの直し方）、ルート台帳（46 → 47 画面。全ページに主な操作・役割ごとの可否・説明の欄を持ち、権限の定義をまとめる唯一の台帳。D-007 ①）、決まりの文書（docs/product/spec.md・system-spec/account-and-users.md・routes-and-access.md・master-settings.md）、反映の受領書 docs/product/spec-receipts/ である。観測の層は、応答の生成時刻ヘッダー x-generated-at、Workers Logs、ゾーンのキャッシュ規則の読み取り確認、本番 DB の読み取り専用の照会である。根拠: qa-r-ops-3 (1)〜(4)、qa-v31 (1)(2)(3)、D-007、qa-f09、system-spec/maintenance-ops.md。

## Cross-cutting contracts

アクセスは、本番 DB と Cloudflare の設定を読み取りだけで調べ、変更は外部変更ガードを通し、PR は実装後に利用者の確認を取ってから作る形にそろえる。誤りと回復は、compensation_failed と rollforward_failed を Workers Logs で見つけ、本番 DB を手で書き換えずに直すことで揃える（rollforward_failed は、本人にもう一度パスワードを変えてもらうと続きがやり直される）。監査は、本番の一律の書き換えの前に対象の会社数・等級数・英語入りの表示名の数を数えて書き換え前の値を記録し、後に読み取りで確かめることで残す。権限の定義はルート台帳1つに置き、台帳とサイドバー・ページの判定・サーバー処理の役割の指定の一致を pnpm test の検査で守る（D-007 ①）。命名の互換は、画面名の改名を対象のすべてで同時に改めることで保つ。対象は、ルート台帳・サイドバー（nav.ts）・画面名の定数（src/lib/domain/agent-keys.ts の AGENT_KEY_PAGE_LABEL）・README・system-spec/improvement-requests.md・docs/deploy-notes.md・specs/data-freshness.md・テスト（agent-keys.test.ts・improvement-ux-contracts.test.ts）である。漏れは check:docs で落とし、役割の種類は増やさない。公開リポジトリのため、文書・テスト・見本に実データや秘密の値を入れない。根拠: qa-r-ops-3 (3)、qa-v31 (1)(3)(4)、D-007、constraints、system-spec/maintenance-ops.md。

## Subtype architecture

Infrastructure: 本ノードの subtype_sections.infrastructure（architecture-infrastructure.md の6節）に、運用・検査・リリースの観点で記す。配信構成とマイグレーションの書き方そのもの（冪等・書き換え前の値の表・新しい依存も DB の表も足さないこと）は、system-spec/infrastructure.md（qa-v29）の担当である。本章は、その前後の手順と検査を持つ。Backend: N/A。検査が守る入口・原子性・権限の定義（D-007 ①。route-ledger.json に置く）・所属（D-004）の契約の中身は、system-spec/backend.md の担当。Frontend・Data・Security: N/A。4 幅の配置、並べ替えの部品（D-005）、権限一覧のページと利用者一覧のモーダル（D-006 の表・タブ・カード）は system-spec/frontend.md・ui-ux.md、所属の表と書き換え前の値の記録の表は system-spec/database.md、応答に他人の等級と点数を載せない規範は system-spec/security.md の担当。根拠: matrix.maintenance-ops.web（qa_ref は qa-v31）、system-spec/maintenance-ops.md。

### Infrastructure architecture

#### Environments and topology

検査の環境は、ローカルの vitest（pnpm test）と、ローカルの preview に向けた Playwright（pnpm test:e2e）である。E2E はローカル以外へ向かないよう LOCAL_HOSTS で止め、375px・768px の幅でも回す。画面の配置の確認は、375・768・1280・1600 の4つの幅で撮影して行う。配布の環境は、GitHub Actions のクリーンな checkout から本番の Worker と D1 へ配る1本だけで、ローカルの作業ツリーを直接配らない（system-spec/release-and-forms.md）。本番は観測の対象で、応答の生成時刻ヘッダー・Workers Logs・ゾーンのキャッシュ規則・D1 の読み取り専用の照会で調べる。根拠: qa-r-ops-3 (2)(3)、qa-v31 (3)、O15、system-spec/maintenance-ops.md。

#### Compute and storage

運用のために新しい計算資源や保存先は足さず、検査と手順は今の Worker・D1・Workers Logs の上で行う。記録の置き場は三つある。Workers Logs の構造化ログ（compensation_failed・rollforward_failed）。等級名の一律の書き換えの前の値の記録（表に残す。表の中身は system-spec/database.md）。本番の前後の読み取りで得た数（対象の会社数・等級数・英語入りの表示名の数）。数は本番の読み取りで得る件数にとどめ、実データ（社員名・評価値）を文書や見本に写さない。根拠: qa-v31 (4)、qa-r-ops-3 (3)、qa-v29 (2)、constraints、system-spec/maintenance-ops.md、system-spec/infrastructure.md。

#### IaC and delivery

検査は、package の scripts（pnpm test・pnpm test:e2e・pnpm run check:docs・check:bundle-size）とテストのファイルとしてリポジトリに置く。Deploy workflow は、同じ checkout でこれらを通してから配る。ルート台帳に権限一覧のページと、全ページの主な操作・役割ごとの可否・説明の欄を足すときは（D-007 ①）、台帳の説明書き（$schemaNote の『44個』）を直し、route-ledger.test.mjs の件数（46 → 47）と新しい欄の検査・nav.test.ts・check:docs を合わせる。画面名の改名は、ルート台帳・nav.ts・画面名の定数（AGENT_KEY_PAGE_LABEL）・README・文書・テストで合わせる。決まりの文書を改めたら、反映の受領書を docs/product/spec-receipts/ に残す。PR は実装後に利用者の確認を取ってから作り、本番への変更（Deploy・secret の設定）は外部変更ガードを通す。根拠: qa-v31 (1)(2)、D-007、qa-r-ops-3 (1)(4)、constraints、system-spec/maintenance-ops.md。

#### Secrets and access

運用の人とエージェントは本番 DB を読み取りだけで調べ、本番に書き込まない。本番への秘密の設定（CREDENTIAL_ENC_KEY の wrangler secret put）や Deploy は、外部への変更として確認を取ってから行い、手順は deploy-notes §6 に置く。改名する『Claude Code連携（システム開発者専用）』の画面は名前だけを変え、役割の種類は増やさない。公開リポジトリのため、手順・ログの例・テストの見本に秘密の値や実データを入れない。根拠: qa-r-ops-3 (3)、qa-r-infrastructure-3 (5)、qa-v31 (1)、constraints、system-spec/maintenance-ops.md。

#### Reliability and recovery

SLO の数値は置かない。鮮度の信頼性は、O2（再読み込みで反映率 100%）と O4（入口を通らない経路0件）を検査で保つ。障害の切り分けは、deploy-notes §7 の順（生成時刻ヘッダー → Workers Logs → ゾーンのキャッシュ規則）に読み取りだけで進め、推測で閉じない。compensation_failed は Workers Logs から見つけ、本番 DB を手で書き換えずに直す。rollforward_failed は、本人にもう一度パスワードを変えてもらうと続きがやり直される。本番の等級名の書き換えは、前の値の記録と後の読み取りでの確認を持ち、崩れたら戻す手順で戻す。根拠: qa-r-ops-3 (3)、qa-v31 (4)、qa-v29 (2)、system-spec/maintenance-ops.md、system-spec/infrastructure.md。

#### Infrastructure verification

毎回の検査は、pnpm test（3つの契約試験、追加の11項目の検査、ルート台帳の件数と新しい欄の検査を含み、違反0件でなければ失敗）、pnpm run check:docs、domain のカバレッジ 100%、6つの経路の E2E（375px・768px を含む）である。Deploy は、同じ checkout でこれらを通してから配る。リリースの前後の確認として、本番の書き換えの前に、対象の会社数・等級数・英語入りの表示名の数を読み取りで数える。Deploy の後は、英語の区分名が残っていないことと、作成直後の強制再読み込みで新しい行が出て生成時刻ヘッダーが作成より後であることを確かめる。独自ドメインへ移すときは、ゾーンに HTML・/api を保存する規則が無いことを読み取りで確かめる。根拠: qa-v31 (1)(3)(4)、qa-r-ops-3、O2、system-spec/maintenance-ops.md。

比べる警告のテストを足す：全件が2つのページを持つ／『食い違』『ズレ』を含む警告が ComparisonGap 以外から作られていない／リンク先が台帳にあり、見る人の役割で開ける／3画面で閉じた1行と開いた表が出る／新しい版はその等級の版だけが増える／他社の等級は拒否される。setup-gaps・SetupGapList・一覧のテストの固定文字列を新しい形に合わせ、domain のカバレッジ 100% を保つ。根拠: qa-w10／system-spec/maintenance-ops.md

## Architecture decisions

本章に効く確定意思決定は D-002・D-004・D-005・D-006・D-007 である。D-002（opt-server-functions）で画面からの書き込みを1つの入口に集めたので、入口を通らない経路を静的検査で0件に保つ運用が成り立つ（二つの経路の混在は移行で解消済み）。D-004（opt-membership-cookie）・D-005（opt-pointer-hook）・D-006（opt-combined）・D-007（opt-route-ledger-extend）は利用者が選んだ。D-007 は、委任を受けて AI が選んだ案とは別の案を、利用者が3案の比較を見たうえで明示して選んだ（qa-v25、2026-10-13T03:40:15Z）。本章は、D-004 を所属していない会社のデータが読めない検査で、D-005 を並べ替えの部品のテストと静的検査（O13）で、D-006 を権限一覧の表とカードが同じ内容を出す検査で守る。D-007 は、ルート台帳の全てのページに主な操作・役割ごとの可否・説明の欄を足し、台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致する検査で守る。代わりに、説明の文言の直しも仕様の台帳の変更として扱う。運用の型は、Clean Code の『一つの規則は一か所に書き、検査で守る』と、Google SRE の『推測より観測』である。規則を検査と記録に持たせ、切り分けを生成時刻ヘッダー → Workers Logs → ゾーンのキャッシュ規則の順に、読み取りだけで進める。足す検査（11 項目）と、本番の書き換えの前後に読み取りで数えることは、qa-v31 の文面にある。本章の要件は、2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (1)・(3) だけを①に直し、旧と新を逐語で示して承認を取り直したものである（qa-v31、2026-10-13T03:48:20Z）。前後の読み取りは、手間と引き換えに書き換えの範囲と結果を証跡に残す。E2E の相手をローカルの preview に限ることで、本番への誤操作を避ける。代わりに、本番での確認はリリース後の利用者の操作と読み取りに頼る。根拠: D-002、D-004、D-005、D-006、D-007、qa-v25、qa-v31、qa-r-ops-3、system-spec/maintenance-ops.md（本章に効く確定意思決定・上流指針・適用された設計知識）。

## Delivery, migration and rollback

リリースは、実装と検査（pnpm test・pnpm run check:docs・E2E）→ 利用者の確認を取ってから PR → main への取り込み → Deploy workflow の自動マイグレーションと fail-closed のゲート → 配布の順で進める。等級名の一律の書き換えは、前に本番 DB を読み取り専用で数え（対象の会社数・等級数・英語入りの表示名の数）、書き換え前の値を記録する。外部変更ガードを通して Deploy し、後に英語の区分名が残っていないことを読み取りで確かめる。本番へのマイグレーションの適用は、wrangler d1 migrations apply に --remote を明示する。失敗した番号はロールバックされ、前に成功した番号は残る（cloudflare-wrangler-d1-commands）。これを前提に、後の読み取りで崩れが見つかれば、書き換え前の値の記録から戻す手順（qa-v29 (2)）を使う。リリース後は、利用者のふだんの作成の直後に ⌘+Shift+R をして新しい行が出ることと、生成時刻ヘッダーが作成より後であることを確かめる。根拠: qa-v31 (4)、qa-v29 (2)、O2、constraints、system-spec/maintenance-ops.md、system-spec/infrastructure.md。

比べる警告の変更は docs/product/spec.md §22 と system-spec の文書に反映し、受領書を docs/product/spec-receipts/ に残す。根拠: qa-w10／system-spec/maintenance-ops.md

## Risks and verification

前提として、本章の要件は利用者の承認を得た文面である（qa-v31、2026-10-13T03:48:20Z）。2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (1)・(3) だけを①に直し、旧と新を逐語で示して承認を取り直した。危険は三つある。文字列を固定したテスト（setup-readiness・scheme-steps・form-sync・StaleCyclesNotice・nav・ui-rules・improvement-ux-contracts・versioned-master-editors）や決まりの文書が、古い文面のまま残ること。改名の取り残し。本番の書き換えの証跡の欠け。これらは、文面の更新・check:docs・前後の読み取りで抑える。また、ルート台帳の権限の定義と、サイドバー・ページの判定・サーバー処理の役割の指定のどれかが食い違うと、権限一覧の表示と実際の判定がずれる。台帳と各判定の一致の検査で落とす。台帳の件数（47）と新しい欄は、route-ledger.test.mjs で確かめる。足す検査は次の11項目である。表示の英語・カタカナの等級区分名0件。等級名を変えられる役割の限定。ルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定の一致。権限一覧の表とカードが同じ内容を出すこと。一般の社員の応答に他人の等級と点数が無いこと。所属していない会社のデータが読めないこと。提出状況の数と一覧の一致。設定不足の各件に直す画面のリンクがあること。並べ替えの全体の保存と 409。選択肢の値が重ならないこと。4 幅で右側だけが空く画面が無いこと。既存の3つの契約試験と6つの経路の E2E、domain のカバレッジ 100% も保ち、pnpm test と check:docs を通す。根拠: qa-v31 (1)(3)、qa-v25、D-007、qa-r-ops-3 (1)(2)、system-spec/maintenance-ops.md（受入条件）。


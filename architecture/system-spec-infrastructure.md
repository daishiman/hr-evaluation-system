---
graph_node_id: "arch-system-spec-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "インフラの配信構成とマイグレーション"
project_id: "hr-evaluation-system"
domain: "infrastructure"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応"]
file_path: "architecture/system-spec-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "97db84c68e57a34f0368d7cf34d1efd6f5fae6921c8ae4c2a364f720d116d6f6", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json"}
source_lineage: {"imported_at": "2026-10-13T05:04:21Z", "origin_kind": "system-spec-harness", "source_digest": "97db84c68e57a34f0368d7cf34d1efd6f5fae6921c8ae4c2a364f720d116d6f6", "source_path": "system-spec/infrastructure.md", "source_plugin": "system-spec-harness", "source_version": "0.1.21"}
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
classification_reason: "system-spec-harness が確定した章 system-spec/infrastructure.md の取り込み"
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-infrastructure.md", "confidence": 0.95}]
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

# Architecture overview

Next.js 16 系を OpenNext Cloudflare で1つの Cloudflare Worker に載せ、D1 を結び付けて workers.dev から配る構成である。この構成と配る先は変えない（Next.js だけ、脆弱性の修正を含む 16.3.8 へ上げる）。鮮度のために、OpenNext の既定（incremental cache・tag cache を使わない）と force-dynamic を保ち、ログイン後の画面をサーバーやエッジで保存しない。Worker が応答を作った時刻 x-generated-at を応答に付け、本番で切り分けられるようにする。2026-10-12 の追加要件では、所属の表の追加と既存の利用者からの移し替え、等級名の一律の書き換えを D1 のマイグレーション（drizzle/migrations の 0033 以降）で行い、本番の Deploy の自動マイグレーションと fail-closed のゲートに乗せる。どのマイグレーションも2回流して結果が変わらず、失敗したら途中の状態を残さない。書き換え前の値を表に残し、戻す手順を用意する。並べ替えは Pointer Events で自作し（D-005）、新しい依存を足さない。権限の定義は route-ledger.json に足し（D-007 ①）、DB の表を足さない。根拠: qa-v29（主）、qa-r-infrastructure-3（旧主根拠）、qa-v25、D-005、D-007、system-spec/infrastructure.md。

## Context and drivers

きっかけは、強制再読み込み（⌘+Shift+R）でも新しい会社が出なかった報告である（qa-u03）。ローカルの preview では応答が private, no-store で毎回新しい行を含んだ。そのため、本番のゾーンのキャッシュ規則など、アプリの外の要因も観測で切り分ける必要があった（qa-f08）。追加要件では、複数会社への所属（G10）と等級名の統一（G6）が、データの形と既存の本番データの書き換えを伴う。並べ替え（G13）は部品を、権限の一覧（G8）は権限の定義を足す。そのため、配信の基盤に変更を持ち込まずに流すことが論点になった。品質の優先は、再読み込みで必ず最新を返すこと（G2）、本番データの書き換えを途中で止めず戻せること、構成と運用負担を増やさないことである。制約は四つある。構成（Next.js 16 系・OpenNext Cloudflare 1.20 系・Workers・D1・better-auth）を変えない。本番 DB は読み取り専用で調べる。外部への変更系通信は preview → CONFIRM → authorize → execute のガードを通す。本番の等級名の書き換えはマイグレーションで行い、書き換え前の値を記録に残す（constraints）。根拠: qa-v29、qa-r-infrastructure-3、qa-f08、qa-u03、system-spec/infrastructure.md。

## Goals and non-goals

ゴールは infrastructure 章の serves_goals の G2・G6・G8・G10・G13 である。G2 は、通常・強制の再読み込みと直接表示が直前の書き込みを含むこと。G6 は、等級名の一律の書き換えを配ること。G8 は、権限の定義を route-ledger.json に足し、DB の表を足さずに支えること（D-007 ①）。G10 は、所属の表と移し替えを配ること。G13 は、並べ替えを新しい依存なしで支えること（D-005）。受入は O2・O6・O8・O10・O13 で判定する。O2 は、書き込み→強制再読み込みの E2E とローカル preview の再現、リリース後の本番で生成時刻ヘッダーが作成より後であること、ゾーンに HTML・/api を保存する規則が無いことの読み取り確認である。O6 は、移行後の本番の等級名が『等級N』『等級N-M』の形であること。O8 は、権限の定義と、ルート台帳の accessClass・サーバー処理の最低ロールを照合する契約テストが通ること。①では権限の定義もルート台帳に置くので、この検査はルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致することを見る（qa-v31 (3)）。O10 と O13 は受入条件の測り方による。非ゴールは、配信構成や配る先の変更、サーバー側キャッシュ（incremental cache・tag cache）の導入、別の利用者の画面への即時配信（WebSocket などの push）、等級名と等級名を含む表示名の一律の書き換え以外の本番データの移行である。根拠: qa-v29、qa-r-infrastructure-3 (1)(4)、qa-v25、qa-v31 (3)、D-005、D-007、O8、scope.out、system-spec/infrastructure.md（To-Be / Delta）、system-spec/maintenance-ops.md。

## System context and boundaries

利用者は Web・モバイル・タブレットのブラウザから workers.dev の Worker に届く。デスクトップのネイティブアプリは対象外である（appr-platform-001・qa-u08）。今は wrangler.jsonc に routes が無く、workers.dev だけで配るので、ゾーンのキャッシュ規則は効かない。独自ドメインへ移すときは、HTML や /api を保存する規則が無いことを読み取りだけで確かめる。変更が要れば、外部への変更として確認を取ってから行う。データの境界は Worker に結び付けた D1 で、ログイン後の応答は共有のキャッシュに載せない。運用の境界として、本番への変更（マイグレーションの適用・secret の設定）は GitHub Actions の Deploy と外部変更ガードを通す。エージェントは本番 DB を読み取りだけで調べる。根拠: qa-r-infrastructure-3 (3)、qa-f08、qa-v29 (1)、system-spec/infrastructure.md。

## Container and component view

配る単位は OpenNext Cloudflare でビルドした1つの Worker である。open-next.config.ts は defineCloudflareConfig() の既定のままで、incremental cache・tag cache・queue を持たない。worker.ts は Next.js の外側で、成功・失敗どちらの応答にも（101 など作り直せない応答を除く）x-generated-at を付ける。ミドルウェアに置かないことで、サーバー側の実行ファイルの容量上限を守る。データは D1 の1つのデータベースで、版は drizzle/migrations の番号付きの .sql で管理する。追加要件の所属の表と移し替え・等級名の一律の書き換え（書き換え前の値を残す表を含む）は、0033 以降の番号で足す。並べ替え（D-005）のために新しい依存を足さない。権限の定義（D-007 ①）は route-ledger.json に足し、D1 の表を足さない。Workers Logs（observability を有効）は、要求ごとのログと compensation_failed・rollforward_failed の構造化ログを受ける。控えの暗号化の鍵 CREDENTIAL_ENC_KEY は、Workers の secret として結び付ける。根拠: qa-r-infrastructure-3 (1)(2)(5)、qa-f08、qa-v29 (1)(2)(3)、system-spec/infrastructure.md。

## Cross-cutting contracts

アクセスは、本番の D1 と Cloudflare の設定を読み取りだけで調べる形にそろえる。マイグレーションの適用・secret の設定・ゾーンの規則の変更は、外部への変更として確認を取ってから行う。誤りと回復の前提は、公式文書 cloudflare-wrangler-d1-commands の動きである。wrangler d1 migrations apply は、途中でエラーになった番号をロールバックし、それより前に成功した番号は適用済みのまま残す。そのため、マイグレーションは2回流しても結果が変わらないように書き、途中の状態を残さない要件（qa-v29 (2)）を番号ごとに満たす。残った番号は、書き換え前の値の記録と戻す手順で扱う。観測は、応答の生成時刻ヘッダーと Workers Logs で行う。設定と秘密は、CREDENTIAL_ENC_KEY をローカルは .dev.vars、本番は wrangler secret put で置き（deploy-notes §6）、値をリポジトリにも DB にも置かない。互換は、構成（Next.js 16 系・OpenNext・Workers・D1）と配る先を変えないことで保つ。並べ替えは Pointer Events で自作して新しい依存を足さず（D-005）、権限の定義は route-ledger.json に足して DB の表を足さない（D-007 ①）。根拠: qa-v29 (2)(3)、qa-r-infrastructure-3 (2)(5)、D-005、D-007、system-spec/infrastructure.md（最新ドキュメント出典）。

## Subtype architecture

Infrastructure: 本ノードの subtype_sections.infrastructure（architecture-infrastructure.md の6節）に記す。Backend: N/A。書き込みの入口・原子性・所属の値への移行（約33か所と約140か所）・権限の定義の中身は system-spec/backend.md の担当。Data: N/A。所属の表の列・既定の等級名・書き換え前の値を残す表の中身は system-spec/database.md の担当で、本章はそれを配る流し方を決める。Frontend・Security: N/A。並べ替えの部品（D-005）は system-spec/frontend.md の担当。応答を共有のキャッシュに載せない規範と secret の扱いの規範は system-spec/security.md の担当。本番の前後の読み取りでの数え上げと切り分けの手順は、system-spec/maintenance-ops.md の担当。根拠: matrix.infrastructure.web（qa_ref は qa-v29）、system-spec/infrastructure.md。

### Infrastructure architecture

#### Environments and topology

環境はローカル（preview で Workers 相当を動かし、D1 はローカル、秘密は .dev.vars）と本番（GitHub Actions の Deploy から配る Worker と本番の D1）の2つで、E2E はローカルの preview だけに向け、ローカル以外へは LOCAL_HOSTS で止める。本番は workers.dev だけで配っており（wrangler.jsonc に routes が無い）、ゾーンのキャッシュ規則は効かない。独自ドメインへ移すときは HTML や /api を保存する規則が無いことを読み取りだけで確かめ、変更は外部への変更として確認を取ってから行う。Web・モバイル・タブレットのブラウザは同じ Worker と D1 を使い、端末による違いは無い。根拠: qa-r-infrastructure-3 (3)(5)、qa-r-ops-3 (2)、qa-f08、system-spec/infrastructure.md。

#### Compute and storage

計算は OpenNext Cloudflare で載せた1つの Worker で、Next.js 16 系（16.3.8 へ上げる）を force-dynamic で動かし、要求のたびに D1 から読む。保存先は D1 だけで、OpenNext の incremental cache・Queue・Tag Cache は設定しない。追加要件の所属の表と書き換え前の値を残す表も、同じ D1 に置く。並べ替えは Pointer Events で自作して新しい依存を足さず（D-005）、権限の定義は route-ledger.json に足して D1 の表を足さない（D-007 ①）。容量は、サーバー側の実行ファイルの上限を check:bundle-size で守る。応答の生成時刻をミドルウェアでなく worker.ts で付けるのも、このためである。費用の面では、他タブの最新化で定期的な取り直し（1秒間隔なら1画面で1日 86,400 要求）を退けた D-001 の判断で、要求の増加を避けている。章として別の予算の数値は置いていない。根拠: qa-r-infrastructure-3 (1)(2)(4)、qa-v29 (1)(3)、qa-f08、qa-f09、D-001、D-005、D-007、system-spec/infrastructure.md。

#### IaC and delivery

構成は、wrangler.jsonc（D1 のバインディング・observability）と open-next.config.ts をリポジトリで管理する。D1 の版は、drizzle/migrations の番号付きの .sql と適用済みを記録する表で管理する。配布は、main の追跡済みコミットを GitHub Actions のクリーンな checkout から行う。check:docs・型生成・typecheck・test:coverage・ビルド・check:bundle-size を通した後、未適用があるときだけバックアップを取ってから自動で適用し、migrations list の未適用0件を確かめてから配る。Deploy と手動の Migrate は同じ concurrency group で直列にする。未知の出力・認証失敗・矛盾した出力は clear とみなさず止める（system-spec/release-and-forms.md）。0033 以降の追加のマイグレーションもこの流れに乗せ、手で本番 DB に流さない。本番へ手で適用する場合も --remote を明示する。根拠: qa-v29 (1)、system-spec/release-and-forms.md、system-spec/infrastructure.md（最新ドキュメント出典 cloudflare-d1-migrations・cloudflare-wrangler-d1-commands）。

#### Secrets and access

秘密の正本は Workers の secret で、控えの暗号化の鍵 CREDENTIAL_ENC_KEY（32 バイトを base64 にしたもの）をローカルは .dev.vars、本番は wrangler secret put で置く手順を deploy-notes §6 に書き、値はリポジトリにも DB にも置かない。本番への secret の設定・マイグレーションの適用・ゾーンの規則の変更は、外部への変更として preview → CONFIRM → authorize → execute のガードを通し、確認を取ってから行う。エージェントは本番 DB を読み取りだけで調べ、本番に書き込まない。根拠: qa-r-infrastructure-3 (3)(5)、constraints、system-spec/infrastructure.md。

#### Reliability and recovery

SLO の数値は置かない。鮮度の信頼性は O2（書き込み直後の再読み込みで反映率 100%）で測り、Workers Logs で要求と失敗を読む。バックアップは、未適用のマイグレーションがあるときに Deploy が本番 D1 を取得して保管し、取得に失敗したら適用しない（system-spec/release-and-forms.md）。マイグレーションは、失敗した番号がロールバックされ、前の番号が残る。そのため、どの番号も2回流して結果が変わらないようにする。書き換え前の値の表と戻す手順で、等級名の一律の書き換えを元に戻せるようにし、障害のときに人が推測で戻す作業を残さない。会社の追加の取り消しやパスワード変更の続きまで失敗したときは、compensation_failed・rollforward_failed を Workers Logs に残し、本番 DB を手で書き換えずに直す。根拠: qa-v29 (2)、qa-r-infrastructure-3、qa-r-ops-3 (3)、system-spec/infrastructure.md。

#### Infrastructure verification

配る前の検査は、Deploy の同じ checkout での check:docs・型生成・typecheck・test:coverage・ビルド（cf:dry-run）・check:bundle-size である。自動適用後は、migrations list で未適用0件を確かめる（判定は scripts/verify-d1-migrations-list.mjs）。マイグレーションは、2回流して結果が変わらないことと、途中の状態を残さないことを要件として確かめる。本番の書き換えの前後は、読み取りだけで数える（手順は system-spec/maintenance-ops.md）。鮮度は、書き込み→強制再読み込みの E2E とローカル preview の再現、リリース後の本番の生成時刻ヘッダー、独自ドメインへ移すときのゾーンの規則の読み取り確認で確かめる。根拠: qa-v29、qa-v31 (4)、qa-r-infrastructure-3、O2、system-spec/release-and-forms.md、system-spec/infrastructure.md、system-spec/maintenance-ops.md。

## Architecture decisions

本章に効く確定意思決定は D-004〜D-007 である。D-004（opt-membership-cookie）は利用者が選んだ。本章は、所属の表の追加と移し替えをマイグレーションで配る。D-005（opt-pointer-hook）は利用者が選んだ（qa-v13）。依存が増えない案で、本章はこれに基づき新しい依存を足さない（qa-v29 (3)）。D-006（opt-combined）は利用者が選んだ画面の見せ方で、配信の構成は変えない。D-007（opt-route-ledger-extend）は、委任を受けて AI が選んだ案とは別の案を、利用者が3案の比較を見たうえで明示して選んだ（qa-v25、2026-10-13T03:40:15Z）。権限の定義を route-ledger.json に足すので、DB の表を足さない（qa-v29 (3)）。本章の要件は、2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (3) だけを①に直し、旧と新を逐語で示して承認を取り直したものである（qa-v29、2026-10-13T03:48:20Z）。既存の判断も保つ。構成の維持（qa-r-infrastructure-3 (4)）で、配備手順や容量検査（check:bundle-size）に新しい運用負担を持ち込まない。キャッシュを入れない（同 (1)）。鮮度を『保存して後から消す』問題にしない。Server Functions の refresh は今の画面を同じ応答で作り直すので、この既定と矛盾しない。将来サーバー側にキャッシュを入れるなら、Tag Cache の設定と組にすることが条件になる（qa-d01）。生成時刻を worker.ts で付けて、容量上限を守る（同 (2)）。根拠: qa-v29、qa-v13、qa-v25、qa-r-infrastructure-3、qa-d01、system-spec/infrastructure.md（本章に効く確定意思決定・適用された設計知識）。

## Delivery, migration and rollback

配る流れは GitHub Actions の Deploy workflow である。main のクリーンな checkout に対して、検査・ビルド → バックアップ → マイグレーション → 未適用0件の確認 → 配布の順を固定する。未適用の状態が判定できなければ、fail-closed で止まる（system-spec/release-and-forms.md）。追加要件の所属の表の追加と既存の利用者からの移し替え、等級名の一律の書き換えは、drizzle/migrations の 0033 以降の番号としてこの自動マイグレーションに乗せる。本番へ wrangler d1 migrations apply で適用するときは、--remote を明示する（公式文書は既定値を示さない）。失敗した番号はロールバックされ、前に成功した番号は残る（cloudflare-wrangler-d1-commands）。そのため、どの番号も2回流して結果が変わらないように書き、途中の状態を番号ごとに残さない。書き換え前の値を表に残し、戻す手順を用意する。Deploy の後の読み取りで英語の区分名が残っているなど、受入が崩れたときに使う。根拠: qa-v29 (1)(2)、qa-v31 (4)、system-spec/infrastructure.md、system-spec/release-and-forms.md、system-spec/maintenance-ops.md。

## Risks and verification

前提として、本章の要件は利用者の承認を得た文面である（qa-v29、2026-10-13T03:48:20Z）。2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (3) だけを①に直し、旧と新を逐語で示して承認を取り直した。『新しい依存を足さない』は、利用者が選んだ D-005 と qa-v29 の承認に基づく。『DB の表を足さない』は、利用者が選んだ D-007 ①（qa-v25）に基づく。危険の一つは、移し替えや一律の書き換えが、2回目の適用や途中の失敗で値を二重に変える・半端に残すことである。冪等な書き方と、書き換え前の値の記録で抑える。もう一つは、独自ドメインへ移したときに、ゾーンの規則が HTML や /api を保存して G2 を崩すことである。読み取りだけの規則の確認で抑える。D-005 は依存を増やさない代わりに、タッチでのスクロールとの区別を自分で作る（部品の中身は system-spec/frontend.md）。検証は、書き込み→強制再読み込みの E2E とローカル preview の再現で行う。リリース後の本番では、生成時刻ヘッダーが作成より後であることを確かめる（作成は利用者のふだんの操作で行い、エージェントは本番に書き込まない）。移行後の本番の等級名が『等級N』『等級N-M』の形であること、Deploy の各ゲート（check:bundle-size を含む）と migrations list の未適用0件も確かめる。O8・O10・O13 は、受入条件の測り方（権限の定義と、ルート台帳の accessClass・サーバー処理の最低ロールを照合する契約テスト、2社目への所属と所属外の拒否の結合テスト、並べ替えの部品のテスト）で確かめる。根拠: qa-v29、qa-v25、D-005、D-007、qa-r-infrastructure-3、O2・O6・O8・O10・O13、system-spec/infrastructure.md（受入条件）。


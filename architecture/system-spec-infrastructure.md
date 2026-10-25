---
graph_node_id: "arch-system-spec-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "インフラの配信構成とマイグレーション（KGI の削除は2回の Deploy、行動指針の割り当ての移行と本番の見本の会社の受付中の期）"
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
confirmation_evidence: {"evaluated_digest": "1ca84778f1037d9384127b45f6c5690efc4f9a28fe5ea30a86b1e93d4bdf244a", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-2026-10-22.json"}
source_lineage: {"imported_at": "2026-10-22T07:58:56Z", "origin_kind": "system-spec-harness", "source_digest": "1ca84778f1037d9384127b45f6c5690efc4f9a28fe5ea30a86b1e93d4bdf244a", "source_path": "system-spec/infrastructure.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-infrastructure.md", "confidence": 0.92}, {"artifact_kind": "specification", "candidate_path": "specs/system-spec-infrastructure.md", "confidence": 0.4}]
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

Next.js 16 系を OpenNext Cloudflare で1つの Cloudflare Worker に載せ、D1 を結び付けて workers.dev から配る構成である。この構成と配る先は変えない（Next.js だけ、脆弱性の修正を含む 16.3.8 へ上げる）。鮮度のために、OpenNext の既定（incremental cache・tag cache を使わない）と force-dynamic を保ち、ログイン後の画面をサーバーやエッジで保存しない。Worker が応答を作った時刻 x-generated-at を応答に付け、本番で切り分けられるようにする。2026-10-12 の追加要件では、所属の表の追加と既存の利用者からの移し替え、等級名の一律の書き換えを D1 のマイグレーション（drizzle/migrations の 0033 以降）で行い、本番の Deploy の自動マイグレーションと fail-closed のゲートに乗せる。どのマイグレーションも2回流して結果が変わらず、失敗したら途中の状態を残さない。書き換え前の値を表に残し、戻す手順を用意する。並べ替えは Pointer Events で自作し（D-005）、新しい依存を足さない。権限の定義は route-ledger.json に足し（D-007 ①）、DB の表を足さない。根拠: qa-v29（主）、qa-r-infrastructure-3（旧主根拠）、qa-v25、D-005、D-007、system-spec/infrastructure.md。

2026-10-19〜20 の追加: KGI の削除は2回の Deploy に分ける。1回目はコードだけ（表と列は残したまま読み書きをやめる）、2回目で表と列を消すマイグレーションを当てる。構成と依存は変えない（図は recharts、印刷はブラウザ）。
根拠: qa-x15（system-spec/infrastructure.md）

2026-10-20〜21 の追加: KGI の削除の「2回の Deploy」は、DD-020 のとおりに2回のマージとして読む。本番への公開は main へのマージで、Deploy workflow が自動で行う。前回の「1回目はコードだけ（表と列は残したまま読み書きをやめる）」を改めた：今は1回目の P05 の PR のマージで 0038 を当て、schema.ts から KGI の定義を外して読み書きをやめる。2回目は P08 の別の PR のマージで、0039 が KGI の3つの表と評価の2列を消し、P08 はコードを変えない。章の serves_goals には G17 が入った。
根拠: qa-z03、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 構成と配る先は変えない。行動指針の既定の割り当てへ戻すデータの移行（I26、G25）は通常の Deploy の流れで当て、戻すときは当てる前に Deploy workflow が書き出した d1-backup の Artifact から戻す。章のゴールに G28 を足し、提出済みの回答を含む受付中の評価期間を、手元の seed と本番の見本の会社の両方に置く。本番の見本の会社への投入は既存の db:sample:remote の手順で、実行の前に利用者の確認を取る。書き戻しと自動の下書き（I28・I29、G27）、共通部品の色（G29）、画面の分け方（G26）は新しい環境・バインディング・依存を足さず、色と手応えと画面の分け方は CSS と画面の変更だけで出す。
根拠: qa-ab10、qa-ab12、G25〜G29、appr-foundation-020（system-spec/infrastructure.md）

## Context and drivers

きっかけは、強制再読み込み（⌘+Shift+R）でも新しい会社が出なかった報告である（qa-u03）。ローカルの preview では応答が private, no-store で毎回新しい行を含んだ。そのため、本番のゾーンのキャッシュ規則など、アプリの外の要因も観測で切り分ける必要があった（qa-f08）。追加要件では、複数会社への所属（G10）と等級名の統一（G6）が、データの形と既存の本番データの書き換えを伴う。並べ替え（G13）は部品を、権限の一覧（G8）は権限の定義を足す。そのため、配信の基盤に変更を持ち込まずに流すことが論点になった。品質の優先は、再読み込みで必ず最新を返すこと（G2）、本番データの書き換えを途中で止めず戻せること、構成と運用負担を増やさないことである。制約は四つある。構成（Next.js 16 系・OpenNext Cloudflare 1.20 系・Workers・D1・better-auth）を変えない。本番 DB は読み取り専用で調べる。外部への変更系通信は preview → CONFIRM → authorize → execute のガードを通す。本番の等級名の書き換えはマイグレーションで行い、書き換え前の値を記録に残す（constraints）。根拠: qa-v29、qa-r-infrastructure-3、qa-f08、qa-u03、system-spec/infrastructure.md。

2026-10-19〜20 の追加: 2026-10-19 の依頼で KGI の表と列を消すことになり、本番の Deploy がマイグレーションをコードより先に当てる順番であるため、1回で出すとその間に古いコードが消えた表を読んで失敗することが分かった。
根拠: qa-x05、qa-x15（system-spec/infrastructure.md）

2026-10-20〜21 の追加: 評価レポートと上司の判断の計画レビュー（SYS-EVAL-REPORT-P01）で、Deploy の手順などの食い違いが見つかった。計画は「P13 で手動で2回公開する」だったが、main へマージすると自動で本番に出る仕組みと合わなかった。2026-10-20 に利用者は、自動の Deploy に合わせて読み替える案を選んだ（qa-z03 の2問目）。食い違いの直し先は、DD と計画レビューの記録で先に確定し、spec-state へは P12 がまとめて反映する案を選んだ（同1問目）。
根拠: qa-z03、DD-020〜DD-024（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 「評価を作る」画面を試すための仮のデータ（提出済みの回答を含み、氏名は実在しない「サンプル」など）を、どこに用意するかが論点になった。本物の会社のデータには入れない（README の規範）。利用者は、手元の見本だけでなく本番の見本の会社にも置くことを選んだ。行動指針の分け方が既定からずれた会社は、データを既定へ書き換えると決まった。
根拠: qa-ab12、qa-ab10（system-spec/infrastructure.md）

## Goals and non-goals

ゴールは infrastructure 章の serves_goals の G2・G6・G8・G10・G13 である。G2 は、通常・強制の再読み込みと直接表示が直前の書き込みを含むこと。G6 は、等級名の一律の書き換えを配ること。G8 は、権限の定義を route-ledger.json に足し、DB の表を足さずに支えること（D-007 ①）。G10 は、所属の表と移し替えを配ること。G13 は、並べ替えを新しい依存なしで支えること（D-005）。受入は O2・O6・O8・O10・O13 で判定する。O2 は、書き込み→強制再読み込みの E2E とローカル preview の再現、リリース後の本番で生成時刻ヘッダーが作成より後であること、ゾーンに HTML・/api を保存する規則が無いことの読み取り確認である。O6 は、移行後の本番の等級名が『等級N』『等級N-M』の形であること。O8 は、権限の定義と、ルート台帳の accessClass・サーバー処理の最低ロールを照合する契約テストが通ること。①では権限の定義もルート台帳に置くので、この検査はルート台帳の権限の定義とサイドバー・ページの判定・サーバー処理の役割の指定が一致することを見る（qa-v31 (3)）。O10 と O13 は受入条件の測り方による。非ゴールは、配信構成や配る先の変更、サーバー側キャッシュ（incremental cache・tag cache）の導入、別の利用者の画面への即時配信（WebSocket などの push）、等級名と等級名を含む表示名の一律の書き換え以外の本番データの移行である。根拠: qa-v29、qa-r-infrastructure-3 (1)(4)、qa-v25、qa-v31 (3)、D-005、D-007、O8、scope.out、system-spec/infrastructure.md（To-Be / Delta）、system-spec/maintenance-ops.md。

2026-10-19〜20 の追加: Goals: KGI の削除の間に古いコードが失敗しないこと、消す前の値を残すこと。Non-goals: 構成・依存・配信の手順の変更、レポートのファイルをサーバーで作る仕組み。
根拠: qa-x15、qa-x07（system-spec/infrastructure.md、system-spec/00-requirements-definition.md の U7）

2026-10-20〜21 の追加: 前回の「ゴールは serves_goals の G2・G6・G8・G10・G13」を改めた：今は G17 も入る（G28 は 2026-10-21〜22 の分）。G17 は、事業所KGIの達成率の仕組み（メニュー・画面・計算・保存・表・列・文書・テスト）を残さず消し、賞与（仮）を KGI を使わない式で出し続けることである。式は、個人Pt＝KPI評価点の合計、賞与額＝個人Pt×昇給の設定の1点あたりの円である。受入は O17 で判定する。
根拠: G17、O17、qa-z05、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 章の serves_goals に G28 を足した。G28 は、評価・結果を確認する画面で「提出済みの回答から評価を作る」を試せるよう、提出済みの回答を含む受付中の評価期間の仮のデータを、手元の見本と本番の見本の会社の両方に用意することである。受入は O28 で判定する。範囲の外の「本番データの移行・修正」は、この仕様で行を書き換える移行（0032〜0036・0039）と行動指針の既定の割り当てへの書き換え（I26）を除く形に改めた。「本番 DB へのテストデータ（手元の seed と E2E のデータ）の投入」は範囲の外のままで、本番の見本の会社への仮のデータ（G28・I31）は除く。
根拠: G28、O28、qa-ab12、appr-foundation-019、appr-foundation-020（system-spec/infrastructure.md）

## System context and boundaries

利用者は Web・モバイル・タブレットのブラウザから workers.dev の Worker に届く。デスクトップのネイティブアプリは対象外である（appr-platform-001・qa-u08）。今は wrangler.jsonc に routes が無く、workers.dev だけで配るので、ゾーンのキャッシュ規則は効かない。独自ドメインへ移すときは、HTML や /api を保存する規則が無いことを読み取りだけで確かめる。変更が要れば、外部への変更として確認を取ってから行う。データの境界は Worker に結び付けた D1 で、ログイン後の応答は共有のキャッシュに載せない。運用の境界として、本番への変更（マイグレーションの適用・secret の設定）は GitHub Actions の Deploy と外部変更ガードを通す。エージェントは本番 DB を読み取りだけで調べる。根拠: qa-r-infrastructure-3 (3)、qa-f08、qa-v29 (1)、system-spec/infrastructure.md。

2026-10-20〜21 の追加: 本番への反映の入口は、main へのマージで動く Deploy workflow の自動の公開だけにする。KGI の削除の2回の公開も、この入口だけを通す。
根拠: qa-z03、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 仮のデータは本物の会社には入れない。本番では見本の会社に紐づく行だけを INSERT で足し、他社の行に触れない。本番の見本の会社に受付中の期を作るので、本番の未回答の一覧に見本の人が並ぶ。製品仕様 §14 の「受付中の期は作らない」を改め、この影響を記す。
根拠: qa-ab12、I31、O28（system-spec/infrastructure.md）

## Container and component view

配る単位は OpenNext Cloudflare でビルドした1つの Worker である。open-next.config.ts は defineCloudflareConfig() の既定のままで、incremental cache・tag cache・queue を持たない。worker.ts は Next.js の外側で、成功・失敗どちらの応答にも（101 など作り直せない応答を除く）x-generated-at を付ける。ミドルウェアに置かないことで、サーバー側の実行ファイルの容量上限を守る。データは D1 の1つのデータベースで、版は drizzle/migrations の番号付きの .sql で管理する。追加要件の所属の表と移し替え・等級名の一律の書き換え（書き換え前の値を残す表を含む）は、0033 以降の番号で足す。並べ替え（D-005）のために新しい依存を足さない。権限の定義（D-007 ①）は route-ledger.json に足し、D1 の表を足さない。Workers Logs（observability を有効）は、要求ごとのログと compensation_failed・rollforward_failed の構造化ログを受ける。控えの暗号化の鍵 CREDENTIAL_ENC_KEY は、Workers の secret として結び付ける。根拠: qa-r-infrastructure-3 (1)(2)(5)、qa-f08、qa-v29 (1)(2)(3)、system-spec/infrastructure.md。

2026-10-20〜21 の追加: drizzle/migrations の番号に、1回目で当てる 0038 と、KGI の3つの表と評価の2列を消す 0039 が加わる。1回目の P05 で、schema.ts から KGI の定義を外す。0039 を戻すときは、drizzle/rollback/0039_* と Deploy workflow の Artifact の書き出しを使う。印刷のための配信の経路は作らない。
根拠: qa-z03、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: scripts/sample-data.mjs の見本の会社に受付中の評価期間を1つ足し、提出済み・下書き・未回答を混ぜる。作り方は buildSeed の使い回しのままにする。手元の seed（scripts/seed-data.mjs）の受付中の期にも、評価を作る画面で試せる人数の提出済みを持たせる。色と手応え（G29）と画面の分け方（G26）は、CSS と画面の変更だけで出す。
根拠: qa-ab12、I31、G26、G29（system-spec/infrastructure.md）

## Cross-cutting contracts

アクセスは、本番の D1 と Cloudflare の設定を読み取りだけで調べる形にそろえる。マイグレーションの適用・secret の設定・ゾーンの規則の変更は、外部への変更として確認を取ってから行う。誤りと回復の前提は、公式文書 cloudflare-wrangler-d1-commands の動きである。wrangler d1 migrations apply は、途中でエラーになった番号をロールバックし、それより前に成功した番号は適用済みのまま残す。そのため、マイグレーションは2回流しても結果が変わらないように書き、途中の状態を残さない要件（qa-v29 (2)）を番号ごとに満たす。残った番号は、書き換え前の値の記録と戻す手順で扱う。観測は、応答の生成時刻ヘッダーと Workers Logs で行う。設定と秘密は、CREDENTIAL_ENC_KEY をローカルは .dev.vars、本番は wrangler secret put で置き（deploy-notes §6）、値をリポジトリにも DB にも置かない。互換は、構成（Next.js 16 系・OpenNext・Workers・D1）と配る先を変えないことで保つ。並べ替えは Pointer Events で自作して新しい依存を足さず（D-005）、権限の定義は route-ledger.json に足して DB の表を足さない（D-007 ①）。根拠: qa-v29 (2)(3)、qa-r-infrastructure-3 (2)(5)、D-005、D-007、system-spec/infrastructure.md（最新ドキュメント出典）。

2026-10-20〜21 の追加: KGI の削除の記録は、P13 が docs/deploy-notes.md の配布の記録に書く。書くのは、2回目の前に数えた値、Deploy workflow の2回の実行 id・sha・時刻、書き出しの Artifact の id、2回目の後の確かめの結果である。どの確かめも SELECT と PRAGMA だけで行い、本番 DB には書かない。
根拠: qa-z03、qa-y16 (9) の訂正、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 本番の見本の会社への投入は、実行の前に利用者の確認を取り、実行の記録を配布の記録（docs/deploy-notes.md）に残す。I26 の移行の後と見本の投入の後の確かめは、SELECT など読み取りだけで行う。出典の opennext-cloudflare-caching と opennext-cloudflare-get-started は、@opennextjs/cloudflare 1.20.13 で 2026-10-22 に取り直した。
根拠: qa-ab12、I26、I31（system-spec/infrastructure.md）

## Subtype architecture

合成対象の subtype と該当テンプレート:

- Frontend: N/A: subtype 非選択
- Backend: N/A: subtype 非選択
- Infrastructure: 合成済み (`architecture-infrastructure.md`)
- Data: N/A: subtype 非選択
- Security: N/A: subtype 非選択

### Infrastructure architecture

#### Environments and topology

環境はローカル（preview で Workers 相当を動かし、D1 はローカル、秘密は .dev.vars）と本番（GitHub Actions の Deploy から配る Worker と本番の D1）の2つで、E2E はローカルの preview だけに向け、ローカル以外へは LOCAL_HOSTS で止める。本番は workers.dev だけで配っており（wrangler.jsonc に routes が無い）、ゾーンのキャッシュ規則は効かない。独自ドメインへ移すときは HTML や /api を保存する規則が無いことを読み取りだけで確かめ、変更は外部への変更として確認を取ってから行う。Web・モバイル・タブレットのブラウザは同じ Worker と D1 を使い、端末による違いは無い。根拠: qa-r-infrastructure-3 (3)(5)、qa-r-ops-3 (2)、qa-f08、system-spec/infrastructure.md。

2026-10-21〜22 の追加: 受付中の評価期間の仮のデータは、手元の seed（scripts/seed-data.mjs）と本番の見本の会社の両方に置く。本番の見本の会社へは既存の db:sample:remote の手順で入れる。「提出済みの回答から評価を作る」の E2E は手元の見本で流す。
根拠: qa-ab12、I31、O28（system-spec/infrastructure.md）

#### Compute and storage

計算は OpenNext Cloudflare で載せた1つの Worker で、Next.js 16 系（16.3.8 へ上げる）を force-dynamic で動かし、要求のたびに D1 から読む。保存先は D1 だけで、OpenNext の incremental cache・Queue・Tag Cache は設定しない。追加要件の所属の表と書き換え前の値を残す表も、同じ D1 に置く。並べ替えは Pointer Events で自作して新しい依存を足さず（D-005）、権限の定義は route-ledger.json に足して D1 の表を足さない（D-007 ①）。容量は、サーバー側の実行ファイルの上限を check:bundle-size で守る。応答の生成時刻をミドルウェアでなく worker.ts で付けるのも、このためである。費用の面では、他タブの最新化で定期的な取り直し（1秒間隔なら1画面で1日 86,400 要求）を退けた D-001 の判断で、要求の増加を避けている。章として別の予算の数値は置いていない。根拠: qa-r-infrastructure-3 (1)(2)(4)、qa-v29 (1)(3)、qa-f08、qa-f09、D-001、D-005、D-007、system-spec/infrastructure.md。

2026-10-20〜21 の追加: D1 からは、2回目の 0039 で KGI の3つの表と評価の2列が消える。消す前の本番 D1 の全体は、Deploy workflow の Artifact（保管14日）に書き出される。
根拠: qa-z03、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: I26 の移行は、行動指針の割り当ての列だけを書き換える。見本の受付中の期は INSERT だけで、見本の会社に紐づく行だけを足す。書き戻しと自動の下書き（I28・I29、G27）、共通部品の色（G29）、画面の分け方（G26）は、新しい環境・バインディング・依存を足さない。
根拠: qa-ab10、qa-ab12、I26、I31（system-spec/infrastructure.md）

#### IaC and delivery

構成は、wrangler.jsonc（D1 のバインディング・observability）と open-next.config.ts をリポジトリで管理する。D1 の版は、drizzle/migrations の番号付きの .sql と適用済みを記録する表で管理する。配布は、main の追跡済みコミットを GitHub Actions のクリーンな checkout から行う。check:docs・型生成・typecheck・test:coverage・ビルド・check:bundle-size を通した後、未適用があるときだけバックアップを取ってから自動で適用し、migrations list の未適用0件を確かめてから配る。Deploy と手動の Migrate は同じ concurrency group で直列にする。未知の出力・認証失敗・矛盾した出力は clear とみなさず止める（system-spec/release-and-forms.md）。0033 以降の追加のマイグレーションもこの流れに乗せ、手で本番 DB に流さない。本番へ手で適用する場合も --remote を明示する。根拠: qa-v29 (1)、system-spec/release-and-forms.md、system-spec/infrastructure.md（最新ドキュメント出典 cloudflare-d1-migrations・cloudflare-wrangler-d1-commands）。

2026-10-19〜20 の追加: KGI の削除は2回の Deploy（1回目はコードだけ、2回目でマイグレーション）。構成と依存は変えない。
根拠: qa-x15（system-spec/infrastructure.md）

2026-10-20〜21 の追加: 前回の「1回目はコードだけ、2回目でマイグレーション」を改めた：今は1回目の P05 の PR のマージで 0038 を、2回目の P08 の PR のマージで 0039 を、Deploy workflow が当てる。P08 はコードを変えない。P13 は手で公開せず、CI の実行番号と backup、本番の読み取りを記録する役にする。
根拠: qa-z03、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 割り当ての移行（I26）は通常の Deploy の流れで当て、手で db:migrate:remote を流さない。本番の見本の会社への投入は既存の db:sample:remote の手順で行い、実行の記録を配布の記録（docs/deploy-notes.md）に残す。色と手応え（G29）と画面の分け方（G26）は CSS と画面の変更だけで出す。
根拠: qa-ab12、I26、I31、G28（system-spec/infrastructure.md）

#### Secrets and access

秘密の正本は Workers の secret で、控えの暗号化の鍵 CREDENTIAL_ENC_KEY（32 バイトを base64 にしたもの）をローカルは .dev.vars、本番は wrangler secret put で置く手順を deploy-notes §6 に書き、値はリポジトリにも DB にも置かない。本番への secret の設定・マイグレーションの適用・ゾーンの規則の変更は、外部への変更として preview → CONFIRM → authorize → execute のガードを通し、確認を取ってから行う。エージェントは本番 DB を読み取りだけで調べ、本番に書き込まない。根拠: qa-r-infrastructure-3 (3)(5)、constraints、system-spec/infrastructure.md。

2026-10-21〜22 の追加: 本番の見本の会社への投入（db:sample:remote）は、実行の前に利用者の確認を取る。仮のデータの氏名は実在しない「サンプル」などにし、本物の会社のデータには入れない（README の規範）。
根拠: qa-ab12、I31（system-spec/infrastructure.md）

#### Reliability and recovery

SLO の数値は置かない。鮮度の信頼性は O2（書き込み直後の再読み込みで反映率 100%）で測り、Workers Logs で要求と失敗を読む。バックアップは、未適用のマイグレーションがあるときに Deploy が本番 D1 を取得して保管し、取得に失敗したら適用しない（system-spec/release-and-forms.md）。マイグレーションは、失敗した番号がロールバックされ、前の番号が残る。そのため、どの番号も2回流して結果が変わらないようにする。書き換え前の値の表と戻す手順で、等級名の一律の書き換えを元に戻せるようにし、障害のときに人が推測で戻す作業を残さない。会社の追加の取り消しやパスワード変更の続きまで失敗したときは、compensation_failed・rollforward_failed を Workers Logs に残し、本番 DB を手で書き換えずに直す。根拠: qa-v29 (2)、qa-r-infrastructure-3、qa-r-ops-3 (3)、system-spec/infrastructure.md。

2026-10-19〜20 の追加: 2回目の前に本番 DB を読み取りで数え、消す前の値を Deploy の自動バックアップに残す。
根拠: qa-x15（system-spec/infrastructure.md）

2026-10-20〜21 の追加: 0039 を当てる直前の2回目の書き出しが、消した値を戻すときの元になる。2回目を戻すときは、drizzle/rollback/0039_* と Artifact の書き出しから、KGI の表と列だけを入れ直す。書き出しの保管は14日である。
根拠: qa-z03、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 既定の割り当てへ戻す移行（I26）は、Deploy workflow が当てる前に書き出す d1-backup の Artifact を戻す元にする。書き換えた会社と、既定のまとまりが無くて書き換えなかった会社の数を、読み取りで数えて記録する。
根拠: qa-ab10、I26、G25（system-spec/infrastructure.md）

#### Infrastructure verification

配る前の検査は、Deploy の同じ checkout での check:docs・型生成・typecheck・test:coverage・ビルド（cf:dry-run）・check:bundle-size である。自動適用後は、migrations list で未適用0件を確かめる（判定は scripts/verify-d1-migrations-list.mjs）。マイグレーションは、2回流して結果が変わらないことと、途中の状態を残さないことを要件として確かめる。本番の書き換えの前後は、読み取りだけで数える（手順は system-spec/maintenance-ops.md）。鮮度は、書き込み→強制再読み込みの E2E とローカル preview の再現、リリース後の本番の生成時刻ヘッダー、独自ドメインへ移すときのゾーンの規則の読み取り確認で確かめる。根拠: qa-v29、qa-v31 (4)、qa-r-infrastructure-3、O2、system-spec/release-and-forms.md、system-spec/infrastructure.md、system-spec/maintenance-ops.md。

2026-10-19〜20 の追加: 1回目の後に KGI の画面が 404 になること、2回目の後に表と列が無いことを読み取りで確かめる。
根拠: qa-x15、qa-y16（system-spec/infrastructure.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: P05 をマージする前に、P06 の自動テストと bundle の大きさ・cf:dry-run を P05 の PR の上で通す。2回目の公開の後に KGI の3つの表と評価の2列が無いことを確かめるのは、SELECT と PRAGMA だけで行う。
根拠: qa-z03、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: I26 の移行を当てた後に、既定の割り当てになった会社の数と書き換えなかった会社の数を SELECT だけで確かめる。見本の受付中の期は、流す前に見本の会社の行だけが変わることを手元で確かめる。本番に入れた後は、見本の会社の期が1つ受付中になり、他社の行の数が変わらないことを読み取りで確かめる。
根拠: qa-ab10、qa-ab12、I26、I31（system-spec/infrastructure.md）

## Architecture decisions

本章に効く確定意思決定は D-004〜D-007 である。D-004（opt-membership-cookie）は利用者が選んだ。本章は、所属の表の追加と移し替えをマイグレーションで配る。D-005（opt-pointer-hook）は利用者が選んだ（qa-v13）。依存が増えない案で、本章はこれに基づき新しい依存を足さない（qa-v29 (3)）。D-006（opt-combined）は利用者が選んだ画面の見せ方で、配信の構成は変えない。D-007（opt-route-ledger-extend）は、委任を受けて AI が選んだ案とは別の案を、利用者が3案の比較を見たうえで明示して選んだ（qa-v25、2026-10-13T03:40:15Z）。権限の定義を route-ledger.json に足すので、DB の表を足さない（qa-v29 (3)）。本章の要件は、2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (3) だけを①に直し、旧と新を逐語で示して承認を取り直したものである（qa-v29、2026-10-13T03:48:20Z）。既存の判断も保つ。構成の維持（qa-r-infrastructure-3 (4)）で、配備手順や容量検査（check:bundle-size）に新しい運用負担を持ち込まない。キャッシュを入れない（同 (1)）。鮮度を『保存して後から消す』問題にしない。Server Functions の refresh は今の画面を同じ応答で作り直すので、この既定と矛盾しない。将来サーバー側にキャッシュを入れるなら、Tag Cache の設定と組にすることが条件になる（qa-d01）。生成時刻を worker.ts で付けて、容量上限を守る（同 (2)）。根拠: qa-v29、qa-v13、qa-v25、qa-r-infrastructure-3、qa-d01、system-spec/infrastructure.md（本章に効く確定意思決定・適用された設計知識）。

2026-10-19〜20 の追加: KGI の削除を2回の Deploy に分ける。上司の判断の列（2026-10-20）は足すだけのマイグレーションなので、今の順番のまま1回で出せる（system-spec/database.md (14)）。
根拠: qa-x15、qa-y15（system-spec/infrastructure.md、system-spec/database.md）

2026-10-20〜21 の追加: 計画レビューで決めた中身は DD-020〜DD-024（docs/product/design-decisions.md）と計画レビューの受領書に記録し、この章にはその訂正を当てて書き直した。本章に効くのは DD-020 で、qa-x15 (4) の「2回の Deploy」は DD-020 のとおりに読む。qa-x15 の答は凍結された記録として変えず、食い違うときは訂正のほうを正とする。利用者は、統合ブランチで1回にまとめる案と、新しい画面を P07 まで閉じる案を選ばなかった（qa-z03 の2問目）。上司の判断の追加では、この章を reopen していない。
根拠: qa-z03、DD-020〜DD-024（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 要件の土台の承認は、completeness evaluator の FAIL（foundation_trace）を受けて appr-foundation-016 から 020 まで取り直し、そのたびに前の承認を置き換えた。017 では G29 をボタン以外の共通部品へ広げ、I33 を足した。018 では、I28・I29 が DD-015・DD-016 を改めるので、改める DD を書いてから実装し、公開の前の検査（staleAskingItems）は残す制約を足した。019 と 020 では範囲の外の文を改め、行を書き換える移行と I26、本番の見本の会社への仮のデータを除外に挙げた。見本の受付中の期のために、製品仕様 §14 の「受付中の期は作らない」を改める DD を書く。
根拠: appr-foundation-016〜020（qa-ab13・qa-ab15〜qa-ab18）、qa-ab14、O28（system-spec/infrastructure.md）

## Delivery, migration and rollback

配る流れは GitHub Actions の Deploy workflow である。main のクリーンな checkout に対して、検査・ビルド → バックアップ → マイグレーション → 未適用0件の確認 → 配布の順を固定する。未適用の状態が判定できなければ、fail-closed で止まる（system-spec/release-and-forms.md）。追加要件の所属の表の追加と既存の利用者からの移し替え、等級名の一律の書き換えは、drizzle/migrations の 0033 以降の番号としてこの自動マイグレーションに乗せる。本番へ wrangler d1 migrations apply で適用するときは、--remote を明示する（公式文書は既定値を示さない）。失敗した番号はロールバックされ、前に成功した番号は残る（cloudflare-wrangler-d1-commands）。そのため、どの番号も2回流して結果が変わらないように書き、途中の状態を番号ごとに残さない。書き換え前の値を表に残し、戻す手順を用意する。Deploy の後の読み取りで英語の区分名が残っているなど、受入が崩れたときに使う。根拠: qa-v29 (1)(2)、qa-v31 (4)、system-spec/infrastructure.md、system-spec/release-and-forms.md、system-spec/maintenance-ops.md。

2026-10-19〜20 の追加: 2回目の Deploy の前に本番 DB を読み取りで数え、消す前の値を Deploy の自動バックアップに残す。Deploy は外部変更ガードを通す。
根拠: qa-x15、qa-y16（system-spec/infrastructure.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: 1回目の P05 と2回目の P08 は、どちらも未適用の migration があるので、Deploy workflow が本番 D1 の全体を Artifact に書き出してから当てる。Artifact の名前は d1-backup に実行の id を付けたもので、保管は14日である。手で deploy せず、db:migrate:remote・db:backup も手で流さない。2回目を戻すときは DB だけを戻し、P08 のマージの後は P05 を revert しない。
根拠: qa-z03、DD-020（system-spec/infrastructure.md）

2026-10-21〜22 の追加: 行動指針の既定の割り当てへの移行（I26）は通常の Deploy の流れで当て、手で db:migrate:remote を流さない。Deploy workflow が未適用のマイグレーションの前に本番 D1 の全体を d1-backup の Artifact に書き出す今の流れのまま当て、戻すときはその書き出しから戻す。この仕様で足した移行のうち行を書き換えるのは 0032・0033・0034・0035・0036・0039 で、0037・0038 は表と列の追加だけである。本番の見本の会社への受付中の期の追加は db:sample:remote の手順で、流す前に見本の会社の行だけが変わることを手元で確かめ、利用者の確認の後に流す。
根拠: qa-ab10、qa-ab12、I26、I31、appr-foundation-020（system-spec/infrastructure.md）

## Risks and verification

前提として、本章の要件は利用者の承認を得た文面である（qa-v29、2026-10-13T03:48:20Z）。2026-10-13T00:03:46Z に全文で承認された文面のうち、D-007 にかかわる本章の項目 (3) だけを①に直し、旧と新を逐語で示して承認を取り直した。『新しい依存を足さない』は、利用者が選んだ D-005 と qa-v29 の承認に基づく。『DB の表を足さない』は、利用者が選んだ D-007 ①（qa-v25）に基づく。危険の一つは、移し替えや一律の書き換えが、2回目の適用や途中の失敗で値を二重に変える・半端に残すことである。冪等な書き方と、書き換え前の値の記録で抑える。もう一つは、独自ドメインへ移したときに、ゾーンの規則が HTML や /api を保存して G2 を崩すことである。読み取りだけの規則の確認で抑える。D-005 は依存を増やさない代わりに、タッチでのスクロールとの区別を自分で作る（部品の中身は system-spec/frontend.md）。検証は、書き込み→強制再読み込みの E2E とローカル preview の再現で行う。リリース後の本番では、生成時刻ヘッダーが作成より後であることを確かめる（作成は利用者のふだんの操作で行い、エージェントは本番に書き込まない）。移行後の本番の等級名が『等級N』『等級N-M』の形であること、Deploy の各ゲート（check:bundle-size を含む）と migrations list の未適用0件も確かめる。O8・O10・O13 は、受入条件の測り方（権限の定義と、ルート台帳の accessClass・サーバー処理の最低ロールを照合する契約テスト、2社目への所属と所属外の拒否の結合テスト、並べ替えの部品のテスト）で確かめる。根拠: qa-v29、qa-v25、D-005、D-007、qa-r-infrastructure-3、O2・O6・O8・O10・O13、system-spec/infrastructure.md（受入条件）。

2026-10-19〜20 の追加: リスクは、1回目の Deploy の前に表を消すマイグレーションが混ざることである。1回目の後に KGI の画面が開けないことを確かめ、2回目の後に本番 DB に3つの表と2列が無いことを読み取りで確かめる。
根拠: qa-x15、qa-y16（system-spec/infrastructure.md、system-spec/maintenance-ops.md）

2026-10-20〜21 の追加: O17 の測り方を改めた。src・docs・route-ledger・nav で KGI の参照を探す静的検査が0件であることを見る。docs のうち経緯を残す5種類（受領書・バックログの履歴・レビューの記録・判断の記録・デプロイ時の注意）は走査から外し、外す先が実在することも同じ検査で確かめる。賞与の計算の単体テストで、個人Pt＝KPI評価点の合計とし、1点あたりの円が0以下なら賞与額を出さないことを確かめる。表と列が無いことを読み取りで確かめる「2回目」は、P08 の PR のマージで Deploy workflow が動く2回目の公開を指し、推測で閉じない。
根拠: qa-z05、O17、DD-020・DD-024（system-spec/infrastructure.md）

2026-10-21〜22 の追加: O28 は、見本の生成のテストで確かめる。受付中の期が1つあり、提出済み・下書き・未回答が混ざり、評価はまだ作られておらず、氏名と会社が見本の印を持ち、他社の行に触れないことを見る。あわせて、手元の見本で「提出済みの回答から評価を作る」を押し、評価の一覧と詳細まで進める E2E を流す。I26 の移行と見本の期の投入の後は、本番を読み取りだけで数えて確かめる。
根拠: qa-ab12、O28、I31、I26（system-spec/infrastructure.md）


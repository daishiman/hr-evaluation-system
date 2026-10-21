---
graph_node_id: "arch-system-spec-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "データ設計：D1 の原子的な書き込み、会社への所属、KGI の表の削除と上司の判断の列"
project_id: "hr-evaluation-system"
domain: "database"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["system-spec", "改善要望対応"]
file_path: "architecture/system-spec-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ba03443e57707dd979ab24d15c45ab13e0bee08dee4f589cade16b2aa5365667", "evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-2026-10-20-z.json"}
source_lineage: {"imported_at": "2026-10-19T22:19:04Z", "origin_kind": "system-spec-harness", "source_digest": "ba03443e57707dd979ab24d15c45ab13e0bee08dee4f589cade16b2aa5365667", "source_path": "system-spec/database.md", "source_plugin": "system-spec-harness", "source_version": "0.1.22"}
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
classification_reason: "確定した技術章（system-spec の章）で、構成・境界・横断契約・決定を記す architecture の取込。"
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/system-spec-database.md", "confidence": 0.92}, {"artifact_kind": "specification", "candidate_path": "specs/system-spec-database.md", "confidence": 0.4}]
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

# Architecture overview

Cloudflare D1（SQLite 互換）を drizzle-orm/d1 で使い、getDb() が要求ごとに env.DB から drizzle を作る1つのデータベースの構成を保つ。書き込みの原子性は、1回の D1 batch に入るものは batch、入りきらない会社追加だけ段階ごとの書き込みと取り消しの組（withCompensation）、取り消せない認証ライブラリの書き込みの続きはやり直し、の3つの型で守る。読み取りは primary に届く今の方式で、書き込みを確定した後の読み取りは同じ要求でも次の要求でも最新を返す。2026-10-12 の追加で、会社ごとの役割・等級・事業所・上司は所属の表を正とする（D-004）。等級名を含む表示名・一覧の等級と点数・アンケートの提出状況は保存せず、既存の表から表示のたびに作る。権限の定義は業務データではなく仕様の台帳（route-ledger.json）の定義なので、DB に持たない（D-007）。
根拠: qa-v26、qa-r-database-3、qa-f07、D-004、D-007（system-spec/database.md）

2026-10-19〜20 の追加: KGI の3つの表（kgi_coefficients・office_kgi_results・office_kgi_revisions）と評価の表の2列（office_achievement_rate・kgi_coefficient）を消す。レポートのための新しい表は作らず、確定済みの評価と評価の項目から作る。評価の表に上司の判断の6列（NULL 可）を足す。シードに、複数の期の確定済みの評価・アンケートの各状態・ズレの3種類・直属の部下の関係・判断の5通りを足す。
根拠: qa-y15（system-spec/database.md）

## Context and drivers

業務の文脈は、書き込みの結果が一覧へすぐ出ず、会社追加が会社・管理者・所属を別々に書いて途中の失敗で中途状態が残り得たことにある。加えて、等級名に英語の区分名が混ざり、users.email が一意で会社への所属を表す表が無いため、2社目に登録できない。優先する品質は、書き込み直後の読み取りの鮮度（G2）、途中失敗で一部を残さない原子性（G5）、等級名の一貫した反映（G6）、実際の判定と食い違わない権限の一覧（G8）、確定済みの最新評価との一致（G9）、所属による会社の境界（G10）、対象者全員の提出状況（G11）、並び順の全体の保存（G13）である。制約は、D1 に対話的なトランザクションが無いこと、1文の bound parameter を99個以下に分けること（chunkRowsForD1）、Workers・D1 の構成を変えないこと、本番 DB は読み取り専用で調べることである。
根拠: qa-f02、qa-f06、qa-f07、qa-v01、qa-v26、D-003（system-spec/database.md、system-spec/00-requirements-definition.md の U2・U8）

2026-10-19〜20 の追加: 2026-10-19 の依頼（KGI の削除・評価レポート・全ての項目を確かめられるテストデータ）と 2026-10-20 の依頼（上司の判断）で、表の削除・列の追加・シードの拡張が必要になった。優先する品質は、本番のデータを壊さずに消すこと（G17）、テストデータで全ての画面と項目が出ること（G20）、判断を記録してもとの点数の判定を書き換えないこと（G24）である。
根拠: qa-x01、qa-y01、qa-y15（system-spec/database.md、system-spec/00-requirements-definition.md）

## Goals and non-goals

Goals: 複数の表を書く書き込みの中途状態を0件にする（G5）。書き込み直後の再読み込みが必ず結果を含む（G2）。等級名の変更が次の表示から全てに反映される（G6）。権限の定義を DB に持たず、表示と判定が route-ledger.json の同じ定義を読む（G8）。一覧の等級と点数がいつ見ても確定済みの最新と一致する（G9）。同じ人が1つのアカウントのまま複数の会社に所属できる（G10）。提出状況を対象者全員について既存の表から求められる（G11）。並び順の全体を1回の batch で保存できる（G13）。Non-goals: 読み取りの複製（read replication）を今は入れない。提出状況のための新しい表や一覧用の写しの列を作らない。権限の定義の表と編集画面を作らない。控えの掃除のために決まった時刻に動く仕組みを足さない。等級名の一律の書き換えを除く本番データの移行・修正を行わず、等級の id と pointGroup の値を変えない。
根拠: qa-v26、qa-r-database-3、D-007（system-spec/database.md の To-Be / Delta）

2026-10-19〜20 の追加: Goals: KGI の表と列を2回目の Deploy で消す。判断の列を既存の行を書き換えずに足す。シードを2回流しても同じ結果にする。Non-goals: レポートの写しの表、判断の履歴の表、本番 DB へのテストデータの投入、確定済みの評価の個人Pt・賞与額・根拠の文の作り直し。
根拠: qa-y15、qa-y07（system-spec/database.md、system-spec/00-requirements-definition.md の U7）

## System context and boundaries

書き込み元は、画面から呼ぶ Server Functions（runAction）、外部のエージェント向け API（Bearer 鍵）と端末の承認、利用記録である。スマホ・タブレットのブラウザも同じ API と D1 を使うため、端末による違いは無い。会社の境界は companyId で、所属の導入後は、cookie が指す会社への所属をサーバーがリクエストのたびに確かめて決めた会社になる（D-004）。会社をまたぐ参照を作らず、会社追加の集約の外にある他社の行には触れない。秘密の境界として、初期パスワードの控えは平文の列を持たず、暗号の鍵は DB に置かない。データの形の変更は drizzle/migrations を通し、本番は Deploy の自動マイグレーションで反映する。
根拠: qa-r-database-3、qa-f02、qa-v26、qa-v27、qa-v29、qa-r-security-3、D-004（system-spec/database.md、system-spec/auth.md、system-spec/infrastructure.md、system-spec/security.md）

## Container and component view

D1 データベース（env.DB）が唯一の永続化先で、src/db/schema.ts の表（会社・事業所・利用者・セッションとアカウント・等級以下の制度設定・評価期間・アンケートと回答・評価・改善要望など）を持つ。永続化層（src/lib）は getDb()、一括挿入を分ける chunkRowsForD1、会社追加の制度ひな形を複製する copyCompanyMasters（src/lib/template.ts）、段階と取り消しの組を持つ withCompensation を受け持ち、取り消しを書き込みの関数の中に散らさない。追加で、所属の表とその読み書きの関数、等級名の書き換え前の値を残す記録用の表、等級名の変更と所属の追加・削除を残す監査ジャーナル、表示名の生成元になる等級の呼び名の共通の関数を置く。権限の定義は route-ledger.json に足し、DB の表を足さない（D-007）。配置は Cloudflare Workers（OpenNext）と D1 の今の構成のまま変えない。
根拠: qa-f02、qa-f07、qa-r-database-3、qa-v26、qa-v29、qa-v30、D-007（system-spec/database.md、system-spec/backend.md、system-spec/infrastructure.md）

2026-10-19〜20 の追加: 評価の表（evaluations）に raise_decision・promotion_decision（'follow' か 'override'。NULL は記録なし）、raise_decision_reason・promotion_decision_reason（文字列、NULL 可）、decision_recorded_by（利用者の参照。evaluator_id と同じ扱い）、decision_recorded_at（時刻）を足す。点数の判定の列（raise_eligible・promotion_eligible と理由の列）は変えない。個人Pt・賞与額・根拠の文の列と、昇給の設定の1点あたりの円は残し、評価と回答の事業所の写し（office_id）はレポートの見出しに使うので残す。
根拠: qa-y15（system-spec/database.md）

## Cross-cutting contracts

識別とアクセス: 全ての読み書きを選んでいる会社の所属で絞る。選んでいる会社は cookie の値をそのまま信じず、リクエストのたびに所属で確かめて決める（D-004）。一般の社員への応答には、他人の等級と点数をデータを作る段階で含めない。エラーと回復性: batch は全部書けるか何も書かれないかで、会社追加は逆順に取り消す。制度マスタの同時保存は後のほうの batch を丸ごと失敗させて 409 で断り、自動でやり直さない。可観測性と監査: 取り消しの失敗は compensation_failed として Workers Logs に残す。等級名の変更と所属の追加・削除は監査ジャーナルに変更前と変更後を、一律の書き換えは書き換え前の値を残す。設定と秘密: 控えの表は暗号文・初期化ベクトル・鍵の版だけを持ち、鍵は Workers の secret に置く。互換性: 等級の id と pointGroup を変えず、マイグレーションは2回流しても結果が変わらない。
根拠: qa-r-database-3、qa-r-backend-4、qa-v26、qa-v28、qa-r-security-3、D-004（system-spec/database.md、system-spec/security.md）

2026-10-19〜20 の追加: 評価の表に（会社・人・状態）で引ける索引があるかを確かめ、無ければ足す。テストデータの人名と値・判断の理由の文は架空にし、本番の設定ではシードを動かさない。
根拠: qa-y15（system-spec/database.md）

## Subtype architecture

Data: architecture-data.md を合成し、subtype_sections の data に記す。Frontend: N/A: 画面側の鮮度の共通口と並べ替えの部品は system-spec/frontend.md の章で扱う。Backend: N/A: runAction と書き込みの3つの型の入口、route-ledger.json の権限の定義から判定を引く形は system-spec/backend.md の章で扱い、本ノードは表と整合の側だけを扱う。Infrastructure: N/A: マイグレーションの配信と fail-closed のゲートは system-spec/infrastructure.md の章で扱う。Security: N/A: 控えの暗号化と認可は system-spec/security.md と system-spec/auth.md の章で扱う。
根拠: qa-v26、qa-v30（system-spec/database.md、system-spec/backend.md）

### Data architecture

#### Data domains and ownership

記録の正本は D1 の1つのデータベースで、表の定義は src/db/schema.ts、形の変更は drizzle/migrations が持つ。会社が所有の単位で、制度設定（等級・要件・行動指針など）・評価期間・アンケート・評価は会社ごとに持ち、会社をまたぐ参照を作らない。利用者の会社ごとの役割・等級・事業所・上司は、『利用者と会社の組』である所属の表が正で、users はメールアドレスで一意のアカウントを表す。権限の定義は業務データではなく仕様の台帳（route-ledger.json）の定義なので、D1 に持たない（D-007）。所属していない会社のデータは読めず、一般の社員には他人の等級と点数を返さない。
根拠: qa-f02、qa-v26、qa-v28、D-004、D-007（system-spec/database.md、system-spec/security.md）

#### Logical and physical model

所属の表は利用者・会社・役割・等級・事業所・上司・作成日時を持ち、利用者と会社の組を一意にし、上司は同じ会社の所属を指す。等級は id と pointGroup（結合キー）を変えずに名前を持ち、既定名は『等級1』『等級2』『等級3』『等級4-1』『等級4-2』『等級5-1』『等級5-2』で、data/grades.json・seed-data.mjs・seed-grade-schemes.mjs・drizzle/seed.sql・copyCompanyMasters の全てをそろえる。行動指針のセット名と、利用者が自分で付けていないアンケートの既定のタイトルは保存せず、割り当てた等級の名前から作る。initial_credential_memos は利用者ごとに1行で暗号文・初期化ベクトル・鍵の版・発行者・発行時刻を持って平文の列を持たず、constitution_events は実体ごとの番号を一意にする（uq_ce_entity_seq）。評価の表は確定済み（finalized）の KPI評価点（totalScore）と等級要件の達成率（requirementRate）を持ち、一覧はここから読む。
根拠: qa-v26、qa-r-database-3（system-spec/database.md）

2026-10-19〜20 の追加: KGI の3つの表と評価の2列を消し、評価の表に判断の6列（NULL 可）を足す。レポートは新しい表を持たず、確定済みの評価と評価の項目から作る。
根拠: qa-y15（system-spec/database.md）

#### Access and consistency

読み取りは primary に届き、書き込みを確定した後の読み取りは同じ要求でも次の要求でも最新を返し、読み取りの複製（withSession）を将来入れるなら書き込みの応答の bookmark を次の読み取りへ渡すことを鮮度の契約に含める。一つの操作で複数の表を書く経路は1回の batch（SQL のトランザクションとして扱われる）で書き、ID はアプリ側で先に採番し、bound parameter を99個以下に分けた文も同じ batch に入れる。並び順の保存は全体を受けて display_order を1から振り直す書き込みを1回の batch で行い、版を持つ要件（等級要件・昇格の条件と要件）は新しい版を作る。一覧の等級と点数は一覧ぶんをまとめて1回の問い合わせで取り、提出状況はアンケート・回答・対象者の既存の表から求めて、写しの列を持たない。所属の読み書きは永続化層の関数に閉じ、getViewer と一覧の問い合わせは選んでいる会社の所属を受け取るだけにする。
根拠: qa-f07、qa-r-database-3、qa-v26、qa-v30、D-003、D-004（system-spec/database.md、system-spec/backend.md）

#### Lifecycle and governance

会社の追加は、会社、制度ひな形の複製、管理者（利用者・ログイン用アカウント・控えを1回の batch）の3段階で書き、途中の失敗では逆順に取り消す。所属を消すときはその会社の所属だけを消し、最後の所属を消したときは今の利用者の削除と同じに扱う。控えは利用者を消すと一緒に消え、発行から14日を過ぎたものは開く・一覧に出す時点で除き、次の発行（会社・利用者・メンバーの追加、再発行、CSV 取込）の batch の先頭で全社分まとめて消す。等級名の変更と所属の追加・削除は監査ジャーナルに変更前と変更後を残し、制度マスタの監査記録は同時保存の後のほうを 409 で断り、文書や見本に実データ（社員名・評価値）を入れない。
根拠: qa-r-database-3、qa-v26、qa-v28（system-spec/database.md、system-spec/security.md、system-spec/00-requirements-definition.md の U8）

2026-10-19〜20 の追加: テストデータ（複数の期の確定済みの評価・受付中の期・アンケートの各状態・ズレの3種類・直属の部下の関係・判断の5通り）は架空の人名と値でシード（scripts/seed-data.mjs）に置き、本番には入れない。
根拠: qa-y15（system-spec/database.md）

#### Migration and recovery

所属の表の追加と既存の利用者全員への1件ずつの所属の作成、既存の全社の等級名の一律の書き換えと、既に保存された英語入りの表示名を既定の扱いへ戻すことをマイグレーションで入れ、等級の id と pointGroup は変えない。同じマイグレーションを2回流しても結果が変わらず、書き換え前の値は記録用の表に残して戻せるようにする。会社追加の取り消しが失敗したら compensation_failed を Workers Logs に残し、本番 DB を手で書き換えずに文書の手順（deploy-notes §7）で直す。本番の書き換えの前後は読み取り専用で対象を数え、英語の区分名が残っていないことを確かめる。
根拠: qa-v26、qa-v29、qa-v31、qa-r-ops-3（system-spec/database.md、system-spec/infrastructure.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 判断の列は足すだけのマイグレーションで1回で出す。KGI の表と列は2回目の Deploy で消し、その前に本番 DB を読み取りで数える。消す前の値は Deploy の自動バックアップに残る。
根拠: qa-y15、qa-x15（system-spec/database.md、system-spec/infrastructure.md）

#### Data verification

write-atomicity-contract.test.ts が batch の外で2つ以上の表を書く関数を0件に保ち、会社追加は途中の段階と取り消しを失敗させる結合テストで会社・制度ひな形・利用者・アカウントのどの行も残らずログが出ることを確かめ、CSV 取込と評価の集計も batch の途中の失敗で確かめる。追加分は、等級名を変えたときに全表示が新しい名前になること、既定と移行後の等級名が『等級N』『等級N-M』の形であること、評価確定直後の一覧の点数が新しい値になること、登録済みのメールアドレスで2社目に所属でき所属していない会社が拒否されること、提出状況の数と一覧が合うこと、並び順の全体保存と 409 を確かめる。
根拠: qa-r-database-3、qa-r-ops-3、qa-v31、O5・O6・O9〜O11・O13（system-spec/database.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: シードを2回流しても同じ結果になるテスト、シードの後に全ての画面と項目が空にならずに出る E2E、2回目の Deploy の後の表と列の不在の読み取りの確認を置く。
根拠: qa-y15、qa-y16（system-spec/database.md、system-spec/maintenance-ops.md）

## Architecture decisions

D-003（採択 opt-batch-first）: 1回の batch に入るものは batch、入りきらない会社追加は補償、戻せない書き込みの続きはやり直しにする。代替の『全部を1回の batch』は制度ひな形の複製が数百行になりうるため会社追加が入りきらず、『補償だけ』は補償そのものの失敗で中途状態が残る。多くの経路で書きかけを起こさず補償とやり直しを2か所に限れる利点を取り、補償まで失敗したときは記録と手順で直す負担を受け入れた。D-004（採択 opt-membership-cookie）: 利用者が選んだ（qa-v12）。所属を自前の表にして会社ごとの役割・等級・事業所・上司を持たせ、users.email の一意を残す。代替の better-auth の organization plugin は既存の companies 表と二重になり、等級・上司を member の表の外に持つ必要がある。URL に会社を入れる案は46画面のルートを全て移す。D-007（採択 opt-route-ledger-extend）: 利用者が①（route-ledger.json に操作と説明を足す）を名指しで選んだ（qa-v25、2026-10-13T03:40:15Z）。委任に基づいて AI が選んだ別の案とは違う案である。権限の定義は DB の表に持たず、編集画面も作らず、route-ledger.json に置く。DB の表で編集する案は、表と実際の判定のずれに気づけない（比べたときの不利な点）。①は台帳が1つで済み、画面を足したときの書き漏れを既存の route-ledger のテストで見つけられる。不利な点は、説明を直すたびに仕様文書の変更になることである。D-005 と D-006 は画面側の判断で、system-spec/frontend.md と system-spec/ui-ux.md の章で扱う。利用者は、D-007 ① に合わせて (9) を直した本章の文面を、旧と新を逐語で示されたうえで承認した（qa-v26、2026-10-13T03:48:20Z）。表示名を保存せず表示のたびに作る形、一覧に写しの列を作らない形、書き換え前の値を記録用の表に残す形は、この承認に含まれる。読み取りの複製は入れず、入れる場合は書き込みの応答の bookmark を次の読み取りへ渡すことを条件にする。
根拠: D-003（qa-u23、qa-u24）、D-004（qa-v12）、D-007（qa-v25）、qa-r-database-3、qa-v26（system-spec/database.md、system-spec/spec-state.json）

2026-10-19〜20 の追加: 判断の列のマイグレーションは列を足すだけなので、コードより先に当てても今のコードが動き、本番の Deploy の今の順番のまま1回で出せる。KGI の表と列を消すマイグレーションは、コードが読まなくなった後の2回目の Deploy で当てる（Deploy はマイグレーションをコードより先に当てるため）。判断の履歴は持たず、記録した人と時刻だけを持つ。
根拠: qa-y15、qa-x15（system-spec/database.md、system-spec/infrastructure.md）

## Delivery, migration and rollback

表の形の変更は drizzle/migrations に積み、既存の 0031（initial_credential_memos）・0032（uq_ce_entity_seq）に続いて、所属の表の追加と既存の利用者全員への今の値どおりの所属の作成、等級名と英語入りの表示名の一律の書き換えを 0033 以降で入れ、本番の Deploy の自動マイグレーションと fail-closed のゲートに乗せる。どのマイグレーションも2回流して結果が変わらず、失敗しても途中の状態を残さない。戻すときは記録用の表に残した書き換え前の値を使う手順を用意する。本番の書き換えの前に読み取り専用で対象（会社数・等級数・英語入りの表示名の数）を数えて書き換え前の値を記録し、外部変更ガードを通して Deploy し、後で英語の区分名が残っていないことを読み取りで確かめる。
根拠: qa-r-database-3、qa-v26、qa-v29、qa-v31（system-spec/database.md、system-spec/infrastructure.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: 2回目の Deploy の前に本番 DB を読み取りで数え、消す前の値は Deploy の自動バックアップに残る。判断の列は既存の行を書き換えないので、古い確定は『記録なし』のまま残る。
根拠: qa-y15、qa-x15（system-spec/database.md、system-spec/infrastructure.md）

## Risks and verification

リスクは、制度ひな形の行数が増えると batch の文の数や Workers の CPU 時間の上限に近づき、会社追加の段階の分け方を見直す必要が出ることである。取り消しやり直しまで失敗したときは手作業の直しが要る。cookie の会社への所属の確認を1か所でも漏らすと、所属していない会社のデータが見える（D-004）。users.company_id を読む約33か所と viewer.companyId を読む約140か所を所属の値へそろえ損ねても、会社の境界が崩れる。適合性の検査として、batch の外で2つ以上の表を書く関数を write-atomicity-contract.test.ts で落とし、会社追加・CSV 取込・評価の集計は途中で失敗させる結合テストで何も残らないことを確かめる。追加分は、評価確定直後の一覧の点数、2社目への所属と所属していない会社のデータが読めないこと、提出状況の数と一覧が合うこと、並び順の全体保存と 409 を検査で確かめる。
根拠: D-003、D-004、qa-r-ops-3、qa-v26、qa-v30、qa-v31（system-spec/database.md、system-spec/backend.md、system-spec/maintenance-ops.md）

2026-10-19〜20 の追加: リスクは、1回目の Deploy の前に表を消して古いコードが失敗すること、シードが2回目で重複すること、テストデータに実データが紛れることである。検査として、シードを2回流しても結果が同じになるテスト、シードの後に全ての画面と項目が出ることの E2E（O20）、2回目の Deploy の後に本番 DB に3つの表と2列が無いことの読み取りの確認（O17）を置く。
根拠: qa-y15、qa-y16（system-spec/database.md、system-spec/maintenance-ops.md）


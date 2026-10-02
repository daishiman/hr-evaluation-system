---
graph_node_id: "spec-data-freshness"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "保存した結果が、どの画面・タブ・端末でもすぐ見える"
project_id: "hr-evaluation-system"
domain: "data-freshness"
status: "active"
priority: null
start_date: "2026-09-30"
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["data-freshness", "server-actions", "d1-batch", "credential-memo", "system-spec-import"]
file_path: "specs/data-freshness.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/system-spec-completeness-report-8.json", "evaluated_digest": "da48a1cd06eb32de04462b01fbe6884c2d11e10691ad5417dff46b00fbcd2de0"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/index.md", "source_version": "0.1.16", "source_digest": "da48a1cd06eb32de04462b01fbe6884c2d11e10691ad5417dff46b00fbcd2de0", "imported_at": "2026-10-01T10:25:00Z"}
created_at: "2026-10-01T10:25:00Z"
updated_at: "2026-10-01T10:25:00Z"
depends_on: []
related_nodes: ["arch-data-freshness"]
resource_scope: ["specs/data-freshness.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec-harness の確定済み仕様（evaluator PASS）から run-dev-graph-system-spec が C02 へ渡した取り込みで、種別は specification と明示されている。本文は specification テンプレートの必須17節と、API を公開・変更するため api-contract の合成4組（サーバーアクションの書き込み・読み出し、残した Route Handler、退避した Route Handler）を持つ。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/data-freshness.md"}, {"artifact_kind": "document", "confidence": 0.05, "candidate_path": "docs/data-freshness.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-10-01T10:25:00Z"}
---
# 仕様メモ: 保存した結果が、どの画面・タブ・端末でもすぐ見える

- feature: `feat-data-freshness`
- beads: 未採番
- 正本（製品）: `docs/product/spec.md` §27
- 正本（システム）: `system-spec/00-requirements-definition.md`（U1・G1〜G5）と8章（`system-spec/index.md`「章一覧と集約状態」）
- 正本（運用）: `docs/deploy-notes.md` §6・§7

## 目的と成功状態

利用者が作成・変更・削除した結果を、成功表示の直後の画面・再読み込み・他のタブと画面復帰のどれでも必ず確認できるようにし、「本当に保存できたのか」を疑わずに次の作業へ進める状態をシステムとして保証する（`system-spec/00-requirements-definition.md` の U1）。

成功時に観測できる状態は、要件定義書のゴール G1〜G5 と目標 O1〜O5 のとおり。

- G1 / O1: 書き込み成功を表示した時点で、同じタブの一覧・件数・会社切替メニューがすべてその結果を含む（作成系 E2E で、成功表示の直後の DOM に新しい行と更新後の件数がある。待機なし）。
- G2 / O2: 通常・強制の再読み込みや URL の直接表示で、直前の書き込み結果が毎回出る（反映率 100%）。
- G3 / O3: 同じ利用者の他のタブと、スマホ・タブレットの画面復帰（bfcache 復元・タブ復帰）で、通知かタブ復帰から1秒以内に最新になる。
- G4 / O4: 共通の入口を通らない書き込み経路が 0 件で、適用漏れは検査で落ちる。
- G5 / O5: 1つの操作で複数の表を書く書き込みが途中で失敗しても、一部だけが残る状態が 0 件。取り消し・やり直しまで失敗したときは Workers Logs に記録が残る。

## スコープ

- In: 全ての作成・更新・削除（会社・利用者・メンバー・アンケート・評価セットと期間・制度設定・CSV 取り込み・改善要望など）の後の表示鮮度。同じタブ・再読み込み・他のタブ・画面復帰の4経路。複数の表を書く全ての書き込みの原子性（1回の D1 batch、会社の追加は取り消し、パスワード変更の続きはやり直し）。鮮度契約の静的検査と E2E。「反映されない」報告の切り分け手段（応答の生成時刻）。初期パスワードの控えの暗号化保存と、発行から14日の期限（連続作成で一覧を優先するために必要になったもの）。
- Out: 別の利用者が開いている画面への即時配信（WebSocket などの押し出し。別の利用者は次の画面遷移・再読み込みで最新を見る＝G2）。オフライン編集と同期。配色・テーマの変更（AGENTS.md と DD-003）。本番データの移行・修正。仮パスワードそのものの失効（backlog SECURITY-005）。

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| システム全体管理者（SUPER_ADMIN） | 会社の追加・変更・切替と、利用者の追加・変更を行い、発行した初期パスワードを会社の管理者へ渡す |
| 会社管理者（COMPANY_ADMIN） | メンバーの追加・CSV 取り込み・アンケートと評価セットの作成・制度設定を行い、直後に一覧で確かめる。同じ会社の控えを開ける |
| 評価者（MANAGER） | 評価の入力・集計・メモ・回答期限の延長を行う |
| 社員（EMPLOYEE） | 回答の保存・本人の登録内容とパスワードの変更・改善要望の送信を行う |
| 開発・運用担当 | 「反映されない」報告を応答の生成時刻で切り分け、取り消し・やり直しの失敗記録を見て手で直す |
| サーバーアクション | `src/actions/*.ts` の `"use server"` 関数。画面からの書き込みと読み出しの唯一の入口 |
| `runAction` | 書き込みの共通の包み（`src/lib/action.ts`）。権限 → 大きさ → 入力の形 → 本体 → `refresh()` の順に通す |
| `runRead` | 読み出し専用の共通の包み。描き直さず、他のタブにも知らせない |
| 鮮度の知らせ | `BroadcastChannel("hr-evaluation:freshness")` で他のタブへ送る `{ kind: "saved", resource, at }` |
| 控え | 発行した初期パスワードを AES-GCM で暗号化して残したもの（`initial_credential_memos`） |
| 補償（`withCompensation`） | 書いた順に積んだ取り消しを、失敗したら逆順に実行する型（会社の追加だけ） |
| 前へ進めて揃える（`rollForward`） | 戻せない書き込みの続きを1回だけやり直す型（パスワード変更だけ） |
| 応答の生成時刻 | `worker.ts` が付ける `x-generated-at`。古い応答が残っていたかを見分ける印 |

### ID の読み方

この機能の文書（このメモ・[アーキテクチャ](../architecture/data-freshness.md)・[機能](../features/feat-data-freshness.md)）に出る記号の定義の場所。記号の読み方はここが正本で、ほかの文書はここを指す。

| 記号 | 意味 | 定義の場所 |
|---|---|---|
| U1〜U9 | 要件定義書の節の番号（U1 は本質的な目的、U3 はゴール、U4 は目標、U9 は具体的にやりたいこと） | `system-spec/00-requirements-definition.md` |
| G1〜G5・O1〜O5 | ゴールと、それを測る目標。同じ番号が対になる（O1 は G1 と対で、成功の表示と同じ描画のうちに一覧・件数が新しくなっていること）。このメモでの要約は上の「目的と成功状態」 | 同上の U3・U4 |
| I1〜I6 | 具体的にやりたいこと | 同上の U9 |
| D-001〜D-003 | 意思決定支援で選んだ案 | 同上の「意思決定支援」 |
| qa-uNN | ヒアリングの問の番号 | 同上の「確定の接地根拠」 |
| ADR-004〜ADR-008 | 設計で足した判断 | アーキテクチャの「Architecture decisions」 |
| FR-NNN・BR-NNN・AC-NNN | 機能要件・ビジネスルール・受入条件 | このメモの「機能要件」「ビジネスルールと検証」「テストと受入条件」 |
| 決定事項 N | このメモの決定事項の番号（アーキテクチャの「設計判断」の番号とは別） | 下の「決定事項」 |
| W1〜W4 | まだ決めていないこと | 下の「未決事項」 |
| UX-030・SECURITY-001・SECURITY-005 | 製品の残課題の番号 | `docs/product/backlog.md`（閉じた SECURITY-001 は `docs/product/backlog-session-notes.md`） |
| DD-003 | 前例のない設計判断の番号 | `docs/product/design-decisions.md` |

## ユースケースとユーザーフロー

1. システム全体管理者が会社を追加する → 成功の知らせと同じ描画で、会社一覧・件数・会社切替メニューに新しい会社が出る → 控えは知らせの後ろに畳まれ、「仮パスワードの控えを見る」で開く → 続けて次の会社を追加しても、前の会社は一覧に残る。
2. 会社管理者がメンバーを追加・CSV で取り込む・アンケートを作る → 同じ描画で一覧と件数が変わる → すぐに ⌘+Shift+R をしても新しい行が出る。
3. 同じ利用者が2つのタブで同じ一覧を開き、片方で保存する → もう片方は1秒以内に新しい行を出す（裏にいたタブは、表に戻したときに1回取り直す）。
4. スマホで一覧を開いたまま別のアプリへ移り、戻る（タブ復帰）か、戻るボタンで前の画面に戻る（bfcache 復元） → 古い一覧のまま操作を続けない。
5. 会社の追加の途中（制度のひな形の複製や管理者の作成）で失敗する → 会社・制度・利用者・アカウントのどの行も残らない → 取り消しも失敗したときは決まった文面を出し、`compensation_failed` を Workers Logs へ残す → 運用担当が `docs/deploy-notes.md` §7 の手順で直す。
6. 社員がパスワードを変更し、続きの後片付けが2回とも失敗する → 「パスワードは変更済みです」と伝え、`rollforward_failed` を残す → 本人がもう一度パスワードを変えれば揃う。
7. 「保存したのに出ない」と報告を受ける → 運用担当が [デプロイ時の注意 §7](../docs/deploy-notes.md) の手順（応答の生成時刻 `x-generated-at` から始める）で切り分ける。

## 機能要件

- `FR-001`: 画面からの作成・変更・削除は、すべてサーバーアクションの `runAction` を通す（決定事項 1）。画面の部品に書き込みの `fetch` を作らない。
- `FR-002`: `runAction` は成功したときだけ `run()` の成功時処理（`onSuccess`）で `refresh()` を呼び、成功の結果と作り直した画面を同じ応答で返す（決定事項 2）。失敗では描き直さない。
- `FR-003`: 画面側の `useSaveAction` は、新しい画面が DOM に入った後に結果を呼び出し元へ返す（`createCommitGate`）。成功の言葉が古い一覧の上に出ない。
- `FR-004`: 読むだけの入口（控えを開く・端末の確認コードを調べる・CSV 取り込みの下見2本）は `runRead` を通し、描き直さず、他のタブに知らせない（決定事項 3）。
- `FR-005`: 保存に成功したタブは、同じブラウザの他のタブへ鮮度の知らせを送る。受けたタブは、見えていればすぐ、裏にいれば見えたときに1回取り直す（決定事項 6）。
- `FR-006`: `visibilitychange`（見えたとき）・`pageshow` の `persisted`（bfcache 復元。ルーターが画面を戻し終えた次のタスクで、間引かずに）・`online` で取り直す。ほかの取り直しは 1.5 秒に1回へ間引く。
- `FR-007`: ログイン後の画面と `/api/*` の応答に、成功・失敗の両方で保存させない指示を付ける（決定事項 5）。
- `FR-008`: Worker が作った全ての応答（101 など作り直せない応答を除く）に `x-generated-at` を付ける。
- `FR-009`: 複数の表を書く保存は、1回の `db.batch`・`withCompensation`・`rollForward` の3つの型のどれかで書く（決定事項 8・10・11）。
- `FR-010`: 制度マスタの同じ項目の同時保存は、後のほうを 409 で断り、自動でやり直さない（決定事項 9）。
- `FR-011`: 連続作成の画面では、一覧の新しい行 ＞ 成功の知らせ ＞ 控え の順に見せる。控えは暗号化して残せたときだけ畳んで始める（決定事項 13・14）。
- `FR-012`: 控えは発行から14日で一覧に出さず、開こうとすると 410 で再発行を頼み、次の発行の batch の先頭で消す（決定事項 14）。
- `FR-013`: 別のサイト・ポート違いからの書き込みと読み出しを、Next.js の検査と `assertSameOrigin` の二重で断る（決定事項 12）。
- `FR-014`: 画面からの書き込みに使っていた Route Handler 22本を退避し、置き換え先のサーバーアクションだけを残す（決定事項 4。下の「API: 退避した Route Handler」）。

## 非機能要件

- Performance: 保存は1往復（応答に新しい画面を同梱）。他のタブの取り直しは知らせかタブ復帰から1秒以内（O3）。取り直しは 1.5 秒に1回まで（2つの関係は [製品仕様 §27-3](../docs/product/spec.md) が正本）。応答の生成時刻は時刻だけを足し、本文を変えない。サーバー側の実行ファイルの容量は `check:bundle-size` の上限内に収める（ミドルウェアではなく Worker の入口で付ける理由）。
- Availability/Reliability: 書き込みの途中失敗で一部だけが残る状態は 0 件（O5）。取り消し・やり直しの失敗は必ず記録する。鍵 `CREDENTIAL_ENC_KEY` が無くても利用者の発行は止めない。
- Accessibility/Usability: 保存を送ってから新しい画面を描き終えるまでは `RefreshStatus`（`role="status"`・`aria-live="polite"`・`aria-busy`）で「〜に反映しています…」と伝える。他のタブ・画面復帰の取り直しは何も表示しない（`FreshnessSync` は画面に何も出さない）。送れなかったときは入力を消さずに残す。375px・768px の幅でも同じタブの反映と控えの畳み方は同じ（E2E）。
- Security/Privacy: 控えは暗号文だけを保存し、利用者IDを付加データにする。応答に仮パスワードの値を返さない。想定外の失敗は中身を伏せる。保存させない指示で、氏名や利用者ごとの文面をブラウザや配信網に残さない。生成時刻に利用者や会社を表す値を載せない。
- Maintainability/Operability: 新しい保存を足しても描き直しを書く場所が無い（入口で呼ぶ）。適用漏れ・3つの型の外の書き込みは契約テストが落とす。切り分けの手順は `docs/deploy-notes.md` §6・§7。

## UI・状態遷移

- 画面/CLI/API状態: 入力中 → 送信中（`saving` が真。ボタンを押せない。`RefreshStatus` が busy）→ 成功（新しい画面と知らせが同じ描画で出る）か 失敗（文面を出し、入力を残す）。他のタブは 表示中 → 知らせを受ける → 取り直し中 → 最新。
- 遷移条件: 送信中 → 成功は応答が `ok: true` で、作り直した画面が DOM に入った後。送信中 → 失敗は `ok: false`・通信の失敗・画面が古い（公開で宛先の識別子が変わった）のいずれか。他のタブの取り直しは、見えている（`document.visibilityState` が `visible`）ときだけ。
- Loading/Empty/Error: 送信中は `RefreshStatus` が「保存しています」を読み上げる。一覧が空のときは各画面の空の表示のまま（この作業で変えない）。失敗は「送れませんでした。通信を確かめて、もう一度押してください。」か「画面が古くなっています。再読み込みしてから送ってください。」か、入口が返した文面。控えは畳んだ状態（値を DOM に置かない）→ 押すと開く。期限切れの控えは一覧にボタンを出さない。

## ビジネスルールと検証

- `BR-001`: 書き込みの入口は `runAction` だけ。読み出しの入口は `runRead` だけ。どちらも通らない `"use server"` 関数があれば `server-actions-contract.test.ts` が落ちる。
- `BR-002`: 1つの関数が別々の `await` で2つ以上の表を書かない。書けば `write-atomicity-contract.test.ts` が落ちる（関数をまたぐ形はレビューで確かめる）。
- `BR-003`: 会社の変更・会社の切替・利用者の追加と変更はシステム全体管理者だけ。本人の登録内容の変更は本人の行だけを、所属会社が開放した項目だけ変えられる。開放されていない項目が混ざったら全体を断る（決定事項 15）。
- `BR-004`: 控えを開けるのはシステム全体管理者と同じ会社の管理者だけ。本人がパスワードを変えると控えは消え、再発行すると置き換わる。発行時刻が14日前以前なら期限切れ。
- `BR-005`: CSV 取り込みは、不正な行が1行でもあればファイル全体を保存しない（409）。1回で安全に保存・復元記録を作れる量を超えたら 413（「500文以内」の案内）。
- `BR-006`: 入力の形が合わないときは 400「入力内容を確認してください（項目：理由）」。大きさの上限は、Claude Code 連携の鍵 4,000 バイト・改善要望 960,000 バイト・その状態更新 16,000 バイト・CSV 6,100,000 バイト。上限を持たない入口は Next.js の `serverActions.bodySizeLimit`（8mb）が上限。

## API契約

画面からの書き込みと読み出しは、Route Handler ではなくサーバーアクションで公開する（D-002）。外から使う口は `/api/*` に9系統だけ残す。`api-contract.md` を、入口の型ごとに4つ合成する。個々のアクションの入力の形は `src/actions/*.ts` の zod スキーマが正本で、ここには写さない。

### API: サーバーアクションの書き込み（runAction・37本）

#### 識別と目的

- Operation ID: `src/actions/*.ts` の export 名（例：`createCompany`・`createMember`・`createForms`・`saveMaster`・`importMembers`・`saveResponse`）。全数は `server-actions-contract.test.ts` が数える。
- Method/Path: `POST` で、呼び出し元のページのパスへ送る。`next-action` ヘッダーに、Next.js が公開ごとに作る識別子を載せる。決まった URL を外へ公開しない。
- Purpose: 画面からの作成・変更・削除のすべて。成功したら同じ応答で今の画面を作り直す（G1・G2・G4）。
- Version/Lifecycle: 識別子は公開ごとに入れ替わる。開いたままの古い画面からの送信は届かず、画面は再読み込みを頼む。画面専用で、外向けの版は持たない。

#### 認証・認可

- Authentication: better-auth のセッション Cookie。`runAction` の先頭の `apiViewer` が確かめる。
- Required scopes/roles: アクションごとに最小の役割を宣言する。全体管理者 12本（会社2・会社切替1・利用者管理2・Claude Code 連携の鍵と端末5・改善要望の引き渡しと破棄2）、会社管理者 16本（期間2・アンケート4・制度3・制度の全体設定1・メンバー2・CSV 取り込み2・KGI 実績1・改善要望の状態1）、評価者 5本（評価2・回答期限の延長2・メモ1）、社員 4本（パスワード1・本人の登録内容1・回答1・改善要望の送信1）。上位の役割は下位の入口も使える。
- Resource ownership check: 会社の境界は、利用者の所属会社（全体管理者は切替中の会社）で絞る。他社の行は見つからない扱い（404）。本人の登録内容は本人の行だけ。

#### Request

- Headers: `next-action`（識別子・必須）、`Origin`（同じ origin・同じポートであること）、セッション Cookie。
- Path parameters: N/A: ページのパスへ送るので、経路に引数を持たない。
- Query parameters: N/A: 引数はすべて本文で渡す。
- Body schema: アクションごとの zod スキーマ。Next.js が引数を直列化して送る。大きさの上限は「ビジネスルールと検証」BR-006。
- Example: 会社の追加 `createCompany({ name: "検証用株式会社", slug: "kensho", businessType: null, adminName: "検証 管理者", adminEmail: "admin@example.invalid" })`。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 成功 | `{ ok: true, message, ...data }` と、`refresh()` で作り直した画面（同じストリーム） |
| 200 | 失敗（入口が断った・本体が失敗した） | `{ ok: false, message }`。描き直さない |

- Headers: `cache-control` は Next.js の動的描画が付ける `private, no-cache, no-store, max-age=0, must-revalidate`。`x-generated-at`（Worker が応答を作った時刻）。
- Example: `{ ok: true, message: "保存しました。" }`、作成の3アクションは値を返さず `memoStored: true` だけを足す。

#### Validation・ビジネスルール

- 順序は「権限 → 大きさ（413）→ 入力の形（400）→ 本体」。権限が無ければ入力を読まない。
- 入力の形が合わなければ 400「入力内容を確認してください（項目：理由）」。
- CSV に不正な行があれば 409 でファイル全体を断る。制度マスタの同時保存と版の不一致は 409。
- 会社の追加では、slug は英小文字・数字・ハイフンの2〜30文字、管理者のメールアドレスは既存の利用者と重ならないこと。

#### Error contract

HTTP の列は入口の中の区分（`HttpError` の状態）で、画面へは常に HTTP 200 の `{ ok: false, message }` として届き、区分は文面に畳まれる。Code の列はこの表での呼び名で、応答には載らない。

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 401 | UNAUTHENTICATED | 未ログイン・セッション切れ（「ログインが必要です。」） | no | ログインし直す |
| 403 | CROSS_ORIGIN | 別のサイト・ポート違いからの送信（「この操作は受け付けられませんでした。画面を開き直してからもう一度お試しください。」） | no | 画面を開き直す |
| 403 | FORBIDDEN | 役割が足りない（「この操作を行う権限がありません。」） | no | 権限のある人に頼む |
| 400 | INVALID_INPUT | 入力の形が合わない | no | 欄を直して送り直す |
| 404 | NOT_FOUND | 対象が無い（他社の行を含む） | no | 再読み込みして確かめる |
| 409 | CONFLICT | 同じ項目の同時保存・版の不一致・CSV の不正な行 | yes（再読み込みの後） | 最新を確かめてから保存し直す |
| 413 | TOO_LARGE | 大きさの上限を超えた | no | 分けて送る |
| 429 | RATE_LIMITED | パスワード変更（10秒に3回）・改善要望の送信（1分に5回）の回数超え | yes（待ってから） | 少し待つ |
| 500 | UNEXPECTED | 想定外の失敗（「処理中に問題が発生しました。時間をおいて試してください。」。中身は伏せる） | yes | 時間をおいて試す |
| 500 | COMPENSATION_FAILED | 会社の追加の取り消しも失敗（「途中で止まり、一部が残りました。管理者に連絡してください。」） | no | 運用担当が deploy-notes §7 で直す |
| 200 | ROLLFORWARD_FAILED | パスワード変更の続きが2回とも失敗。`ok: true` で「パスワードは変更済みです。お知らせが残るときは管理者に連絡してください。」 | no | 新しいパスワードで使い続ける |
| N/A: 応答が無い | NETWORK | 送信そのものが失敗（画面側で「送れませんでした。通信を確かめて、もう一度押してください。」） | yes | 入力を残したまま押し直す |
| N/A: 応答が無い | STALE | 公開で識別子が変わった（画面側で「画面が古くなっています。再読み込みしてから送ってください。」） | no | 再読み込みしてから送る |

#### 実行セマンティクス

- Idempotency key/replay: 冪等キーは持たない。二重送信は送信中にボタンを押せなくして防ぐ。端末の承認の引き換えは条件付きの更新で、同時に2回送っても1回だけ通る。`rollForward` の続きは何度流しても同じ結果になる。
- Concurrency/optimistic lock: 制度マスタは監査記録の番号の一意索引（`uq_ce_entity_seq`）と版の照合で、後から来た保存を 409 で断る。自動でやり直さない。
- Transaction boundary: 1回の `db.batch`（D1 の1トランザクション）が既定。会社の追加だけ `withCompensation`、パスワード変更だけ `rollForward`。
- Timeout/retry/rate limit: Workers の実行時間の範囲で動き、入口は自動で再試行しない。流量制限はメモリ上の固定ウィンドウ（同じ isolate の中だけ効く）。

#### キャッシュ・ページング

- Cache/ETag: 応答を保存させない（動的描画の `private, no-cache, no-store`）。ETag は使わない。成功時の描き直しは `refresh()` で、`revalidatePath` などのキャッシュの無効化は使わない（データキャッシュを持たないため）。
- Cursor/limit/filter/sort: N/A: 書き込みの入口で、一覧を返さない。一覧は作り直した画面が持つ。

#### 可観測性と監査

- Request/correlation ID: 専用の ID は持たない。応答の `x-generated-at` と Workers Logs の時刻で突き合わせる。
- Metrics/logs/audit/redaction: 画面側が `/actions/{resource}` の名前で所要時間と成否を利用状況へ送る（`recordActionCall` → `/api/usage`）。想定外の失敗は `console.error`。制度マスタの変更は `constitution_events` に同じ batch で残す。`compensation_failed`・`rollforward_failed` を Workers Logs へ残す。入力値・パスワード・控えの値は記録しない。

#### セキュリティ確認

- Input/output validation: 入力は zod で形を固定する。出力は文面と必要な値だけで、仮パスワードの値は返さない（作成は `memoStored` の真偽値だけ）。
- Sensitive data exposure: 想定外の失敗は決まった文面にし、例外の中身を返さない。応答を保存させない。
- Abuse/authorization tests: 別のサイト・ポート違いの送信（`action-origin.test.ts`）。役割が足りないときに1行も書かないこと、本人の行と開放された項目だけを変えること（`account-and-company-admin.integration.test.ts`）。

#### Contract tests

- Positive: 成功したときだけ描き直す（`action.test.ts`）。結果は新しい画面が描き終わってから返す（`use-refresh.test.ts`）。会社の追加・評価の提出から確定まで（`companies.integration.test.ts`・`evaluation-flow.integration.test.ts`）。
- Boundary: 大きさの上限ちょうどと超え、CSV の不正な行が1行（`member-import`・`response-import` の試験）。
- Negative/auth/error/idempotency: どの入口も `runAction` か `runRead`（`server-actions-contract.test.ts`）。3つの型の外で2つ以上の表を書かない（`write-atomicity-contract.test.ts`）。同時保存の 409（`master-concurrent-save.integration.test.ts`）。取り消し・やり直しの失敗の記録（`compensation.test.ts`）。

### API: サーバーアクションの読み出し（runRead・4本）

#### 識別と目的

- Operation ID: `revealCredentialMemo`（控えを開く）・`checkDeviceCode`（Claude Code の端末の確認コードを調べる）・`previewMembersImport`・`previewResponsesImport`（CSV 取り込みの下見）。
- Method/Path: 書き込みと同じく、ページのパスへの `POST` と `next-action` ヘッダー。
- Purpose: 画面を描き直さずに、その場で値を返す。他のタブには知らせない（D-001 の対象外）。
- Version/Lifecycle: 書き込みと同じく、識別子は公開ごとに入れ替わる。

#### 認証・認可

- Authentication: セッション Cookie を `runRead` の先頭の `apiViewer` が確かめる。
- Required scopes/roles: `revealCredentialMemo`・CSV の下見2本は会社管理者以上、`checkDeviceCode` は全体管理者。
- Resource ownership check: 控えは同じ会社の利用者のものだけ（全体管理者は全社）。CSV の下見は利用者の会社に対して照合する。

#### Request

- Headers: `next-action`・`Origin`（同じ origin）・セッション Cookie。
- Path parameters: N/A: ページのパスへ送る。
- Query parameters: N/A: 引数は本文。
- Body schema: `revealCredentialMemo({ userId })`、`checkDeviceCode({ userCode })`（50文字まで・全体で 4,000 バイトまで）、CSV の下見は CSV の本文（上限 6,100,000 バイト）。
- Example: `revealCredentialMemo({ userId: "u_example" })`。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 成功 | 控え `{ ok: true, message, password, issuedAt, expiresAt }`、下見 `{ ok: true, message, ...行ごとの判定 }` |
| 200 | 失敗 | `{ ok: false, message }` |

- Headers: `cache-control` は動的描画の `private, no-cache, no-store`。`x-generated-at`。
- Example: `{ ok: true, message: "控えを開きました。ご本人へ安全な方法でお伝えください。", password: "（値）", issuedAt: "2026-10-01T00:00:00.000Z", expiresAt: "2026-10-15T00:00:00.000Z" }`（値は画面の中だけに出す。画面は期限を「◯◯まで開けます」と添える）。

#### Validation・ビジネスルール

- 控えは、期限切れなら鍵を読む前に 410 で断る。鍵が無ければ 503。鍵の入れ替わりや暗号文の壊れは 409。
- CSV の下見は書き込まず、行ごとの判定だけを返す。本番の取り込みは `importMembers`・`importResponses`（書き込みの入口）で行う。

#### Error contract

HTTP の列は入口の中の区分で、画面へは HTTP 200 の `{ ok: false, message }` として届く。Code の列はこの表での呼び名。

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 401 / 403 | UNAUTHENTICATED / FORBIDDEN / CROSS_ORIGIN | 書き込みと同じ | no | 書き込みと同じ |
| 404 | MEMO_NOT_FOUND | 「この方の控えはありません。」 | no | 再発行する |
| 410 | MEMO_EXPIRED | 「発行から14日を過ぎたため開けません。再発行してください。」 | no | 再発行する |
| 503 | MEMO_KEY_MISSING | 「控えを開く鍵が設定されていません。」 | no | 運用担当が鍵を設定する（W3） |
| 409 | MEMO_UNREADABLE | 鍵の入れ替わり・暗号文の壊れ | no | 再発行する |
| 413 | TOO_LARGE | CSV が上限を超えた | no | 分けて送る |
| 500 | UNEXPECTED | 想定外の失敗 | yes | 時間をおいて試す |

#### 実行セマンティクス

- Idempotency key/replay: 読むだけなので何度呼んでも同じ。控えを開いても消さない。
- Concurrency/optimistic lock: N/A: 書き込まない。
- Transaction boundary: N/A: 書き込まない（CSV の下見も書き込まない）。
- Timeout/retry/rate limit: 自動で再試行しない。流量制限は持たない（役割と会社の境界で絞る）。

#### キャッシュ・ページング

- Cache/ETag: 応答を保存させない。控えの値は畳んでいる間 DOM に置かない。
- Cursor/limit/filter/sort: N/A: 1件か、1回の CSV の判定だけを返す。

#### 可観測性と監査

- Request/correlation ID: `x-generated-at` と Workers Logs の時刻。
- Metrics/logs/audit/redaction: 控えを開いたら `console.info` で `credential_memo_revealed`（開いた人・対象の利用者・会社の ID）を残し、値は残さない。

#### セキュリティ確認

- Input/output validation: zod で入力を固定する。控えの復号は AES-GCM で、利用者 ID を付加データにして、別の利用者の暗号文では開けない。
- Sensitive data exposure: 平文の仮パスワードを保存しない。期限切れは鍵を読む前に断る。
- Abuse/authorization tests: 他社の会社管理者・社員・評価者が控えを開けないこと（`credential-memo-lifecycle.integration.test.ts`）。

#### Contract tests

- Positive: 期限内の控えを開ける（`credential-vault.test.ts`）。
- Boundary: 発行からちょうど14日で期限切れ（`credential-memo-lifecycle.integration.test.ts`）。
- Negative/auth/error/idempotency: 410・404・鍵の不在、他社からの取得、描き直さないこと（`action.test.ts` の `runRead`）。

### API: 残した Route Handler（/api/*・9系統）

#### 識別と目的

- Operation ID: 経路ごとに1系統。
- Method/Path: `POST`・`PUT /api/agent/device`（Claude Code の端末の承認）、`POST /api/agent/token`（鍵の取り直し）、`GET`・`POST /api/auth/[...all]`（better-auth）、`GET /api/export`（CSV の書き出し）、`POST`・`GET`・`PATCH /api/improvements`（改善要望の送信と、Claude Code 向けの読み出しと状態の更新）、`PATCH /api/improvements/[id]`（公開前の確認用の状態更新）、`GET /api/search`（人の検索）、`PUT`・`GET /api/theme-choice`（外観の記録と利用人数）、`POST /api/usage`（利用状況の記録）。
- Purpose: 画面の外の相手（Claude Code・認証ライブラリ・書き出しのダウンロード・送信を待たない記録）と、外から読む口だけを残す。画面からの書き込みには使わない。
- Version/Lifecycle: 版を持たない。同じリポジトリの画面・Claude Code 連携・公開前の確認スクリプト（`scripts/verify-improvement-preview.mjs`）だけが使う。

#### 認証・認可

- Authentication: セッション Cookie（`apiViewer`）か、Claude Code 向けの Bearer 鍵（`guardAgentRequest`。`improvements` の `GET`・`PATCH`）。`auth/[...all]` は better-auth が自分で扱う。
- Required scopes/roles: `export` は書き出す種類が回答・メンバーなら会社管理者、それ以外は評価者。`improvements` の `POST` は社員、`improvements/[id]` は会社管理者。`search` は社員。`theme-choice` の `PUT` はログイン中の本人、`GET` は全体管理者。`usage` はログイン中の本人。
- Resource ownership check: 会社の境界は書き込みの入口と同じく利用者の会社で絞る。

#### Request

- Headers: セッション Cookie か `authorization: Bearer`。本文は JSON（`usage` は `sendBeacon` で送る）。
- Path parameters: `improvements/[id]` の `id`（改善要望の ID）。
- Query parameters: `search` の `q`（空なら0件）、`export` の `type`（書き出す種類）。並び替え・ページの指定は持たない。
- Body schema: 本文のある経路（`agent/*`・`improvements`・`improvements/[id]`・`theme-choice`・`usage`）は、どれも経路ごとの zod スキーマの `parse` で検証する。`export` の問い合わせも zod で検証する。合わなければ `describeError` が 400 に直す。
- Example: `GET /api/search?q=山` → 最大8人を返す。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 成功 | `handle` が `{ ok: true, ...data }`。`export` は CSV、`improvements` の `GET` は markdown か JSON |
| 400〜503 | 失敗 | `jsonError` が `{ ok: false, message }`（状態コードはそのまま返る）。Claude Code 向けの口（`agent/*` と `improvements` の Bearer 経路）はテキストの本文で断る |

- Headers: 成功・失敗の両方に `cache-control: private, no-store`（`API_CACHE_CONTROL`。CSV の書き出しだけは `csvResponse` の `no-store`）。429 には `retry-after`。Bearer 鍵の 401 には `www-authenticate: Bearer`。全ての応答に `x-generated-at`。
- Example: `{ ok: true, people: [] }`。

#### Validation・ビジネスルール

- `improvements` の `PATCH` は 対応中 → レビュー待ち → 対応済み の順で、順番を飛ばすと 409。中身は `src/lib/improvements/status.ts` を画面の入口と共有する。
- `agent/token` は断る理由を1つの文面にまとめ、どの条件で断ったかを外へ出さない。
- `theme-choice` は表示中の一覧に影響しない（テーマは U7 の対象外で、正本は `system-spec/appearance-theme.md`）。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | INVALID_INPUT | 入力の形が合わない | no | 直して送る |
| 401 | UNAUTHENTICATED | 未ログイン・Bearer 鍵が無いか違う | no | ログインする・鍵を取り直す |
| 403 | FORBIDDEN / CROSS_ORIGIN | 役割が足りない・別のサイトから | no | 権限のある人に頼む |
| 404 | NOT_FOUND | 対象が無い | no | 確かめる |
| 409 | CONFLICT | 改善要望の状態の順番飛ばし | no | 正しい順で更新する |
| 429 | RATE_LIMITED | `agent/device`・`agent/token`（IP ごとに1分30回）、`usage`（本人ごとに1分20回） | yes | `retry-after` の秒数だけ待つ |
| 500 | UNEXPECTED | 想定外の失敗（中身は伏せる） | yes | 時間をおいて試す |

#### 実行セマンティクス

- Idempotency key/replay: 端末の承認の引き換えは条件付きの更新で、同時に2回送っても1回だけ通る。利用状況の記録と古い記録の掃除は1回の batch。
- Concurrency/optimistic lock: 改善要望の状態は順番の照合で断る。
- Transaction boundary: 複数の表を書くものは1回の `db.batch`（改善要望の書き込み・端末の引き換え・利用状況）。
- Timeout/retry/rate limit: 流量制限は上の表のとおり。サーバー側は自動で再試行しない。

#### キャッシュ・ページング

- Cache/ETag: 成功・失敗の両方を保存させない（`handle`・`jsonError` と、`improvements` の `GET` が返す markdown・JSON は `API_CACHE_CONTROL`。CSV の書き出しは `src/lib/csv.ts` の `csvResponse` が `no-store` を付ける）。ETag は使わない。
- Cursor/limit/filter/sort: `search` は最大8件。ほかはページを持たない。

#### 可観測性と監査

- Request/correlation ID: `x-generated-at` と Workers Logs の時刻。
- Metrics/logs/audit/redaction: 想定外の失敗は `console.error`。利用状況は画面の遷移とアクションの所要時間だけで、入力値は送らない。

#### セキュリティ確認

- Input/output validation: 本文と `export` の問い合わせは zod で検証する（上の「Request」）。検索は氏名を返すので、保存させない指示を必ず付ける。
- Sensitive data exposure: Bearer 鍵の値を応答や記録に出さない。`agent/token` は断る理由を区別しない。
- Abuse/authorization tests: Bearer 鍵の無い呼び出し・他社の改善要望・流量制限の超過（`src/app/api/improvements/route.integration.test.ts`・`src/app/api/agent/device/route.integration.test.ts`）。

#### Contract tests

- Positive: 成功の応答が `private, no-store`（`api.test.ts`）。
- Boundary: 流量制限のちょうどと超えで 429 と `retry-after`。
- Negative/auth/error/idempotency: 失敗の応答も `private, no-store`（`api.test.ts`）。端末の引き換えの同時2回（`agent/device` の結合テスト）。改善要望の状態の順番飛ばしで 409。

### API: 退避した Route Handler（22本・廃止）

#### 識別と目的

- Operation ID: 画面からの書き込みに使っていた Route Handler 22本。
- Method/Path と置き換え先: `account/company-scope`（`switchCompanyScope`）、`account/password`（`changeOwnPassword`）、`account/profile`（`updateOwnProfile`）、`agent-keys`（`createAgentKey`・`revokeAgentKey`・`setAgentEnvKey`）、`agent-keys/approve`（`checkDeviceCode`・`approveDevice`・`revokeAgentSession`）、`companies`（`createCompany`・`updateCompany`）、`cycles`（`createCycle`・`updateCycleStatus`）、`evaluations/[id]`（`updateEvaluation`）、`evaluations/build`（`buildEvaluations`）、`forms/[id]/extensions`（`grantFormExtension`・`revokeFormExtension`）、`forms/[id]/questions`（`rebuildFormQuestions`・`saveFormQuestions`）、`forms`（`createForms`・`updateForm`）、`import/members`（`previewMembersImport`・`importMembers`）、`import/responses`（`previewResponsesImport`・`importResponses`）、`kgi-results`（`saveKgiResult`）、`masters/profile-policy`（`saveProfilePolicy`）、`masters`（`saveMaster`・`deleteMasterItem`）、`members`（`createMember`・`updateMember`）、`notes`（`createNote`）、`responses/[formId]`（`saveResponse`）、`scheme`（`saveScheme`）、`system/users`（`updateSystemUser`・`createSystemUser`）。いずれも `/api/` の下。
- Purpose: 描き直しを画面ごとに呼ぶ作りをなくし、書き込みの入口を `runAction` の1つにするため（D-002）。
- Version/Lifecycle: 2026-10-01 に廃止。ファイルは git から外し、リポジトリの外の退避先に置いた（リポジトリには残さない）。互換の期間は設けない（外から呼ぶ利用者がいない画面専用の口だったため）。

#### 認証・認可

- Authentication: N/A: 経路が無いので、認証の前に 404 になる。
- Required scopes/roles: N/A: 置き換え先の認可は「API: サーバーアクションの書き込み」と「API: サーバーアクションの読み出し」に従う。
- Resource ownership check: N/A: 処理しない。

#### Request

- Headers: N/A: どんなヘッダーでも処理しない。
- Path parameters: N/A: 経路が無い。
- Query parameters: N/A: 経路が無い。
- Body schema: N/A: 本文を読まない。
- Example: `POST /api/companies`（未ログイン）→ 404。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 404 | 経路が無い（全てのメソッド） | Next.js の not-found 画面（HTML） |

- Headers: `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`（2026-10-01 にローカルの preview で `GET`・`POST /api/companies`、`PATCH /api/members` を送って確かめた）。
- Example: 本文は not-found 画面。JSON は返さない。

#### Validation・ビジネスルール

- N/A: 処理しないので検証も無い。入力の検証は置き換え先のアクションの zod スキーマが持つ。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 404 | ROUTE_REMOVED | 廃止した経路への全てのメソッド | no | 画面から操作する（置き換え先のサーバーアクションを通る） |

#### 実行セマンティクス

- Idempotency key/replay: N/A: 書き込まない。
- Concurrency/optimistic lock: N/A: 書き込まない。
- Transaction boundary: N/A: 書き込まない。
- Timeout/retry/rate limit: N/A: 処理しない。

#### キャッシュ・ページング

- Cache/ETag: 404 も保存させない（上の観察値）。
- Cursor/limit/filter/sort: N/A: 処理しない。

#### 可観測性と監査

- Request/correlation ID: `x-generated-at` だけが付く。
- Metrics/logs/audit/redaction: 廃止した経路への呼び出しは Workers Logs の 404 として見える。専用の記録は持たない。

#### セキュリティ確認

- Input/output validation: N/A: 本文を読まない。
- Sensitive data exposure: 書き込みの入口が22本から `runAction` の1つに減り、送信元の検査と権限の確かめを1か所で行う（攻撃面の縮小）。
- Abuse/authorization tests: 画面の部品に書き込みの `fetch` が残っていないこと（`server-actions-contract.test.ts`）。

#### Contract tests

- Positive: N/A: 成功する経路が無い。
- Boundary: N/A: 境界値が無い。
- Negative/auth/error/idempotency: 部品から廃止した経路を呼ばないこと（`server-actions-contract.test.ts`）。退避した経路の試験は、置き換え先の試験へ移した（`src/actions/agent-keys.integration.test.ts`、`src/lib/masters/` の `apply-master-update-kpi-category`・`apply-master-update-kpi-item`・`body-schema`・`delete-master-item`）。

## データモデル

- Entity/Value: `initial_credential_memos`（初期パスワードの控え。移行 0031）と、`constitution_events` の一意索引 `uq_ce_entity_seq`（移行 0032）を足した。ほかの表は変えていない。
- Fields/Types/Nullability: 控えは `user_id`（text・主キー・`users.id` を参照、利用者を消すと控えも消える）、`ciphertext`・`iv`・`key_version`（text・必須）、`issued_by`（text・空を許す）、`issued_at`（integer・必須）。平文の列は持たない。
- Relations/Constraints/Indexes: `uq_ce_entity_seq` は `(company_id, entity_type, entity_id, seq)` の一意索引。張る前に、既にある重なりを同じ実体の中で `(seq, occurred_at, id)` の順に振り直した（並び順は変えない）。旧索引 `idx_ce_entity` は消した。
- Ownership/Retention/Migration: 控えは発行から14日で期限切れ。次の発行の batch の先頭で消す（定期実行は持たない）。本人のパスワード変更で消え、再発行で置き換わる。移行は本番の配布の流れ（`deploy.yml` の backup → 適用 → 未適用0件の再確認）で当てる。

## 認証・認可

- Authentication: better-auth のセッション Cookie。サーバーアクションも Route Handler も `apiViewer` で確かめる。Claude Code 向けは Bearer 鍵。
- Authorization: 入口ごとに最小の役割を宣言する（`runAction({ role })`）。会社の変更・会社の切替・利用者の追加と変更は全体管理者だけ。控えは全体管理者と同じ会社の管理者だけ。
- Tenant/data boundary: 利用者の所属会社（全体管理者は切替中の会社）で絞る。本人の登録内容は本人の行だけを、会社が開放した項目だけ変えられる。別のサイト・ポート違いからの送信は、ログインを確かめる前に断る。

## エラー・例外・回復

- Error taxonomy: 上の「API契約」の各 Error contract のとおり。サーバーアクションの失敗は HTTP 200 の `{ ok: false, message }` で、内部の区分（401・403・400・404・409・410・413・429・500・503）は文面に畳む。`/api/*` は状態コードをそのまま返す。
- Retry/Timeout/Fallback: 入口は自動で再試行しない。画面は失敗の文面を出し、入力を残す。会社の追加は失敗したら逆順に取り消す。パスワード変更の続きは1回だけやり直す。鍵が無いときは控えを作らず、その場でメモする案内に落とす。
- Idempotency/Concurrency: 同時保存は後のほうを 409 で断る（先の人の変更を黙って上書きしない）。端末の承認の引き換えは条件付きの更新で1回だけ通る。取り消し・やり直しの失敗は `compensation_failed`・`rollforward_failed` として残し、手で直す手順は `docs/deploy-notes.md` §7。

## イベント・非同期処理

- Producer/Consumer: 保存に成功したタブが `BroadcastChannel("hr-evaluation:freshness")` へ `{ kind: "saved", resource, at }` を送り、同じブラウザの同じ origin の他のタブの `FreshnessSync`（`watchFreshness`）が受ける。サーバー側のキュー・定期実行は持たない（N/A: 控えの掃除は発行の batch に入れ、取り直しはブラウザの中で完結するため）。
- Delivery/Ordering/Deduplication/DLQ: 届くのは同じブラウザの中だけで、送ったタブ自身には届かない。順序は保証しない（知らせは「取り直せ」の合図だけで、中身を運ばないため）。受けた側は 1.5 秒に1回へ間引き、裏にいる間の知らせは表に戻ったときの1回にまとめる。落ちた知らせは、タブ復帰・bfcache 復元・通信復帰での取り直しが拾う（再送の仕組みは持たない）。

## 可観測性

- Logs/Metrics/Traces/Audit: Workers Logs（`wrangler.jsonc` の `observability.enabled`）に、想定外の失敗（`console.error`）、`compensation_failed`・`rollforward_failed`、`credential_memo_revealed` を残す。画面のアクションの所要時間と成否は `/actions/{resource}` の名前で利用状況に送る。制度マスタの変更は `constitution_events`。入力値・パスワード・控えの値・生成時刻以外の利用者を表す値は記録しない。
- Alert/SLO dashboard: 警報と SLO の画面は持たない（N/A: 配信は workers.dev の1本で、運用担当が報告を受けて Workers Logs を見る運用のため）。反映されない報告は、応答の `x-generated-at` と Workers Logs の時刻で切り分ける（`docs/deploy-notes.md` §6・§7）。

## 互換性・移行・リリース

- Compatibility/versioning: サーバーアクションの識別子は公開ごとに入れ替わる。開いたままの古い画面からの送信は届かず、画面が再読み込みを頼む（STALE）。廃止した22本の経路は互換の期間を設けず 404 にする。Next.js は 16.3.8、OpenNext Cloudflare は 1.20 系で、構成は変えない。
- Migration/backfill: 移行 0031（控えの表）と 0032（監査番号の振り直しと一意索引）。0032 は既存の重なりを振り直してから索引を張る。
- Rollout/rollback: `main` への取り込み後、`deploy.yml` が「確認 → 型と試験 → 本番 D1 の backup と保管 → 移行の適用 → 未適用0件の再確認 → 配布 → 30秒後と90秒後の smoke」の順に流す。自動のロールバックはしない（`docs/deploy-notes.md` §8）。移行の適用後に配布だけが失敗したら、同じ workflow を再実行する（適用済みの移行は再適用されず、未適用0件の確認の後の配布から再開する）。古い isolate・認証・設定の不備を切り分けてから `wrangler rollback` を選び、DB を戻すときは保管したバックアップと移行の互換性を確かめる。配布の後に、本番で作成の直後の ⌘+Shift+R を確かめる（W2）。

## テストと受入条件

- [ ] `AC-001`: Given 会社一覧を開いた全体管理者, When 会社を追加する, Then 成功の知らせと同じ描画で一覧・件数・会社切替メニューに新しい会社が出て、控えは畳まれて始まる（E2E・同じタブ。375px・768px でも同じ）。
- [ ] `AC-002`: Given 会社を追加した直後, When ⌘+Shift+R か URL の直接表示をする, Then 新しい会社が出る（E2E・強制再読み込み）。
- [ ] `AC-003`: Given 同じ一覧を開いた2つのタブ, When 片方で会社を追加する, Then もう片方に1秒以内に出る（E2E・2つのタブ）。
- [ ] `AC-004`: Given 別の端末（別のブラウザの文脈）で同じ一覧を開いている, When 片方で追加し、もう片方を開き直す, Then 新しい会社が出る（E2E・別の端末）。
- [ ] `AC-005`: Given 一覧から別の画面へ移った, When 戻るボタンで戻る（bfcache 復元を含む）, Then 古い一覧のまま残らない（E2E・戻る・bfcache）。
- [ ] `AC-006`: Given 会社の追加の途中の段階を失敗させる, When 追加する, Then 会社・制度ひな形・利用者・アカウントのどの行も残らず、取り消しも失敗させたときは `compensation_failed` が出る（結合テスト）。
- [ ] `AC-007`: Given パスワード変更の続きを2回とも失敗させる, When 変更する, Then `rollforward_failed` が出て、「変更済み」と伝わる（`credential-memo-lifecycle.integration.test.ts`）。
- [ ] `AC-008`: Given 新しいサーバーアクションを `runAction`・`runRead` を通さずに足す, When `pnpm test` を回す, Then `server-actions-contract.test.ts` が落ちる。
- [ ] `AC-009`: Given 発行から14日を過ぎた控え, When 一覧を開く・開こうとする, Then ボタンが出ず、開くと 410 で再発行を頼み、次の発行で消える。
- [ ] `AC-010`: Given 別のサイトかポート違いの送信元, When サーバーアクションを送る, Then ログインを確かめる前に断る（`action-origin.test.ts`）。
- Contract/integration/e2e/security/performance: どのテストが何を固定するかは [アーキテクチャ「テスト」](../architecture/data-freshness.md#テスト) が正本。E2E は `e2e/data-freshness.spec.ts` と `e2e/data-freshness-component-types.spec.ts`（経路の一覧は前者の冒頭の注釈が正本。ローカル以外へは向けない）。2026-10-02 の実測で、`pnpm test` は 144 ファイル・2246 件が通り、E2E は 14 件が3回続けて通った。性能は O3 の1秒を E2E で見る（負荷試験は持たない）。

## 決定事項

1. 画面からの書き込みは、すべてサーバーアクションにする。入口は `runAction` の1つで、「権限 → 大きさ → 入力の形 → 本体 → `refresh()`」の順に通す。画面ごとに描き直しを呼ぶ作りは残さない。
2. `refresh()` は成功したときだけ呼ぶ。成功の表示と新しい画面は同じ応答で届く（往復は1回）。失敗は `{ ok: false, message }` で返し、描き直さない。
3. 読むだけの入口（控えを開く・端末の確認コードを調べる・CSV 取り込み2種の下見）は `runRead` を通す。描き直さず、他のタブにも知らせない。
4. `/api/*` に残すのは、外から読む口と画面の外の相手だけ（`agent/device`・`agent/token`・`auth/[...all]`・`export`・`improvements`・`improvements/[id]`・`search`・`theme-choice`・`usage`）。
5. ログイン後の画面と `/api/*` の応答は `Cache-Control: private, no-store`。API は共通の出口 `handle`・`jsonError` が成功・失敗の両方に付ける。失敗に添えた待ち時間などのヘッダーは残し、保存の指示だけを固定する。
6. 他のタブへの知らせは `BroadcastChannel("hr-evaluation:freshness")`。加えて、タブが見えたとき・戻るボタンで開き直したとき（`pageshow` の `persisted`）・通信が戻ったときに取り直す。取り直しは1.5秒に1回へ間引く（bfcache の復元だけは間引かない）。
7. 別の利用者・別の端末の画面へは押し出さない（常時接続は持たない）。戻ったとき・開き直したときに最新を見れば足りる。
8. 1つの操作で複数の表を書くときは、1回の D1 batch にまとめる。制度マスタは本体と監査記録を同じ batch で書く（`writeMasterBatch`）。
9. 監査記録の番号は実体ごとに一意（`uq_ce_entity_seq`、移行 0032）。同じ項目の同時保存は後のほうを 409 で断り、自動でやり直さない（先の人の変更を黙って上書きしないため）。
10. 1回の batch に入らない書き込みは2つだけで、型を分ける（D-003＝案A＋rollForward）。会社の追加は会社 → 制度 → 管理者の順に書き、途中で失敗したら逆順に消す（`withCompensation`）。取り消しも失敗したら決まった文面で返し、`compensation_failed` を Workers Logs へ残す。パスワードの変更は認証ライブラリの書き込みを取り消せないので、続き（控えの削除・他端末のログアウト）を1回やり直し、それでも失敗したら「変更済み」と伝えて `rollforward_failed` を残す（`rollForward`）。この3つの型の外で2つ以上の表を書く関数が無いことを `write-atomicity-contract.test.ts` が固定する。
11. 別々の `await` で2つの表を書いていた4か所（改善要望の書き込み・端末の承認の引き換え・利用状況の記録と掃除）は1回の batch にした。端末の承認の引き換えは条件付きの更新にし、同時に2回引き換えても1回だけ通る。
12. 別のサイトからの書き込みと読み出しは二重に断る。Next.js の Server Actions の送信元検査（`allowedOrigins` は足さない）と、`runAction`・`runRead` の先頭の `assertSameOrigin`（ポートだけ違う場合も断る）。どちらもログインを確かめる前に効く（`action-origin.test.ts`）。
13. 初期パスワードの控えは AES-GCM で暗号化し、利用者IDを付加データに入れる。平文は保存しない。鍵は Workers の secret `CREDENTIAL_ENC_KEY` にだけ置き、無ければ控えを作らずその場でメモする案内を出す（発行は止めない）。
14. 控えを開けるのはシステム全体管理者と同じ会社の管理者だけ。本人がパスワードを変えると控えは消え、再発行すると置き換わる。発行から14日（`MEMO_TTL_DAYS`）を過ぎた控えは一覧に出さず、開こうとすると 410 で再発行を頼み、次の発行の batch の先頭で消す。本人のパスワード変更では、この端末のログインを保ち、他の端末のログインを切る。
15. 会社の変更・会社の切替・利用者の追加と変更はシステム全体管理者だけ。本人の登録内容の変更は本人の行だけを、所属会社が開放した項目だけ変えられる（開放されていない項目が混ざったら全体を断る）。応答に仮パスワードの値を返さず、想定外の失敗は中身を伏せて決まった文面で返す（`account-and-company-admin.integration.test.ts`。backlog SECURITY-001 の監査）。

## 非決定 / 残すもの

- 別の利用者・別の端末への押し出し（W1。同じ画面の同時編集が必要になったら検討する）
- 本番での作成直後の ⌘+Shift+R の確認（W2。配布後に行う。ゾーンに HTML・`/api` を保存するキャッシュ規則が無いことを読み取りだけで確かめる）
- 本番の `CREDENTIAL_ENC_KEY` の設定（W3。外部への変更なので利用者の確認を通す）
- 仮パスワードそのものの失効（W4 / backlog SECURITY-005。失効させるとログインできなくなるので、日数と期限切れの人の見分け方を事業側が決める。控えの14日はこの作業で入れた）
- 楽観更新（backlog UX-030。保存から表示までの実測値を取ってから決める）

## 未決事項

この機能の受け入れ（AC-001〜AC-010）を止めるものは無い。次の5件は、決める時点を日付ではなく「きっかけ」で置く。決めるまでの間も、今の作りで U1・G1〜G5 は守られる。

| ID | 決めること | きっかけ（決める時点） | 決める人 | 決めるまでの扱い |
|---|---|---|---|---|
| W1 | 別の利用者・別の端末の画面へ、保存を押し出すか（常時接続を持つか） | 同じ画面を複数人で同時に編集することが要件に上がったとき | daishiman | 押し出さない。画面復帰・開き直し・通信復帰で取り直す（決定事項 6・7） |
| W2 | 本番で、作成の直後に ⌘+Shift+R をしても新しい行が出るか | 本番へ配布した当日 | daishiman（運用担当） | ローカルの E2E（`e2e/data-freshness.spec.ts`。強制再読み込みを含む）で確かめ済み。本番ではゾーンに HTML・`/api` を保存するキャッシュ規則が無いことを読み取りだけで確かめる |
| W3 | 本番の Workers secret `CREDENTIAL_ENC_KEY` を設定する | 本番へ配布する前が望ましい（未設定でも発行は止まらない） | daishiman（運用担当） | 控えを作らず、その場でメモする案内を出す（決定事項 13）。設定は外部への変更なので、確認の手順（preview → 確認 → 実行）を通す |
| W4 / SECURITY-005 | 仮パスワードそのものを何日で失効させるか、期限切れの人をどう見分けるか | 事業側が日数を決めたとき | 事業側 | 失効させない。控えだけを14日で開けなくする（決定事項 14） |
| UX-030 | 楽観更新（応答を待たずに一覧へ足す）を入れるか | 本番で保存から表示までの実測値が取れた後 | daishiman | 入れない。成功の表示は新しい画面が描き終わってから出す（AC の実測値を参照） |

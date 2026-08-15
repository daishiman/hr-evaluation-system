# 改善要望 — 投稿・保存・管理契約

## 1. 対象とroute identity

- 投稿入口は`AppShell`内の`FeedbackWidget` 1個。認証済み業務ページへ共通配置する。
- routeの正本は`route-ledger.json`。`src/lib/nav.ts`は台帳を読み、別の画面名表を持たない。
- `path`はクエリ/hashを除いた実URLを再現用に保存する。`route_pattern`は動的IDを`[token]`等へ正規化し、一覧の集計・絞込に使う。
- `/f/<token>`は`/f/[token]`・「配布されたアンケート」として扱い、「その他の画面」にしない。
- 台帳外pathは実pathを両列へ保存し、画面名を「その他の画面」とする。クライアントが名乗る画面名は受け付けない。

## 2. POST `/api/improvements`

処理順は次で固定する。

1. `apiViewer("EMPLOYEE")`で有効session、role、companyを確定する。
2. `Content-Length`を解析前に、streamの実バイト数を読取中に960,000 bytes以下か検査する。超過は413。
3. strict JSON schemaでpath、`kind`(`bug`/`request`)、1〜1000文字本文、300文字以内の`expected`、`NN×NN` viewport、UUID submission keyを検査する。
4. shotはPNG/JPEG/WebPのdata URL、base64整合、magic bytes一致、復号後700,000 bytes以下を検査する。
5. `company_id + reporter_id + submission_key`の既存行は同じIDを成功応答し、連投回数へ加えない。
6. 既存rate-limit機構で投稿者ごと60秒5件まで。超過は429と`Retry-After`を返す。
7. `improvement_requests`と任意の`improvement_shots`を単一D1 `batch`へ入れる。任意statement失敗は全rollbackする。

submission keyから投稿者を含む決定的request IDをSHA-256で生成し、unique indexと合わせて並行再送も1件にする。秘密、自由本文、画像data URLはログへ出さない。D1保存例外は値を含まない固定500文へ変換する。

## 3. 管理閲覧・PATCH

- 一覧、詳細、更新は`COMPANY_ADMIN`以上。`SUPER_ADMIN`は選択中会社、`COMPANY_ADMIN`は自社だけ。
- 一覧queryは`company_id`、詳細queryは`company_id AND id`。更新の`WHERE`も`company_id AND id`を持つ。
- 他社と不存在を区別せず404。MANAGER/EMPLOYEEは閲覧・更新不可。
- 状態は`open / doing / done / dropped`。どの状態からでも変更でき、同じ状態のままメモの追加・修正・空化ができる。
- `dropped`はtrim後のメモが必須。状態とメモがどちらも同じなら400。
- 物理削除APIは持たない。

## 4. DB

| 表/制約 | 契約 |
|---|---|
| `improvement_requests.path` | 実URL。query/hashなし |
| `improvement_requests.route_pattern` | route ledgerに基づく集計単位 |
| `improvement_requests.submission_key` | 新規投稿は必須。legacy行だけnullを許す |
| `uq_ir_reporter_submission` | company+reporter+submission keyの冪等境界 |
| `idx_ir_route` | company+route patternの一覧境界 |
| `improvement_shots.request_id` | requestと1:0..1。本文と同batch |
| `improvement_requests.kind` | `bug`/`usability`/`feature`。既存行は`usability`をdefaultで受ける |
| `improvement_requests.diagnostics` | 正規化・masking済みJSON文字列。200KB超はnull |
| `improvement_issue_links.request_id` | PK。Issue二重起票の境界。requestへcascade |

`0019_improvement_delivery.sql`は既存行のroute patternを安全側でbackfillし、submission keyはlegacyを壊さないためnullのままにする。
`0020_improvement_issue.sql`は`kind`/`expected`/`diagnostics`を追加し、`improvement_issue_links`を新設する。既存行は`kind='usability'`、他はnullで通る（当時種類を聞いていないため、後から`bug`と言い換えない）。

## 4-1. 自動収集する技術情報

- 収集は`src/lib/client-diagnostics.ts`（browser）。上限・正規化・maskingの正本は`src/lib/domain/improvement-issue.ts`。
- 収集対象は端末情報、console error/warn、unhandledrejection、**失敗したfetchのみ**(method/path/status/duration/request body/response body)、直前操作、navigation timing、LCP。
- bodyは**same-originのみ**。外部URLはmethod/path/statusだけにし、`external: true`で区別する。成功した通信のbodyは取らない。
- 入力値、header、cookie、query stringは収集しない。欄はlabelだけを残す。`.feedback-root`内の操作は除外する。
- bodyのmaskingは**key名**で行う（`token`/`secret`/`password`/`authorization`/`cookie`/`session`/`credential`/`signature`と、`mail`/`name`/`comment`/`note`/`reason`/`memo`/`feedback`）。値側の規則（mail/Bearer/長い連なり/数字列）も重ねて当てる。over-maskは許容する（氏名・評価コメント流出の方が不可逆なため）。
- JSONとして解釈できない場合は値側の規則だけを当てる。配列は先頭50件、入れ子は6段まで（超過は`…ほか${n}件`/`…`）。
- 件数上限 logs 20 / network 20 / breadcrumbs 30、1項目300文字、body 1本8,000文字・合計64,000文字、全体200,000 bytes。body合計超過時は**古い順にbodyだけ落とし行は残す**（`truncated: true`）。全体超過時はdiagnosticsをnullにして本文を残す。
- `kind`ごとにDiagnosticsLevelを決める（`bug`→`full` / `usability`→`medium` / `feature`→`minimal`）。`medium`はlogsとbodyを落とし、`minimal`はnetwork/breadcrumbs/performanceを空にする。判定の正本は`diagnosticsLevelFor()`で、**serverが再度levelを当て直す**（clientの申告を信用しない）。
- 送信前preview（`FeedbackWidget`）は`collectDiagnostics(kind)`＝`normalizeDiagnostics(raw, level)`の戻り値をそのまま表示する。保存されるものと表示物は同一関数を経由する。
- maskingはclientとserverの両方で通し、**serverの通過を正本**にする（clientは差し替え可能なため）。
- 保存先はメモリのみ。`localStorage`/`sessionStorage`/IndexedDBを使わない（`ui-rules.test.ts`が固定）。

## 4-2. POST `/api/improvements/[id]`（記録票の起票）

- `apiViewer("SUPER_ADMIN")`のみ。`COMPANY_ADMIN`は不可（送信先が会社ではなく開発側repoのため）。
- 会社scopeは`getImprovementRequest(companyId, id)`。他社・不存在はいずれも404。
- 既存linkがあれば内容の指紋で分岐する（一致=skip / 不一致=同一issueをPATCH+comment / 壊れている=再作成）。詳細は §7。二重起票の境界は`improvement_issue_links`のPK。
- 詳細画面のPOSTと一覧のPUTは同じ`syncImprovementIssue()`を通る。起票処理を2箇所に書かない。
- `requireGithubSettings()`を**送信前**に通す。`GITHUB_REPO`未設定・不正、`GITHUB_TOKEN`未設定は503で、設定手順を含む文を返す。
- token未設定時の文面は`src/lib/domain/github-setup.ts`が正本（取得先URL・一覧URL・選ぶpermission・一度しか表示されない旨・`wrangler secret put`のコマンド）。対象repoは`GITHUB_REPO`から差し込み、案内側へ書き写さない。同じURLを`.dev.vars.example`・README・`docs/deploy-notes.md` §5・`wrangler.jsonc`のコメントでも案内する。
- 画面（`ImprovementIssueForm`）は改行で分けて1行目をReasonNote、2行目以降を手順の番号付きリストで出し、`https://`で始まる部分だけを`target="_blank" rel="noopener noreferrer"`のリンクにする。
- 外部送信の**前**に`improvement_issue_links`へ`issue_number = 0`の席を`onConflictDoNothing`で立て、`returning()`が空なら送らない。成功後に`issue_number`/`issue_url`/`content_fingerprint`/`synced_at`を書き、`status='open'`なら`doing`へ進める。
- tokenはserver専用（`src/lib/github-issue.ts`）。clientへ渡さず、client bundleへ露出させない。
- 本文・titleは`src/lib/improvement-issue-draft.ts`が組み立て、管理画面のpreviewとAPIが同じ関数を共有する。previewも`listRelatedIssueLinks()`を同条件で引き、previewと実送信の本文を一致させる。
- titleは`[不具合|改善|新機能] {screenLabel}: {本文1行目}`。labelは`improvement` + topic(`bug`/`enhancement`/`feature-request`) + `severity:high|medium|low` + `area:{route pattern第1segment}`（動的segmentは付けない）。severityはconsole error有無・status null/5xx有無から導出し、本人の申告では決めない。
- 重複は`listRelatedIssueLinks(companyId, routePattern, kind, excludeId)`で同画面・同種の直近3件を「似ている記録票」として本文へ並べるだけにする。自動closeも自動commentもしない（判断は人）。
- 技術情報は`<details>`内をsub headingで分ける（環境 / コンソールのエラー / 失敗した通信 / 操作の履歴 / 表示の速さ / 読み始めるファイルの候補）。summaryは`full`のとき「技術情報（実装に必須）」、それ以外は「参考情報（自動収集）」。
- 本文は58,000文字でclampする（GitHubのissue body上限65,536文字に対する安全域）。切った事実と管理画面での全文参照を明記する。
- 記録票へ氏名・メール・画像data URLを載せない。画像は管理画面URLで参照する。
- routeは`/issue`へ分けずPATCHと同一fileへ置く。route segmentを増やすとserver bundleが依存一式ごと重複し、free planの上限に対し約0.5MB増える。

## 5. クライアント下書きと回復

- 種類（うまく動かない/使いにくい・直したい/こんな機能がほしい）は必須のchip選択、`expected`（どうなってほしいか）は任意1行。追加入力はこの2つまで。既定は`usability`。
- 何が一緒に送られるかを窓の中に畳んで明示する（開かなくても項目名が読める見出しを付ける）。中身はkind依存の説明文＋件数＋maskingずみbody実物で、kindの切替に追従する。
- 自動撮影を既定にし、再撮影、貼付、ファイル選択、注釈、undo、画像削除、文章のみ投稿を同じdialogで行う。
- 黒塗りは注釈色に関係なく`--mark-ink`固定。画像は送信時に焼き込み、元画像は保存しない。
- 未送信本文・画像・submission keyはReact state/refにだけ保持し、close/reopen・失敗で維持する。`localStorage`、`sessionStorage`、IndexedDBへ置かない。
- 空本文は送信ボタンをdisabledにせず、inline errorを出してtextareaへfocusする。
- 413/429/500/通信失敗は入力を保持し、画像削除・待機・再送の回復方法を同じdialog内に示す。

## 6. テスト契約

最低限、文章のみ、画像あり、偽装/超過画像、解析前/実body超過、rate-limit、D1 rollback、順次/並行idempotency、動的URL集約、4ロール、他社404、同状態メモ追加/修正/空化、見送り理由をunit/integrationで固定する。E2Eは投稿→会社管理者一覧→詳細→状態変更を実ブラウザで通す。

diagnosticsとIssue起票は次を固定する。masking（メール/Bearer/token/長い連なり/数字列、およびkey名masking）、件数と長さの切り詰め、body合計上限での古い順切り落とし、外部URLがmetadataだけになること、200KB超のnull化、破損JSONの無害化、不正な`kind`/levelの安全側fallback、`kind`別のDiagnosticsLevel、`sourceCandidatesFor`のpath導出、記録票本文の必須節とsub heading、summaryの出し分け、label/severity/areaの導出、似ている記録票の掲載、58,000文字clamp、氏名・メール・画像を含まないこと、SUPER_ADMIN以外の拒否、他社404、設定不足時に外部送信しないこと、二重押しで1件だけになること。外部送信はmockし、テストからGitHubへ出さない。`src/lib/domain/improvement-issue.ts`はcoverage 100%（branch含む）の対象で、到達しない分岐を残さない。

## 7. 一覧からの一括同期（PUT /api/improvements）

- 入口は`PUT /api/improvements`（`{ id }` 1件）。route segmentを増やさないため既存fileへ同居させる。画面が**逐次**呼ぶ。並行実行しない（進捗表示・部分確定・rate limit回避の3点が理由）。
- 権限は`apiViewer("SUPER_ADMIN")`。画面側の`canPush`はUIのみ。1件の失敗は例外にせず`{ result }`として200で返す（throwすると後続行が止まる）。
- 状態判定は`src/lib/domain/improvement-sync.ts`（純関数・coverage 100%対象）。`issueSyncState(link, fingerprint)` → `none | synced | changed | broken`、`plannedAction()` → `create | skip | update | recreate`。
- `improvementFingerprint()`の材料は`kind` / `screenLabel`+`path`+`routePattern`（まとめて1項目「画面」）/ `body` / `expected` / `status` / `handledNote`。`diagnostics`・`createdAt`は不変なので含めない（一覧クエリで大きなJSONを読まないためでもある）。`null`と`""`は同値。
- 更新日時比較はしない。`content_fingerprint`の一致だけで判定する。空の指紋は「比較不能」＝`synced`扱い（移行時に既存issueへcommentを流し込まない）。
- 作成時に`status`が`open→doing`へ進むため、draftと指紋は**進めた後の値**で作る（`advanced`）。送信前の値を控えると直後に`changed`になる。
- schema: `improvement_issue_links.content_fingerprint`(text, default '')、`synced_at`(integer timestamp, nullable)、`link_state`(text, default 'ok' / 'missing')。migration `0021_improvement_issue_sync.sql`（手書き。`db:generate`は使わない）。
- 席取り: 新規は`issue_number = 0`のinsert + `onConflictDoNothing().returning()`。再作成は`UPDATE ... WHERE link_state='missing' OR (issue_number=0 AND created_at < now-20s)`（`SEAT_STALE_MS = 20_000`）。失敗時は席を削除するが、`IssueMaybeCreatedError`（2xxだが応答を読めない）だけは席を残す。
- `updateGithubIssue()`は`PATCH /issues/{n}`に`state`を送らない（closeを勝手に戻さない）。404/410は`{ missing: true }`を返し、呼び出し側が`link_state='missing'`を立てて`failed`として返す（自動再作成しない）。
- `commentOnGithubIssue()`は`issueUpdateComment(changed, at, closed)`の本文を投げる。変わった項目名とJST時刻、closed時は開き直していない旨を含む。
- 一覧（`listImprovementRequests`）は行ごとに`syncState`と`syncNote`を返す。無言の行を作らない。
- テスト契約（§6に追加）: 未起票→created / 同内容→skipped（外部呼び出し0回）/ 変更後→updated + comment / closed issueで`state`を送らないこと / missing→failed後にもう一度でcreated（linkは1件のまま）/ 作成失敗で席が空くこと / SUPER_ADMIN以外403 / 他社404。UI契約は`src/components/improvement-ux-contracts.test.ts`。

## 8. 落とす・戻す・廃棄（PUT /api/improvements の action）

- 入口は§7と同じ`PUT /api/improvements`。`action`（既定`sync`）で分岐する。`reject | duplicate | discard | restore | unlink | close-issue | refresh`。route segmentは増やさない。
- 権限は`apiViewer("SUPER_ADMIN")`。画面の`canDisposeImprovements(role)`はUIのみ。既存のPATCH（対応状況とメモ）は`COMPANY_ADMIN`のまま変えない。
- **物理削除を作らない**。廃棄は`improvement_requests.discarded_at / discarded_by_id / discard_reason`の印。重複は`duplicate_of_id`。`status`のCHECK制約（`open|doing|done|dropped`）は変更しない（子FKを持つ表の作り直しを避けるため）。
- 判断は`src/lib/domain/improvement-disposition.ts`（純関数・coverage 100%対象）。表示状態は`discarded > duplicate > status`の優先順。理由は`REJECT_REASONS`/`DISCARD_REASONS`から選択し、`other`は自由記述必須。`dispositionReasonError()`を画面とサーバーの両方で通す（理由なしは400）。
- 履歴は`improvement_status_events`へ**追記のみ**（`id / request_id / action / from_status / to_status / reason_code / reason / actor_id / created_at`）。UPDATEしない。詳細画面のPATCH（対応状況の変更）も`action:"status"`で1行残す。
- 戻す（`restore`）先は履歴から引く（最後の`discard|reject|duplicate`の`from_status`）。これが「廃棄→復元で元の状態に戻る」の根拠。
- **順番はアプリ側の確定 → GitHub**。`closeGithubIssue`の失敗は理由文へ書き足すだけで、アプリ側の状態を巻き戻さない（逆も同じ）。ずれは一覧の記録票列（`issue_state`）に出る。
- `closeGithubIssue()`はcomment → `PATCH {state:"closed", state_reason:"not_planned"}`の順。`readGithubIssueState()`はGETのみで、closedなら`issue_state`を更新し、`open|doing`だったものを`done`へ追随させる（履歴に残るので戻せる）。
- 廃棄したものは`syncImprovementIssue`の先頭で`skipped`にする（画面の絞り込みだけに頼らない）。
- 一覧の既定は`view=active`（`open|doing`かつ廃棄・重複でないもの）。`all`は廃棄以外、`trash`は廃棄のみ。並べ替えは`new|old|state`。
- schema: migration `0022_improvement_disposition.sql`（手書き）。`improvement_issue_links.issue_state`(text, default 'open')を追加。
- テスト契約（§6に追加）: 廃棄で行が消えないこと / 廃棄→復元で元のstatusへ戻ること / 対応しない→復元 / 廃棄がまとめ送りの対象外になること / 理由なし400・`other`空400 / GitHubの失敗でもアプリ側が確定すること / 閉じる理由がcommentに載ること / unlink後に再作成できること / GitHub側closeへの追随 / 統合先なしの重複は400 / SUPER_ADMIN以外403 / 他社404。

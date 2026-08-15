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
| `improvement_handouts.request_id` | PK。払い出しの控えの境界。requestへcascade |

`0019_improvement_delivery.sql`は既存行のroute patternを安全側でbackfillし、submission keyはlegacyを壊さないためnullのままにする。
`0020_improvement_issue.sql`は`kind`/`expected`/`diagnostics`を追加する。既存行は`kind='usability'`、他はnullで通る（当時種類を聞いていないため、後から`bug`と言い換えない）。
`0023_improvement_handout.sql`は`improvement_handouts`を新設し、旧`improvement_issue_links`の行（`synced_at`→`handed_out_at`）を移してから旧表をDROPする。すでに外へ出した要望は「払い出し済み」に相当するため捨てない。

## 4-1. 自動収集する技術情報

- 収集は`src/lib/client-diagnostics.ts`（browser）。上限・正規化・maskingの正本は`src/lib/domain/improvement-instruction.ts`。
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

## 4-2. GET `/api/improvements`（作業指示文の払い出し）

- 認証は API キー方式。`Authorization: Bearer <key>`。session は使わない（呼ぶのは人ではないため）。
- 鍵の在り処は2つで**どちらでも通る**。**優先順位は ①画面で発行した鍵（`agent_api_keys.key_hash` とハッシュ比較。有効な全行が対象）→ ②Workers の secret `AGENT_API_KEY`**（`AGENT_KEY_MIN_LENGTH = 32`未満は未設定扱い）。①を先にするのは、①だけが画面から即座に止められるため。②は `agent_key_settings.env_key_enabled = false` のとき未設定と同じ扱いにする（画面から止める切替。§4-3）。どちらにも無いときだけ未設定（503）。
- 認証結果は `AgentAuthResult` で経路（`via: "screen" | "env"`）と通った鍵のハッシュを返す。払い出しの履歴に「どの鍵で取られたか」を残すため、通ったかどうかだけにしない。
- **鍵が無い/違うときは要望の中身を一切返さない**。401の文面は`AGENT_UNAUTHORIZED_MESSAGE`で固定し、未設定(503)と取り違え(401)で言い分けない。503は`agentKeySetupLines()`の設定手順を返す。
- rate limit（`AGENT_API_RATE_LIMIT` 60秒30回、key は `cf-connecting-ip`）は**鍵の検査より先**に消費する。後にすると外れた試行が数に入らない。判定の入口は`src/lib/agent-api.ts`の`guardAgentRequest()`1本。
- 純関数の正本は`src/lib/domain/agent-api.ts`（coverage 100%対象）。`readBearer` / `keysMatch`（長さ一致時は全桁比較）/ `agentAuth` / `agentFormat` / `parseAgentIds` / `agentFetchCommand` / `agentPromptText`。
- 形式は`?format=json|markdown`が`Accept`より優先。既定は markdown。応答は`handle()`を通さず生の`Response`で返し（`{ok:true}`で包むと指示文として読めない）、`cache-control: no-store`を必ず付ける。
- 取り方は3つ。一覧（引数なし・`AGENT_LIST_MAX = 50`・id/kind/screen/summary/statusのみ）/ 1件（`?id=`）/ まとめて（`?ids=`・`AGENT_BULK_MAX = 10`・重複は落とし、超過分は`dropped`として本文に明記）。
- 対象は会社を跨ぐ（`listImprovementsForAgent` / `getImprovementsForAgent`）。払い出せるのは開発側なので会社scopeで絞らない。廃棄済み（`discarded_at`）は問い合わせの段階で外す。
- 受け取れた時点で`recordHandout(db, item, { via: "api", ... })`を通す（`handed_out_by_id = null`）。画面からの払い出しだけを控えると、API で直接取った分が未払い出しのまま残る。履歴の作りは §4-4。
- 文面は`src/lib/improvement-instruction-draft.ts`が組み立て、管理画面のpreviewとAPIが同じ関数を共有する。
- titleは`[不具合|改善|新機能] {screenLabel}：{本文1行目}`。severityはconsole error有無・status null/5xx有無から導出し、本人の申告では決めない。
- 技術情報はsub headingで分ける（環境 / コンソールのエラー / 失敗した通信 / 操作の履歴 / 表示の速さ）。`kind`ごとのDiagnosticsLevelで量を変える。
- 本文は58,000文字でclampする。切った事実と管理画面での全文参照を明記する。
- 指示文へ氏名・メール・画像data URLを載せない。画像は管理画面URLで参照する。
- routeは`/agent`等へ分けずPOST/PUTと同一fileへ置く。route segmentを増やすとserver bundleが依存一式ごと重複し、free planの上限に対し約0.5MB増える。
- 画面が配る取得コマンドに本物の鍵を書かない（`AGENT_KEY_SHELL_VAR = "HR_AGENT_KEY"`を参照する形で出す）。

## 4-3. 鍵の発行画面（`/system/agent-keys`）

- 目的は「ターミナルを開かずに使い始められること」。SUPER_ADMIN専用（`requireRole` と `apiViewer("SUPER_ADMIN")` の両方で確かめ、画面で隠すだけにしない）。nav ラベルは `AGENT_KEY_PAGE_LABEL = "Claude Code 連携の鍵"`。
- 鍵は `crypto.getRandomValues(32 bytes)` → base64url（記号なし。シェル・貼付で壊れる文字を含めない）。**人が入力する方式にしない**。
- 保存するのは `key_hash`（SHA-256 hex）と `key_prefix`（先頭8文字）だけ。生の鍵は `POST /api/agent-keys` の応答が唯一の出口で、DB・ログ・履歴のいずれにも残さない。突き合わせは `keysMatch()`（定数時間）。
- **同時に有効な鍵は `AGENT_KEY_MAX = 10` 本**。`issueAgentKey()` は他の行を revoke しない（1本漏れたときに全部止めるしかない状態を作らない）。上限判定は画面表示だけでなく `issueAgentKey()` の入口でも行い、超過は 400（`AGENT_KEY_CAP_MESSAGE`）。
- **用途の名前（`label`、`AGENT_KEY_LABEL_MAX = 30`）は必須**。空欄の発行は 400。先頭8文字だけが並ぶ一覧では「どれを止めてよいか」が判定できず、結果としてどれも止められなくなる。名前は識別のためではなく**失効可能性のため**の項目。空の古い行は `agentKeyDisplayName()` が「名前のない鍵」に置き換える。
- `DELETE /api/agent-keys?id=` は1本だけ revoke し、他は動き続ける。id 未指定・既に失効済みは 400（黙って成功にしない）。確認文（`agentKeyRevokeConfirmText`）に止める鍵の名前と**残る本数**を書く。
- **設定値の鍵（`AGENT_API_KEY`）の受け付けは `PUT /api/agent-keys` で止められる**（`agent_key_settings.env_key_enabled`、既定 true）。secret を削除する案を採らないのは、削除が取り消せないうえ、すでに設定値で動いている場所を止めてしまうため。画面には恒久削除の1行（`AGENT_ENV_KEY_DELETE_COMMAND`）も併記し、急ぎは可逆な切替、恒久は削除、と選べるようにする。札は「登録されていません／使えます／止めています」の3つを言い分ける。
- 行は消さない。`created_by_id` / `created_at` / `revoked_by_id` / `revoked_at` がそのまま操作履歴になる。`last_used_at` は `AGENT_KEY_TOUCH_INTERVAL_MS = 60_000` を下限に書き足す（読むたびの書き込みを避ける）。
- 画面は発行直後だけ生の鍵を出し、`AGENT_KEY_ONCE_NOTICE` を鍵と同じ場所に先に出す。コピーできるのは3つ（鍵 / Claude Code へ貼る文言＝鍵を埋めた形 / `export HR_AGENT_KEY='...'`）。`localStorage`・`sessionStorage` へ置かない。作り直し・失効は `ConfirmButton` で1回確認する。
- 純関数の正本は `src/lib/domain/agent-keys.ts`（coverage 100%対象）。保存・乱数は `src/lib/agent-keys.ts`。migration は `0024_agent_api_keys.sql` と `0025_agent_keys_and_handout_history.sql`。
- 未設定時の 503 本文（`agentKeySetupLines()`）と `agentPromptText()` の末尾は、この画面の絶対URLを先に案内する。
- 一覧に出すのは 名前 / 先頭8文字 / 発行日時 / 最終使用日時 / 状態 の5項目。最終使用日時が空のときは `agentKeyUsageNote(null)` で理由を書き、空欄で並べない。

## 4-4. 払い出しの履歴（`improvement_handout_events`）

- 1回の払い出しにつき1行積む。`via`（`screen` = 画面からコピー / `api` = Claude Code が取得）、`actor_id`（画面のとき）、`key_label`（API のとき、通った鍵の名前の写し）を持つ。鍵の行が後で消えても読めるよう、名前は**参照ではなく写し**で持つ。
- **保持は要望1件につき新しい順に `HANDOUT_HISTORY_MAX = 20` 行**。挿入のたびに超過分を古い順に削る。全体件数で切ると、よく直す1件の履歴が無関係な要望の増加だけで消える。
- 通算回数の正本は `improvement_handouts.handout_count`（`recordHandout()` が `+ 1` する）。履歴の行数から数えない（丸めた瞬間に回数が減って見える）。
- 20行を超えたことは `handoutHistoryNote()` で画面に出す。黙って丸めない。
- 「更新あり（再払い出し推奨）」は従来どおり `improvement_handouts.content_fingerprint`（＝最新の払い出し時点の内容）と今の内容の比較で判定する。履歴を積んでも基準は変えない。
- 一覧は `handoutCountText(count, 最終日時)`、詳細は `listHandoutEvents()`（新しい順・上限 `HANDOUT_HISTORY_MAX`）を使う。

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

diagnosticsと指示文は次を固定する。masking（メール/Bearer/token/長い連なり/数字列、およびkey名masking）、件数と長さの切り詰め、body合計上限での古い順切り落とし、外部URLがmetadataだけになること、200KB超のnull化、破損JSONの無害化、不正な`kind`/levelの安全側fallback、`kind`別のDiagnosticsLevel、`sourceCandidatesFor`のpath導出、指示文の必須節とsub heading、severityの導出、58,000文字clamp、氏名・メール・画像を含まないこと、SUPER_ADMIN以外の拒否、他社404。`src/lib/domain/improvement-instruction.ts`はcoverage 100%（branch含む）の対象で、到達しない分岐を残さない。

払い出しAPIは次を固定する（最重要は1つ目）。**鍵なしで中身が返らないこと**、取り違えと未設定で断り文が同一であること、未設定・32文字未満で503と設定手順、rate limit超過で429（鍵の検査より前）、markdown既定と`?format=json`、`?id=`/`?ids=`（上限超過の`dropped`表示を含む）、masking済みの技術情報が指示文へそのまま載ること、受け取り時に控えが残り`open→doing`へ進むこと、廃棄済みが払い出されないこと。鍵は`getCloudflareContext`をmockして差し替える。

鍵の発行は次を固定する（`src/app/api/agent-keys/route.integration.test.ts`）。生の鍵がDBにも画面の再表示にも残らないこと、SUPER_ADMIN以外が発行・失効できないこと（サーバー側で）、失効させた鍵で払い出しが通らないこと、環境変数の鍵と画面発行の鍵のどちらでも通ること、鍵の全文が発行の記録に出ないこと、**名前なしの発行が断られること**、**1本失効させても他の鍵は通ること**、**上限（10本）を超えて発行できないこと**、**環境変数の鍵を画面から止めると通らなくなり、戻すとまた通ること**。

払い出しの履歴は次を固定する。画面からのコピーと API 経由が別の経路として積まれること、API のときに通った鍵の名前が残ること、`HANDOUT_HISTORY_MAX` を超えた古い行が消えること、丸めても通算回数が減らないこと。

## 7. 一覧からの一括払い出し（PUT /api/improvements）

- 入口は`PUT /api/improvements`（`{ id, action }` 1件）。route segmentを増やさないため既存fileへ同居させる。画面が**逐次**呼ぶ。並行実行しない（進捗表示と部分確定のため）。
- 権限は`apiViewer("SUPER_ADMIN")`。画面側の`canHandOut`はUIのみ。1件の失敗は例外にせず`{ result }`として200で返す（throwすると後続行が止まる）。
- 状態判定は`src/lib/domain/improvement-handout.ts`（純関数・coverage 100%対象）。`handoutState(snapshot, fingerprint)` → `none | handed | changed`、`plannedAction()` → `handout | skip | rehandout`。
- `improvementFingerprint()`の材料は`kind` / `screenLabel`+`path`+`routePattern`（まとめて1項目「画面」）/ `body` / `expected` / `status` / `handledNote`。`diagnostics`・`createdAt`は不変なので含めない（一覧クエリで大きなJSONを読まないためでもある）。`null`と`""`は同値。
- 更新日時比較はしない。`content_fingerprint`の一致だけで判定する。空の指紋は「比較不能」＝`handed`扱い。
- 払い出し時に`status`が`open→doing`へ進むため、指紋は**進めた後の値**で作る（`advanced`）。進める前の値を控えると直後に`changed`になる。
- schema: `improvement_handouts`（`request_id` PK / `content_fingerprint` text default '' / `handed_out_at` integer nullable / `handed_out_by_id` text nullable）。migration `0023_improvement_handout.sql`（手書き。`db:generate`は使わない）。
- 控えの保存は`recordHandout()`1本（画面・まとめ操作・API の3経路が通る）。`onConflictDoUpdate`で上書きするため席取りは要らない。外へ出す通信が無く、途中で止まる隙間が無いため。
- 廃棄済みは`handOutImprovement()`の先頭で`skipped`にする（画面の絞り込みだけに頼らない）。
- 一覧（`listImprovementRequests`）は行ごとに`handoutState`と`handoutNote`を返す。無言の行を作らない。
- テスト契約（§6に追加）: 未払い出し→handed / 同内容→skipped / 変更後→rehandout / 30件を順に処理しても控えが取り違わないこと / 同時押しでも控えが1件のこと / SUPER_ADMIN以外403 / 他社404。UI契約は`src/components/improvement-ux-contracts.test.ts`。

## 8. 落とす・戻す・廃棄（PUT /api/improvements の action）

- 入口は§7と同じ`PUT /api/improvements`。`action`（既定`handout`）で分岐する。`DISPOSITION_ACTIONS = reject | duplicate | discard | restore`。route segmentは増やさない。
- 権限は`apiViewer("SUPER_ADMIN")`。画面の`canDisposeImprovements(role)`はUIのみ。既存のPATCH（対応状況とメモ）は`COMPANY_ADMIN`のまま変えない。
- **物理削除を作らない**。廃棄は`improvement_requests.discarded_at / discarded_by_id / discard_reason`の印。重複は`duplicate_of_id`。`status`のCHECK制約（`open|doing|done|dropped`）は変更しない（子FKを持つ表の作り直しを避けるため）。
- 判断は`src/lib/domain/improvement-disposition.ts`（純関数・coverage 100%対象）。表示状態は`discarded > duplicate > status`の優先順。理由は`REJECT_REASONS`/`DISCARD_REASONS`から選択し、`other`は自由記述必須。`dispositionReasonError()`を画面とサーバーの両方で通す（理由なしは400）。
- 履歴は`improvement_status_events`へ**追記のみ**（`id / request_id / action / from_status / to_status / reason_code / reason / actor_id / created_at`）。UPDATEしない。詳細画面のPATCH（対応状況の変更）も`action:"status"`で1行残す。
- 戻す（`restore`）先は履歴から引く（最後の`discard|reject|duplicate`の`from_status`）。これが「廃棄→復元で元の状態に戻る」の根拠。
- 落とす操作は外へ出る通信を伴わないため、途中で片方だけ確定する状態を作らない。1トランザクション内で印と履歴を書く。
- 廃棄したものは`handOutImprovement()`の先頭で`skipped`にする（画面の絞り込みだけに頼らない）。払い出しAPI側も`isNull(discardedAt)`で問い合わせの段階から外す。
- 一覧の既定は`view=active`（`open|doing`かつ廃棄・重複でないもの）。`all`は廃棄以外、`trash`は廃棄のみ。並べ替えは`new|old|state`。
- schema: migration `0022_improvement_disposition.sql`（手書き）。
- テスト契約（§6に追加）: 廃棄で行が消えないこと / 廃棄→復元で元のstatusへ戻ること / 対応しない→復元 / 廃棄がまとめ払い出しの対象外になること / 理由なし400・`other`空400 / 統合先なしの重複は400 / SUPER_ADMIN以外403 / 他社404。

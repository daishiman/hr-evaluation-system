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
| `improvement_requests.kind` | `bug`/`request`。既存行は`request`をdefaultで受ける |
| `improvement_requests.diagnostics` | 正規化・masking済みJSON文字列。24KB超はnull |
| `improvement_issue_links.request_id` | PK。Issue二重起票の境界。requestへcascade |

`0019_improvement_delivery.sql`は既存行のroute patternを安全側でbackfillし、submission keyはlegacyを壊さないためnullのままにする。
`0020_improvement_issue.sql`は`kind`/`expected`/`diagnostics`を追加し、`improvement_issue_links`を新設する。既存行は`kind='request'`、他はnullで通る。

## 4-1. 自動収集する技術情報

- 収集は`src/lib/client-diagnostics.ts`（browser）。上限・正規化・maskingの正本は`src/lib/domain/improvement-issue.ts`。
- 収集対象は端末情報、console error/warn、unhandledrejection、**失敗したfetchのみ**(method/path/status/duration)、直前操作、navigation timing、LCP。
- 入力値、request/response body、header、cookie、query stringは収集しない。欄はlabelだけを残す。`.feedback-root`内の操作は除外する。
- 件数上限 logs 20 / network 20 / breadcrumbs 30、1項目300文字、全体24,000 bytes。超過分は古い順に捨て、全体超過時はdiagnosticsをnullにして本文を残す。
- maskingはclientとserverの両方で通し、**serverの通過を正本**にする（clientは差し替え可能なため）。
- 保存先はメモリのみ。`localStorage`/`sessionStorage`/IndexedDBを使わない（`ui-rules.test.ts`が固定）。

## 4-2. POST `/api/improvements/[id]`（記録票の起票）

- `apiViewer("SUPER_ADMIN")`のみ。`COMPANY_ADMIN`は不可（送信先が会社ではなく開発側repoのため）。
- 会社scopeは`getImprovementRequest(companyId, id)`。他社・不存在はいずれも404。
- 既存linkがあれば外部送信せずその`issue_number`/`issue_url`を返す。二重起票の境界は`improvement_issue_links`のPK。
- `requireGithubSettings()`を**送信前**に通す。`GITHUB_REPO`未設定・不正、`GITHUB_TOKEN`未設定は503で、設定手順を含む文を返す。
- 起票成功時は`improvement_issue_links`へ`onConflictDoNothing`で挿入し、`status='open'`なら`doing`へ進める。
- tokenはserver専用（`src/lib/github-issue.ts`）。clientへ渡さず、client bundleへ露出させない。
- 本文・titleは`src/lib/improvement-issue-draft.ts`が組み立て、管理画面のpreviewとAPIが同じ関数を共有する。
- 記録票へ氏名・メール・画像data URLを載せない。画像は管理画面URLで参照する。
- routeは`/issue`へ分けずPATCHと同一fileへ置く。route segmentを増やすとserver bundleが依存一式ごと重複し、free planの上限に対し約0.5MB増える。

## 5. クライアント下書きと回復

- 種類（困っている/こうしてほしい）は必須のchip選択、`expected`（どうなってほしいか）は任意1行。追加入力はこの2つまで。
- 何が一緒に送られるかを窓の中に畳んで明示する（開かなくても項目名が読める見出しを付ける）。
- 自動撮影を既定にし、再撮影、貼付、ファイル選択、注釈、undo、画像削除、文章のみ投稿を同じdialogで行う。
- 黒塗りは注釈色に関係なく`--mark-ink`固定。画像は送信時に焼き込み、元画像は保存しない。
- 未送信本文・画像・submission keyはReact state/refにだけ保持し、close/reopen・失敗で維持する。`localStorage`、`sessionStorage`、IndexedDBへ置かない。
- 空本文は送信ボタンをdisabledにせず、inline errorを出してtextareaへfocusする。
- 413/429/500/通信失敗は入力を保持し、画像削除・待機・再送の回復方法を同じdialog内に示す。

## 6. テスト契約

最低限、文章のみ、画像あり、偽装/超過画像、解析前/実body超過、rate-limit、D1 rollback、順次/並行idempotency、動的URL集約、4ロール、他社404、同状態メモ追加/修正/空化、見送り理由をunit/integrationで固定する。E2Eは投稿→会社管理者一覧→詳細→状態変更を実ブラウザで通す。

diagnosticsとIssue起票は次を固定する。masking（メール/Bearer/token/長い連なり/数字列）、件数と長さの切り詰め、24KB超のnull化、破損JSONの無害化、`sourceCandidatesFor`のpath導出、記録票本文の必須節、`kind`別の完了条件、氏名・メール・画像を含まないこと、SUPER_ADMIN以外の拒否、他社404、設定不足時に外部送信しないこと、二重押しで1件だけになること。外部送信はmockし、テストからGitHubへ出さない。

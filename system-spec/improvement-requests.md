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
3. strict JSON schemaでpath、1〜1000文字本文、`NN×NN` viewport、UUID submission keyを検査する。
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

`0019_improvement_delivery.sql`は既存行のroute patternを安全側でbackfillし、submission keyはlegacyを壊さないためnullのままにする。

## 5. クライアント下書きと回復

- 自動撮影を既定にし、再撮影、貼付、ファイル選択、注釈、undo、画像削除、文章のみ投稿を同じdialogで行う。
- 黒塗りは注釈色に関係なく`--mark-ink`固定。画像は送信時に焼き込み、元画像は保存しない。
- 未送信本文・画像・submission keyはReact state/refにだけ保持し、close/reopen・失敗で維持する。`localStorage`、`sessionStorage`、IndexedDBへ置かない。
- 空本文は送信ボタンをdisabledにせず、inline errorを出してtextareaへfocusする。
- 413/429/500/通信失敗は入力を保持し、画像削除・待機・再送の回復方法を同じdialog内に示す。

## 6. テスト契約

最低限、文章のみ、画像あり、偽装/超過画像、解析前/実body超過、rate-limit、D1 rollback、順次/並行idempotency、動的URL集約、4ロール、他社404、同状態メモ追加/修正/空化、見送り理由をunit/integrationで固定する。E2Eは投稿→会社管理者一覧→詳細→状態変更を実ブラウザで通す。

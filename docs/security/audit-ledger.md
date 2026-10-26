# 脆弱性の監査の台帳（2026-10-22 の監査）

- 2026-10-22 の監査（アプリ・基盤・入出力・画面の4つ）の指摘ごとに、状態・根拠・残るリスク・見直す時期を記録する。台帳を持つことは [DD-032](../product/design-decisions.md) の15で決めた。
- 母数は、[受領記録](../product/spec-receipts/2026-10-22-vulnerability-audit-and-hardening.md) の受領表の **72 行**（指摘の ID ごと）と、重複をまとめた後の **47 件**（対応の数）。ID・深刻度・目標・まとめ先は受領表を正本とし、この台帳はそれと文字まで合わせる。照合は `scripts/security-ledger.test.mjs` が行う。
- 47件の内訳は、直した32件・受け入れた11件・範囲の外4件。暫定の防御と当たらないは0件。
- まとめた25行は、状態をまとめ先と同じにし、根拠にまとめ先の ID を書く。残るリスクと見直す時期は、まとめ先の行を見る。
- 状態の書き方は5つに限る。
  - 直した：括弧に、直したことを確かめるテストの名前を書く。
  - 受け入れた：括弧に、受け入れた理由を書く。残るリスクと見直す時期を必ず書く。
  - 範囲の外：括弧に、外した理由か、決定を待つ課題を書く。
  - 暫定の防御・当たらない：今回は使っていない。
- 公開リポジトリなので、再現の細部・実データ・秘密・本番の URL・ソースの行の場所は書かない。直した場所はテストの名前で示す。監査の原本は git の管理外に置く。

## 台帳（72行）

| ID | 深刻度 | 目標 | 状態 | 根拠 | 残るリスク | 見直す時期 | 確かめた日 |
|---|---|---|---|---|---|---|---|
| APP-01 | medium | G34 | 直した（auth-route-allowlist.test.ts） | DD-032 の2。認証の口を許可リストの3つに絞り、許可の外は 404 を返す | 許可リストは better-auth の口の名前に依る | better-auth の版を上げるとき | 2026-10-25 |
| APP-02 | medium | G34 | 直した（client-ip.test.ts・rate-limit-client-ip.test.ts・auth-config.test.ts） | DD-032 の3。回数制限の数え先を cf-connecting-ip だけにし、IPv6 は /64 で数える。偽ったヘッダーでは数え先が変わらない | 数える表はメモリにあり、isolate ごとに分かれる | 数える表を D1 か Durable Objects に移すとき | 2026-10-25 |
| APP-03 | medium | G35 | 直した（csv.test.ts・export.test.ts） | DD-032 の5。CSV の書き出しで、表計算ソフトが式として読む先頭の字を無害にする。負の数は数値のまま残す | — | — | 2026-10-25 |
| APP-04 | medium | G38 | 範囲の外（SECURITY-013 の決定を待つ） | feature の context の scope_out（受領記録の「範囲の外」の3） | 決めるまでは今の動きのまま | SECURITY-013 を決めるとき | 2026-10-25 |
| APP-05 | low | G35 | 直した（safe-redirect.test.ts） | DD-032 の6。ログイン後の戻り先を、同じサイトの中の道だけに限る。URL として解決して点の区切りを畳んだ後の形にも、同じ検査をもう一度かける | — | — | 2026-10-25 |
| APP-06 | low | G34 | 直した（auth-route-allowlist.test.ts・password.test.ts・PasswordChangeForm.test.ts） | DD-032 の2・4。公開のパスワード変更の口は閉じ、Server Action から10文字以上の共通の長さの検査を通す | — | — | 2026-10-25 |
| APP-07 | low | G38 | 受け入れた（書き換えの権限を持つ人だけが操作でき、範囲も正しい） | DD-032 の17 | 書き換えの経緯が残らない | 操作の履歴を入れるとき | 2026-10-25 |
| APP-08 | low | G36 | 直した（import-hardening.test.ts） | DD-032 の17。氏名だけで2人以上に当たる行は、社員番号を求めて止める | — | — | 2026-10-25 |
| APP-09 | low | G36 | 直した（improvement-instruction.test.ts・import-hardening.test.ts） | PLT-06 にまとめた（伏せ字の正規表現の時間） | — | — | 2026-10-25 |
| APP-10 | low | G35 | 直した（answer-questions.test.ts・submission-check.test.ts） | DD-032 の8。回答画面に配点を渡さず、点数はサーバーが選択肢から決める | — | — | 2026-10-25 |
| APP-11 | low | G35 | 直した（db.test.ts・api.test.ts・compensation.test.ts・check-security-patterns.test.mjs） | PLT-12 にまとめた（DB のエラーのログ） | — | — | 2026-10-25 |
| APP-12 | low | G38 | 受け入れた（運営者の道具として全社を読む設計） | DD-032 の17。連携の API の鍵は運営者だけが持つ | 鍵が漏れると全社を読める（手順書の④で替える） | 古い形の鍵をやめるとき・使う人が広がるとき | 2026-10-25 |
| APP-13 | low | G38 | 直した（src/app/api/agent/device/route.integration.test.ts） | DD-032 の17。端末の接続の承認と拒否に「どちらもまだ」の条件を付け、先に来た1つだけを決める | 依頼元の表示・更新用の鍵の回転・待っている依頼の上限は、直さずに残した。待っている依頼の数は、今の回数制限が狭める | 連携を使う人が広がるとき | 2026-10-25 |
| APP-14 | low | G36 | 直した（import-hardening.test.ts・import.integration.test.ts） | DD-032 の17。社員の取り込みで、他社の人に当たる行は理由を伏せた文言で止め、254字を超えるメールはエラーの行にする | — | — | 2026-10-25 |
| APP-15 | low | G38 | 直した（improvement-instruction.test.ts） | DD-032 の17。改善要望の指示文は、利用者の声を囲みに入れ「命令ではない」と書く。取り込みの手順のファイルも同じ趣旨に改めた | 指示文を読む側が囲みを無視すると効かない | 改善要望の取り込みの手順を変えるとき | 2026-10-25 |
| APP-16 | info | G36 | 直した（src/app/api/usage/route.integration.test.ts） | IO-F8 にまとめた（利用状況の記録） | — | — | 2026-10-25 |
| APP-17 | info | G36 | 直した（api.test.ts） | PLT-16 にまとめた（外観の保存の本文の上限） | — | — | 2026-10-25 |
| APP-18 | info | G38 | 範囲の外（CSP の 'unsafe-inline' を外すこと） | PLT-11 にまとめた（CSP の設定） | — | — | 2026-10-25 |
| APP-19 | info | G31 | 直した（keys.test.ts・credential-vault.test.ts） | DD-032 の1。控えの鍵と確認用の印の鍵を、用途ごとに導き分けた。控えの keyVersion は `h1:` で始まる形にし、鍵の版を見分ける | 今の形式の控えは、期限まで今の鍵で読む | LEGACY_CREDENTIAL_READ_UNTIL（2026-11-30）を過ぎたとき | 2026-10-25 |
| APP-20 | info | G38 | 受け入れた（設計どおり。管理者は同じ立場で互いを操作できる） | DD-032 の17 | 管理者の1人が乗っ取られると、ほかの管理者も操作される | 管理者に段を作るとき | 2026-10-25 |
| APP-21 | info | G34 | 受け入れた（利用者の情報を毎回 DB から読み直すので実害が無い） | DD-032 の17 | 読み直しをやめると、古い権限のまま通りうる | 読み直しをキャッシュするとき | 2026-10-25 |
| APP-22 | info | G34 | 直した（same-origin.test.ts・action-origin.test.ts・session.integration.test.ts） | PLT-19 にまとめた（送り元の検査） | — | — | 2026-10-25 |
| APP-23 | info | G38 | 受け入れた（表示で期を結合していないので漏れが無い） | DD-032 の17 | 表示を変えると、別の期の名が出うる | メモに期の名を出すとき | 2026-10-25 |
| APP-24 | info | G38 | 直した（improvement-instruction.test.ts） | DD-032 の17。改善要望の技術情報（操作の記録）に、画面の文字を残さない | — | — | 2026-10-25 |
| APP-25 | info | G38 | 範囲の外（SECURITY-015 の決定を待つ） | feature の context の scope_out（受領記録の「範囲の外」の3） | 決めるまでは今の動きのまま | SECURITY-015 を決めるとき | 2026-10-25 |
| APP-R1 | info | G38 | 直した（scheme-steps.test.ts・answer-snapshot.test.ts） | DD-032 の17。等級区分の URL に壊れた % があると 404 にし、壊れた選択肢は0件として描く。壊れた入力で管理画面を 500 にしない | — | — | 2026-10-25 |
| PLT-01 | critical | G30 | 直した（deploy-workflow-contract.test.mjs・check-security-patterns.test.mjs） | DD-032 の13・16 の①。DB の書き出しを成果物に上げる工程を消した。戻す元は Time Travel だけにし、bookmark を実行の Summary に記録する（D-010） | 2026-10-25 に成果物の一覧を読むだけで見て、0件だった（前に上がった書き出しは、もう無い）。上がっていた間に誰かが落としたかは、一覧からは確かめられない。この変更が main に入るまでは、未適用の migration を含む変更をマージすると、古い工程がまた書き出しを上げる（[バックログ](../product/backlog.md) の SECURITY-014） | マージの後に成果物の一覧をもう一度確かめたとき（P13） | 2026-10-25 |
| PLT-02 | high | G32 | 直した（runtime-version-contract.test.mjs） | DD-032の14。nextは16.4.2。PR #103のCI失敗を受け、body-parser 2.4.0・undici 7.30.1をpnpm.overridesで限定適用した。本番用・開発用を含む監査の両方でhigh・criticalは0件（最終受領書のCI修正の節） | moderateは本番用1件・全体5件残る | 新しい勧告が出たとき。上流の版が修正版を取り込んだらoverridesの要否を見直す | 2026-10-27 |
| PLT-03 | medium | G32 | 直した（deploy-workflow-contract.test.mjs） | DD-032 の14。security-audit.yml で pnpm audit を push・PR・週1回に流し、high 以上で止める（D-011） | 週1回の実行の間の数日は、新しい勧告に気づかない | 依存の検査の仕組みを見直すとき | 2026-10-25 |
| PLT-04 | medium | G34 | 直した（client-ip.test.ts・rate-limit-client-ip.test.ts・auth-config.test.ts） | APP-02 にまとめた（回数制限の数え先） | — | — | 2026-10-25 |
| PLT-05 | medium | G37 | 範囲の外（D-012。公開の入口は workers.dev のまま） | feature の context の scope_out（受領記録の「範囲の外」の7） | 前段に WAF が無い | 独自ドメインへ移るとき | 2026-10-25 |
| PLT-06 | medium | G36 | 直した（improvement-instruction.test.ts・import-hardening.test.ts） | DD-032 の10。伏せ字の正規表現を、長い入力でも時間が延びない形に改めた。8万字で100ms 以内を確かめる | — | — | 2026-10-25 |
| PLT-07 | medium | G33 | 直した（deploy-workflow-contract.test.mjs） | DD-032 の13。秘密を持たない verify-build の job で作って確かめ、秘密を持つ deploy の job は成果物を受け取って出すだけにした。成果物は1日だけ置き、取り込んだらすぐ消す。秘密を持つ job（deploy・migrate）は、秘密の無い job が保存した依存の cache を戻さない | 乗っ取られた依存が、verify-build の中で成果物を書き換えうる | 成果物に署名か digest の照合を足すとき | 2026-10-25 |
| PLT-08 | low | G33 | 直した（runtime-version-contract.test.mjs） | DD-032 の13。Actions の uses をすべてコミット SHA で固定し、版を注釈に書いた | 固定した版の更新は人が追う | Actions の major を上げるとき | 2026-10-25 |
| PLT-09 | low〜medium | G34 | 直した（auth-route-allowlist.test.ts） | APP-01 にまとめた（認証の口の開きすぎ） | — | — | 2026-10-25 |
| PLT-10 | low | G34 | 直した（auth-route-allowlist.test.ts・password.test.ts・PasswordChangeForm.test.ts） | APP-06 にまとめた（パスワード変更の口） | — | — | 2026-10-25 |
| PLT-11 | low | G38 | 範囲の外（CSP の 'unsafe-inline' を外すこと） | feature の context の scope_out（受領記録の「範囲の外」の4） | 差し込まれた script を、CSP だけでは止められない | CSP を見直すとき | 2026-10-25 |
| PLT-12 | low〜medium | G35 | 直した（db.test.ts・api.test.ts・compensation.test.ts・check-security-patterns.test.mjs） | DD-032 の7。失敗のログに残すのは、型・場所・SQL の操作と表の名前・D1 のコードだけにし、値を残さない | — | — | 2026-10-25 |
| PLT-13 | low | G36 | 直した（request-body.test.ts・auth-route-allowlist.test.ts） | DD-032 の9。Server Action の本文の上限を 6.5mb にした。認証の口も、ほかの Route Handler と同じ短い JSON の上限まで先に読み、超えたら 413 で断る | — | — | 2026-10-25 |
| PLT-14 | low | G38 | 受け入れた（会社の追加は運営者がたまに行う操作） | DD-032 の17 | 途中で失敗すると、途中までの会社ができる | D1 の batch に寄せるとき・会社の追加を広く開くとき | 2026-10-25 |
| PLT-15 | low | G36 | 直した（import-hardening.test.ts） | DD-032 の10。メールの検査を zod に寄せ、8万字の入力でも100ms 以内で終わる | — | — | 2026-10-25 |
| PLT-16 | low | G36 | 直した（api.test.ts） | DD-032 の9。外観の保存（theme-choice）は、4000 バイトを超える本文を 413 で断る | — | — | 2026-10-25 |
| PLT-17 | low | G36 | 直した（rate-limit.test.ts） | DD-032 の11。回数制限の表の件数に上限を付けた | 数えるのは isolate ごと | 数える表を D1 か Durable Objects に移すとき | 2026-10-25 |
| PLT-18 | low | G37 | 直した（public-surface.test.ts） | DD-032 の12。使っていない口を断る | 本番の画像の変換（/cdn-cgi/image/）が有効でないことは、利用者が確かめる | 画像の変換を使うとき | 2026-10-25 |
| PLT-19 | low | G34 | 直した（same-origin.test.ts・action-origin.test.ts・session.integration.test.ts） | DD-032 の17。送り元の検査で、Origin も Sec-Fetch-Site も無い送信を 403 で断る | 安全な文脈の外（http の LAN アドレスなど）からは API が通らない | 手元の確かめ方を変えるとき | 2026-10-25 |
| PLT-20 | low | G33 | 直した（runtime-version-contract.test.mjs） | DD-032 の14。.nvmrc・engines・.npmrc で Node の版を 22.23.4 に固定し、CI は node-version-file で読む | — | — | 2026-10-25 |
| PLT-21 | low | G33 | 直した（add-user.test.mjs） | DD-032 の4。user:add はパスワードを引数で受けず、ADD_USER_PASSWORD かパイプの標準入力で受ける | — | — | 2026-10-25 |
| PLT-22 | low〜medium | G32・G33 | 直した（runtime-version-contract.test.mjs） | DD-032 の14。CI と手元の Node を、2026-10-21 の修正を含む 22.23.4 にした。経緯は「Node 本体の通知」の節 | — | — | 2026-10-25 |
| PLT-23 | info | G37 | 直した（public-surface.test.ts） | DD-032 の12。poweredByHeader を false にし、x-powered-by を返さない | — | — | 2026-10-25 |
| PLT-24 | info | G37 | 受け入れた（source map は Cloudflare の側だけに置かれ、公開の配信には出ない） | DD-032 の17。配信の中身（.open-next/assets）に .map が無いことは、verify-build の検査で確かめる | 設定を変えると、配信に .map が混ざりうる（verify-build の検査で止める） | リポジトリを非公開にするとき | 2026-10-25 |
| PLT-25 | info | G37 | 受け入れた（プランの上限が処理を打ち切る。入力も DD-032 の9・10 で絞った） | DD-032 の17 | 重い要求が、上限まで CPU を使いうる | 有料プランへ移るとき（cpu_ms の上限を設ける） | 2026-10-25 |
| PLT-26 | info | G37 | 受け入れた（同じ isolate は同じ秘密を持つので、要求の間で混ざっても他社の情報にはならない） | DD-032 の17。「監査の観点 (B) の結果」の節 | 依存のコードから process.env の秘密を読める | 要求ごとの情報をモジュールの変数に置くとき | 2026-10-25 |
| PLT-27 | info | G32 | 受け入れた（本番の workerd が同梱する部品で、このアプリに届かない見込み） | DD-032 の14。見張るだけにする | 同梱の部品の修正が遅れる | 同梱の版が上流の修正を含んだとき（security-audit.yml の週1回に合わせて workerd の告知を見る） | 2026-10-25 |
| IO-F1 | medium | G35 | 直した（csv.test.ts・export.test.ts） | APP-03 にまとめた（CSV の書き出し） | — | — | 2026-10-25 |
| IO-F2 | low（有料プランでは medium） | G36 | 直した（improvement-instruction.test.ts・import-hardening.test.ts） | PLT-06 にまとめた（伏せ字の正規表現の時間） | — | — | 2026-10-25 |
| IO-F3 | low | G35 | 直した（safe-redirect.test.ts） | APP-05 にまとめた（ログイン後の戻り先の検査） | — | — | 2026-10-25 |
| IO-F4 | low | G38 | 直した（improvement-instruction.test.ts） | APP-15 にまとめた（改善要望の本文の扱い） | — | — | 2026-10-25 |
| IO-F5 | low | G36 | 直した（import-hardening.test.ts・import.integration.test.ts） | APP-14 にまとめた（社員の取り込みの検査と文言） | — | — | 2026-10-25 |
| IO-F6 | low | G36 | 直した（import-hardening.test.ts・import.integration.test.ts） | APP-14 にまとめた（社員の取り込みの検査と文言） | — | — | 2026-10-25 |
| IO-F7 | low | G35 | 直した（db.test.ts・api.test.ts・compensation.test.ts・check-security-patterns.test.mjs） | PLT-12 にまとめた（DB のエラーのログ） | — | — | 2026-10-25 |
| IO-F8 | low | G36 | 直した（src/app/api/usage/route.integration.test.ts） | DD-032 の17。利用状況の記録は、実在する API（method ごと）・認証の3つの口・FRESHNESS_RESOURCES の宛先だけを数え、1社1日に画面の表と通信の表それぞれ500行までにする。既にある行への足し込みは、上限と関係なく受ける | 上限に達した日は、新しい宛先を数えない | 数える宛先を増やすとき | 2026-10-25 |
| IO-F9 | info | G38 | 直した（improvement-instruction.test.ts） | APP-24 にまとめた（改善要望の技術情報に残る文字） | — | — | 2026-10-25 |
| IO-F10 | info | G38 | 範囲の外（CSP の 'unsafe-inline' を外すこと） | PLT-11 にまとめた（CSP の設定） | — | — | 2026-10-25 |
| IO-F11 | info | G31 | 直した（keys.test.ts・credential-vault.test.ts） | APP-19 にまとめた（確認用の印の鍵） | — | — | 2026-10-25 |
| IO-F12-1 | info | G36 | 直した（api.test.ts） | PLT-16 にまとめた（外観の保存の本文の上限） | — | — | 2026-10-25 |
| IO-F12-2 | info | G38 | 受け入れた（回答の取り込みは管理者だけが使い、本文の上限もある） | DD-032 の17。照合の手間は、行数と社員数の積で増える | 社員の数が増えると重くなる | 社員の数が大きく増えるとき | 2026-10-25 |
| IO-F12-3 | info | G38 | 直した（answer-snapshot.test.ts） | DD-032 の17。管理者のアンケートの画面は、壊れた選択肢を0件として描き、500 にしない | — | — | 2026-10-25 |
| PG-F1 | medium | G38 | 範囲の外（SECURITY-013 の決定を待つ） | APP-04 にまとめた（SECURITY-013） | — | — | 2026-10-25 |
| PG-F2 | low | G35 | 直した（safe-redirect.test.ts） | APP-05 にまとめた（ログイン後の戻り先の検査） | — | — | 2026-10-25 |
| PG-F3 | low | G35 | 直した（answer-questions.test.ts・submission-check.test.ts） | APP-10 にまとめた（回答画面の配点） | — | — | 2026-10-25 |
| PG-F4 | info | G38 | 範囲の外（SECURITY-015 の決定を待つ） | APP-25 にまとめた（SECURITY-015） | — | — | 2026-10-25 |
| PG-F5 | info | G38 | 直した（scheme-steps.test.ts・answer-snapshot.test.ts） | APP-R1 にまとめた（管理画面の 500） | — | — | 2026-10-25 |

## #97 で消した表と列を戻さない決定

- 先行公開の後に使わない事業所の表と列は、#97 の migration で消した。この migration は戻さない（受領記録の「ヒアリングの決定」の #97）。
- 消した表の中身が後で要るときの戻す元は、D1 の Time Travel だけにする（D-010）。戻すための D1 の migration は足さない。
- 監査の指摘は、消した表と列に触れていない。台帳の72行のどれも、戻すことを前提にしていない。

## 監査の観点 (B) の結果（要求をまたいで残る状態）

- DB の接続と認証の設定は、要求ごとに作る（`getDb`・`getAuth` は、呼ばれるたびに Cloudflare の文脈から作り直す）。利用者の文脈は、isolate をまたいで残らない。
- 画面で選んだ会社は、要求ごとにサーバーが利用者の権限と突き合わせてから使う。モジュールの変数には置かない。
- `use cache`・ISR・増分キャッシュは使っていない。ほかの利用者の応答がキャッシュから返ることは無い。
- 要求をまたいで残るものは2つだけ。1つは同じ isolate が同じ秘密を持つこと（PLT-26。受け入れた）、もう1つはメモリの回数制限の表（PLT-17。件数に上限を付けた）。

## 監査の観点 (E) の結果（自分が書いたと確かめずに読み戻すこと）

- 初期パスワードの控えは AES-GCM で包み、利用者の id を追加の認証データにする。別の利用者の行へ写した控えは開けない。鍵の版は keyVersion で見分ける（APP-19）。
- 外から受ける JSON の本文は、zod の schema で parse してから使う。
- DB に保存した JSON（選択肢など）を読み戻すとき、壊れていても画面を 500 にしない（APP-R1・IO-F12-3）。
- 今回直したのは、取り込みの確認用の印の鍵（APP-19・IO-F11）と、回答画面に渡していた配点（APP-10）。

## 利用者の作業

リポジトリの外の設定と本番の操作なので、この変更では行っていない。利用者が行う。

- GitHub の environment `production` に、承認する人を付ける。deploy と手動の migrate の job はこの環境に結び付けたが、外部の承認者・保護ルールの設定は未実行である。設定後は、どちらも承認の後にだけ動くことを確かめる。
- Cloudflare の API トークンの権限を、Workers Scripts の Edit と D1 の Edit に絞る。
- Cloudflare の画像の変換（/cdn-cgi/image/）を有効にしていないことを、ダッシュボードで確かめる（PLT-18）。
- 本番の秘密（BETTER_AUTH_SECRET・CREDENTIAL_ENC_KEY・連携の API の鍵）を、[秘密を替える手順書](./secret-rotation-runbook.md) に沿って交換する。
- マージの後に、リポジトリの Actions の成果物の一覧を確かめ、DB の書き出しが残っていないことを見る（P13・PLT-01）。

## Node 本体の通知（2026-10-21 のセキュリティリリース）

- 2026-10-21 に Node のセキュリティリリースが出た（22 系は 22.23.4）。本番は Cloudflare Workers（workerd）で動き、Node 本体を使わないので、本番には届かない。
- 届くのは CI と手元の Node だった。版を 22.23.4 に固定し（.nvmrc・engines・.npmrc の engine-strict）、CI は .nvmrc を読む。2026-10-25 に、CI の設定と手元の版が 22.23.4 であることを確かめた（PLT-20・PLT-22）。
- G32 の「通知から48時間以内に判断する」を過ぎてから対応した。2026-10-22 の監査まで、Node の通知を知らせる仕組みが無かったためである。
- 以後は、Node の通知が届いた時点で確かめ、security-audit.yml の週1回の実行に合わせて受信漏れを点検する。workerd の告知も週1回見る（[手順書の「Node 本体の勧告」](./secret-rotation-runbook.md#node-本体の勧告)）。Node 24 系への移行は範囲の外（受領記録の「範囲の外」の5）。
- 2026-10-25 に、Node.js の公式の告知（[Wednesday, October 21, 2026 Security Releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)）を読んで確かめた。対象は 26.x・24.x・22.x の3系で、22 系の直った版は 22.23.4。告知の10件の内訳は high 4件・medium 3件・low 3件で、22 系に当たらないと書かれたものもある。CI と手元はこの版なので、この告知について追加の対応は無い。告知の一覧で、この後に出た告知は無かった。

## Actions の uses の一覧（コミット SHA で固定）

- `.github/workflows` の uses は、すべてコミット SHA で固定し、版を注釈に書いた（PLT-08）。major は上げず、v4 系の最新にした。
- 2026-10-25 に、各 SHA がその版のタグのコミットであることを GitHub の API（読み取りだけ）で確かめた。
- この台帳には長い16進の値を書かない決まりなので、SHA は先頭12桁だけを書く。40桁の正本は `.github/workflows` の各ファイルの uses の行である。

| action | コミット SHA（先頭12桁） | 版 | 使う場所の数 | 確かめた日 |
|---|---|---|---|---|
| actions/checkout | `11d5960a3267` | v4.4.0 | 5 | 2026-10-25 |
| actions/setup-node | `49933ea5288c` | v4.4.0 | 5 | 2026-10-25 |
| pnpm/action-setup | `fc06bc1257f3` | v4.4.0 | 5 | 2026-10-25 |
| actions/upload-artifact | `ea165f8d65b6` | v4.6.2 | 1 | 2026-10-25 |
| actions/download-artifact | `d3f86a106a0b` | v4.3.0 | 1 | 2026-10-25 |

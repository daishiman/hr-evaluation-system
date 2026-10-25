# デプロイ時の注意

本番配布の入口は [Deploy workflow](../.github/workflows/deploy.yml) です。ローカルの作業ツリーから直接デプロイせず、`main` の追跡済みコミットを GitHub Actions のクリーンな checkout から配布します。

## 1. スキーマ変更を伴う順序

新しいコードが古い DB を読む状態を作らないため、次の順序を固定します。

1. migration と、その追加列がなくても動く後方互換なコードを `main` へ入れる。
2. 自動の [Deploy workflow](../.github/workflows/deploy.yml) が文書・型・テスト・ビルド・容量の各ゲートを通す。
3. 未適用 migration があれば、本番DBのバックアップを取得し、age の公開鍵で暗号化してから14日間Artifactに保管する（下の「書き出しの暗号化」）。受け手の公開鍵が無いとき、バックアップか暗号化ができないときは停止する。
4. migrationを自動適用し、同じ本番DBを再照会して未適用0件を確認してから配布する。
5. 自動スモークを確認し、必要な認証付き操作を人が確認する。ログインしたあとの画面が新しい表を読めるかは、§3 の「移行のあとに、ログインしたスモークを流す」で確かめる。

migration がない変更はバックアップと適用をスキップしてそのまま配布します。通常運用で手動操作は不要です。[Migration workflow](../.github/workflows/migrate.yml) は、Deployのmigration適用後に別工程で失敗した場合の復旧確認や、後方互換なmigrationだけを先行適用したい場合に使います。DeployとMigrateは同じconcurrency groupで直列化し、未適用状態が判定不能ならfail-closedで停止します。

### 書き出しの暗号化

このリポジトリは Public で、Actions の Artifact は GitHub にログインした誰もが落とせます。だから本番 D1 の書き出しを平文で Artifact に置きません。Deploy workflow と Migrate workflow は、書き出しを [age](https://age-encryption.org) の公開鍵で暗号化した `backup.sql.age` だけを置き、平文の `backup.sql` はランナーの中で消します。決めたことは [DD-031](./product/design-decisions.md) です。

- CI が持つのは公開鍵だけです。リポジトリの Variables の `D1_BACKUP_AGE_RECIPIENT` に置きます。開く鍵（秘密鍵）は、CI にも Secrets にもリポジトリにも置きません。
- `D1_BACKUP_AGE_RECIPIENT` が無いとき、または age の公開鍵（`age1` で始まる62文字）でない値があるときは、書き出す前に止まります。移行も配布もしないので、本番は何も変わりません。形の違う値は、貼り間違えた秘密鍵かもしれないので、ログに出しません。
- 移行の無い Deploy は書き出さないので、変数が無くても今までどおり配ります。
- 暗号化と検査は [`.github/scripts/encrypt-d1-backup.sh`](../.github/scripts/encrypt-d1-backup.sh) が行います。暗号化した先頭の行が `age-encryption.org/v1` でなければ、何も保管せずに止まります。workflow の順と台本の振る舞いは `scripts/deploy-workflow-contract.test.mjs` が `pnpm test` で確かめます。

鍵の用意（利用者が1回だけ行う）:

1. 手元に age を入れます: `brew install age`
2. 鍵を作ります: `age-keygen -o <リポジトリの外の安全な場所>/d1-backup.key`。表示される `Public key: age1...` が公開鍵です。鍵のファイルはリポジトリの中に置かず、コミットしません。
3. 鍵をなくすと書き出しを開けなくなるので、別の場所（別の端末やパスワード管理の保管庫）でもう1本作ることを勧めます。
4. 公開鍵だけを変数に置きます: `gh variable set D1_BACKUP_AGE_RECIPIENT --body "age1... age1..."`（空白か改行で区切って複数を書けます）。`AGE-SECRET-KEY-1` で始まる行（秘密鍵）は置きません。
5. 置いた後に確かめます: `D1_BACKUP_AGE_RECIPIENT="$(gh variable get D1_BACKUP_AGE_RECIPIENT)" bash .github/scripts/encrypt-d1-backup.sh check` が「受け手の公開鍵: N 本」を出します。

書き出しを開く（戻すとき）:

1. `gh run download <実行の id> -n d1-backup-<実行の id> -D <リポジトリの外の場所>`
2. `age -d -i <鍵の場所>/d1-backup.key -o <リポジトリの外の場所>/backup.sql <リポジトリの外の場所>/backup.sql.age`
3. 要る表と列だけを取り出して使います。全体は流し込みません（その後の保存が消えるため。§9・§14・§15 の戻し方）。使い終わったら平文の `backup.sql` を消します。

DB の全体をある時点へ戻すときは、書き出しの代わりに D1 の Time Travel（`pnpm exec wrangler d1 time-travel restore hr-evaluation-db --timestamp <時刻>`。戻せるのは無料の枠で7日、有料で30日の内）も使えます。戻した時点の後の保存はすべて消えるので、別に承認を取ってから行います。

## 2. ローカルで Workers 相当を確認する

```bash
pnpm run cf-typegen
pnpm run db:migrate:local
pnpm run preview
```

`cloudflare-env.d.ts` は `wrangler.jsonc` から生成する Git 管理外ファイルです。別 worktree からコピーせず、各 checkout で `pnpm run cf-typegen` を実行します。秘密値は追跡せず、ローカルでは `.dev.vars`、本番では Cloudflare Secrets を使います。

### 全置換seedはローカル専用

`pnpm run db:seed:local` は、ローカルD1の全業務テーブルを削除してデモデータへ置き換える開発用コマンドです。生成データには既知の共通デモパスワードが含まれるため、本番初期化には使いません。

- package scripts に `db:seed:remote` は用意しない。
- `node scripts/seed.mjs --remote` を直接実行しても、seedデータの読込み・SQL生成・`drizzle/seed.sql` の書込み・Wrangler起動より前に必ず失敗する。
- 本番は Deploy workflow のmigrationと、権限を確認できる管理画面・用途別コマンドで必要なデータだけを追加する。全テーブルを一括置換しない。

本番へ見本会社だけを追加・削除する `db:sample:*:remote` は、専用IDの行だけを対象にする別機能です。全置換seedの代わりには使いません。

新しい利用者を1人だけ発行する `pnpm user:add` は、会社の役割なら `--company <会社ID>` が必須で、利用中かつテンプレートでない会社にだけアカウント・資格情報・所属をまとめて作ります。`SUPER_ADMIN` に会社は指定できません。既存のメールには何も書かず、登録済みとして終了します。発行後は管理画面で確認でき、秘密値を含む一時SQLは成功・失敗どちらでも削除します（[CLI](../scripts/add-user.mjs)、[DB結合試験](../scripts/add-user.test.mjs)）。

### preview で見る代表経路

- ログインし、ロール別ホームを表示できる。
- フォームの作成、回答、評価確定まで進められる。
- 評価集計で `evaluations` に行が作られる。計算不能な設問が一つあっても、人単位で黙って欠落しない。
- 評価の確定で、個人 Pt（KPI評価点の合計を整数に丸めた値）と賞与（仮）（個人 Pt × 昇給の設定の1点あたりの金額）が出る。1点あたりの金額が未設定か0以下なら、賞与額は `null` として扱われる。未設定を `0` や「0円」と表示しない（[製品仕様 §29-1](./product/spec.md#29-1-事業所の達成率の削除と賞与仮の出し方受入-1)）。
- 評価が確定した社員の評価レポート（`/reports/<社員の利用者 id>`）を、本人・上長・会社の管理者で開ける。印刷のプレビューで A4 縦の2枚に収まり、メニューと印刷のボタンが紙に出ない（[製品仕様 §29-2](./product/spec.md#29-2-評価レポート受入-34)）。
- 上長が評価を確定するとき、昇給と昇格のそれぞれに「点数の判定どおりにする」か「変える」を選ぶ。「変える」で理由が空白なら断られる（[製品仕様 §29-3](./product/spec.md#29-3-昇給昇格への上司の判断受入-10)）。
- 対象変更に応じてアカウント設定、会社管理、マスタ版履歴を確認する。
- 同じ画面を2つのタブで開き、片方で保存すると、もう片方へ戻ったときに同じ内容が出る。

## 3. 配布直後の確認

Cloudflare Workers では配布直後に旧 isolate が短時間残ることがあります。Deploy workflow は間隔を空けて 2 回スモークを行います。1 回目だけの不一致で即座にロールバックせず、2 回目と deployment 一覧を確認して判断します。

認証付き疎通を追加するときは次を守ります。

- ログイン API には対象 URL と一致する `origin` ヘッダーを送る。
- `429` は失敗として連打せず、待機または上限付きリトライを使う。
- 秘密値や個人データをログへ出さない。

### 移行のあとに、ログインしたスモークを流す

ログイン前の2枚（`/` と `/login`）は、表が足りなくても通ります。表が無いと落ちるのは、ログインしたあとに DB を読む画面です（0010 の当て漏れで `/account` が `no such table` になった件。[アカウント設定の設計](../architecture/account-profile.md) の「マイグレーション」）。移行を足したら、[認証付きスモーク](../scripts/smoke-authenticated.mjs) で役割ごとに入り直して確かめます。

手元の preview で流す手順:

```bash
pnpm run db:migrate:local
pnpm run preview
# preview を起動したまま、別の端末で
pnpm run smoke:auth -- --origin http://localhost:8787
```

- 見本の利用者（`scripts/seed-data.mjs`）で入ります。ローカル D1 が空なら、先に `pnpm run db:seed:local` を流します（全置換）。
- 8787 以外の港番号で preview を上げるときは、`.dev.vars` の `BETTER_AUTH_URL` を同じ港番号に合わせます。合っていないとログインが `INVALID_ORIGIN` で断られ、NG になります。
- 役割は一般・マネージャー・会社の管理者・システム全体管理者の4つで、開く画面は14件です（`/account`・`/me`・`/manager`・`/admin`・`/admin/members` とそこから拾った1人・`/admin/members/policy`・`/system`・`/system/users`）。役割と画面の表はスクリプトの `PAGES` の1か所にあります。移行で表を足したら、その表を読む画面が `PAGES` にあるかを確かめます。`--roles` で役割を絞れます（`--help` で一覧）。
- 結果は「OK/NG・役割・パス・状態」を1行ずつ出します。NG にするのは、200 以外（`/login` や自分のホームへの転送も含む）と、200 でも本文にエラーの印があるものです。印は `no such table`・`no such column`・Next.js のエラー画面と、例外の印 `data-dgst` です。本番では例外の文面が伏せられ、`data-dgst` の数字だけが残ります。
- 終了コードは、0 = 全部 OK、1 = NG が1件以上、2 = 引数や利用者の指定が足りない（通信の前に止めた）です。
- ログインの試行制限（`429`）に当たったら、言われた秒数だけ待って入り直します（回数に上限あり）。

本番に向けるとき:

- 見本の利用者では入りません。役割ごとに本番の専用の利用者を用意し、`SMOKE_<役割>_EMAIL` と `SMOKE_<役割>_PASSWORD` を環境変数で渡します。会社を選ぶ役割は `SMOKE_<役割>_COMPANY`（会社 id）も渡します。`<役割>` は `EMPLOYEE`・`MANAGER`・`COMPANY_ADMIN`・`SUPER_ADMIN` です。確かめる役割の分がそろっていなければ、通信の前に終了コード 2 で止まります。
- 宛先は `--origin` か、環境変数 `APP_URL`（`smoke.sh` と同じ名前）で渡します。
- パスワードは出力に出しません。資格情報を文書・スクリプト・ログに書きません。
- [Deploy workflow](../.github/workflows/deploy.yml) には組み込んでいません。本番では §1 の5のとおり人が確かめます。

## 4. アセットサイズ

容量は値を文書へ転記せず、配布対象から毎回測定します。

```bash
pnpm run cf:dry-run
pnpm run check:bundle-size
```

[容量検査スクリプト](../scripts/check-bundle-size.mjs) は gzip 後サイズを Cloudflare の設定済み上限と比較します。Deploy workflow でも同じ検査を行い、超過時は配布前に停止します。最新の実測値は workflow log を参照してください。

## 5. 改善要望を作業指示文として払い出すための設定

`/admin/improvements` から払い出す指示文と、作業する側が読む `GET /api/improvements` は、鍵が設定されてから動きます。未設定でも要望の投稿・閲覧は動き、払い出しだけが 503 と設定手順を返します。

鍵の置き場所は2つあり、**どちらでも通ります**。

| 置き場所 | 作り方 | 見る順番 |
|---|---|---|
| 画面から発行した鍵（`agent_api_keys` テーブル） | `/system/agent-keys`（メニュー「Claude Code連携（システム開発者専用）」）でボタンを押す | 1番目 |
| `AGENT_API_KEY` | Cloudflare Secrets（`wrangler secret put AGENT_API_KEY`）／`openssl rand -base64 32` で作った文字列 | 2番目 |

**見る順番は「画面で発行した鍵 → サーバーの設定値（`AGENT_API_KEY`）」で固定です。** 先に画面の鍵を見るのは、そちらが画面から即座に止められるからです。どちらか一方に合えば通ります。32文字未満の設定値は未設定と同じ扱いです。

設定値の鍵は**画面から受け付けを止められます**（`/system/agent-keys` の「サーバーの設定値の鍵」→「この鍵での受け取りを止める」）。止めている間は、正しい設定値を送っても通りません。いつでも再開できます。設定値そのものを消すときは `pnpm exec wrangler secret delete AGENT_API_KEY` ですが、こちらは取り消せないため、急ぎのときはまず画面で止めてください。

### 手順A: 画面から発行する（ターミナル不要・推奨）

1. システム全体管理者でログインし、メニュー「Claude Code連携（システム開発者専用）」（`/system/agent-keys`）を開く
2. 「どこで使うか」の名前を入れて（例: 自宅の Claude Code）「鍵を発行する」を押す
3. 表示された鍵・貼る文言・設定用の1行のいずれかをコピーする。**この画面を閉じると二度と表示できません**
4. 使う場所が増えたら、別の名前でもう1本発行する。**同時に10本まで**持てる
5. 1本だけ漏れたときは、その行の「この鍵を止める」を押す。**他の鍵はそのまま使えます**

保存するのは鍵のハッシュ（SHA-256）と先頭8文字だけで、生の鍵はデータベースにもログにも残しません。突き合わせは定数時間比較で行います。発行・失効の行は消さず、誰がいつ行ったかがそのまま履歴になります。

### 手順B: ターミナルから設定する

1. `openssl rand -base64 32` を実行する（人が考えた文字列は使わない）
2. `pnpm exec wrangler secret put AGENT_API_KEY` を実行する
3. 聞かれたら、1で作った文字列を貼り付ける
4. 手元にも控えを1つ残す（登録後に画面へ表示する方法はない）
5. 漏れたと思ったら、同じ手順で入れ直す。古い鍵はその時点で使えなくなる
6. 完全に消すときは `pnpm exec wrangler secret delete AGENT_API_KEY`（取り消せません。急ぎは画面から止める方が安全です）

- 鍵はブラウザへ渡らず、Workers 側でのみ使います。client bundle へ入れないため、`NEXT_PUBLIC_` を付けた名前にしません。
- 管理画面が配る「取得コマンド」も鍵そのものは含みません。作業する側の環境変数 `HR_AGENT_KEY` から読む形で出します。
- ローカルで試すときは `.dev.vars` に `AGENT_API_KEY=...` を置きます（このファイルは追跡しません。書き方は `.dev.vars.example` にあります）。
- 鍵を差し替えたら `wrangler secret put` を再実行します。再配布は不要です。
- この API は要望の生の声と技術情報を返します。鍵が無いとき・鍵が違うときは同じ文面で断り、中身は一切返しません。回線ごとに1分30回までで、それを超えると鍵を確かめる前に断ります。
- 払い出しは1回ずつ履歴に積みます（画面からのコピーか、Claude Code の取得か、どの鍵で通ったか）。**保持は要望1件につき新しい順に20件**で、それより古い行は消します。通算の回数は別の欄に持つため、丸めても回数は減りません。

## 6. 初期パスワードの控えを使うための設定（CREDENTIAL_ENC_KEY）

利用者の追加・会社の追加・初期パスワードの再発行のとき、発行したパスワードを暗号化して控えに残せます。控えは一覧の行からあとで開けます。鍵が無くても発行そのものは動き、控えを残さない旨を画面に出します。

1. `openssl rand -base64 32` を実行する（人が考えた文字列は使わない）
2. `pnpm exec wrangler secret put CREDENTIAL_ENC_KEY` を実行し、1の文字列を貼り付ける
3. ローカルでは `.dev.vars` に `CREDENTIAL_ENC_KEY=...` を置く（書き方は `.dev.vars.example`）

- 鍵として使うのは、ちょうど32バイト（base64で44文字）の値だけです。それ以外は未設定と同じ扱いです。
- 暗号は AES-GCM で、利用者IDを付加データに入れます。別の人の行へ暗号文を写しても開けません。
- 開けるのはシステム全体管理者と、同じ会社の管理者だけです。
- 本人がパスワードを変えると控えは消えます。再発行すると新しい控えに置き換わります。
- 鍵を入れ替えると古い控えは開けなくなります。必要な人だけ再発行してください。
- 本番の secret の設定は外部への変更です。作業者が自分の権限で行い、値を記録やチャットへ貼りません。

## 7. 「保存したのに反映されない」と言われたとき

保存の操作はすべてサーバーアクション（`src/actions/`）を通り、成功したときは同じ応答の中で新しい画面を返します。成功の文面は、新しい一覧が描かれてから出ます。同じブラウザの別タブには保存を知らせ、別の端末は画面に戻ったときに取り直します。仕組みの詳細は [製品仕様 §27](./product/spec.md) と [保存した結果の鮮度](../architecture/data-freshness.md) にあります。

上から順に確かめます。

1. **同じタブで再読み込みする。** 出れば保存は済んでいます。出ないときは2へ進みます。
2. **押したときの文面を聞く。** 「保存しました」以外なら失敗です。主な文面は次のとおりです。

| 文面 | 意味 | 次にすること |
|---|---|---|
| 画面が古くなっています。再読み込みしてから送ってください。 | 配布で画面とサーバーの組が変わった | 再読み込みしてやり直す |
| 送れませんでした。通信を確かめて、もう一度押してください。 | サーバーへ届かなかった | 通信を確かめてやり直す |
| 同じ項目を別の人が同時に保存しました。… | 制度マスタの同時保存で後のほうが断られた | 再読み込みして内容を確かめる |
| 途中で止まり、一部が残りました。管理者に連絡してください。 | 会社の追加が途中で止まり、取り消しも一部失敗した | 下の「会社の追加が途中で止まったとき」へ |
| パスワードは変更済みです。お知らせが残るときは管理者に連絡してください。 | パスワードは変わったが、仮パスワードの印と控えの片付けが2回とも失敗した | 下の「パスワード変更の後片付けが止まったとき」へ |

3. **「保存しました」と出たのに再読み込みで出ないときは、応答の生成時刻を見る。** 開発者ツールの Network で、その画面の文書の応答ヘッダー `x-generated-at` を確かめます。Worker が応答を返せるようになった時刻（UTC）です。DBの読取時刻ではなく、保存結果を含む証拠にはなりません。
   - **ヘッダーが無い:** 静的ファイルや101応答などの対象外を除き、Workerの入口・配布版と経路を確かめます。ブラウザの拡張機能や社内のプロキシ、配信網のキャッシュを疑い、5へ進みます。
   - **時刻が保存より前:** 時計の差も確認し、保存前にWorkerを通った応答が残っている可能性を調べます。5へ進みます。
   - **時刻が保存より後なのに出ない:** 保存前に読んだ本文にもこの時刻は付きます。時刻だけで鮮度を断定せず、保存結果と読み出す会社を確認するため4へ進みます。
4. **Workers Logs を見る。** 保存した時刻の前後で、その操作の失敗（`compensation_failed`・`rollforward_failed`、例外）が出ていないかを確かめます。会社の追加なら下の「会社の追加が途中で止まったとき」、パスワードの変更なら「パスワード変更の後片付けが止まったとき」も見ます。
   - **失敗が出ていない:** 保存は通っていて、読み出している会社が違う疑いがあります。全ての役割で、サイドバーの「操作する会社」が選ぶ会社（Cookie `hr_company`。同じブラウザの全タブで共通）の分を読みます。別のタブで会社を切り替えた後や、選んでいた会社が停止・所属解除された後は、保存した会社と違う会社を見ていることがあります。複数の会社に所属する管理者・評価者・社員も、保存した会社を選び直して確かめます。所属が1社だけなら会社選択欄は出ません。会社選択の契約は [製品仕様 §28-4](./product/spec.md#28-4-複数の会社への所属s7受入-a6) を参照してください。
5. **ゾーンのキャッシュ規則を見る（読むだけ）。** いまは `workers.dev` だけで配っているので（`wrangler.jsonc` に `routes` が無い）、ゾーンの規則は効きません。ブラウザ側（拡張機能・社内のプロキシ）を疑います。独自ドメインへ移した後は、そのゾーンの Cache Rules に、アプリのパスをキャッシュする規則が無いかを確かめます。ログイン後の画面と `/api/*` は `private, no-store` を返すので、規則で上書きしない限り残りません。規則の変更は外部への変更なので、別に承認を取ってから行います。
6. **別の端末で出ないときは、その画面へ戻ってもらう。** 別の端末へは押し出して知らせません。タブへ戻る・通信が戻る・戻るボタンで開き直す、のどれかで取り直します。

### 会社の追加が途中で止まったとき

Workers Logs で `compensation_applied` と `compensation_failed` を探します。

- `operation` は操作名（`company.create`）、`ids` は会社IDと利用者ID、`leftovers` は消せずに残った手順です。
- `leftovers` が空なら、書きかけは残っていません。そのままやり直せます。
- `company` や `masters` が残ったときは、その会社を `/system/companies` で利用停止にし、別の会社IDで作り直します。データは消さずに止める運用です。本番DBを手で書き換えません。

### パスワード変更の後片付けが止まったとき

パスワードの変更は認証ライブラリが先に書き、取り消せません。そのあと「仮パスワードのまま」の印と、管理者が発行した仮パスワードの控えを1回の batch で消します。この batch は失敗すると1回だけやり直し、それでも失敗したときに上の表の文面を出します。パスワードそのものは新しいもので入れます。

Workers Logs で `rollforward_retry` と `rollforward_failed` を探します。

- `operation` は `account.password`、`ids.userId` が本人の利用者IDです。
- `rollforward_retry` だけで `rollforward_failed` が無ければ、やり直しで揃っています。何もしません。
- `rollforward_failed` があるときは、本人に `/account/password` からもう一度パスワードを変えてもらいます（いまのパスワード欄には、変えたばかりの新しいパスワードを入れます）。変更が済むたびに同じ batch が走るので、これで印と控えが消えます。
- 後で同じ `ids.userId` の `rollforward_failed` が増えていないことと、本人の画面から「仮パスワードのまま」のお知らせが消えたことを確かめます。
- 何度やっても `rollforward_failed` が出るときは、D1 の障害を疑い、[Cloudflare の状況](https://www.cloudflarestatus.com/)を見てから時間を置いて同じことを頼みます。
- 印や控えを本番DBで手で消しません。控えは発行から14日を過ぎると開けなくなり、次の発行のときに掃除されます。

### 画面の通し試験（E2E）で確かめる

鮮度の経路（同じタブ・強制再読み込み・2つのタブ・別の端末・戻る・bfcache）、成功の知らせの後ろに畳んだ控え、下書きの自動保存とまとめ処理は `pnpm test:e2e` で確かめられます。経路の一覧は `e2e/data-freshness.spec.ts` の冒頭の注釈が正本で、どの経路をどの幅（パソコン・スマホ 375px・タブレット 768px）で回すかはテスト名に書いてあります。相手はローカルの preview だけです。試験は会社を実際に追加するので、ローカル以外には向けられないよう止めてあります（`playwright.config.ts` の `LOCAL_HOSTS`）。

改善要望の回帰は `e2e/improvement-data-flows.spec.ts`（回答提出・評価確定後の一覧・所属切替・等級名・不足リンク）と `e2e/reorder-data-flow.spec.ts`（3入力方法の並べ替え保存）で、画面の操作後にローカルD1も読み戻します。専用の匿名試験データは各試験の終了時に監査を含めて片付けます。`wrangler dev --persist-to <dir>` でDBのコピーを使う場合は、試験にも `E2E_PERSIST_TO=<dir>` を渡し、previewと同じ保存先を指してください。ログインの試行制限は解除せず、429のときだけ `Retry-After` に従って上限付きで待ちます。

```bash
pnpm exec playwright install chromium   # 初回だけ
pnpm run db:migrate:local
pnpm run db:seed:local                  # 見本データ（super@hyoka-demo.jp など）
pnpm run preview                        # 別の端末で動かしたままにする
pnpm test:e2e
```

- preview を 8787 以外で動かすときは、`.dev.vars` の `BETTER_AUTH_URL`（`APP_ORIGIN` を置いているならそれも）を同じポートにし、`E2E_BASE_URL=http://localhost:<ポート> pnpm test:e2e` で指します。`BETTER_AUTH_URL` がずれるとログインが `INVALID_ORIGIN` で断られます。
- ログインに使う利用者は `E2E_EMAIL` / `E2E_PASSWORD` で変えられます。既定は見本データのシステム全体管理者です。下書きの自動保存の試験でアンケートに答える社員は `E2E_RESPONDENT_EMAIL` / `E2E_RESPONDENT_PASSWORD` で変えられ、既定は見本データの1社目の一般社員です。
- 試験が残すものはローカル D1 に残ります。追加した会社（`E2E ` で始まる名前）と、その会社に送った要望、見本の一般社員の入力途中の下書き（提出はしない）と、締切が過ぎていたときに延ばした本人の期限（1行だけで、増えていかない）です。消すときは `pnpm run db:seed:local` で入れ直します。
- 要望の送信には1人60秒に5件の上限があります。続けて走らせて上限に当たると、試験は知らされた秒数だけ待つので、1回が最長1分ほど延びます。
- 失敗したときは `playwright-report/` に記録が残ります（Git 管理外）。

## 8. 失敗時

自動ロールバックは行いません。migration適用後にDeployだけが失敗した場合は、まず同じDeploy workflowを再実行します。適用済みmigrationは再適用されず、未適用0件の確認後に配布から再開します。旧 isolate、認証・設定不備を切り分けてから `wrangler rollback` を選び、DBを戻す必要がある場合はArtifactのバックアップとmigrationの互換性を確認してください。バックアップは暗号化してあるので、§1 の「書き出しの暗号化」の手順で開きます。移行 0039（KGI の表と列の削除）を当てた後は、`wrangler rollback` で KGI を消す前の版（0038 を出した PR より前）に戻しません。戻し方は §14 にあります。

## 9. 2026-10 の改善要望の配布（移行 0033・0034・0035）

この配布は、移行3本と、それを読む新しいコードを同時に出します。§1 の順序のとおり、Deploy workflow が本番 DB を書き出してから移行を当て、未適用0件を確かめてから Worker を配ります。手で `db:migrate:remote` を流しません。

| 移行 | 中身 | 2回流したとき |
|---|---|---|
| 0033 | 所属の表 `company_memberships` を作り、既存の利用者に今の会社・役割どおりの所属を1件ずつ写す | 変化0（`IF NOT EXISTS`・`INSERT OR IGNORE`） |
| 0034 | 既存の会社の等級名と、等級名を含む表示名を『等級1』〜『等級5-2』へ書き換える。前の値は `display_name_rewrites` に残す | 変化0 |
| 0035 | 予行で見つかった漏れ（前の等級名で保存された既定の題名・KPI 項目の文・昇格要件の本文の写し）を直す | 変化0 |

配布の記録:

- Deploy workflow の実行 `38509015552`（2026-10-14 03:58〜04:04 UTC、PR #93 の `03787cb`）。本番 D1 の書き出し → 保管 → 0033・0034・0035 の適用 → 未適用0件 → 配布 → 2回のスモークが、すべて success。
- 書き出しは Artifact `d1-backup-38509015552` に保管した。保管の期限は 2026-10-28 04:01 UTC。0034・0035 を書き出しから戻す手順（[移行の対応表 §12-5](./migration-mapping-grade-display-names.md)）は、この期限の内だけ使える。
- 2026-10-24 に読んだ時点で、この Artifact はもう残っていない（期限の前に消えている。消した記録は無い）。0034・0035 は、`display_name_rewrites` に残した前の値と `drizzle/rollback/` の SQL でだけ戻せる。
- 続く実行 `38560660381`（2026-10-14 12:00〜12:05 UTC、PR #94 の `42b7f6b`）は未適用の移行が0件だったので、書き出し・保管・適用を飛ばして配布とスモークだけを流した（どちらも success）。

確かめる要点（配布の後に読み取りだけで見る）:

- `wrangler d1 migrations list` の未適用が0件である（Deploy workflow が確かめて、記録に残す）。
- 会社に属する利用者（役割が会社の管理者・マネージャー・社員）の数と、`company_memberships` の行数が合う（配布の直後で、まだ誰も2社目を足していないとき）。
- `display_name_rewrites` の `migration` ごとの件数が、予行の件数と大きく違わない。予行の件数は [移行の対応表 §12](./migration-mapping-grade-display-names.md) にある。
- 会社の管理者の画面で、等級の名前が『等級1』の形で出て、英語の区分名（Beginner など）が出ない。

戻すとき: 0035 の戻し → 0034 の戻し の順に、`drizzle/rollback/` のファイルを流します。戻るのは「今の値が移行の書いた値のままの行」だけで、移行のあとに会社が自分で直した名前は上書きしません。0033 の所属の表は、古いコードが読まないので残したままで構いません。詳しい手順と、書き出しから戻すときの並べ替えは [移行の対応表 §12-5](./migration-mapping-grade-display-names.md)。

## 10. 2026-10 の改善要望で増えた運用

### 等級の名前を変える（会社の管理者・全体管理者）

1. 会社の管理者でログインし、メニュー「等級の設定」（`/admin/masters`）を開く。全体管理者は、先に「操作する会社」の選択欄でその会社を選ぶ。
2. 「等級を選ぶ」で変えたい等級を押し、「等級の名前」を書き換えて「等級の設定を保存する」を押す。
3. 保存のあと、その会社の全ての画面（一覧・評価・アンケートの既定の題名など）が次の描画から新しい名前になる。利用者が自分で付けた題名は変わらない。

マネージャーと一般の社員はこの画面を開けず、サーバーも 403 で断ります。

### 2社目の所属を足す（全体管理者）

1. 全体管理者でログインし、「利用者一覧」（`/system/users`）から本人を開く。
2. 「ほかの会社にも所属させる」で、足す会社とその会社での役割を選び、「この会社に所属させる」を押す。パスワードはそのまま使える。
3. 等級と上長は、同じ画面の「所属している会社」で足した会社を押し、「登録内容を変える（会社名での値）」で付けて「この内容で保存する」を押す。ほかの会社の値は変わらない。

所属を外すのは、その会社の管理者（または、その会社を「操作する会社」で選んだ全体管理者）が「社員」（`/admin/members`）から本人を開き、「この会社の所属を外す」で行います。ほかの会社の所属とログイン、外した会社での回答と評価の記録は残ります。

### 権限一覧を見る

- 全体管理者はメニュー「権限一覧」（`/system/permissions`）で、47画面ぶんの「できる（○）・条件つき（△）・できない（—）」を役割ごとに見られる。上のタブで役割を1つに絞れる。△ の条件は「i」を指すか押すと出る。
- 利用者の一覧（`/system/users`・`/admin/members`）の「権限一覧を開く」でも、同じ内容をその場で開ける。
- 一覧はルート台帳から作るので、画面の入口・メニュー・保存の処理の判定と食い違わない。役割の決まりを変えるときは、台帳を直して契約テスト（`src/lib/permissions-contract.test.ts`）を通す。

## 11. 社員CSVの取り込みの直し（移行 0036）

0033 で所属の表が会社ごとの値の正本になったあとも、社員CSVの取り込みは `users` だけを書いていました。そのため次の2つが起きていました。

- 取り込みで新しく作った人に所属の行が無く、社員の一覧・評価の画面に出ない。
- 登録済みの人を取り込みで変えたとき、役割・等級・上長などが `users` の写しにだけ入り、所属の行（正本）は前の値のまま。

取り込みは所属の行を書くように直しました（`src/lib/import-members.ts`）。ほかの会社にも所属している人の氏名・利用状態は、社員の画面と同じく全体管理者の取り込みでだけ変えられます。

移行 0036 は、1つ目の人たちに所属の行を足します。足すのは、取り込みの記録（`import_batches` の `before_json`）で「その取り込みで新しく作った」と分かり、今もその会社の役割を持ち、所属の行が無い人だけです。値は `users` の写しから取り、id は `mem_imp_` で始まります。2回流しても変化0です。§1 の順序のとおり Deploy workflow が当てるので、手で流しません。

確かめる要点（配布の後に読み取りだけで見る）:

- 足した行の数: `SELECT COUNT(*) FROM company_memberships WHERE id LIKE 'mem_imp_%';`
- 会社に属するのに所属の行が無い人が0件である:

  ```sql
  SELECT u.id, u.company_id, u.role FROM users u
  WHERE u.company_id IS NOT NULL AND u.role IN ('EMPLOYEE', 'MANAGER', 'COMPANY_ADMIN')
    AND NOT EXISTS (SELECT 1 FROM company_memberships m WHERE m.user_id = u.id AND m.company_id = u.company_id);
  ```

  ここに出る人は、取り込みの記録に無い経路で作られた人です。移行では足さないので、1人ずつ原因を調べてから全体管理者の画面で所属を足します。

2つ目（登録済みの人の取り込みでの変更）は、この移行では直しません。写しと所属の行のどちらが正しいかは、その会社に確かめないと決められないためです。次の照会（読み取りだけ）で、写しと元の所属の値がずれている人を出せます。

```sql
SELECT u.id, u.name, u.company_id,
  u.role AS copy_role, m.role AS membership_role,
  u.grade_id AS copy_grade, m.grade_id AS membership_grade,
  u.manager_id AS copy_manager, m.manager_id AS membership_manager,
  u.office_id AS copy_office, m.office_id AS membership_office,
  u.employee_code AS copy_code, m.employee_code AS membership_code,
  u.department AS copy_department, m.department AS membership_department,
  u.hired_at AS copy_hired, m.hired_at AS membership_hired
FROM users u
JOIN company_memberships m ON m.user_id = u.id AND m.company_id = u.company_id
WHERE u.role IS NOT m.role OR u.grade_id IS NOT m.grade_id OR u.manager_id IS NOT m.manager_id
  OR u.office_id IS NOT m.office_id OR u.employee_code IS NOT m.employee_code
  OR u.department IS NOT m.department OR u.hired_at IS NOT m.hired_at;
```

本番で流すときは `pnpm wrangler d1 execute hr-evaluation-db --remote --command "<上の SQL>"` を使います（`SELECT` だけ）。出た人は、会社に確かめて正しい値を社員の画面（`/admin/members`）で保存し直します。保存すると所属の行と写しの両方が同じ値になります。同じCSVをもう一度取り込んでも直せます（今の取り込みは所属の行に書くため）。

戻すとき: アプリの版を戻します。足した行は取り込みが本来書くべきだった行なので、残したままで構いません。消すときは書き出してから `DELETE FROM company_memberships WHERE id LIKE 'mem_imp_%';` を流します（足したあとに画面で変えた値も消えます）。

## 12. アカウント操作の監査記録（移行 0037）

全体管理者にする・外す、会社の役割を変える、所属の会社を移す、利用を止める・再開する、パスワードを再発行する、アカウントを作る、の操作を（出来事は8種類）、表 `account_security_events` に残すようにしました（E7。決めたことは [前例のない設計判断の記録 DD-013](./product/design-decisions.md)）。入口は「システム全体の利用者」「社員」「会社の追加（最初の管理者）」「社員CSVの取り込み」の4つです。

移行 0037 は表・索引2つ・書き換えを止めるトリガーを足すだけで、既存の行は変えません。2回流しても変化0です。§1 の順序のとおり Deploy workflow が当てるので、手で流しません。移行の前の操作は記録にありません（表はこの移行から書き始めます）。

確かめる要点（配布の後に読み取りだけで見る）:

- 表とトリガーがある: `SELECT name, type FROM sqlite_master WHERE tbl_name = 'account_security_events';`（表・`idx_ase_user_time`・`idx_ase_company_time`・`trg_ase_append_only` が出る）
- 画面で利用者を1人保存したあとに、記録が1件以上増えている: `SELECT COUNT(*) FROM account_security_events;`

記録を読むときの照会（読み取りだけ。画面はまだありません）:

```sql
SELECT e.occurred_at, e.event_type, e.source, e.company_id,
  target.email AS target_email, actor.email AS actor_email,
  e.before_json, e.after_json, e.operation_id
FROM account_security_events e
JOIN users target ON target.id = e.user_id
LEFT JOIN users actor ON actor.id = e.actor_id
ORDER BY e.occurred_at DESC, e.rowid DESC
LIMIT 50;
```

- 1人に絞るときは `WHERE e.user_id = '<利用者の id>'`、1社に絞るときは `WHERE e.company_id = '<会社の id>'` を足します。会社の列は移した先の会社です。全体管理者の付け外しのように所属の無い出来事は NULL です。
- 同じ保存で起きたことは同じ `operation_id` です。社員CSVの取り込みは、取り込みの記録の id（`import_batches.id`）と同じ値です。
- `occurred_at` はミリ秒の数値です。日時で見るときは `datetime(e.occurred_at / 1000, 'unixepoch', '+9 hours')` にします。
- 本番で流すときは `pnpm wrangler d1 execute hr-evaluation-db --remote --command "<上の SQL>"` を使います（`SELECT` だけ）。結果には利用者のメールアドレスが入るので、文書・Issue・ログに貼りません。

記録は書き換えられません（UPDATE はトリガーが `account_security_events_append_only` で止めます）。操作した人の利用者を消したときだけ、`actor_id` が NULL になります。

戻すとき: アプリの版を戻します。古いコードはこの表を読み書きしないので、表を残したままで構いません。表ごと消すときは、記録も消えるので書き出してから `DROP TABLE account_security_events;` を流します（トリガーと索引も一緒に消えます）。

## 13. 保存した結果の鮮度の配布（移行 0031・0032）

保存の入口の一本化（[製品仕様 §27](./product/spec.md)）は、移行2本と、それを読む新しいコードを同時に出しました（PR #90、`40362db`）。§1 の順序のとおり、Deploy workflow が本番 DB を書き出してから移行を当て、未適用0件を確かめてから Worker を配っています。手で `db:migrate:remote` を流しません。

| 移行 | 中身 | 2回流したとき |
|---|---|---|
| 0031 | 初期パスワードの控えの表 `initial_credential_memos` を作る。暗号文だけを持ち、利用者を消すと控えも消える | 2回目は表が既にあるので、Deploy workflow は適用済みとして流さない |
| 0032 | 制度マスタの監査記録 `constitution_events` の番号の重なりを、同じ実体の中で並び順を変えずに振り直し、索引を一意（`uq_ce_entity_seq`）に張り替える | 振り直しの対象が無くなるので、変化0 |

配布の記録:

- Deploy workflow の実行 `36988220392`（2026-10-02 09:10〜09:15 UTC、`40362db`）。未適用の確認 → 本番 D1 の書き出し → 保管 → 0031・0032 の適用 → 未適用0件 → 配布 → 2回のスモークが、すべて success。
- 書き出しは Artifact `d1-backup-36988220392` に保管した。保管の期限は 2026-10-16 09:12 UTC。期限を過ぎると、この時点の DB へは戻せない。

確かめる要点（配布の後に読み取りだけで見る）:

- 表と索引がある: `SELECT name, type FROM sqlite_master WHERE name IN ('initial_credential_memos', 'uq_ce_entity_seq', 'idx_ce_entity');`（表と `uq_ce_entity_seq` が出て、`idx_ce_entity` は出ない）
- 番号の重なりが0件: `SELECT company_id, entity_type, entity_id, seq, COUNT(*) FROM constitution_events GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1;`（0行）
- 控えを使うには、§6 の鍵 `CREDENTIAL_ENC_KEY` が要る。鍵が無いあいだは控えを作らず、表は空のまま。

戻すとき: まずアプリの版を戻します（§8）。移行は戻さずに残すのが既定です。

- 0031 の表は、古いコードが読み書きしないので残したままで構いません。消すときは `DROP TABLE initial_credential_memos;` を流します。控えは開けなくなるので、要る人だけ初期パスワードを再発行します。
- 0032 の一意索引は、古いコードでも残したままで構いません。古いコードで同じ項目を同時に保存すると、後のほうが重なりの代わりに失敗します。元の索引に戻すときは `DROP INDEX uq_ce_entity_seq;` のあと、`CREATE INDEX idx_ce_entity ON constitution_events (company_id, entity_type, entity_id, seq);` を流します。振り直した番号は元に戻せませんが、並び順は変わっていません。
- DB そのものを書き出しの時点へ戻すのは、上の保管の期限の内だけです。戻すとその後の保存がすべて消えるので、別に承認を取ってから行います。

## 14. 評価レポートと上司の判断の配布（移行 0038・0039）

事業所KGIの削除・評価レポート・昇給と昇格への上司の判断（[製品仕様 §29](./product/spec.md#29-評価レポートと上司の判断事業所の達成率の削除2026-10-20-追加)）は、**2回の公開に分けて**出します。決めたことは [DD-020](./product/design-decisions.md)（公開の単位）と [DD-024](./product/design-decisions.md) の1（移行の番号）です。どちらも main へのマージで Deploy workflow が流すので、手で `db:migrate:remote` や `deploy:worker` を流しません。

| 公開 | 入るもの | 移行 | 中身 | 2回流したとき |
|---|---|---|---|---|
| 1回目（P05 の PR のマージ） | KGI を読まない新しいコード・評価レポート・上司の判断 | 0038 | 評価に上司の判断の6列（`raise_decision`・`raise_decision_reason`・`promotion_decision`・`promotion_decision_reason`・`decision_recorded_by`・`decision_recorded_at`）と索引 `idx_eval_company_employee_status` を足す。列はすべて NULL 可で、既存の行は「記録なし」になる | Deploy workflow は適用済みのファイルを流さない。手で2回流すと、列がもうあるので止まる（SQLite の `ADD COLUMN` に `IF NOT EXISTS` が無い） |
| 2回目（P08 の別の PR のマージ） | 移行だけ | 0039 | KGI の3つの表（`office_kgi_revisions`・`office_kgi_results`・`kgi_coefficients`）を消し、評価の2列（`kgi_coefficient`・`office_achievement_rate`）を消す。賞与の個人Pt・賞与額・根拠の文は残す | 表は `IF EXISTS` で変化0。手で2回流すと、列がもう無いので止まる |

**0039 を 0038 と同じ Deploy に入れません。** Deploy workflow は移行を Worker の配布より先に当てます。同じ Deploy に入れると、KGI の表と列を名前で読む古い Worker が動いている間に表と列が消え、画面が `no such column` で落ちます。1回目の Worker が本番で動き、KGI を読んでいないことを確かめてから、2回目の PR をマージします。

- この作業ツリーでは、0038 と 0039 を同じ変更に入れて試しています。PR を作るときは、`drizzle/migrations/0039_drop_office_kgi.sql` と `drizzle/rollback/0039_drop_office_kgi_rollback.sql` の2つを P05 の PR から外して P08 の PR に移します。`wrangler d1 migrations apply` は `drizzle/migrations/` のファイルだけを見て、`meta/_journal.json` は 0015 までしか持たないので、ほかに移すものはありません。
- seed の試験（`scripts/seed-idempotent.test.mjs`）は移しません。0039 のファイルが無ければ「0039 で消した表を含まない」を飛ばし、消す表が schema.ts と DB にあることで確かめるので、P05 の PR の上でも `pnpm test` が通ります。
- コードの側では、1回目で `src/db/schema.ts` から KGI の定義を外します。DB の表と列は、2回目まで残ります（DD-020 の3）。

### 書き出しの保管

未適用の移行があると、Deploy workflow は本番 D1 の全体を書き出し、Artifact `d1-backup-<実行の id>` に14日置きます。2回目の書き出しは、消した KGI の値を戻せる唯一の元です。

- 1回目（Deploy workflow の実行 `39562261411`、2026-10-21 07:28 UTC、0038）と2回目（`39564492520`、07:47 UTC、0039）の書き出しは、この時点の workflow のとおり平文のまま保管された。
- 2026-10-24 に読んだ時点で、2つの Artifact はどちらも残っていない（保管の期限 2026-11-04 の前に消えている。消した記録は無い）。だから、消した KGI の値を書き出しから戻すことは、もうできません。
- これより後の書き出しは、age の公開鍵で暗号化してから置きます（§1 の「書き出しの暗号化」、[DD-031](./product/design-decisions.md)）。
- KGI の値を14日より長く保管するかは、P08 のマージの前に利用者が決めます（DD-020 の9）。長く置かないなら、期限の後は値を戻せません。

### 確かめる要点（読み取りだけ）

本番で流すときは `pnpm exec wrangler d1 execute hr-evaluation-db --remote --command "<SQL>"` を使います（`SELECT` と `PRAGMA` だけ）。手元の token が本番 D1 を読めない間（[バックログ](./product/backlog.md) の OPS-017）は流せません。結果は P13 が下の配布の記録に書きます。

1回目の後:

- `PRAGMA table_info(evaluations);` に 0038 の6列がある。KGI の2列もまだある。
- 評価レポート（`/reports/<社員の利用者 id>`）を、本人・上長・会社の管理者で開ける。印刷のプレビューが A4 縦の2枚になる。
- 2回目の PR をマージする前に、1回目の Worker が配られていること（Deploy workflow の2回のスモークが success）を確かめる。
- 消した KGI の仕組みで出した根拠の文が残る評価の件数を、状態ごとに数える（文は写さない）。確定済みの件数は、評価の詳細にその文がそのまま出る件数で、[バックログ](./product/backlog.md) の POLICY-011 の判断に使う。P08 のマージの前に数える。

  ```sql
  SELECT status, COUNT(*) AS n, SUM(personal_points IS NULL) AS no_points FROM evaluations WHERE bonus_rationale LIKE '%KGI%' GROUP BY status;
  ```

2回目の後:

- `SELECT name FROM sqlite_master WHERE name IN ('office_kgi_revisions', 'office_kgi_results', 'kgi_coefficients');` が0行。
- `PRAGMA table_info(evaluations);` に `kgi_coefficient`・`office_achievement_rate` が無く、0038 の6列がある。
- `wrangler d1 migrations list` の未適用が0件（Deploy workflow が確かめて、記録に残す）。

保存済みの上司の文のうち、本人に見せない語に引っかかる件数（[DD-023](./product/design-decisions.md) の4。件数だけを数え、文は写さない）:

```bash
pnpm exec wrangler d1 execute hr-evaluation-db --remote --json --command "SELECT evaluator_comment AS t FROM evaluations UNION ALL SELECT raise_decision_reason FROM evaluations UNION ALL SELECT promotion_decision_reason FROM evaluations;" \
  | node --input-type=module -e 'const { containsCriteriaLeak } = await import("./src/lib/domain/evaluation-view.ts"); const { readFileSync } = await import("node:fs"); const rows = JSON.parse(readFileSync(0, "utf8"))[0].results; console.log(JSON.stringify({ checked: rows.filter((r) => r.t).length, flagged: rows.filter((r) => containsCriteriaLeak(r.t)).length }))'
```

- リポジトリの直下で流します。node 22 は `.ts` を直接読めるので、検査の語は保存のときと同じ `CRITERIA_LEAK_PATTERNS` を使います。出るのは件数の2つだけです。
- 0038 の前は理由の2列が無いので、1回目の後に流します。

### 戻すとき

自動では戻しません（§8）。どちらも本番の DB への書き込みなので、利用者の承認を得てから流します。

- **1回目を戻す**: コードだけを戻すときは、`drizzle/rollback/0038_evaluation_decisions_rollback.sql` を流しません。足した列はすべて NULL 可なので、前のコードも動きます。列まで消すときだけ流し、先に `SELECT COUNT(*) FROM evaluations WHERE raise_decision IS NOT NULL OR promotion_decision IS NOT NULL;` で、消える判断の件数を確かめます。
- **2回目を戻す**: DB だけを戻します。`drizzle/rollback/0039_drop_office_kgi_rollback.sql` で3つの表と2列の形を作り直し、値は2回目の書き出しから3つの表と2列だけを取り出して入れ直します。書き出し全体を流し込みません（2回目の後の保存が消えるため。前例は §9 の 0034 の戻し方）。P08 のマージから14日の内は、承認があればすぐ戻します。
- **2回目の後は、P05 を revert しません。** `wrangler rollback` でも P05 より前の版に戻しません。前の版は消えた KGI の表と列を読むので、画面が落ちます。直すときは、前に進める PR で直します（DD-020 の9）。
- 2つの戻す SQL が表の形を移行の前に戻すこと（0039 を先に、0038 を後に戻す順も含む）と、上の件数の SELECT がそのまま流せることは、`src/db/migration-rollback-0038-0039.test.ts` が `pnpm test` で確かめます。値の入れ直しは確かめていないので、流すときは入れ直した後の件数を書き出しの件数と比べます。

配布の記録（P13 が書く）:

- 1回目: Deploy workflow の実行（id・時刻）、マージの sha、Artifact `d1-backup-<id>` と保管の期限、確かめる要点の結果（根拠の文が残る評価の状態ごとの件数を含む）。
- 2回目: 同じ項目と、上の件数（`checked`・`flagged`）。

## 15. 行動指針の割り当てを既定へ戻す配布（移行 0040）

行動指針の既定の分け方（等級1・等級2に1つ目、等級3・等級4-1・等級4-2に2つ目、等級5-1・等級5-2は出さない）からずれた会社を、等級の識別子で既定へ戻します。決めたことは [DD-026](./product/design-decisions.md) です。移行は feature `feature-guideline-kpi-ux-and-two-way-sync` の P05 の PR に入り、main へのマージで Deploy workflow が流すので、手で `db:migrate:remote` を流しません。

| 移行 | 中身 | 2回流したとき |
|---|---|---|
| 0040 | 記録の表 `behavior_band_default_rewrites` を作り、7つの識別子（`beginner`・`regular`・`chief`・`am1`・`am2`・`manager1`・`manager2`）の等級のうち、既定と違う `grades.behavior_band` を既定へ書き換える。前の値は記録の表に残し、書き換えた行の `updated_at` は移行の時刻にする。雛形の会社と、使用を止めた等級も対象にする。会社が足した等級・観点の文・まとまりの呼び名は変えない。使用中の既定のまとまり（`g1_2`・`g3_4`）の両方がそろっていない会社は書き換えず、記録の表に `table_name = 'companies'` の行を1つ残す | 変化0（`IF NOT EXISTS`・`INSERT OR IGNORE`。書き換えるのは今の値が記録の前の値のままの行だけ） |

- 割り当ては NULL（出さない）を取るので、記録の `old_value`・`new_value` も NULL を取ります。移行と戻しは `IS`・`IS NOT` で比べます。
- 移行の後に会社が変えた割り当ては、もう一度流しても、戻しても上書きしません。例外が1つあります。会社が移行の前と同じ値へ戻した行は、記録の前の値のままの行と見分けられないので、0040 を手で流し直すと既定へ書き換わります（wrangler は適用済みの移行を流し直さないので、Deploy workflow では起きません）。
- 0040 は生の SQL なので、設定を保存したときの追従（[DD-028](./product/design-decisions.md) の4）は流れません。書き換えた会社の回答0件の下書きは、割り当ての `updated_at` が下書きより新しくなるので、KPI・評価セットの入口の「設定とずれた下書き」の知らせに「設定に合わせて作り直す」として出ます。会社の管理者が「内容を見る → そろえる」を押して作り直します（下の「ずれた下書きをそろえる」）。公開中・締め切ったアンケートは変えません。
- 上の性質と、下の読み取りの SQL がそのまま流せることは、`src/db/behavior-band-default-migration.test.ts` が `pnpm test` で確かめます。新しい会社が既定で始まることは `src/actions/behavior-default-company.integration.test.ts` が確かめます。

### 書き出しの保管

未適用の 0040 があるので、Deploy workflow は本番 D1 の全体を書き出し、暗号化して Artifact `d1-backup-<実行の id>` に14日置きます。戻す元はまず記録の表で、この書き出しはもう1つの元です（DD-026）。

- 書き出しを使うときも、全体は流し込みません（0040 の後の保存が消えるため。前例は §9 の 0034 の戻し方）。書き出しから割り当ての表（`grades` の `id` と `behavior_band`）だけを取り出し、今の値と比べてから入れ直します。
- 書き出しは age の公開鍵で暗号化してから置きます（§1 の「書き出しの暗号化」、[DD-031](./product/design-decisions.md)）。repo の Variables に `D1_BACKUP_AGE_RECIPIENT` を設定するまで、0040 を含む Deploy は書き出しの前で止まり、0040 は当たりません（本番は変わりません）。P05 をマージする前に、利用者が鍵を用意して変数を設定します。
- 期限の後は書き出しが消え、戻す元は記録の表だけになります。

### 確かめる要点（読み取りだけ）

本番で流すときは `pnpm exec wrangler d1 execute hr-evaluation-db --remote --command "<SQL>"` を使います（`SELECT` だけ）。手元の token が本番 D1 を読めない間（[バックログ](./product/backlog.md) の OPS-017）は流せません。

- 書き換えなかった会社の数。0件でなければ、`row_id` の会社の行動指針の画面を会社の管理者が開き、割り当てを人が決めます。

  ```sql
  SELECT COUNT(*) AS n FROM behavior_band_default_rewrites WHERE table_name = 'companies';
  ```

- 書き換えた等級の数（会社ごと）。

  ```sql
  SELECT company_id, COUNT(*) AS n FROM behavior_band_default_rewrites WHERE table_name = 'grades' GROUP BY company_id ORDER BY company_id;
  ```

- 配布の直後に、書き換えなかった会社を除いて、7つの識別子の等級で既定と違う行が0件。

  ```sql
  SELECT COUNT(*) AS n FROM grades WHERE code IN ('beginner', 'regular', 'chief', 'am1', 'am2', 'manager1', 'manager2') AND behavior_band IS NOT CASE code WHEN 'beginner' THEN 'g1_2' WHEN 'regular' THEN 'g1_2' WHEN 'chief' THEN 'g3_4' WHEN 'am1' THEN 'g3_4' WHEN 'am2' THEN 'g3_4' END AND company_id NOT IN (SELECT row_id FROM behavior_band_default_rewrites WHERE table_name = 'companies');
  ```

- `wrangler d1 migrations list` の未適用が0件（Deploy workflow が確かめて、記録に残す）。

### 戻すとき

自動では戻しません（§8）。本番の DB への書き込みなので、**利用者の承認を得てから**流します。

1. 戻らない行（移行の後に会社が変えた行）の数を確かめ、承認を求めるときに一緒に伝えます。

   ```sql
   SELECT COUNT(*) AS n FROM behavior_band_default_rewrites w JOIN grades g ON g.id = w.row_id WHERE w.table_name = 'grades' AND w.migration = '0040_behavior_band_defaults' AND w.new_value IS NOT g.behavior_band;
   ```

2. 承認を得てから流します。

   ```bash
   pnpm exec wrangler d1 execute hr-evaluation-db --remote --file drizzle/rollback/0040_behavior_band_defaults_rollback.sql
   ```

- 戻るのは、今の値が記録の `new_value` のままの行だけです。移行の後に会社が変えた割り当ては上書きしません。戻した行の `updated_at` は戻した時刻になります。
- 記録の表は消しません。戻した後に 0040 をもう一度流しても、最初の値の記録は上書きされず、同じ結果になります。
- `table_name = 'companies'` の行は数えるための記録なので、戻す対象にありません。
- コードは戻さなくて構いません。説明の文はいまの割り当てから作るので、戻した割り当てのとおりに出ます。
- 戻すと割り当ての `updated_at` がまた進むので、戻した会社の回答0件の下書きは、もう一度「設定とずれた下書き」の知らせに出ます。会社の管理者が、下の手順でもう一度そろえます。

### ずれた下書きをそろえる

0040 で割り当てが変わった会社と、設定とアンケートを別々に直した会社には、KPI・評価セットの入口（`/admin/scheme`）に「設定とずれた下書きのアンケートが N 件あります」が出ます。そろえる操作は回答0件の下書きだけを書き換え、公開中・締め切ったアンケートには触れません（[DD-028](./product/design-decisions.md) の6）。

- **件数の読み方**: N は、そろえられる下書きと、そろえられない下書きの合計です。「内容を見る」は何も書かずに、一覧を2つに分けて出します。
  - そろえられる下書きには、向きが1つずつ付きます。「設定に合わせて作り直す」は、設定の方が新しい下書きで、設問を設定から作り直します。「下書きの直しを設定へ反映する」は、設問の方が新しい下書きで、会社の設定（等級・昇格の要件、行動指針、KPI の設問、評価セットの項目）の文を下書きに合わせて書き換えます。向きは、設定の `updated_at` の最大と、下書きの設問（`form_questions.updated_at`）の最大を比べて決めます。
  - そろえられない下書きには、理由と「直す画面を開く」が付きます。人がその画面で直してから、もう一度「内容を見る」を押します。
- **本番の手順**: 本番の DB への書き込みなので、**利用者の承認を得てから**流します。
  1. 全体管理者が会社を切り替え、入口で「内容を見る」を押し、一覧の件数と向きを控えます。
  2. 「下書きの直しを設定へ反映する」が1件でもある会社は、P13 では流しません。そろえる操作は会社の一覧を全部まとめて流すので、その1件だけを外せません。そして、会社の設定を書き換えるうえ、設定の保存と同じ追従が続きます（回答のある公開中のアンケートには次の版の下書きができ、確定前の評価は集計し直す）。その会社は、アンケートごとに会社の管理者が中身を確かめてから流します。
  3. 承認を求めるときに、会社ごとの件数と向きを一緒に伝えます。
  4. 承認を得てから、流す前の行を手元へ書き出します。置き場はリポジトリの外（`$TMPDIR`）で、コミットしません。「設定に合わせて作り直す」だけなら `forms`・`form_questions` を書き出します。「下書きの直しを設定へ反映する」を流すときは、さらに `grade_requirements`・`promotion_requirements`・`behavior_guidelines`・`kpi_questions`・`scheme_items` と、追従が書く `evaluations`・`evaluation_items` も書き出します。

     ```bash
     pnpm exec wrangler d1 export hr-evaluation-db --remote --no-schema --table forms --table form_questions --output "$TMPDIR/align-<会社の id>-<時刻>.sql"
     ```

  5. 入口で「そろえる」を押し、もう一度「内容を見る」を押して、そろえられる下書きが0件になったことを確かめます。間に誰かが保存していたら、そろえる操作は断ります。もう一度内容を見てから押します。
  6. 受け入れは「そろえられる下書きが0件」です。そろえられない下書きは0件を条件にせず、件数と理由を配布の記録に残します。
- **そろえた結果を戻すとき**: 利用者の承認を得てから、4 の書き出しから、そろえた下書きの `forms` の行と `form_questions` の行だけを取り出し、今の行と比べてから入れ直します（`wrangler d1 execute --remote --file`）。書き出し全体は流し込みません（そろえた後の保存が消えるため）。設定の側も、4 の書き出しの7つの表を元にします。そろえた記録（`constitution_events` の `before_json`）は、消えた KPI の設問が要約しか残らないので、補助にとどめます（[DD-028](./product/design-decisions.md) の6）。

### 見本の会社を入れ直す

見本の会社（見本商事（サンプル））には、受付中の評価期間（2026年度 下期）を1つ置きます（[DD-029](./product/design-decisions.md)）。提出済み5名（s1・s3・s5・s7・s9）・入力途中2名（s2・s6）・未回答4名（s4・s8・s10 と上長）で、評価はまだ作りません。

- 本番の見本を新しい中身にするのは、**利用者の承認を得てから** `pnpm db:sample:remote` を流します。見本の会社だけを消してから入れ直し、他の会社には触れません（§2 の `db:sample:*:remote` の説明）。消すだけのときは `pnpm db:sample:remove:remote` です。
- 入れ直すと、見本の利用者の仮パスワードも作り直されます。台本は平文を出さないので、使う人の分は管理画面の「仮パスワードを再発行する」から発行します。

配布の記録（P13 が書く）: Deploy workflow の実行（id・時刻）、マージの sha、Artifact `d1-backup-<id>` と保管の期限、暗号化の step のログの行（「暗号化しました: backup.sql.age（受け手 N 本）」）、確かめる要点の件数。

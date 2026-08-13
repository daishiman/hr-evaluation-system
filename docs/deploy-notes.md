# デプロイ時の注意

本番配布の入口は [Deploy workflow](../.github/workflows/deploy.yml) です。ローカルの作業ツリーから直接デプロイせず、`main` の追跡済みコミットを GitHub Actions のクリーンな checkout から配布します。

## 1. スキーマ変更を伴う順序

新しいコードが古い DB を読む状態を作らないため、次の順序を固定します。

1. migration と、その追加列がなくても動く後方互換なコードを `main` へ入れる。
2. 自動の [Deploy workflow](../.github/workflows/deploy.yml) が文書・型・テスト・ビルド・容量の各ゲートを通す。
3. 未適用 migration があれば、本番DBのバックアップを取得して14日間Artifactに保管する。バックアップできなければ停止する。
4. migrationを自動適用し、同じ本番DBを再照会して未適用0件を確認してから配布する。
5. 自動スモークを確認し、必要な認証付き操作を人が確認する。

migration がない変更はバックアップと適用をスキップしてそのまま配布します。通常運用で手動操作は不要です。[Migration workflow](../.github/workflows/migrate.yml) は、Deployのmigration適用後に別工程で失敗した場合の復旧確認や、後方互換なmigrationだけを先行適用したい場合に使います。DeployとMigrateは同じconcurrency groupで直列化し、未適用状態が判定不能ならfail-closedで停止します。

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

### preview で見る代表経路

- ログインし、ロール別ホームを表示できる。
- フォームの作成、回答、評価確定まで進められる。
- 評価集計で `evaluations` に行が作られる。計算不能な設問が一つあっても、人単位で黙って欠落しない。
- `/admin/kgi` で達成率を入力し、未入力時の個人 Pt・賞与額は `null` として扱われる。未入力を `0` や「0円」と表示しない。
- 対象変更に応じてアカウント設定、会社管理、マスタ版履歴を確認する。

## 3. 配布直後の確認

Cloudflare Workers では配布直後に旧 isolate が短時間残ることがあります。Deploy workflow は間隔を空けて 2 回スモークを行います。1 回目だけの不一致で即座にロールバックせず、2 回目と deployment 一覧を確認して判断します。

認証付き疎通を追加するときは次を守ります。

- ログイン API には対象 URL と一致する `origin` ヘッダーを送る。
- `429` は失敗として連打せず、待機または上限付きリトライを使う。
- 秘密値や個人データをログへ出さない。

## 4. アセットサイズ

容量は値を文書へ転記せず、配布対象から毎回測定します。

```bash
pnpm run cf:dry-run
pnpm run check:bundle-size
```

[容量検査スクリプト](../scripts/check-bundle-size.mjs) は gzip 後サイズを Cloudflare の設定済み上限と比較します。Deploy workflow でも同じ検査を行い、超過時は配布前に停止します。最新の実測値は workflow log を参照してください。

## 5. 失敗時

自動ロールバックは行いません。migration適用後にDeployだけが失敗した場合は、まず同じDeploy workflowを再実行します。適用済みmigrationは再適用されず、未適用0件の確認後に配布から再開します。旧 isolate、認証・設定不備を切り分けてから `wrangler rollback` を選び、DBを戻す必要がある場合はArtifactのバックアップとmigrationの互換性を確認してください。

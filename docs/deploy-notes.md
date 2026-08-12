# デプロイ時の注意

本番配布の入口は [Deploy workflow](../.github/workflows/deploy.yml) です。ローカルの作業ツリーから直接デプロイせず、`main` の追跡済みコミットを GitHub Actions のクリーンな checkout から配布します。

## 1. スキーマ変更を伴う順序

新しいコードが古い DB を読む状態を作らないため、次の順序を固定します。

1. migration と、その追加列がなくても動く後方互換なコードを `main` へ入れる。
2. 自動の [Deploy workflow](../.github/workflows/deploy.yml) が未適用 migration を検出して、配布前に停止したことを確認する。
3. [Migration workflow](../.github/workflows/migrate.yml) を `APPLY` 確認付きで手動実行する。このworkflowがバックアップを先に取得し、適用後に未適用0件を再確認する。
4. 停止した Deploy workflow を再実行し、文書・型・テスト・ビルド・容量・migration の各ゲートを通して配布する。
5. 自動スモークを確認し、必要な認証付き操作を人が確認する。

migration がない変更は手順 2〜3 を通らずそのまま配布できます。migration だけを先に安全に出す場合も、migration ファイルを含むcommitを先に `main` へ入れて同じ手順を使います。Deploy workflow は配布直前に本番 D1 を照会し、未適用または判定不能なら fail-closed で停止します。

## 2. ローカルで Workers 相当を確認する

```bash
pnpm run cf-typegen
pnpm run db:migrate:local
pnpm run preview
```

`cloudflare-env.d.ts` は `wrangler.jsonc` から生成する Git 管理外ファイルです。別 worktree からコピーせず、各 checkout で `pnpm run cf-typegen` を実行します。秘密値は追跡せず、ローカルでは `.dev.vars`、本番では Cloudflare Secrets を使います。

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

自動ロールバックは行いません。migration の互換性、旧 isolate、認証・設定不備を切り分けてから、GitHub Actions の再実行または `wrangler rollback` を選びます。DB を戻す必要がある場合は、コードだけを先に戻さず、バックアップと migration の互換性を確認してください。

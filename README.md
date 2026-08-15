# hr-evaluation-system

人事評価制度の設定、アンケート、評価、昇給・賞与候補までを一つの会社単位で扱う Web アプリケーションです。

## 現在の構成

- Next.js / React / TypeScript
- Better Auth
- Drizzle ORM / Cloudflare D1
- OpenNext for Cloudflare / Cloudflare Workers

依存バージョンは [package.json](./package.json)、バインディングと本番変数は [wrangler.jsonc](./wrangler.jsonc) を正本とします。

## 最短セットアップ

Node.js 22 と pnpm を用意し、次を実行します。

```bash
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm run cf-typegen
pnpm run db:migrate:local
pnpm run db:seed:local
pnpm run preview
```

`preview` は Workers 相当のローカル環境を `http://localhost:8787` で起動します。日常の UI 開発で `pnpm dev` を使う場合は、`.dev.vars` の `BETTER_AUTH_URL` を Next.js が表示する URL に合わせてください。

改善要望を作業指示文として払い出す読み取り API（`GET /api/improvements`）だけは、鍵が要ります。無くても投稿・閲覧は動き、払い出しのときだけ設定案内が出ます。鍵はシステム全体管理者が画面から発行できます（メニュー「Claude Code 連携の鍵」＝ `/system/agent-keys`。用途の名前を付けて発行すると乱数で作られ、その場で1回だけ表示します。同時に10本まで持て、1本だけ止めても他は動き続けます）。ターミナルから設定する場合は `openssl rand -base64 32` で作り、`.dev.vars` の `AGENT_API_KEY` に置きます（本番は `pnpm exec wrangler secret put AGENT_API_KEY`）。どちらの鍵でも通り、**見る順番は画面発行の鍵 → 環境変数 `AGENT_API_KEY`** です。環境変数の鍵は同じ画面から受け付けを止められます。手順の詳細は [デプロイ注意 §5](docs/deploy-notes.md) にあります。

## Claude Code から改善要望を呼び出して直す

利用者が画面から送った改善要望を、このリポジトリから直接読み出して着手できます。毎回 URL や鍵を打つ必要はありません。

1. **鍵を発行する** — システム全体管理者で [/system/agent-keys](https://hr-evaluation-system.daishimanju.workers.dev/system/agent-keys) を開き、用途の名前（例: 自宅の Claude Code）を付けて「鍵を発行する」を押します。鍵はその場で1回だけ表示されます。
2. **手元に置く** — `cp .env.example .env.local` でファイルを作り、`HR_AGENT_KEY=` の右に控えた鍵を貼ります。`.env.local` は追跡されません。発行画面の「.env.local へ書く1行をコピー」を押すと、この1行がそのまま手に入ります。
3. **呼び出す** — 次のどれかを実行します。

```bash
pnpm improvements list                         # 手つかずの要望を一覧で見る
pnpm improvements get <要望ID>                 # 1件の作業指示文を読む
pnpm improvements get <ID> <ID>                # まとめて読む（最大10件）
pnpm improvements done <ID> --release <公開先> # 直して公開したことを書き戻す
pnpm improvements failed <ID> --reason <理由>  # 直しきれなかった理由を残す
pnpm improvements key                          # 鍵の在り処だけを確かめる（値は出ません）
pnpm improvements list --json                  # 機械処理用にJSONで出す
```

Claude Code の中からは `/improvements`（一覧を見る）と `/improve-request <要望ID>`（その要望のとおりに直して公開する）で同じことができます。

宛先は既定で本番です。ローカルの `pnpm run preview` に向けるときだけ `--base http://localhost:8787` を付けるか、`.env.local` に `HR_APP_URL` を書きます。鍵が未設定のときは発行画面と書き込み手順を出して止まり、鍵の値そのものは画面にもログにも出しません。

### 鍵の置き場所（1Password を既定に、無くても動く）

鍵は次の順で探し、最初に見つかったものを使います。1Password が入っていない環境でも下の段で動きます。

| 順 | 置き場所 | 設定のしかた |
| --- | --- | --- |
| 1 | 環境変数 | `HR_AGENT_KEY=…`（その場だけ差し替えたいとき） |
| 2 | 1Password | 鍵を保管庫に入れ、場所だけを `HR_AGENT_KEY_OP_REF=op://保管庫/項目名/credential` に書く |
| 3 | OSのキーチェーン | `security add-generic-password -s hr-agent-key -a "$USER" -w` |
| 4 | `.env.local` | `HR_AGENT_KEY=…` の1行 |

どこから読めているかは `pnpm improvements key` で確かめられます（出るのは置き場所の名前だけで、鍵の値は出ません）。

### 鍵で何ができるか

画面から発行した鍵には、発行した時点の**会社が焼き込まれます**。その鍵でできるのは次の2つだけです。

- その会社の要望を読む
- **その鍵で受け取った**要望の状態を変える

他社の要望は、要望IDを直接指しても「見つかりません」としか返りません。受け取っていない要望も状態を変えられません。どちらもサーバー側で断っています。

「対応済み」にできるのは、公開まで届いて `--release` に公開先（本番URL・版の名前・確認依頼の番号）を書いたときだけです。届かなかったときは `--reason` を使い、状態は「対応中」のまま理由だけが残ります。書き戻した記録は要望の詳細画面の「操作の履歴」に、どの鍵が・いつ・どの公開で変えたかとして残り、人がその画面から差し戻せます。

## 品質確認

```bash
pnpm run check:docs
pnpm run typecheck
pnpm run test
pnpm run test:coverage
```

Cloudflare へ配る構成をローカルで確認するときは `pnpm run cf:dry-run` の後に `pnpm run check:bundle-size` を実行します。使用可能なコマンドの正本は [package.json](./package.json) です。

## 文書の入口

- [製品仕様](./docs/product/spec.md) — 画面・評価制度の要件
- [現在の残課題](./docs/product/backlog.md) — 未解決事項の current SSOT
- [システム仕様](./system-spec/index.md) — API・データ・認証の契約
- [アーキテクチャ](./architecture/index.md) — 構成と設計判断
- [デプロイ時の注意](./docs/deploy-notes.md) — migration、配布、スモーク確認
- [30思考法レビュー](./docs/reviews/elegant-review-2026-08-13.md) — 今回の検証方法・改善・PASS根拠

## 本番運用とデータの注意

本番配布は `main` のコミットを [Deploy workflow](./.github/workflows/deploy.yml) から行います。未適用 migration がある場合は、検査・ビルド完了後に本番DBをバックアップし、migration適用と未適用0件の再確認を済ませてから自動で配布します。[Migration workflow](./.github/workflows/migrate.yml) は復旧・先行適用用です。詳しい順序と復旧判断は [デプロイ時の注意](./docs/deploy-notes.md) に集約しています。

このリポジトリは Public です。従業員の個人情報、実際の評価・給与データ、認証情報をコミットしないでください。`data/` には個人情報を含まない制度定義と匿名化サンプルだけを置き、秘密値は `.dev.vars` またはデプロイ環境の Secrets で管理します。

## ライセンス

MIT License. 詳細は [LICENSE](./LICENSE) を参照してください。

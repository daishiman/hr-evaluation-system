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

改善要望を作業指示文として払い出す読み取り API（`GET /api/improvements`）だけは、鍵が要ります。無くても投稿・閲覧は動き、払い出しのときだけ設定案内が出ます。鍵はシステム全体管理者が画面から発行できます（メニュー「Claude Code 連携の鍵」＝ `/system/agent-keys`。押すと乱数で作られ、その場で1回だけ表示します）。ターミナルから設定する場合は `openssl rand -base64 32` で作り、`.dev.vars` の `AGENT_API_KEY` に置きます（本番は `pnpm exec wrangler secret put AGENT_API_KEY`）。どちらの鍵でも通り、見る順番は画面発行 → 環境変数です。手順の詳細は [デプロイ注意 §5](docs/deploy-notes.md) にあります。

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

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

改善要望を作業指示文として払い出す読み取り API（`GET /api/improvements`）だけは、通行証が要ります。無くても投稿・閲覧は動き、払い出しのときだけ設定案内が出ます。通行証は `pnpm improvements login` で受け取り、システム全体管理者がブラウザで承認します（メニュー「Claude Code連携（システム開発者専用）」＝ `/system/agent-keys`）。同じ画面には古い方式の鍵も残しています（用途の名前を付けて発行すると乱数で作られ、その場で1回だけ表示します。同時に10本まで持て、1本だけ止めても他は動き続けます）。ターミナルから設定する場合は `openssl rand -base64 32` で作り、`.dev.vars` の `AGENT_API_KEY` に置きます（本番は `pnpm exec wrangler secret put AGENT_API_KEY`）。どれでも通り、**見る順番は通行証 → 画面発行の鍵 → 環境変数 `AGENT_API_KEY`** です。環境変数の鍵は同じ画面から受け付けを止められます。手順の詳細は [デプロイ注意 §5](docs/deploy-notes.md) にあります。

利用者を追加したときの初期パスワードは、`.dev.vars` に `CREDENTIAL_ENC_KEY` を置くと暗号化して控えに残り、一覧の行からあとで開けます。値は `openssl rand -base64 32` で作ります（本番は `pnpm exec wrangler secret put CREDENTIAL_ENC_KEY`）。無くても追加は動き、そのときはその場でメモする案内が出ます。詳細は [デプロイ注意 §6](docs/deploy-notes.md) にあります。

## Claude Code から改善要望を呼び出して直す

利用者が画面から送った改善要望を、このリポジトリから直接読み出して着手できます。毎回 URL や鍵を打つ必要はありません。

1. **この端末を通す** — ターミナルで `pnpm improvements login` を実行します。合言葉（例 `ABCD-2345`）が出たまま待ちます。
2. **ブラウザで承認する** — システム全体管理者で [/system/agent-keys](https://hr-evaluation-system.daishimanju.workers.dev/system/agent-keys) を開き、合言葉を入れて「この端末を通す」を押します。ターミナルの表示が進み、通行証が `.env.local` に書き込まれます（値は表示しません。`.env.local` は追跡されません）。
3. **呼び出す** — 次のどれかを実行します。

```bash
pnpm improvements list                         # 手つかずの要望を一覧で見る
pnpm improvements get <要望ID>                 # 1件の作業指示文を読む
pnpm improvements get <ID> <ID>                # まとめて読む（最大10件）
pnpm improvements review <ID> --pr <確認依頼>  # 確認依頼を出した（レビュー待ちにする）
pnpm improvements done <ID> --pr <確認依頼>    # 確認依頼が取り込まれた（対応済みにする）
pnpm improvements failed <ID> --reason <理由>  # 直しきれなかった理由を残す
pnpm improvements key                          # 通行証の在り処だけを確かめる（値は出ません）
pnpm improvements login                        # ブラウザで承認して、この端末を通す
pnpm improvements list --json                  # 機械処理用にJSONで出す
```

Claude Code の中からは `/improvements`（一覧を見る）と `/improve-request <要望ID>`（その要望のとおりに直して公開する）で同じことができます。

宛先は既定で本番です。ローカルの `pnpm run preview` に向けるときだけ `--base http://localhost:8787` を付けるか、`.env.local` に `HR_APP_URL` を書きます。通行証が未設定のときは `login` の手順を出して止まり、通行証の値そのものは画面にもログにも出しません。

### 通行証は2本立て（毎回、短い方を取り直す）

`login` で受け取るのは長い方の通行証だけです。実際に要望を読むときは、その場で**15分で切れる短い通行証**を取り直して使います。短い方はディスクに書きません。長い方は90日で切れ、切れたら `pnpm improvements login` からやり直します。通した端末は `/system/agent-keys` の「通した端末」から1台ずつ止められ、止めた瞬間から読み取りも取り直しも通らなくなります。

### 通行証の置き場所（1Password を既定に、無くても動く）

通行証は次の順で探し、最初に見つかったものを使います。1Password が入っていない環境でも下の段で動きます。

| 順 | 置き場所 | 設定のしかた |
| --- | --- | --- |
| 1 | 環境変数 | `HR_AGENT_TOKEN=…`（その場だけ差し替えたいとき） |
| 2 | 1Password | 値を保管庫へ移し、`.env.local` を `HR_AGENT_TOKEN=op://保管庫/項目名/credential` に書き換える |
| 3 | OSのキーチェーン | `security add-generic-password -s hr-agent-token -a "$USER" -w` |
| 4 | `.env.local` | `HR_AGENT_TOKEN=…` の1行（`login` が書き込む先） |

値が `op://` で始まるときは、台本が自分自身を `op run --` で起動し直します。1Password が値を**その処理の環境変数にだけ**渡すので、平文はファイルにも画面にも残りません。`op` が入っていない環境ではそのまま3・4の段で動きます。どこから読めているかは `pnpm improvements key` で確かめられます（出るのは置き場所の名前だけです）。

長命の鍵（`HR_AGENT_KEY`）は**古い方式**です。使えば動きますが、実行のたびに移行の案内が出ます。画面の「鍵を発行する（古い方式）」も当面残しますが、新しく作る必要はありません。

### 通行証・鍵で何ができるか

通行証には、承認した人の**会社が焼き込まれます**（画面から発行した鍵も同じです）。できるのは次の2つだけです。

- その会社の要望を読む
- **その端末で受け取った**要望の状態を変える

他社の要望は、要望IDを直接指しても「見つかりません」としか返りません。受け取っていない要望も状態を変えられません。どちらもサーバー側で断っています。

要望は「未対応 → 対応中 → レビュー待ち → 対応済み」と進みます。要望を受け取った時点で「対応中」になり、変更内容の確認依頼を出すと `review` で「レビュー待ち」、その確認依頼が取り込まれると `done` で「対応済み」になります。**レビュー待ちを飛ばして対応済みにはできません**（サーバー側が断ります）。取り込まれずに終わったものが完了扱いで一覧から消えないようにするためです。直しきれなかったときは `--reason` を使い、状態は「対応中」のまま理由だけが残ります。

`--pr` には確認依頼のURLか番号を書きます（v53 までの `--release` という書き方も、そのまま受け続けます）。書き戻した記録は要望の詳細画面の「操作の履歴」に、どの鍵が・いつ・どの確認依頼で変えたかとして残り、人がその画面から差し戻せます。

## 使い方

### 役割とログイン後のホーム

| 画面上の役割 | ホーム | 主な操作 |
| --- | --- | --- |
| システム全体管理者 | `/system` | 会社・利用者の管理、操作対象会社の制度設定 |
| 会社の管理者 | `/admin` | 自社の制度設定・評価運用・社員の登録 |
| マネージャー | `/manager` | 直属メンバーの回答状況の確認、評価の作成・確定 |
| 一般 | `/me` | 自分の実績報告と、確定した評価結果の確認 |

使える範囲は、役割、所属・操作対象の会社、本人・直属上長の関係、等級によって決まります。権限の正本は [ルートとアクセス](./system-spec/routes-and-access.md)、全画面の一覧は [ルート台帳](./system-spec/route-ledger.json) です。

### 最初にすること

1. `/login` でメールアドレスとパスワードを入力します。ログイン後は上のホームへ移り、「次にやること」を確認できます。
2. 管理者が発行した仮のパスワードの間は、画面上部に変更の案内が出続けます。`/account/password` で10文字以上の新しいパスワードに変更してください。案内が表示されていても操作は続けられます。
3. 右上のアカウントメニューから `/account`（自分の情報）を確認します。本人が変更できる項目は、会社の管理者が `/admin/members/policy` で決めます。
4. システム全体管理者は、サイドバーの「操作する会社」で対象を確認・変更してから会社別の操作をします。未選択なら、有効な実会社の先頭が既定で選ばれます。

会社の利用者は `/admin/members` で登録・アカウント発行を行います。

ローカルの `pnpm run db:seed:local` で投入する動作確認用アカウントは次のとおりです。共通パスワードは `Hyoka2026!demo` で、ローカル専用です。

| 役割 | メールアドレス |
| --- | --- |
| システム全体管理者 | `super@hyoka-demo.jp` |
| 会社の管理者 | `admin@kyufu.hyoka-demo.jp` |
| マネージャー | `manager@kyufu.hyoka-demo.jp` |
| 一般 | `e1@kyufu.hyoka-demo.jp` |

`kyufu` は会社ごとに `sakura`（さくら福祉会）、`mirai`（みらい支援ネット）に置き換えられます。

### 制度の設定と半期ごとの評価

会社の管理者は `/admin/setup`（制度設定ガイド）を開いてください。設定と運用の6ステップが依存する順番に並び、現在の登録件数・状態・次の操作を確認できます。昇給・賞与も扱う場合は、`/admin/kgi`（事業所KGIの達成率）と `/admin/raises`（昇給の設定）も確認します。

制度の準備ができたら、半期ごとに次の流れを進めます。

1. 会社の管理者が `/admin/forms` でアンケートの下書きを作り、回答者プレビューを確認して公開します。
2. 対象者が `/me/forms` で受付中の自分のアンケートに回答し、提出します。途中で下書き保存もできます。
3. 上長が `/manager/cycles` で回答状況を確認して提出済みの回答から評価を作り、評価詳細で判定理由を確認して確定します。
4. 本人が `/me/results` で確定した自分の評価結果を確認します。

- 回答の本文は提出するまで本人だけが読めます。提出済みの回答だけが評価作成の対象です。
- 本人の結果画面 `/me/results` には確定済みの評価だけが表示されます。自分自身の評価は自分で確定できません。
- アンケートには作成時点の制度が保存されます。制度を直しても作成済みの版には自動反映されず、確定済み評価も当時の制度と結果のまま残ります。
- `/f/[token]` の配布用URLでもログインが必要です。回答できる等級と受付期間の条件も適用されます。

アンケートの中身だけを確認する場合は `/forms` を開きます。画面の目的・制度・用語の詳しい説明は [製品仕様](./docs/product/spec.md) を参照してください。

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
- [30思考法レビュー](./docs/reviews/elegant-review-2026-10-14.md) — 今回のワークツリーの検証・共通化・確認結果（[前回のレビュー](./docs/reviews/elegant-review-2026-10-02.md)）
- [エージェント向けの規約](./AGENTS.md) — Claude Code・Codex 共通。キットの扱い、配色の優先順位、改善要望の手順
- 生成物と記録 — `specs/`・`features/`・`tasks/`・`docs/requirements/` は開発の計画づくり（dev-graph・system-dev-planner）が作った文書、`.dev-graph/`・`eval-log/` はその状態と実行の記録（端末ごとに残り、git では共有しない）で、どれも正本ではありません。画面と振る舞いは製品仕様、API・データ・認証の契約はシステム仕様、構成と設計判断はアーキテクチャを正とし、食い違ったら生成物の側を直します。

## 本番運用とデータの注意

本番配布は `main` のコミットを [Deploy workflow](./.github/workflows/deploy.yml) から行います。未適用 migration がある場合は、検査・ビルド完了後に本番DBをバックアップし、migration適用と未適用0件の再確認を済ませてから自動で配布します。[Migration workflow](./.github/workflows/migrate.yml) は復旧・先行適用用です。詳しい順序と復旧判断は [デプロイ時の注意](./docs/deploy-notes.md) に集約しています。

このリポジトリは Public です。従業員の個人情報、実際の評価・給与データ、認証情報をコミットしないでください。`data/` には個人情報を含まない制度定義と匿名化サンプルだけを置き、秘密値は `.dev.vars` またはデプロイ環境の Secrets で管理します。

## ライセンス

MIT License. 詳細は [LICENSE](./LICENSE) を参照してください。

`aidd-agent-kit/` 配下（と、そこから `.claude/` `.agents/skills/` `.codex/agents/` へ配置されるキット由来のファイル）は同梱の Apache License 2.0 に従います。詳細は [aidd-agent-kit/LICENSE](./aidd-agent-kit/LICENSE) と [NOTICE](./aidd-agent-kit/NOTICE) を参照してください。

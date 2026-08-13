# Phase 1 — 思考リセット・俯瞰レポート

調査日: 2026-08-13
対象: 現在のワークツリー（既存レビューの結論を前提にせず、ファイル・実行結果から再構成）
工程境界: 分析のみ。製品コード、仕様正本、残課題リストは変更していない。Phase 2 の30思考法分析と実装には進んでいない。

## 1. 今回確かめた事実

- Next.js 16 + OpenNext + Cloudflare Workers + D1 + Better Auth の既存アプリである（`package.json`、`wrangler.jsonc`）。
- 4ロール（SUPER_ADMIN / COMPANY_ADMIN / MANAGER / EMPLOYEE）、複数会社を `company_id` で分離する構成である（`docs/product/spec.md` §1〜2、`src/lib/session.ts`、`src/db/schema.ts`）。
- `src/app/**/page.tsx` は **42ルート**。このうち `/` と `/admin/masters/kpi-categories` は転送入口で、ほかに `src/app/not-found.tsx` がある。
- Route Handler は **22ルート**、D1スキーマは認証・業務・監査を合わせて **40テーブル**ある。
- テストは `src/` に **86ファイル**ある。業務計算、権限、版管理、取込、UI契約、各ロールのダッシュボードまで含む。
- 現在のワークツリーは調査開始前から多数の未保存差分を含む。今回の調査ではそれを戻さず、現在ファイルを観測対象にした。
- `pnpm install --frozen-lockfile` で欠落していたmacOS用任意バイナリを依存領域だけに復元後、`pnpm run preview` はビルド・型検査を通過し、Workers相当の `http://localhost:8787` で起動した。
- `/login` は 200、未ログインの `/` は `/login` へ 307。HSTS、CSP、Permissions-Policy、Referrer-Policy、`nosniff`、`DENY` をレスポンスで確認した。
- 既存の認証付き巡回スクリプトを現在のpreviewへ実行し、4ロールで **のべ287ページを200描画**した（全体管理者106、会社管理者106、上長80、本人42の探索経路から、権限上200になるページを集計）。
- 同じ巡回で「40文字を超える文」が **141のロール×画面インスタンス**に出た。中心は `/criteria`、`/admin/scheme`、`/admin/raises`、フォーム内容・回答詳細、評価詳細。長いURL、計算式、会社が登録する設問や確定済み理由も含むため、141件をそのまま書き換え対象とはしない。
- アプリ内ブラウザはこのセッションに接続されていなかったため、スクリーンショットによる目視は未実施。HTML、CSS、画面コード、認証付き実描画を事実の範囲とした。

## 2. 全ページ一覧

### 共通・認証・振り分け（7）

| ルート | 役割 |
|---|---|
| `/` | ロール別ホーム、またはログインへ振り分け |
| `/login` | メールアドレスとパスワードでログイン |
| `/account` | 自分の情報を確認し、会社のポリシーで許された項目だけ編集 |
| `/account/password` | パスワード変更 |
| `/forms` | 自社アンケートの中身を評価期間ごとに確認 |
| `/forms/[id]` | 1本のアンケート内容を回答せずに確認 |
| `/f/[token]` | 配布URL。ログイン後、回答可否に応じて回答画面か確認画面へ案内 |

### 自分の評価（6）

| ルート | 役割 |
|---|---|
| `/me` | 自分の回答状況、結果、推移のホーム |
| `/me/forms` | 自分が回答できるアンケート一覧 |
| `/me/forms/[id]` | 回答、下書き、提出 |
| `/me/results` | 確定済み結果の期間別一覧 |
| `/me/results/[id]` | 1件の結果と判定理由 |
| `/me/responses/[id]` | 保存済み回答の詳細確認 |

### 評価する側・基準確認（6）

| ルート | 役割 |
|---|---|
| `/manager` | 直属メンバーの未回答・要対応を示すホーム |
| `/manager/members` | 閲覧可能なメンバー一覧 |
| `/manager/members/[id]` | 個人プロフィールと評価推移 |
| `/manager/cycles` | 期間ごとの提出状況、集計、評価確定 |
| `/manager/evaluations/[id]` | 点数、ランク、根拠、昇格・昇給可否の詳細 |
| `/criteria` | MANAGER以上が評価基準を確認 |

### 会社の制度設定・評価運用（19）

| ルート | 役割 |
|---|---|
| `/admin` | 制度準備→評価運用→確認の現在地と次の一手 |
| `/admin/setup` | 制度設定の依存順を示すガイド |
| `/admin/masters` | 等級の名前・水準・目標数 |
| `/admin/masters/requirements` | 等級要件（支援・運営） |
| `/admin/masters/promotion` | 昇格点と点数外要件 |
| `/admin/behavior` | 行動指針セット、等級割当、観点、段階文言 |
| `/admin/scheme` | KPI・評価セットの入口と進捗 |
| `/admin/scheme/[group]` | 等級区分で使うKPIを選ぶ手順1 |
| `/admin/scheme/[group]/criteria` | 選んだKPIのA〜E基準を決める手順2 |
| `/admin/cycles` | 半期の評価期間を作成・管理 |
| `/admin/forms` | 期間×等級×版のアンケート一覧と作成 |
| `/admin/forms/[id]` | アンケート組み立て、確認、公開 |
| `/admin/forms/[id]/responses` | 回答対象者と提出状況の一覧 |
| `/admin/members` | 社員一覧、絞り込み、CSV取込、アカウント発行 |
| `/admin/members/[id]` | 社員情報、利用状態、パスワード再発行 |
| `/admin/members/policy` | 本人が変更できるプロフィール項目を設定 |
| `/admin/kgi` | 事業所×期間のKGI達成率と係数 |
| `/admin/raises` | 昇給条件、金額、調整、履歴 |
| `/admin/masters/kpi-categories` | 旧入口。`/admin/scheme` へ転送 |

### システム全体管理（4）

| ルート | 役割 |
|---|---|
| `/system` | 全社横断ホームと操作対象会社の入口 |
| `/system/companies` | 会社一覧、追加、停止 |
| `/system/users` | 全社の利用者一覧と会社絞り込み |
| `/system/users/[id]` | 利用者の所属・役割・状態等を変更 |

### 仕様とのずれ

- `docs/product/spec.md` §3 の画面一覧には `/admin/forms/[id]/responses` と `/me/responses/[id]` の独立した説明がない。
- 同仕様は番号の重複・欠番を含むため、実装の42ルートを一読で数えられない。Phase 2以降で、画面の役割を変えず一覧だけ実装と同期する価値がある。

## 3. 中央の業務オブジェクト

```text
会社
├─ 事業所
├─ 利用者 ─ 上長関係 / ロール / 等級 / 本人編集ポリシー
├─ 制度定義
│  ├─ 等級 ─ 等級要件 / 昇格要件 / 昇格点
│  ├─ 行動指針セット ─ 観点 ─ 段階
│  ├─ KPIカテゴリ ─ KPI項目 ─ 設問 / 参考配点 / ランク基準
│  └─ 等級別配点ルール ─ 評価セット ─ 選択項目 / ランク比率
├─ 評価期間
│  └─ アンケート（版）─ 設問 ─ 回答 ─ 回答値
│                         └─ 評価 ─ KPI / 行動 / 等級要件 / 昇格ゲートのスナップショット
└─ 報酬運用
   ├─ 事業所KGI実績 / 係数 / 改定履歴
   └─ 昇給方針 / パターン / 特例 / 改定履歴
```

中心は「会社×人×半期」であり、評価1件の数え方は `1人 × 1評価サイクル`。制度定義はフォーム作成時・評価確定時にスナップショットされ、後のマスタ変更で過去結果を動かさない設計である。

## 4. 主要ユーザーと業務フロー

### EMPLOYEE / 評価を受ける人

1. ログインし、必要なら仮パスワードを変更する。
2. `/me` で今期の未回答を把握する。
3. `/me/forms/[id]` で実績を回答し、提出する。
4. 確定後に `/me/results/[id]` で結果と理由、推移を確認する。

### MANAGER / 評価する上長

1. `/manager` で直属メンバーの未回答・未確定を把握する。
2. `/manager/cycles` で提出状況と集計対象を確認する。
3. `/manager/evaluations/[id]` で根拠を確認し、確定する。
4. `/manager/members/[id]` で本人のプロフィールと期ごとの変化を振り返る。
5. 自分自身の評価については `/me/*` を使う。

### COMPANY_ADMIN / 制度と運用の責任者

1. `/admin` の「次の一手」から不足している設定へ進む。
2. 等級・要件 → 行動指針 → KPI・評価セットの順に制度を整える。
3. 評価期間 → アンケート作成・公開 → 回答状況 → 評価集計・確定を進める。
4. 事業所KGIと昇給設定を補い、結果の説明可能性を保つ。
5. 社員・権限・仮パスワードを管理する。

### SUPER_ADMIN / 全社運用者

1. 会社と全利用者を管理する。
2. サイドバーで操作対象会社を1社選ぶ。
3. 以後はCOMPANY_ADMINと同じ会社別フローを、その1社に限定して行う。

## 5. 代表画面

**代表画面は `/admin` とする。**

理由は、アプリの価値が単なるマスタ編集ではなく、「制度準備→アンケート運用→評価確定」を止めずに進めることにあり、`AdminDashboard` がその3段階、例外（締切後の未確定・確定者不在）、次の一手、暫定値を一画面で統合しているため。共通の `PageTitle`、Card、Badge、Bar、DefList、ReasonNote、主要CTAも同時に観察でき、全体の設計品質を最もよく代表する。

回答体験の代表は `/me/forms/[id]`、高密度な説明体験の代表は `/criteria`、評価判断の代表は `/manager/evaluations/[id]` とする。Phase 3の全画面確認では、この3画面を `/admin` の衛星画面として優先する。

## 6. 共通構造とページ固有構造

### 共通構造

- `AppShell`: 左サイドバー、固定ヘッダー、本文幅、仮パスワード警告。
- `AppSidebar` + `src/lib/nav.ts`: ロール別・動詞別のナビ、現在地、SUPER_ADMINの会社切替、PC折りたたみ、1023px未満の引き出し。
- `AccountMenu`: 自分の情報、パスワード、ログアウト、明るさ切替。
- `ui.tsx`: Button、LinkButton、選択部品、Badge、Card、PageTitle、EmptyState、ReasonNote、数値表示等の正本。
- `globals.css`: 意味トークン、Light/Dark、文字段、余白、カード、表のカード化、sticky、focus、coarse pointer、reduced motion。
- `DataTable`: 同じ列定義から広幅の表と狭幅のカードを生成。
- `StickyActionBar` / sticky PageTitle: 長い編集画面で現在地と保存先を維持。

### ページ固有構造

- 各ロールのダッシュボードは、DB取得と「次に何を示すか」の純粋モデルを分離。
- 制度設定は等級・要件・行動指針・KPI選択・ランク基準ごとの専用Editor。
- アンケートは `FormBuilder`、確認専用 `FormPreview`、回答用 `FormAnswer` を分離。
- 評価は `EvaluationDetail`、推移は `EvaluationTrend` / Charts。
- 利用者管理はSelfProfile、ProfilePolicy、PasswordReissue、MembersFilter。
- KGI・昇給は制度値、実績、改定履歴を同じページ内で段階表示。

## 7. 第一印象のUI/UX評価

### 確認できた長所（事実）

- ログイン画面は1画面1目的で、タイトル、説明、2入力、主要操作、復旧案内だけに絞られている。
- ナビはシステム用語ではなく「制度を順番に設定する」「評価を進める」のような業務の動詞で分類される。
- 管理ホームは全機能を平置きせず、データ状態から1件の「次の一手」を選ぶ。
- EMPLOYEEへ配点・閾値を渡さない、他社IDを会社境界で止める、回答内容とフォーム内容の閲覧権限を分ける設計が、画面とAPIの両方にある。
- 空・停止・確定済み・未設定を黙らせず、ReasonNote、Badge、EmptyStateで理由と解決先を示す方針が共通化されている。
- 文字サイズ、意味色、タップ領域、focus、reduced motion、狭幅カード化、stickyの適用方針がCSSと契約テストに落ちている。

### Phase 2へ渡す可逆な仮説

- **最大の改善余地は装飾ではなく情報密度。** 現状は信頼感のある業務UIだが、`/criteria`、評価詳細、フォーム詳細では、設問・計算式・閾値・理由・注記が同じ視野へ積み上がり、主判断が埋もれる可能性が高い。
- COMPANY_ADMINのサイドバーは業務をMECEに分けている一方、会社別メニューだけで14項目前後あり、日常運用と低頻度の制度変更を同じ恒常ナビで毎回読む負担が残る可能性がある。
- `Card`、`ReasonNote`、小見出しの反復は一貫性を作るが、重要度の違う情報が似た器へ入ると「整っているが平坦」に見える可能性がある。追加装飾ではなく、削る・束ねる・開示を遅らせる方向で検証すべき。
- MANAGER/COMPANY_ADMINは「他者を評価する仕事」と「自分が評価を受ける仕事」を同じシェルで持つ。ナビ上は分離済みだが、ホームの第一優先がどちらかは運用頻度で再検証する価値がある。
- 40文字超警告は、必要な制度原文と、UI側が分割できる説明が混在している。原文を改変せず、ラベル・要約・詳細開示・式の専用表示を使い分けることが有力。

## 8. Phase 2へ渡す論点（優先順）

1. **主判断を守る情報階層**: `/criteria`、`/manager/evaluations/[id]`、`/me/forms/[id]` で「最初に判断する1点」と「必要時に読む根拠」を分ける。
2. **全画面の密度分類**: 287描画の警告141件を、制度原文・式/URL・生成理由・アプリ固定文へ分類し、固定文と器だけを改善対象にする。
3. **日常運用と制度変更の距離**: `/admin` の次の一手を主導線として保ちつつ、恒常ナビの認知負荷を測る。
4. **仕様と実装の画面一覧同期**: 補助2画面を仕様へ明記し、42ルートを役割別に数えられるようにする。
5. **全幅目視の未実施**: backlogの `UX-001`、`UX-002`、`UX-004`、`UX-018` と合わせ、375 / 768 / 1280 / 1600pxで全ページの折返し、sticky重なり、表→カード切替を検証する。
6. **代表画面の一貫性**: `/admin` の「次の一手」と同じ明快さを、MANAGERとEMPLOYEEのホーム、評価詳細の終了体験まで連鎖させる。
7. **視覚回帰の証拠**: 現状は契約テストとHTML巡回が強い一方、スクリーンショット比較がない。Phase 3で目視後、代表画面だけ固定化する候補とする。

## 9. 証拠の入口

- 製品の役割・画面・入力・表示契約: `docs/product/spec.md`
- current残課題: `docs/product/backlog.md`
- 画面実装: `src/app/**/page.tsx`
- ナビ: `src/lib/nav.ts`、`src/components/AppSidebar.tsx`
- 共通シェル: `src/components/AppShell.tsx`
- 共通UIとトークン: `src/components/ui.tsx`、`src/app/globals.css`
- 認可: `src/lib/session.ts`
- データモデル: `src/db/schema.ts`
- 評価計算: `src/lib/evaluate.ts`、`src/lib/domain/scoring.ts`
- フォーム生成: `src/lib/form-build.ts`
- 実描画巡回: `scripts/scan-rendered-text.mjs`
- システム不変条件: `system-spec/*.md`
- 既存テスト: `src/**/*.test.ts`

## 10. Phase 1ゲート

- 思考リセット: 充足。既存成果物を削除せず、既存レビューのPASSを継承せず再観測した。
- Evidence: 充足。仕様、コード、DB、テスト、Workers preview、認証付き287描画を照合した。
- Decide: 充足。代表画面を `/admin`、中心課題仮説を「高密度画面の情報階層」とした。
- Draft: 充足。本レポートをPhase 1成果物とした。
- Validate: 充足。preview build、HTTP応答、4ロール巡回を実行した。スクリーンショット目視だけ接続制約で未実施。
- Diff: 充足。事実と可逆な仮説を分離し、Phase 2の論点を優先順で残した。

ロードしたスキル: `app-orchestrator` / `improve-app` / `app-excellence` / `browser:control-in-app-browser`。
次工程: 親工程の指示があるまでPhase 2・製品実装へ進まない。

---

# Phase 2〜4 — 30思考法の統合、改善、最終検証

実施日: 2026-08-13
モード: 追加開発・成果物先行。既存未コミット差分を利用者所有として保持し、削除・巻き戻しはしていない。外部公開はしていない。

## 11. 指定された30思考法をどう適用したか

以下は依頼で指定された30種と分析結果の1対1の記録である。補助的に使った脅威モデリング、状態機械、FMEA等はこの30種の代替として数えない。

| # | 思考法 | このアプリでの適用と結論 |
|---:|---|---|
| 1 | 批判的思考 | 287描画・既存テスト成功を品質保証とみなさず、対象者スコープ、負系、保存失敗を再検証した。 |
| 2 | 演繹思考 | 「回答本文は管理者以上」「MANAGERは直属のみ」「本人結果は確定後」という前提からAPI・画面の許可条件を導いた。 |
| 3 | 帰納的思考 | export、評価、メモ、期限延長で反復する「会社一致だけで許可」の欠陥から目的別認可不足を一般化した。 |
| 4 | アブダクション | ホームだけ直属に絞れていた証拠から、roleによる列制御とviewerIdによる行制御の混同を最善説明として特定した。 |
| 5 | 垂直思考 | 画面→loader→query→API→D1まで追い、直属条件と原子性がどこで失われるかを特定した。 |
| 6 | 要素分解 | UI、業務ロジック、認可、状態、データライフサイクル、仕様・テストへ分け、共有契約の不足を切り出した。 |
| 7 | MECE | 42ルートを役割群へ、権限をself/direct-report/same-company-other/other-company×操作へ分け、漏れと重複を検査した。 |
| 8 | 2軸思考 | 42ルートを利用頻度×判断密度で分類し、高頻度・高密度の回答、評価、回答状況を代表改善対象にした。 |
| 9 | プロセス思考 | 等級・要件→行動指針→KPI→評価期間→フォーム→回答→評価→確定→結果の依存順で改善した。 |
| 10 | メタ思考 | 200描画巡回が非200・操作状態・無効token・4幅を黙って落とす検査設計自体の欠陥を見直した。 |
| 11 | 抽象化思考 | 42画面の機能群を「会社×人×評価期間の評価ケース」という中心対象へ抽象化した。 |
| 12 | ダブル・ループ思考 | 文長・部品統一・200応答を品質の代理指標とする前提を疑い、業務完了と失敗回復を受入基準へ戻した。 |
| 13 | ブレインストーミング | ナビ圧縮、検索、通知、ウィザード、ケース管理を発散し、既存構造を活かす評価作業キュー＋ケース型画面へ収束した。 |
| 14 | 水平思考 | ページ単位でなく変更イベントから見て、CSV取込だけdry-runと復元性が不足する非対称を発見した。 |
| 15 | 逆説思考 | 情報を全部見せるほど判断根拠を探しにくくなると捉え、結論・例外を先に、式・履歴を段階開示へ移した。 |
| 16 | 類推思考 | 評価1件をチケット/審査案件/カルテに類推し、状態・担当・根拠・決定・履歴を同じ作業台へまとめた。 |
| 17 | if思考 | 10倍件数、375px、不安定回線、途中DB失敗を仮定し、横溢れ、下書き、部分commitを検出・修正した。 |
| 18 | 素人思考 | 新任利用者の視点で専門語、無言の権限拒否、空状態を見直し、「評価期間」と回復導線へ統一した。 |
| 19 | システム思考 | 制度設定→フォーム版→回答原本→評価スナップショット→確定公開→昇給候補を一つの証拠変換系として扱った。 |
| 20 | 因果関係分析 | 正本矛盾、複数回答、上長列欠落、非原子的保存が下流の評価・結果へ及ぼす連鎖を追った。 |
| 21 | 因果ループ | 曖昧なデータ→不信→CSV迂回→原本がさらに曖昧になる強化ループを、正式版・snapshot・原子保存で止めた。 |
| 22 | トレードオン思考 | 権限最小化と日常操作、CSV柔軟性と安全性、設定変更と過去不変性を両立する契約を選んだ。 |
| 23 | プラスサム思考 | 共通の正本・権限・状態を一本化し、本人、上長、管理者、全体管理者の全役割で手戻りと誤解を減らした。 |
| 24 | 価値提案思考 | 価値を「項目を登録できる」から「誰がどの制度版と原本で、なぜ判定されたか再現できる」へ定義し直した。 |
| 25 | 戦略的思考 | 完全性の背骨→安全な操作→運用の閉鎖→UIの順にし、不正確な結果を見やすくするだけの改善を避けた。 |
| 26 | why思考 | 複数フォーム回答の入力順依存を5回掘り、cycle×employeeの正式な評価入力という不変条件の欠如へ到達した。 |
| 27 | 改善思考 | RED→GREEN→REFACTORを権限、正式回答、原子保存、CSV、状態、readiness、UI、全幅の順で反復した。 |
| 28 | 仮説思考 | KPI制約は旧仕様、高密度が主判断を隠す、複数openは意図でない等を履歴・コード・実描画で検証した。 |
| 29 | 論点思考 | 色や余白より、制度正本、証拠正本、権限境界、状態正本、価値終端を先に決めるべき論点とした。 |
| 30 | KJ法 | 指摘を制度・正本、原本・版・原子性、役割・状態、完了定義・価値・観測へ束ね、依存順を確定した。 |

## 12. 統合した正本と実装

### KPI契約

git履歴の後発裁定（`697e7ec`、`2080e91`）と現行domain/testを照合し、固定No.1以外は自社の全KPIから自由選択を正本とした。`kpi_reference_points`、カテゴリ、`is_monetary`、対象等級は選択禁止に使わない。`grade_point_rules` だけが1/3/6/7/8件、枠、100点、重複禁止を拘束する。仕様、system-spec、schema/API/UI/seedの説明を同期し、旧再投入scriptはfail-fastにした。

### 権限・版・保存

- `evaluation-authority.ts`: 直属/tenant、export目的、本人下書き、finalized結果を共有契約化。
- `authoritative-response.ts`: cycle×employeeの正式回答版を提出日時→フォーム版→IDで決定的に解決。
- `response-write.ts`: 回答head/answerと評価head/childrenをD1 batchへまとめ、子行失敗時に旧データが残る回帰を追加。
- 社員CSV: 列なし=変更なし、明示空=上長解除、予定グラフで循環検出。
- 回答CSV: 同一formId×CSV本文のHMAC付きdry-run tokenがなければ本取込を409で拒否。
- `form-deadline.ts` / `cycle-lifecycle.ts`: 評価期間とアンケート状態をfail-closedで統合。

### UI/UXと経路

- `/manager/evaluations/[id]` を結論→例外/再計算→全体像/根拠→コメント/確定へ再構成。
- 共通loading/error/not-foundへ回復導線を追加し、用語を「評価期間」へ統一。
- `system-spec/route-ledger.json` に42ルート、目的、対象、access class、4幅を記録。仕様から漏れていた回答一覧/回答詳細2画面も同期。
- 375pxの回答詳細で複数選択Badgeが横溢れしたため、意味を変えず折返し可能な本文表示へ変更。

## 13. RED→GREENの反復

1. **反復1（P0業務整合）**: 担当外MANAGER、非本人draft、未確定本人結果、export、複数フォーム版、子行失敗、CSV上長列の失敗テストを先に追加。小さいdomain/DB契約でGREEN化。
2. **反復2（状態・経路・体験）**: closed/planning時の回答可否、状態遷移、42ルート台帳、代表評価画面の順序、共通回復状態をRED化し、既存部品へ寄せてGREEN化。
3. **反復3（Workers preview）**: 42×4幅で1件の横溢れを検出し修正。OpenNextのredirect/404がHTTP 200のRSC digestに包まれることによる監査器誤判定も分離し、HTTP statusだけでなく`NEXT_REDIRECT` / `NEXT_HTTP_ERROR_FALLBACK;404`を判定して再検証した。
4. **Phase 4反復2（最上位目的の阻害3点）**: 初回最終判定を4条件FAILとし、終了せず再開。社員/回答CSVの部分commitと復元点なしを失敗注入でRED化し、全行検証→単一D1 batch→`import_batches`変更前snapshotでGREEN化した。`computeGroupProgress`をsetup/dashboard/cycle/formで共有し、remote全置換seedをwrite/exec前にfail-fast化した。
5. **Phase 4反復3（最終ゲート）**: 全test/docs/type/build、220 HTTP、CSV負系、変更4画面×4幅を再検証。初回に残した`SECURITY-010` / `RELIABILITY-005〜007`を解消根拠とともに履歴へ移し、4条件を再判定した。

## 14. Phase 4検証結果

### testing-excellence 4層

- Layer 1 Unit / Layer 2 Integration: Vitest **97 files pass、1 file skip、1,507 tests pass、1 test skip**。権限、正式回答版、D1失敗、CSV全ファイルrollback、復元snapshot、状態機械、readiness、remote seed guard、route台帳を含む。
- Layer 3 E2E/受入: OpenNext Workers previewで認証付き42×4ロール=168、匿名42、invalid ID/他社/他人/token=10、合計220 HTTPケースをRSC digest込みで再分類し **220/220 PASS**。4業務フローも **4/4 PASS**。
- Layer 4 infrastructure/deploy: `opennextjs-cloudflare build` PASS。D1 local binding、production bundle生成、42 page routeを確認。外部公開は依頼範囲外のため未実施。
- ルート台帳は42 route×106 route-state pair×4 role×4 widthへ **1,696契約ケース**を展開しテストで **1,696/1,696 PASS**。これは静的な期待結果/幅契約の検証であり、1,696件すべてを実ブラウザで操作した数ではない。
- 実レイアウト検査は42ページ×375/768/1280/1600= **168/168 PASS**。最初の反復で1件を検出・修正後、全件0 overflow/0 empty/0 500/0 pageerror、局所再検査も375=375pxでPASS。
- readiness統合後に変更した`/admin`、`/admin/setup`、`/admin/cycles`、`/admin/forms`も4幅 **16/16 PASS**。
- 代表4画面: 本人フォーム一覧375、評価詳細1280、評価基準768、回答CSV1600を `artifacts/phase4/*.png` に保存。in-app Browserは接続先0件で利用不能だったため、standalone Playwright + Chromeで代替した。
- 主要4フロー: 本人回答入力、MANAGERの結論→根拠→確認/再開、回答CSV dry-run tokenと変更本文409、別のopen評価期間がある再開409を確認。
- Console: product pageerror 0。`/favicon.ico` の404を1件記録（機能影響なし、黙って除外せず低リスクとして記録）。

### launch-security

- `pnpm audit`: 730依存、critical 0 / high 0 / moderate 1。
- CSP、HSTS、X-Frame-Options、nosniff、Referrer-Policy、Permissions-Policyをpreview実応答で確認。
- user入力を`dangerouslySetInnerHTML`へ渡す箇所、`eval`/動的コード実行、アプリ本体のshell実行は検出なし。inline scriptは固定のtheme/sidebar初期化だけ。
- tenant/IDOR/draft/export/tokenは今回の権限・HMAC・負系テストで防御を確認。
- **公開判定: GO（この変更のコード/ローカルpreviewゲート）**。`db:seed:remote`を削除し、`seed.mjs --remote`はseed-data import/SQL生成/ファイル書込/Wrangler実行より前に拒否、後段の実行先もlocal固定にした。critical/highは0。moderate 1件は最新版`drizzle-kit`の開発時限定transitive esbuild serve経路でproduction Workerに同梱・使用せず、強制overrideの互換性リスクを取らず`SECURITY-008`で更新窓を管理する。外部公開と本番CWV測定は依頼範囲外。

### ローカルfixture事故

remote seed guardの実プロセス試験初稿で`it.each`の引数展開を誤り、ローカル`seed.mjs`が2回実行された。remote/本番D1への接続はない。ローカルD1は会社4・利用者31のデモfixtureへ置換され、workspace/一時領域に直前backup/exportが無かったため直前内容は復元不能。生成された追跡`drizzle/seed.sql`差分は開始時版へ戻した。試験を直してremote拒否6件をGREEN化し、以後local seed/全消去は実行していない。

## 15. 最終4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | **PASS** | KPI契約、目的別権限、正式回答版、回答可否、readinessを仕様/domain/API/UI/testの同じ正本へ同期した。 |
| 漏れなし | **PASS** | 42ページ、4ロール、状態/負系、4幅、CSV復元点、remote seed境界を台帳・実装・受入証拠で覆った。 |
| 整合性あり | **PASS** | 回答保存、評価再構築、社員/回答CSVを原子的にし、失敗注入で既存値保持、成功時snapshot/hash/actor保存を確認した。 |
| 依存関係整合 | **PASS** | 制度→評価セット→評価期間→フォーム→回答→正式版→評価→確定/公開の順を共有契約とfail-closed APIで固定した。 |

**最終判定: 4条件すべてPASS。** 全test/docs/type/build、Workers preview、HTTP負系、全ページ4幅、主要業務フロー、launch-securityを再通過した。外部公開は依頼どおり行わない。

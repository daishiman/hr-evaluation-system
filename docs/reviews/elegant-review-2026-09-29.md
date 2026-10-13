# ワークツリーの30思考法レビュー（2026-09-29）

## 対象と判定範囲

対象は `feat/aidd-kit-1.11-indigo-default` の現状。キット1.11.0更新、独自テーマ契約の維持、インディゴ追加・既定化、および着手時に存在した README の使い方案内を、既存の製品・システム仕様と照合する。周辺の共有処理は、この変更の依存先として調べる。全製品の将来課題がゼロであることは判定対象にしない。

`AGENTS.md`、製品仕様、DD-003 を優先する。管理対象のキット配置を重複として削除しない。平賀配色への移行や、合格させるための保護契約テスト変更は行わない。着手前の変更と利用者のローカル記録を維持する。

## フェーズ1：思考リセット・俯瞰（完了）

既存レビューの結論を根拠にせず、作業状態・入口文書・製品契約・変更ファイルから構成を再把握した。思考リセットによる成果物の削除はない。

- 構成：Next.js/React → 共有ドメイン契約 → Drizzle/D1 → Cloudflare Workers。今回の画面設定は、明るさと配色を独立した2軸で保存する。
- 作業状態：着手時は README の使い方案内がステージ済み。キットの Windows 同期スクリプトにも変更表示があったが、再確認では内容差分なし。`.artifact-delivery/`、`.beads/`、`eval-log/` のローカル記録は対象外。
- 成熟度：release tag `v55` と本番配布 workflow がある既存アプリ。調査中の fetch で今回の変更が `origin/main` に取り込まれたことも確認した。ユーザーの作業内容を自動で取り替えない。
- 第一印象の懸念：明るさと配色の選択に、保存読込・DOM属性適用・再選択抑止・計測という同形の処理がある。共通化の候補だが、2軸の独立性と描画前初期化は守る必要がある。
- 第一印象の懸念：README の新しい役割説明・画面早見表・設定フローは、製品仕様と制度設定ガイドに重なる。利用者向けの短い入口を残し、権限や判定条件を複数箇所で再定義していないか確認する。
- 第一印象の懸念：キットの編集元と同期配置の複製は配布機構上の必須依存。見かけの重複と、保守時に別々の判断を必要とする実装の重複を区別する。

この俯瞰完了をゲートとして、9種・9種・12種の思考法を3つの SubAgent に分けて並列分析する。全結果が揃うまで改善実装を開始しない。

## フェーズ2：並列分析

3つの SubAgent による読み取り専用分析が完了。下表はそれぞれが実際に検証した問い・根拠と統合判断である。行番号は改善前のもの。全結果が揃ってからフェーズ3へ進んだ。

### 論理・構造（logic_structure_review：9種）

| 思考法 | 検証した内容・根拠 | 統合判断 |
|---|---|---|
| 批判的思考 | 保存不能でも使えるという主張を、ThemeToggle:36–51・PaletteToggle:43–58・AccountMenu:107の再mountで反証 | 保存失敗後、適用DOMと選択表示がずれる。修正する |
| 演繹思考 | spec.md:361–391の軸独立・既定属性なし・同値no-opから、選択表示は実表示に一致すべきと導出 | 再mountの復元元を適用済みDOMにする |
| 帰納的思考 | 両Toggleのstate→DOM→保存→計測が同形。表示は既存Segmented/ChoiceChipへ集約済み | 表示部品を増やさず操作hookを共有する |
| アブダクション | palette.ts:4–11,65–70の独立理由とlayout.tsx:43–47を照合 | 同じなのは操作機構。値・キー・描画前初期化は独立のまま |
| 垂直思考 | ux-patterns.tsx:270–299の数値処理を現役number-input.ts・ui.tsxと比較 | 未使用コピーが異なる仕様を持つ。アプリコピーを削除する |
| 要素分解 | 値契約・初期化・状態・DOM・保存・計測・表示に分解 | 未集約の選択操作だけをhookへ寄せる |
| MECE | palette.ts・palette-contract・0030 migration・theme-preferences統合検査で6系統を照合 | indigoの追加漏れなし。既存検査を維持する |
| 2軸思考 | 明るさ3値×配色6値、現役実装×参照コピーで分類 | 2軸を保持。実行境界上必要なCSS/配布複製は残す |
| プロセス思考 | 同値判定→状態/DOM→保存試行→記録→メニュー再表示を追跡 | 適用順を保持し、再表示時の旧保存値への巻戻りを止める |

### メタ・発想（meta_expansion_review：9種）

| 思考法 | 検証した内容・根拠 | 統合判断 |
|---|---|---|
| メタ思考 | 短さだけで評価せず、README:100–129の初回導線と制度ガイド再記述を区別 | 初回導線は残し、制度詳細は既存画面へ案内 |
| 抽象化思考 | 入口・製品契約・状態付きガイドの責務をroutes-and-access.md・nav.tsと照合 | READMEの新しい全画面対応表を廃し正本へリンク |
| ダブル・ループ思考 | 上位ロールが下位の全機能を使えるという前提をform-entry.ts・session.ts:184–185で再検証 | 回答は等級等も必要。一般利用者に/criteriaを案内しない |
| ブレインストーミング | 詳細README修正・別文書移設・既存正本への入口という3案を比較 | 入口案を採用。重複の移設や生成機構追加は不要 |
| 水平思考 | 静的6手順の共有から、setup/page.tsx:75–134の現在状態付き案内へ視点変更 | /admin/setupを主入口にする |
| 逆説思考 | 削除の副作用を点検。README:148–150の非公開注意と:152の配布URL説明を照合 | 重要注意は残す。/f/[token]のログイン必須を正す |
| 類推思考 | nav.tsの既存共有グループと両Toggleの同形処理を比較 | 操作ライフサイクルを共有し、初期化の障害分離は保持 |
| if思考 | READMEの会社なしEMPLOYEE作成例をadd-user.mjs:24,54–55→session.ts:100–102へ追跡 | 利用不能な案内を除き、既存の管理画面発行へ案内 |
| 素人思考 | 画面の呼称・開けるURL・会社選択・初回パスワードの説明を実装と照合 | 「一般」へ統一。SUPER_ADMINは対象会社を確認。操作遮断を示唆しない |

### システム・戦略・問題解決（system_value_review：12種）

| 思考法 | 検証した内容・根拠 | 統合判断 |
|---|---|---|
| システム思考 | palette→初期化→Toggle→theme-usage→API→DB→集計を追跡 | 全体連鎖は維持し、Toggleの同形処理だけを共通化 |
| 因果関係分析 | 保存失敗→DOM新値→閉鎖→再mount→旧保存値という連鎖を追跡 | 再mount時のDOM読込が最小修正 |
| 因果ループ | AccountMenu:50–62→本人1行upsert→採用率という観測ループを確認 | 同値抑止と適用後の計測を維持する |
| トレードオン思考 | 共通hookと既存2種UIの両立を検討 | 新たなProviderなしでコード削減と正確さを両立 |
| プラスサム思考 | 共通化の利用者・保守者双方への効果と配布コピー削除の損失を評価 | 保存不能端末も改善。キットの管理配置は残す |
| 価値提案思考 | READMEの入口価値と制度手順・画面台帳再掲の追加保守を比較 | 短い入口・初回操作・重要注意に集約 |
| 戦略的思考 | AGENTS・CIのmanifest一致・deployのmigration先行を照合 | project scopeと既存データ契約を守る小規模改善 |
| why思考 | ずれ→再mount→保存失敗→DOM未参照→別実装/文字列中心の検査という5why | DOM正本と操作の振る舞い検査で根本を直す |
| 改善思考 | README:103の操作継続と:116の変更必須を照合 | 初回変更案内という動作へ統一 |
| 仮説思考 | DOM読込仮説を、保存成功/失敗・既定復帰・no-op・他軸保持で反証する計画を立案 | 検証可能な小さなhookとして実装 |
| 論点思考 | ファイル数ではなく、同じ判断を別々に更新する責務を抽出 | Toggle動作・README再定義・未使用コピーを対象にする |
| KJ法 | 指摘をUI状態正本・文書正本・配布境界・データ互換性の4群へ整理 | 前2群を改善、後2群は既存検査を維持 |

### 統合した改善計画

1. 両Toggleの共通操作hookを抽出し、適用済みDOMから復元する。保存失敗→再表示→旧値へ戻す回帰検査を追加。
2. READMEを初回導線と正本リンクに集約し、役割・アクセス・配布URL・会社選択の誤案内を修正。既存仕様のMANAGER「閲覧のみ」も実装へ合わせる。
3. 未参照の `src/lib/ux-patterns.tsx` を削除。キット原本・既存表示部品を使う。Segmentedと旧計測テーブルのコメントを正本へ揃える。

1・3のコードと2の文書は独立して並列実装。実装完了後の全検査・実ブラウザ受入・4条件判定は直列に行う。大幅な構造変更は不要。UIの選択肢・配色値・API/DB契約は変更しない。

改善前判定は、矛盾なしFAIL（READMEの権限等）、漏れなしFAIL（保存失敗後の再表示）、整合性ありFAIL（DOMと選択状態）、依存関係整合PASS（配布・初期化・DB連鎖）。

### 改善前の検証基準

- `pnpm run check:docs`：PASS。リンク・台帳検査だけでは README の権限説明の誤りは検出されないため、読み取り分析による契約照合も行う。
- 型検査とテストは、当初 OS 向け optional native dependency 不足で起動失敗。lockfile を変えず `pnpm install --frozen-lockfile` で復旧した。
- 復旧後の `pnpm run typecheck`：PASS。
- 復旧後の `pnpm test`：125 files / 2,071 tests PASS、既存1 test skip。

## フェーズ3：改善と再検証

`logic_structure_review` を app-orchestrator 実行担当（コード）、`meta_expansion_review` を文書実行担当に再割当し、並列で進めた。`system_value_review` は独立した読み取り再検証担当。レビュー記録と全体検証は親が担当。改善→再検証は最大3回。

### キット境界の読み取り診断

- `verify-codex-layout.sh`：全項目OK。編集元と両manifest・実配置のpath/hash一致、1.11.0。
- `doctor-codex-layout.sh`：errors=0、warnings=34。ユーザー全体に同名スキル・custom agentが存在するため。
- `migrate-legacy-colors.mjs src --json`：終了コード1、`eligibility.status=report-only`、`source_theme=external-brand`、`applied=false`。変更適用なし。
- リポジトリ・ユーザー全体のClaude/Codex version：すべて1.11.0。古いversionなし。
- 直近backup manifestから消えた285パスに対し、`docs/`・`src/`の参照は0件。今回はキットの差し替えを行わないためsync・backup削除は実施していない。

同名skill WARNの名前一覧（複数配置をまとめると26名）：`app-excellence`、`better-auth-google-gate`、`ci-cd-pipeline`、`cloudflare-email-service`、`cloudflare-secure-deploy`、`cloudflare`、`design-judgment`、`durable-objects`、`jp-web-design`、`launch-security`、`llm-api-integration`、`llm-cost-simulator`、`mvp-first-development`、`report-design-system`、`solo-git-flow`、`testing-excellence`、`turnstile-spin`、`ux-design`、`web-perf`、`workers-best-practices`、`wrangler`、`build-app`、`improve-app`、`setup-cicd`、`undo-app`、`app-orchestrator`。custom agent WARN：`app-orchestrator.toml`。ユーザー全体のファイルは変更していない。

### 実装・受入

改善対象は、批判的・演繹・因果関係・why思考で示した実害を直す共通操作hookと、抽象化・水平・価値提案思考で示した文書の入口整理を採用した。垂直・2軸・論点思考による未使用コピーの除去も実施した。

- `use-appearance-choice.ts` に45行の共有hookを実装。ThemeToggle/PaletteToggleは値の契約と既存表示部品だけを持つ。再mountは保存値ではなく適用済みDOMを読む。
- `use-appearance-choice.test.ts` の8件は実コンポーネントのボタン属性・適用DOM・保存値を検証。保存失敗、保存値削除失敗、読込不能、再表示、既定復帰、同値抑止、軸独立を扱う。改善前に5件失敗を確認してから修正した。
- 計測層は差し替えたsinkの同期例外も隔離し、選択操作を止めない回帰検査を追加。両Toggle内のno-op文字列を探す検査1件は、上の操作検査へ置換した。
- 未参照のアプリ内参照コピー `src/lib/ux-patterns.tsx`（301行）を削除。現役のNumberField/Numとキット原本を維持。
- READMEの使い方を123行→51行へ整理。制度設定ガイドと画面台帳への案内に集約し、一般の呼称、回答URLのログイン、会社選択、アカウント発行、10文字のパスワード条件を実装へ揃えた。
- 製品仕様のMANAGERを「閲覧のみ」から実際の直属評価作成・確定へ修正。本人の結果画面の確定済み限定は `/me/results` の経路として明記。
- ManagerDashboardの「メンバー（全社員）」を、実際の閲覧範囲に合う「メンバーの一覧」へ修正。Segmentedの個数説明、旧集計テーブルのコメントも正本へ揃えた。

可視interactionはcatalog-default判定対象。結果は `REPORT_ONLY / external-brand / DD-003`。独自テーマ・2軸切替の契約を維持し、平賀配色移行は適用していない。標準profileのconformance診断は今回profileへ適用されないため参考扱いとし、生成診断は `/tmp/hr-elegant-review-design-conformance.json` へ置いた。保護された3契約テスト、T2 §5、globals.css、純粋なtheme/palette契約、キット配置の内容差分は0。

### 今回の変更とは独立した既存の論点

最終文書監査で、マネージャーが自分の個人詳細URLを直接開く際の本人向け公開範囲が未整理であることを確認した。今回、権限契約を文書だけで拡張せず、既存の異なる入口の扱いを [SECURITY-013](../product/backlog.md) に集約した。製品全体の未解決事項まで解消したという判定は行わない。

### 最終検証

型検査PASS、targeted 7 files / 41 tests PASS。全体の `pnpm run test:coverage` は126 files / 2,079 tests PASS、既存1 test skip。既存の評価・計算ドメインの網羅率は statements/branches/functions/lines とも100%。最終 `check:docs` は98件の残課題と主要リンクについてPASS。差分の空白検査もPASS。

- Cloudflare build：exit 0、Worker生成成功。公開ファイルの圧縮後容量1,891.3 KiB、上限の61.6%でPASS。
- 独立preview：`http://localhost:8788`。既存8787を停止せず、CLIで公開URL設定のみ上書き。local D1とAssetsで起動。未認証のlogin=200、manager=307、theme-choice API=401。
- 実ブラウザ：Chromeのゲストでローカルデモのログイン、managerホーム、暗い表示＋グリーン、メニュー再表示、再読込後の選択保持、自動＋インディゴへの復帰を確認。色の実表示と選択ボタンが一致することを目視。既存の評価期間・回答一覧・本人結果画面も正常に表示。
- 保存失敗の再現と修正は8件の操作検査で検証。実ブラウザに保存障害を注入したとは主張しない。
- 独立した最終差分監査は4条件PASS。既存の未解決事項は上記SECURITY-013とcurrent backlogへ残す。

#### ビルド診断7件の扱い

OpenNext 1.20.2の `workerd.js:46–47` は文字列形式の `exports` も解析へ渡し、`:17` の `in` 演算子でTypeErrorになる。`:77–78` はそれを `Failed to copy` と表示する。対象の `@esbuild-kit/esm-loader`、`ansi-styles`、`ast-v8-to-istanbul`、`chalk`、`content-type`、`js-tokens`、`strip-ansi` はすべて実在し、同じ例外を再現した。

7件はすべて `next.config.ts` の `serverExternalPackages` 対象外。`.next` の全NFTではpackage.jsonだけが参照され、JS本体は参照されていない。同じ解析の`:70`にある全体コピー分岐は対象外なので、今回のruntime依存欠落として扱わない。package・lockfile・Next/OpenNext設定は変更せず、依存追加・node_modulesパッチは不要と判断した。着手前ビルドログとの直接比較は未実施。ビルド出力の抜粋は `/tmp/hr-elegant-review-cloudflare-build-excerpt.log`（全文ではない）。

### 最終4条件

| 条件 | 結果 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | READMEの権限・認証・パスワード・会社選択と実装を照合。MANAGERの概要と画面ラベル・コメントも統一 |
| 漏れなし | PASS | 30方法すべて適用。初回導線を残し、保存失敗/再表示/旧値復帰/既定/no-op/独立2軸を操作検査で確認。6系統の既存網羅検査も維持 |
| 整合性あり | PASS | 共有hookによるDOM正本、値契約・表示部品の分離、未使用コピー除去、文書は既存正本への入口に集約 |
| 依存関係整合 | PASS | 保護契約・初期化・CSS・DB・キット境界は不変。型検査・全テスト・Worker起動・実操作とビルド診断を確認 |

フェーズ1の俯瞰→フェーズ2の3並列分析→フェーズ3のコード/文書並列実装→直列の最終検証を完了。文書の独立監査による補正を含め、改善・再検証は3回以内。使用した入口・実行・検証規律は `improve-app`、`app-orchestrator`、`testing-excellence`、catalog-default契約。最終判定は冒頭に定めた今回の変更範囲に限定する。本番反映を含む権限変更や製品全体のゼロ課題は判定していない。

# 仕様反映 受領書（比べる警告に、比べている2つのページの名前とリンクを付ける）

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-15 |
| graph_node_id | `feature-comparison-gap-two-page-links`（task は `SYS-COMPARISON-GAP-P01`〜`SYS-COMPARISON-GAP-P13`） |
| beads_id | なし（B1：親の feature が `draft`・`pending` のままで、Beads への投影が昇格の関門で止まっている。下の「制約と限界」） |
| 計画 | `.dev-graph/plans/feature-package-feature-comparison-gap-two-page-links/`（P01〜P13 の task 仕様書） |
| 要件 | [要件定義](../../../system-spec/00-requirements-definition.md) の G16・O16・I17（qa-w01〜qa-w05 で確定） |
| 判定 | **影響あり → 受入 AC1〜AC7、3画面×5状態の表、用語の表をここで決める。型と読み出しの設計は DD-012** |

## 受領した要望

2026-10-14 の依頼（画像1枚、qa-w01）で、アンケートの一覧の警告が、どのページとどのページの内容が食い違っているかを示さず、たどれないことが報告された。同じ日の追加の指示（qa-w03）は次のとおり。

> 見た目の観点で情報量が増えすぎるため、デフォルトで表示させるのではなく、ボタンを押した際に表示させるなどの工夫を施し、UI を整えてください。
>
> 文章は不要です。「こことここを改善してほしい」といったリストを表示させるだけでも構いません。
>
> 現状の内容は文章がずらずらと並び、読むのが億劫になるため、「下記の内容を変更・修正してください」といった形式で、箇条書きや表形式など、見た目が最適なものを選択して表示するようにしてください。

選択の問（qa-w02）の回答：

| 問 | 回答 |
|---|---|
| 出す画面 | 一覧・1本・使うKPIを選ぶ（使うKPIを選ぶの画面にも、ズレているアンケートへのリンク付きで出す） |
| ページ名 | 階層つき（例「KPI・評価セット › 等級1・等級2・等級3：使うKPIを選ぶ」） |
| 公開後の直し方 | この等級だけ新しい版（警告に『この等級だけ新しい版の下書きを作る』を足す） |
| 当てる範囲 | 比べる警告すべて（型と契約テストで、今後足す警告にも強制する） |

出し方（qa-w04）は、その場で開く `InlineDetail` にした。窓（`DetailDialogButton`）は使わない。理由は qa-w04 の4点（§22-4・見比べ・§22-2・文の段落を置かない）。

## 受入（AC1〜AC7）と確かめ方

feature の受入7件に番号を振り、主な確かめ方を決める。

| 番号 | 受入 | 確かめ方 |
|---|---|---|
| AC1 | 比べる警告を作る処理の全件が、2つのページ（階層つきの名前とリンク）を持つ。欠落0件 | `src/lib/domain/comparison-gap.test.ts`（状態の組み合わせの全件で `pages` が2つ、名前に「›」、`href` が台帳の道筋に合う） |
| AC2 | 3画面で、閉じた状態が1つの段・開くと2つのリンクと表が出る | `src/components/ComparisonGapNotice.test.ts`（3画面の props で描き、閉じた段・リンク2本・表を確かめる）、`src/lib/comparison-gap-source.test.ts`（3画面が部品を使う）、P07 の画面の確認（4つの幅） |
| AC3 | 『食い違』『ズレ』を含む警告が ComparisonGap 以外から作られていない | `src/lib/comparison-gap-source.test.ts`（項目の差を使うのは `comparison-gap.ts` だけ。`src/app`・`src/components`・`src/lib`・`src/actions` の文字列と地の文で、許した2ファイルと理由つきの2件の外に字面が無い） |
| AC4 | リンク先がすべてルート台帳にあり、見る人の役割で開ける。ズレの応答に他社の名前が無い | `src/lib/comparison-gap-links.test.ts`（台帳の照合・役割ごとの `href`・D1 の2社の見本で読み出しから他社の名前と id が出ない） |
| AC5 | 『この等級だけ新しい版の下書きを作る』で、その等級の版だけが増える。自社のものでない gradeId を含む createForms は何も作らず拒否する | `src/actions/forms-grade-scope.test.ts`（版が1つだけ増える・他の等級は増えない・他社の等級は理由の文で断られ0件） |
| AC6 | 表の th に scope、○ と — に読み上げの文字。4つの幅で同じ振る舞い。狭い幅でも本文が横に流れない | `ComparisonGapNotice.test.ts`（`scope="col"`・「ある」「ない」・横に流す枠）と、P07 の画面の確認（4つの幅） |
| AC7 | `pnpm test` と `pnpm run check:docs` が通り、domain のカバレッジ 100% を保つ | `pnpm test`・`pnpm run check:docs`・`pnpm run test:coverage` |

## 3画面×5状態

「閉じた1行」はどの状態でも同じ形の1つの段（注意の印・『評価項目とのズレ ◯件（足りない◯・余分◯）』・『直すところを見る』の札。狭い幅では札が次の行に回ってよい）。ズレ0件のときは何も出さない。

| 状態 | アンケートの一覧（`/admin/forms`） | アンケート1本（`/admin/forms/[id]`） | 使うKPIを選ぶ（`/admin/scheme/[group]`） |
|---|---|---|---|
| ズレ0件 | 出さない | 出さない | 出さない |
| 下書きで回答0件 | カードの末尾に1行。開くと ①1行目 ②リンク2行（使うKPIを選ぶ・このアンケート）③表 ④『設問を作り直す』（確認つき） | 見出しの下に1行。①〜③は一覧と同じで、このアンケートの行に「（このページ）」。④は出さない（同じボタンが枠の外に既にある） | 見出しの下に1行。開くと ①1行目 ②このページのリンク1行 ③アンケートごとに1行の表（アンケート（リンク）・聞いていない項目・余分に聞いている項目） |
| 下書きで回答あり | ①〜③ ④『この等級だけ新しい版の下書きを作る』 ⑤注記1行 | 同左 | 同上（行は下書きのアンケート） |
| 公開中・締め切り済み | ①〜③ ④『この等級だけ新しい版の下書きを作る』（確認つき）⑤注記1行。締め切り済みも一覧では今どおり出す | 同左 | 公開中だけ行に出す。締め切り済みと、締め切った評価期間のアンケートは出さない |
| より新しい版あり（状態を問わない） | ①〜③ ④ボタンの代わりに『第N版の下書きを開く』か『第N版を開く』のリンク ⑤注記1行（公開後か回答ありのとき） | 同左 | 同上（行はそれぞれのアンケート） |
| 締め切った評価期間 | ①〜③ ④なし ⑤『締め切った評価期間には新しい版を作れません』 | 同左 | 行に出さない |
| 評価セットの準備中 | ①〜③ ④ボタンの代わりに、残っている手順（最初の不足）へのリンク ⑤注記1行（公開後か回答ありのとき） | 同左 | 同上 |

- ⑤の注記は「公開後や回答のあるアンケートは設問を差し替えません」の1行（締め切った評価期間では上の表の文）。下書きで回答0件のときは出さない。
- ④は上の表の行の上から順に1つだけ選ぶ。見る人の役割でその操作ができなければ出さない。
- 使うKPIを選ぶの画面では、表の前に「下記の内容を変更・修正してください」の1行と、このページのリンク1行（「（このページ）」付き）を置く。もう片方のページ（アンケート）は、表の行ごとの階層つきのリンクにする。比べる相手が複数あるため、相手のリンクを行に入れる。
- 使うKPIを選ぶの画面の件数は、（アンケート×項目）の組で数える。同じ項目が2本のアンケートで足りなければ2件。

## 用語

| 用語 | 意味 |
|---|---|
| 比べる警告 | 2つのページの内容を比べて、食い違いを知らせる警告。今は「使うKPIを選ぶ」と「アンケートの設問」の比べだけ |
| ComparisonGap | 比べる警告の型。2つのページ・項目ごとの有無・件数・直す操作を必須で持つ（DD-012） |
| 2つのページ | 「使うKPIを選ぶ」（`KPI・評価セット › {区分の呼び名}：使うKPIを選ぶ`）と「このアンケート」（`アンケート › {アンケートの題名}（第N版）`。題名が空なら `{評価期間} {等級名} 実績アンケート`） |
| 足りない | 使うKPIを選ぶにあり、このアンケートで聞いていない項目（表では ○ と —） |
| 余分 | このアンケートで聞いているが、使うKPIを選ぶに無い項目（表では — と ○） |
| 直す操作 | 『設問を作り直す』『この等級だけ新しい版の下書きを作る』『第N版の下書きを開く』『第N版を開く』、評価セットの残りの手順へのリンクのどれか1つ。どれも当てはまらなければなし（注記で理由を1行） |

## 影響の判定

| 層 | 影響 | 理由 |
|---|---|---|
| 製品仕様 | あり | `docs/product/spec.md` の22章（説明文の量と出し方）に、比べる警告の形を足す（P12） |
| システム仕様 | あり | 要件定義の G16・O16・I17 は確定済み。章（ui-ux・frontend・backend・security・maintenance-ops）は compile で反映する（P12） |
| 設計 | あり | DD-012（ComparisonGap の型・読み出し・部品・照合・gradeIds の検査） |
| データ | なし | 表・列を足さない。読み出しは既存の問い合わせを使い回す |
| 権限 | あり（狭める側だけ） | リンクは見る人の役割で開けるときだけ付ける。createForms は自社にない gradeId を1件でも含めば拒否する（今は黙って外している） |
| 配色・テーマ | なし | `globals.css` を変えない。既存の注意の枠（`caution-panel`）と `inline-detail` を使う |
| 依存 | なし | 新しい依存を足さない |

## 計画との食い違い

| 計画の記述 | 実際 | 扱い |
|---|---|---|
| 使うKPIを選ぶ＝`/admin/scheme/[group]/criteria`（`src/app/admin/scheme/[group]/criteria/page.tsx`） | 台帳で `/admin/scheme/[group]/criteria` は「選んだ項目の基準を決める」。使うKPIを選ぶは `/admin/scheme/[group]`（`schemeStepPath(pg, "select")`） | 実際の `src/app/admin/scheme/[group]/page.tsx` に置く。`criteria/page.tsx` は変えない |
| 書く範囲に `src/components/DataTable.tsx` が無い | `<table>` を書いてよいのは `DataTable.tsx` だけ（`ui-rules.test.ts`）。`DataTable` は狭い幅でカードに組み替えるため、AC6（狭い幅では横に流す）とぶつかる | 範囲を足す。`DataTable` に、カードに組み替えず横に流すだけの指定を足す（DD-012） |
| 書く範囲に `src/app/admin/scheme/data.ts` | 変えずに済む | 変えない |
| P07 の preview はポート 8787 | 8787 は別のプロジェクトの preview が使っている | 8791 で上げる。git 管理外の `.dev.vars` の送り元も 8791 にした |
| P07 の書く範囲は受領書だけ | 画面の確認で不合格が3件見つかった（下の「受け入れの結果」） | 仕様書の「不合格は P05 に差し戻す」に従い、P05 の範囲（部品・`DataTable`）で直した |
| P12 の始める条件は「P11 の証跡がコミット済み」 | この作業ではコミットしない（利用者の指示） | 証跡（P11）を未コミットのまま P12 に進んだ。コミットのときに P11 と P12 の順を守る |
| P12 の書く範囲に受領書が無い。一方で「公開の手順と戻し方を P13 のために残す」とある | P13 が公開の記録を足すのはこの受領書 | 手順と戻し方を受領書に置いた（下の「公開の手順と戻し方」）。手順と記録が同じ場所にそろう |

## 受け入れの結果（P07）

build のあと、preview（`opennextjs-cloudflare preview --port 8791`）で確かめた。使ったのは見本の kyufu 社のデータだけで、実データは使っていない。

見本のズレは、ローカルの D1 だけに4つ作った。

| 例 | アンケート | ズレ | 出るはずの直す操作 |
|---|---|---|---|
| A | 2026年度上期 等級4-1（公開中） | 足りない1 | 『この等級だけ新しい版の下書きを作る』と注記 |
| B | 2026年度上期 等級4-2（第2版の下書きあり） | 余分1 | 『第2版の下書きを開く』 |
| C | 2026年度上期 等級3（下書き・回答0件） | 足りない1 | 一覧は『設問を作り直す』。1本の画面は枠の外のボタンだけ |
| D | 2025年度下期 等級1（締め切った評価期間） | 余分1 | なし。締め切りの注記1行 |

### 3画面×4つの幅

会社の管理者と、会社を選んだシステム全体管理者の2役割で確かめた。11ページ×4つの幅×2役割の88件が、すべて合格だった。

| 画面 | 開いたページ | 375px | 768px | 1280px | 1600px |
|---|---|---|---|---|---|
| アンケートの一覧 | 2026年度上期（3件）、2025年度下期（1件） | 合格 | 合格 | 合格 | 合格 |
| アンケート1本 | A・B・C・D、ズレの無い等級4-2 第2版 | 合格 | 合格 | 合格 | 合格 |
| 使うKPIを選ぶ | AM（2行）、Chief（1行）、Regular と Beginner（出さない） | 合格 | 合格 | 合格 | 合格 |

各件で、次のことを確かめた。

- 警告の数が合い、既定で閉じている。
- 札にフォーカスして Enter を押すと開く。
- 開くと、1行目の文・2つのリンク・表・直す操作1つ・注記が出る。
- 表の th に `scope`、○ と — に読み上げの文字がある。
- 表の枠は `overflow-x: auto` で、画面の横流れは 0px。

閉じた状態の高さは、768px 以上ではどれも1行だった。375px では文が折り返すので、一覧と1本で3行、使うKPIを選ぶで2行になる。どれも注意の枠の1つの段なので、AC2 の「1つの段」を満たす。

### 役割・安全・押す操作

| 観点 | 結果 |
|---|---|
| マネージャー・一般 | 3画面とも開けない（`/manager`・`/me` へ戻る）。警告の文は出ない |
| 他社のアンケートの URL・自社に無い区分 | どちらも「ページが見つかりません」の画面。警告の文は出ない |
| 他社の名前 | 3画面の HTML に、他社の名前と id が0件 |
| AC5（押す操作） | 例 A で押すと、確認の文が出る。増えたのは等級4-1 の第2版の下書き1件だけ |

AC5 の確認の文は「「2026年度 上期 等級4-1 実績アンケート」の等級だけ、いまの評価項目で新しい版の下書きを作ります。いまの版はそのまま残ります。よろしいですか？」だった。確かめたあと、増えた下書きを消した。kyufu 社の等級ごとの版の数が、元と同じことも確かめた。

### 見つけて直したこと

| 見つけたこと | 原因 | 直し |
|---|---|---|
| 375px で開くと、画面が最大 41px 横に流れた | 長い札が、`.btn` の折り返さない指定のまま本文の幅を超えた | 部品の中だけ `.btn` を折り返す（`globals.css` は変えない） |
| 320px で、表の読み上げ用の文字が画面の幅を広げた | 横に流す枠が static で、`.sr-only` が枠で切り取られない | `DataTable` の `scroll` の枠に `relative` を足す |
| 375px で「くださ／い」「余分／0）」のように1〜2文字だけ落ちた | 文字組みの指定が無い。キットの jp-web-design の決まりに反する | 注意の枠に `text-pretty` と `word-break: auto-phrase` を付ける |

`word-break: auto-phrase` は、文節で折り返す指定で、対応していないブラウザでは今までどおりの折り返しになる。

### 受け入れの幅の外（320px）

警告を隠した幅と比べ、警告が広げた幅はすべて 0px だった。アンケート1本の4ページは、警告が無くても 29px 横に流れる。原因は、既存の札「回答画面に配点・ランク基準は表示されません」と既存のボタンで、この機能の範囲外である（follow-up の候補）。

2026-10-15 追記：この2つは、どちらも `globals.css`（層の外）の折り返さない指定（`white-space: nowrap`）のまま、本文の幅を超えていた。320px で測ると、札が +31px、ボタン「いまの評価項目に合わせて設問を作り直す」が +29px だった。アンケート1本の画面で、この2つの枠の中だけ important で折り返しを許し、文節で折る（`word-break: auto-phrase` と `text-pretty`）。`globals.css` は変えていない。build し直した preview で、5本のアンケートを 320px・375px・768px で開くと、画面の横流れはどれも 0px だった。折り返しは「…ランク基準は／表示されません」「…合わせて／設問を作り直す」で、1文字だけ落ちる行は無い。

## 品質と安全（P09）

この段ではコードを書かず、P05〜P08 の成果を観点ごとに確かめた。

| 観点 | 確かめ方 | 判定 |
|---|---|---|
| 他社の等級（AC5） | `forms-grade-scope.test.ts`。他社の等級を1件でも含むと理由の文で断られ、版は増えない | 合格 |
| 役割とリンク（AC4） | `comparison-gap-links.test.ts`。リンク先は台帳にあり、開ける役割にだけ付く | 合格 |
| 他社の名前（AC4） | 同じテストで、2社の見本の読み出しに他社の名前と id が無い。P07 の HTML でも0件 | 合格 |
| 権限の台帳 | `permissions-contract.test.ts` が通る。新しい権限とルートは足していない | 合格 |
| a11y：表 | th に `scope="col"` と表の caption がある。○ と — は読み上げず、「ある」「ない」を添える | 合格 |
| a11y：キーボード | 3画面で、Tab だけで札に届く。`:focus-visible` で 2px の枠が出て、Enter と Space で開閉する | 合格 |
| a11y：狭い幅 | 4つの幅で画面の横流れは 0px。表だけが枠の中で横に流れる（P07） | 合格 |
| 画面の器の作法 | `ui-rules.test.ts` が通る（`<table>` は `DataTable`、`<details>` は `ui.tsx` だけ） | 合格 |
| テーマの契約 | 契約のテスト3つが通る。この3つと `globals.css` の main との差分は0件 | 合格 |
| 新しい依存 | `package.json` と `pnpm-lock.yaml` の main との差分は0件 | 合格 |

結論：high の指摘は0件で、この段からの差し戻しは無い。P07 で見つけた3件は、P07 の中で P05 へ差し戻して直した。

## 証跡（P11）

P10 の最終レビューで直したあとの作業ツリーで、品質ゲートを流した（2026-10-15）。最終レビューの受領書の「レビューのあとの追記」（所属の順・320px・`pickFix` の注釈）を入れたあとに、もう一度流し直した数を載せる。所属の検査が1件増えた。

| コマンド | 結果 |
|---|---|
| `pnpm test` | 成功。テストのファイル 187 件が通り、1件は skip（188件）。テスト 2869 件が通り、1件は skip（2870件） |
| `pnpm typecheck` | 成功（型の誤り0件） |
| `pnpm test:coverage` | 成功。Statements 100%（2604/2604）、Branches 100%（2076/2076）、Functions 100%（691/691）、Lines 100%（2128/2128） |
| `pnpm check:docs` | 成功。「文書 drift 検査: PASS（current backlog 103 件、主要リンク確認済み）」 |

skip の1件は、前からある `src/lib/domain/production-bounds.check.test.ts` で、実データが無いときは飛ばす作りになっている。この作業では変えていない。

これで AC7（`pnpm test`・`check:docs`・カバレッジ 100%）は PASS。

### 画面で確かめ直す手順

見本のデータだけを使う。実データと秘密の値は使わず、ここにも書かない。D1 に書くのはローカル（`--local`）だけにする。

1. build して preview を上げる：`pnpm run preview`（ポート 8787）。8787 が使われているときは、build のあとに `pnpm exec opennextjs-cloudflare preview --port <ポート>` で上げ、git 管理外の `.dev.vars` の `BETTER_AUTH_URL` と `APP_ORIGIN` を同じポートにそろえる。そろえないとログインが送り元の検査で断られる。今回は 8791 を使った。
2. ローカルの D1 を用意する：`pnpm db:migrate:local` のあと、`pnpm wrangler d1 execute hr-evaluation-db --file=drizzle/seed.sql --local -y` で見本のデータを入れる。
3. 見本のズレ（上の例 A〜D）を作る。次の SQL をファイルに保存し、`pnpm wrangler d1 execute hr-evaluation-db --file=<ファイル> --local -y` で流す。

   ```sql
   -- A: 2026年度上期 等級4-1（公開中）から「利用者満足度」の設問を消す → 足りない1
   DELETE FROM form_questions WHERE form_id = 'frm_kyufu_2026h1_am1' AND kpi_item_id = 'kpi_kyufu_13';

   -- B: 等級4-2 の第2版の下書きを、第1版と同じ設問で作る（第2版はズレなし）
   INSERT INTO forms (id, company_id, grade_id, cycle_id, title, description, version, status, public_token, opens_at, closes_at, created_at, updated_at)
   SELECT 'frm_kyufu_2026h1_am2_v2', company_id, grade_id, cycle_id, title, description, 2, 'draft',
          lower(hex(randomblob(16))), opens_at, closes_at,
          CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000
   FROM forms WHERE id = 'frm_kyufu_2026h1_am2';

   INSERT INTO form_questions (id, company_id, form_id, section, question_type, title, help_text, unit, required,
     validation_min, validation_max, options_json, display_order, grade_requirement_id, promotion_requirement_id,
     behavior_guideline_id, kpi_item_id, kpi_question_key, is_gate, created_at, updated_at, validation_integer)
   SELECT replace(id, 'frm_kyufu_2026h1_am2', 'frm_kyufu_2026h1_am2_v2'), company_id, 'frm_kyufu_2026h1_am2_v2', section,
     question_type, title, help_text, unit, required, validation_min, validation_max, options_json, display_order,
     grade_requirement_id, promotion_requirement_id, behavior_guideline_id, kpi_item_id, kpi_question_key, is_gate,
     created_at, updated_at, validation_integer
   FROM form_questions WHERE form_id = 'frm_kyufu_2026h1_am2';

   -- B: そのうえで第1版に「改善提案」を余分に足す → 余分1
   INSERT INTO form_questions (id, company_id, form_id, section, question_type, title, help_text, unit, required,
     validation_min, validation_max, options_json, display_order, grade_requirement_id, promotion_requirement_id,
     behavior_guideline_id, kpi_item_id, kpi_question_key, is_gate, created_at, updated_at, validation_integer)
   SELECT 'fq_p07_am2_extra', company_id, 'frm_kyufu_2026h1_am2', 'kpi', 'number',
     '半期に提出した改善提案の件数を入力してください（件）', NULL, '件', 1, 0, NULL, NULL, 33, NULL, NULL, NULL,
     'kpi_kyufu_27', 'q27_1', 0,
     CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, 0
   FROM forms WHERE id = 'frm_kyufu_2026h1_am2';

   -- C: 2026年度上期 等級3 を下書きに戻し、「ヒヤリ報告件数」の設問を消す → 足りない1
   UPDATE forms SET status = 'draft' WHERE id = 'frm_kyufu_2026h1_chief';
   DELETE FROM form_questions WHERE form_id = 'frm_kyufu_2026h1_chief' AND kpi_item_id = 'kpi_kyufu_2';

   -- D: 締め切った 2025年度下期 等級1 に「ヒヤリ報告件数」を余分に足す → 余分1
   INSERT INTO form_questions (id, company_id, form_id, section, question_type, title, help_text, unit, required,
     validation_min, validation_max, options_json, display_order, grade_requirement_id, promotion_requirement_id,
     behavior_guideline_id, kpi_item_id, kpi_question_key, is_gate, created_at, updated_at, validation_integer)
   SELECT 'fq_p07_beginner_extra', company_id, 'frm_kyufu_2025h2_beginner', 'kpi', 'number',
     '半期のヒヤリハット報告件数を入力してください（件）', NULL, '件', 1, 0, NULL, NULL, 20, NULL, NULL, NULL,
     'kpi_kyufu_2', 'q2_1', 0,
     CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, 0
   FROM forms WHERE id = 'frm_kyufu_2025h2_beginner';
   ```

4. README の動作確認用アカウントの「会社の管理者」でログインし、3画面を開く。システム全体管理者で確かめるときは、先に会社（kyufu）を選ぶ。

   | 画面 | 開くページ |
   |---|---|
   | アンケートの一覧 | `/admin/forms?cycle=cyc_kyufu_2026h1`、`/admin/forms?cycle=cyc_kyufu_2025h2` |
   | アンケート1本 | `/admin/forms/frm_kyufu_2026h1_am1`（A）、`/admin/forms/frm_kyufu_2026h1_am2`（B）、`/admin/forms/frm_kyufu_2026h1_chief`（C）、`/admin/forms/frm_kyufu_2025h2_beginner`（D）、`/admin/forms/frm_kyufu_2026h1_am2_v2`（ズレ無し） |
   | 使うKPIを選ぶ | `/admin/scheme/AM`、`/admin/scheme/Chief`、`/admin/scheme/Regular`、`/admin/scheme/Beginner` |

   各ページで、「受け入れの結果（P07）」の5点（警告の数・既定で閉じる・開いた中身・表の読み上げ・横流れ）を、375px・768px・1280px・1600px の4つの幅で確かめる。
5. 例 A で直す操作を押すと、等級4-1 の第2版の下書きが1件できる。確かめたら、その下書きを消す：`DELETE FROM form_questions WHERE form_id = '<できた下書きの id>'; DELETE FROM forms WHERE id = '<できた下書きの id>' AND status = 'draft';`
6. 元に戻す：手順2の seed の SQL を流し直す。`drizzle/seed.sql` は全部の表を消してから入れ直すので、ズレも消える。ログインの記録と、締切の延長（`form_deadline_extensions`）も消えるので、ログインし直し、延長が要るなら入れ直す。

## 公開の手順と戻し方（P13 のため・P12）

この作業では表と列を足していない（移行のファイルは0本）。そのため、[公開の注意](../../deploy-notes.md) §1 の「移行を先に当てる」順序は要らず、コードを配るだけで済む。

公開の手順：

1. P01〜P12 がすべて main にマージされたことを確かめる。
2. 他の作業の未コミットの変更を含まない、別の作業ツリーで main の先頭を取り出す。共有の作業ツリーからは公開しない。
3. その作業ツリーで `pnpm test`・`pnpm typecheck`・`pnpm check:docs` を通してから、`pnpm run deploy` で公開する。
4. 公開のあと、[公開の注意](../../deploy-notes.md) §3 のとおり、間を空けて2回確かめる。1回目だけ合わなくても、すぐには戻さない。
5. 本番の3画面で、比べる警告が閉じた1段で出ることを、読むだけで確かめる。直す操作のボタンは押さない。押すと本番に下書きができる。本番の DB には書かない。
6. この受領書に、公開の日時・版・確かめの結果を足す（実データは書かない）。

戻し方：

- 問題があれば、原因の段の PR を revert し、main の先頭から公開し直す。表と列を変えていないので、データの戻しは要らない。
- 急ぐときは、[公開の注意](../../deploy-notes.md) §8 のとおり、旧 isolate と設定の不備を切り分けてから `wrangler rollback` を選ぶ。
- 公開のあとに会社の管理者が直す操作で作った下書きは、戻しても残る。ふつうの下書き（版の番号が1つ上の `draft`）なので、前のコードでもそのまま開ける。消すかどうかは会社が決める。

## 4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | §22-2（操作の結果を左右する事実は畳まない）・§22-4（カードの中の短い補足は `InlineDetail`）・DD-003（配色）と食い違わない |
| 漏れなし | PASS | feature の受入7件が AC1〜AC7 に1対1。qa-w02 の4問と qa-w04 の①〜⑤に反映先がある |
| 整合性あり | PASS | 用語の表の名前を DD-012・テスト・画面の文で使う |
| 依存関係整合 | PASS | 要件 G16・O16・I17 → 受領書（ここ）→ DD-012 → テスト（P04）→ 実装（P05）の順 |

## 制約と限界

- B1：dev-graph に、macro の feature を `confirmed`・`pass` へ進める書き手が無い。そのため Beads の issue が無く、beads_id は「なし」。task の進み具合は計画の task 仕様書と、この受領書の追記で示す。
- B2：計画の task 文書（`tasks/feature-comparison-gap-two-page-links/*.md`）を書き出す書き手が無い。task 文書は手で作らない。
- P13（本番への公開）は、main へのマージのあとに別の作業ツリーから行う。この作業ではコミットと PR をしないので、P13 は行わない。

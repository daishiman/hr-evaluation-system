# 最終レビュー 受領書（行動指針と KPI・評価セットの画面・双方向の追従・見本・部品の手応え）

> 以下は2026-10-24時点のレビューと是正の履歴です。2026-10-26の統合PR準備・再検証・仕様反映と現在の残課題は [最新の受領書](./2026-10-26-guideline-kpi-pr-review.md) を参照してください。

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-24 |
| graph_node_id | `SYS-GUIDE-KPI-P10`（feature `feature-guideline-kpi-ux-and-two-way-sync`） |
| beads | `hr-6pi.10` |
| 対象 | [受領書](./2026-10-22-guideline-kpi-ux-and-two-way-sync.md) の受け入れ10件と範囲の外の8件、[設計レビュー](./2026-10-22-guideline-kpi-design-review.md)、[DD-026〜DD-030](../design-decisions.md)、[設定の写しの一覧](../settings-copy-ledger.md)、製品仕様・[バックログ](../backlog.md)・[公開の手順](../../deploy-notes.md) §15、P02〜P09 の差分（未 commit の作業ツリー） |
| 読んだ差分の範囲 | 起点 `44a2e028c1b09d69a9933bee2c11f8e6e4e754c5`、main `44a2e028c1b09d69a9933bee2c11f8e6e4e754c5`（= origin/main = HEAD）。この feature はまだ1件もコミットしていないので、仕様書の `git diff --stat 44a2e028…..origin/main` は空になる。代わりに `git diff 44a2e028…` と `git status --porcelain` の未追跡（`??`）を読んだ（レビューの時点で129行。`.claude/state/` は読んでいない） |
| レビューの仕方 | 実装した担当とは別の担当（general-purpose）が、実装側の結論を渡されずに独立の文脈で、仕様書の5つの観点で読んだ。ファイルは書き換えていない。担当は vitest を2回流した（6 files / 121 passed、8 files / 112 passed）。流した後も `git status --porcelain` は129行のまま。D1・`--remote`・deploy・Playwright は使っていない |
| 判定 | **P13 へは進めない。P13 の本番への書き込みを止める指摘は3件（A・B・C）。A と B はレビューのあとに直した。C（SECURITY-014）は利用者の決定待ちで残る。止めない指摘 D・E・F・G・H・N・O のうち、D は tasks/ を書き換えずに読み方をここに残し、ほかはレビューのあとに直した。範囲の外の follow-up 4件（I・J・K・M）はバックログに足した** |
| コミット | 未 commit。commit したときに sha をここに書く |

## P10 の受け入れ

| 受け入れ | 判定 | 根拠 |
|---|---|---|
| 5 つの観点それぞれに結論がある | 満たす | 下の「観点ごとの判定」 |
| レビューを作った context と別の context で読んだことが記録にある | 満たす | 上の「レビューの仕方」 |
| P13 の本番への書き込みを止める指摘が 0 件である | **満たさない** | C が残る。SECURITY-014 は利用者が決める事項で、実装側では閉じられない |

## 観点ごとの判定

| 観点 | 見たこと | レビュー時 | 解消後 |
|---|---|---|---|
| 1 受け入れ10件の assert | 受領書の対応表の試験ファイルが、受け入れの文の条件を全て assert しているか | 指摘あり（A・O26-1・O27-2・O29-2） | PASS |
| 2 権限・会社の絞り込み・409・制度の変更の記録 | 台帳の minRole は `forms.align`・`forms.saveQuestions`・`masters.save`・`scheme.save` のどれも COMPANY_ADMIN。`__scope` が違えば `runAction` が 409。読み取りは会社で絞る。409 は planKey・`expectedUpdatedAt`・記録の seq の3か所。記録は設定への書き戻し（`writeMasterBatch`）・アンケートの保存・評価セットの保存の3経路で、どれも actorId 付き | PASS（follow-up の I・J） | PASS |
| 3 0040 とそろえる操作の戻し方 | 戻しの SQL は 0040 が書いた値のままの行だけを戻し、冪等性は `behavior-band-default-migration.test.ts` が試す。流し直しの例外・戻した後の下書き・そろえる操作の戻し方が文書にあるか | 指摘あり（F・G・B） | PASS |
| 4 写しの一覧とコードの一致 | 評価の内訳の3表の「元」と「分け方」が `evaluate.ts` と `FOLLOW_TARGETS` の動きと合うか。契約テストが照らすのは外部キー・列・export・分け方の言葉の4つで、振る舞いは照らさない | 指摘あり（H） | PASS |
| 5 文書の食い違い・古い記述・書かれていない挙動 | §14、deploy-notes §15、DD-028 の向きの基準、tasks/ の前提が、今の実装と状態に合うか | 指摘あり（N・D・G・A） | PASS（D は読み方をここに残す） |

## 受け入れごとの証跡と判定

| 番号 | 証跡 | レビュー時 | 解消後 |
|---|---|---|---|
| O25-1 0040 で既定へ戻す | `src/db/behavior-band-default-migration.test.ts` | PASS（流し直しの例外の試験が無い。指摘 F） | PASS（17件。例外の1件を足した） |
| O25-2 新しい会社は既定で始まる | `src/actions/behavior-default-company.integration.test.ts`、`src/lib/domain/behavior-default-assignment.test.ts` | PASS | PASS |
| O26-1 説明文の数・長さ・重なり | `src/components/guideline-kpi-disclosure.test.ts` | 穴あり（部品を組み立てて数え、入口の知らせ2つが数に入らない） | PASS（15件。知らせが出た状態の2件を足した。`comparison-gap-source.test.ts` の13件も通る） |
| O26-2 4つの作業の画面・カード・1行ずつ・幅 | `e2e/guideline-kpi-screens.spec.ts` | PASS（読んだだけ） | PASS（E2E 23件） |
| O27-1 アンケート → 設定 | `src/actions/form-to-settings-sync.test.ts` | PASS（他社の項目は `ok:false` だけを見る） | PASS |
| O27-2 設定 → アンケート、確定した評価は変わらない | `src/actions/settings-to-forms-sync.integration.test.ts` | 穴あり（確定した評価の比べ方が evaluations・evaluation_items・evaluation_behaviors だけ） | PASS（16件。`finalizedSnapshot` に evaluation_requirements と evaluation_gates を足した） |
| O27-3 写しの一覧とコード・そろえる操作 | `src/lib/settings-copy-ledger.contract.test.ts`、`src/lib/form-align.integration.test.ts`、`e2e/settings-two-way-sync.spec.ts` | 指摘あり（A・H） | PASS（契約36件・そろえる操作の結合18件・判定の単体21件。E2E 2件） |
| O28 見本の受付中の期 | `scripts/sample-data.test.mjs`、`e2e/sample-open-cycle-evaluation.spec.ts`、DD-029 | DD はある。§14 の本文が直っていない（指摘 N） | PASS（§14 を改めた） |
| O29-1 テーマの契約・部品クラス | `src/components/component-classes.static.test.ts`、テーマの契約4ファイル | PASS | PASS |
| O29-2 色の比・状態・明暗の記録 | `src/components/gradient-contrast.test.ts`、`e2e/component-states.spec.ts` | 穴あり（写すのは `/system` 系の4画面だけで、この feature の画面が無い） | PASS（E2E 21件。`/admin/scheme`・`/admin/behavior` を足し、写しは12枚） |

## 範囲の外の確認

| 範囲の外 | 確かめ方 | 判定 |
|---|---|---|
| 1 平賀配色への移行・テーマの契約の書き換え | `git diff --stat` で theme-contract・palette-contract・ui-rules・aidd-kit-boundary・`T2-experience-spec.md` の差分が空。`globals.css` の差分は追加だけで、`brand_color_*` を含む行の変更は0行 | 触れていない |
| 2 確定した評価とレポートの集計し直し | O27-2 の `finalizedSnapshot`（評価の内訳5表）が保存の前後で同じ。確定済みは `FINALIZED_SKIP_MESSAGE` で飛ばす | 触れていない |
| 3 公開中・締め切ったアンケートの差し替え | O27-2 の「回答のある公開中の版は変えず、次の版の下書きを1つだけ作る」「締め切った前の期のアンケートは、当時の名前のまま」。そろえる操作も回答0件の下書きだけを書く | 触れていない |
| 4 合わない変更のアンケートから設定への反映 | O27-1 の、断って `fixHref` を返す試験 | 触れていない（断る） |
| 5 別の利用者の画面への即時配信 | 差分と未追跡の src・e2e に WebSocket・EventSource は0件。BroadcastChannel は既存の他タブへの知らせ（§27）だけ | 触れていない |
| 6 本物の会社への仮のデータ・実在の氏名 | 見本の生成の試験（見本の印・他社の行を指さない）。この記録にも社員名・評価値を書いていない | 触れていない |
| 7 確認なしの本番への見本の投入 | `db:sample:remote` は流していない。手順は deploy-notes §15 の「見本の会社を入れ直す」で、利用者の承認の後 | 触れていない |
| 8 画面の組み替えを2画面と評価を作る画面の外へ | 組み替えたのは `/admin/scheme`（と作業ごとの4画面）・`/admin/behavior` だけ。レビューのあとの `StaleCyclesNotice` の直し（下の「範囲の外で見つけて直したもの」）は共通の知らせの重複を消すもので、画面の組み替えではない | 触れていない |

## 指摘と扱い

| 番号 | 重さ | 指摘 | 扱い |
|---|---|---|---|
| A | P13 を止める | そろえる操作の向きを `forms.updated_at` で決めていた。締切・題・状態の直しでも進むので、設定を直した後に締切だけを直した古い下書きが「設定へ反映する」向きになり、新しい設定が古い文で上書きされ、新しい要件・行動指針が外れ、KPI の聞くことの行が消える。確認の画面はどの設定が変わるかを見せない | 直した。案2: 向きは下書きの `form_questions.updated_at` の最大で決める（設問の保存は全ての行を入れ直すので、設問を消しただけでも進む）。同じ時刻と設問0問は作り直す側に倒す（`src/lib/form-align.ts`・`src/lib/domain/form-align.ts`、DD-028 の6）。案4: 結合テスト「設定を保存した後に締切と題だけを直した下書きは、作り直す側に出て、設定を変えない」と「移行が書き換えた等級の下書きは…作り直す一覧に出る」を足した。案1: deploy-notes §15 の手順2に「設定へ反映するが1件でもある会社は P13 では流さない」と書いた。案3（変わる設定の行を確認の画面に出す）は入れていない（下の「利用者の判断待ち」） |
| B | P13 を止める（A と同じ根） | 設定へ書き戻した後に追従が続く（次の版の下書き・確定前の評価の集計し直し・消えた KPI の聞くこと）。P13 の書き出しは draft の forms と form_questions だけで、戻し方にも無い | 直した。deploy-notes §15 の手順4で、設定へ反映するときの書き出しに設定の5表（`grade_requirements`・`promotion_requirements`・`behavior_guidelines`・`kpi_questions`・`scheme_items`）と `evaluations`・`evaluation_items` を足した。戻す元は書き出しで、`before_json` は補助（DD-028 の6）。手順2で P13 は設定へ反映する会社を流さない |
| C | P13 を止める | SECURITY-014 が decision のまま。未適用の 0040 を含めてマージすると、Deploy workflow が本番 D1 の全体を Public のリポジトリの Actions の Artifact に14日置く | 残る。利用者が P05 のマージの前に決める（バックログの SECURITY-014）。P13 の待ちは OPS-019 に書いた |
| D | 直したい | `tasks/…/sys-guide-kpi-p07.md:77` と `p13.md:78`、P10 の仕様書の背景が「0040 は P05 のマージで本番に出ている」と書く。実際は未コミットで HEAD = origin/main | tasks/ は計画の成果物なので書き換えない。読み方を下の「tasks/ の読み方」に残す |
| E | 直したい | P13 に「そろえられない下書き」（failed）の扱いが無く、受け入れの「0件で知らせが消える」が failed の残る会社では満たせない | 直した。deploy-notes §15 の手順6で、受け入れを「そろえられる下書きが0件」にし、そろえられない下書きは件数と理由を配布の記録に残す。直す画面を開いて直してから、もう一度内容を見る |
| F | 直したい | 0040 をもう一度流すと、会社が移行の前と同じ値へ戻した行は書き換わる。文書も試験もこの例外を持たない | 直した。0040 の注釈2行、DD-026 の8、deploy-notes §15 に例外を書いた。Deploy workflow では起きない（wrangler は適用済みの移行を流し直さない）。試験「移行のあとに会社が移行の前と同じ値へ戻した行だけは、もう一度流すと既定へ書き換わる」を足した |
| G | 直したい | deploy-notes §15 の「書き換えた会社のアンケートは追従します」が動きと違う（0040 は生の SQL で追従は流れない）。戻した後にもう一度そろえることと、そろえる操作の戻し方が無い | 直した。§15 を「入口の知らせに作り直すとして出て、管理者がそろえる」に改め、「戻すとき」にもう一度そろえることを足し、「ずれた下書きをそろえる」と「そろえた結果を戻すとき」の節を足した |
| H | 直したい | 写しの一覧の評価の内訳3表の「元」と「確定前は追従」が、実際の写し方（回答したアンケートの設問と回答から写し、要件・行動指針の保存では集計し直さない）と違う | 直した。一覧の3行の元・分け方・追従の関数を実態に合わせ、注を足した。試験「等級要件の文を直す保存は、確定前の評価を集計し直さず、集計し直しても元の文のまま」「行動指針の名前を直す保存のあとに集計し直しても、観点の名前と段階の名前は回答した時点のまま」を足した。契約テストは36件（3行の追従の関数が「なし」になり、export の照合が3件減った）。[設計レビュー](./2026-10-22-guideline-kpi-design-review.md) の55行目も `evaluate.ts` を「確定前は追従」に分けているが、P03 の記録なので書き換えず、正はこの一覧とする |
| N | 直したい | 製品仕様 §14 が「5期すべて締め済み」「受付中の期は作らない」のまま。受領書の P05 は「直した」と書いていた | 直した。§14 を DD-029 どおりに改め、受領書の P05 の記述を事実に合わせた（直したのは P10 のレビューのあと） |
| O26-1 | 直したい | 説明文の数の試験が page.tsx の知らせ（`StaleCyclesNotice`・`FormAlignNotice`）を数えない | 直した。知らせが出た状態の describe を足した。そこで、集計し直せる期間が2つ以上だと直し方の文が2回出る不具合を見つけ、直した（下の「範囲の外で見つけて直したもの」） |
| O27-2 | 直したい | 確定した評価の比べ方に evaluation_requirements と evaluation_gates が無い | 直した。`finalizedSnapshot` に2表を足した |
| O29-2 | 直したい | 明暗の写しがこの feature の画面を写さない | 直した。`SCREENS` に `admin-scheme` と `admin-behavior` を足し、会社を給付事業（1社目）に切り替えて写す |
| I | follow-up | `expectedUpdatedAt` が任意で、照合が書き込みの batch の外 | バックログ RELIABILITY-008 |
| J | follow-up | `form-to-settings.ts` の書き込みが id だけで絞る（読み取りは会社で絞るので、確かめた範囲では他社へ届かない） | バックログ SECURITY-016 |
| K | follow-up | 入口を開くたびに全ての下書きを解析する | バックログ PERFORMANCE-008 |
| M | follow-up | そろえる操作を流したこと自体の記録が無い | バックログ OPS-020 |

## 4条件

| 条件 | レビュー時 | 解消後 | 根拠 |
|---|---|---|---|
| 矛盾なし | NG | OK | DD-028 の向きの基準・deploy-notes §15・写しの一覧・§14 が、コードと試験の動きと合う（A・G・H・N） |
| 漏れなし | NG | OK（C を除く） | 受け入れ10件の条件が全て assert され（O26-1・O27-2・O29-2）、流し直しの例外・failed・戻し方が文書にある（F・E・B・G）。C は利用者の決定待ち |
| 整合性あり | NG | OK | 受領書の P05・P07・P09 の記述を事実に合わせた。tasks/ の前提は下の読み方で読む（D） |
| 依存関係整合 | NG | NG（C） | P13 の入口は P05〜P12 のマージと SECURITY-014 の決定と利用者の承認。SECURITY-014 が決まるまで P05 をマージしない |

## 利用者の判断待ち（指摘にしていないもの）

- **SECURITY-014**（指摘 C）: 本番 D1 の書き出しを Public のリポジトリの Artifact に置くか。P05 のマージの前に決める。決めに沿って `.github/workflows/deploy.yml` を直す。
- **P13 に進むか**: 入口は、P05〜P12 のマージ、SECURITY-014 の決定、本番への書き込みの利用者の承認。バックログの OPS-019。
- **A の案3**: 「下書きの直しを設定へ反映する」の確認の画面に、変わる設定の行（文の直し・外し・行の削除）を出すか。P13 は設定へ反映する会社を流さないので、P13 の前提にはしない。

## tasks/ の読み方

tasks/ の仕様書は計画の成果物なので書き換えない。次の3か所の「本番に出ている」は、「P05 のマージの後に本番に出る」と条件の形で読む。

- `tasks/feature-guideline-kpi-ux-and-two-way-sync/sys-guide-kpi-p07.md` の77行目
- 同 `sys-guide-kpi-p13.md` の78行目
- 同 `sys-guide-kpi-p10.md` の背景（「0040 は P05 のマージで本番に当たっている」）

## 確かめられなかったこと

- 本番で設定とずれた下書きの件数と、そのうち「設定へ反映する」になるもの。D1 に触れていないので、P13 で流せる会社の数は分からない（手順1で数える）。
- GitHub に今ある Actions の Artifact の状態。
- Cloudflare のプランが Free か Paid か。K の上限との関係も、そのため確かめていない。
- 確定前の評価を集計し直した後に設定を戻すと、評価が元どおりになるか（B）。P13 は設定へ反映する会社を流さないので、P13 では起きない。

## レビューのあとの追記（2026-10-24）

上の表と4条件のレビュー時の欄は、レビューのときの記録として残す。

| 対象 | したこと | 確かめ方 |
|---|---|---|
| そろえる操作の向き（A） | 向きを下書きの `form_questions.updated_at` の最大で決める | `pnpm exec vitest run src/lib/form-align.integration.test.ts`: 18 passed、`src/lib/domain/form-align.test.ts`: 21 passed |
| 0040 の流し直しの例外（F） | 注釈・DD-026・deploy-notes に例外を書き、試験を1件足した | `src/db/behavior-band-default-migration.test.ts`: 17 passed |
| 写しの一覧（H）と確定した評価（O27-2） | 一覧の3行を直し、振る舞いの試験2件を足した。`finalizedSnapshot` に2表を足した | `src/actions/settings-to-forms-sync.integration.test.ts`: 16 passed、`src/lib/settings-copy-ledger.contract.test.ts`: 36 passed |
| 説明文の数（O26-1） | 知らせが出た状態の試験を足した | `src/components/guideline-kpi-disclosure.test.ts`: 15 passed、`src/lib/comparison-gap-source.test.ts`: 13 passed |
| 明暗の写し（O29-2） | 2画面を足した | `pnpm exec playwright test`（この feature の E2E 4本）: 49 passed。`e2e/component-states.spec.ts` は 21 passed、写しは12枚（`test-results/`、git の管理外） |
| 文書（B・E・G・N） | deploy-notes §15・DD-028 の6・§14・受領書を直した | `pnpm run check:docs`: PASS |
| 全体 | | `pnpm test`: 3900 passed / 1 skipped（240 files）、`pnpm run typecheck`: 終了コード 0、`pnpm exec opennextjs-cloudflare build`: `OpenNext build complete.` |

### 範囲の外で見つけて直したもの（2026-10-24）

| 対象 | 見つけたこと | したこと | 確かめ方 |
|---|---|---|---|
| `src/components/StaleCyclesNotice.tsx` | 集計し直せる期間が2つ以上あると、直し方の文「確認中の評価だけを、現在の基準で集計し直せます。」が期間の数だけ出る（§22-10 の「同じ文を2回出さない」に反する）。O26-1 の試験を知らせが出た状態へ広げて見つけた | 2件目からは直し方の文を書かず、リンクだけにした。この部品は P06・P09 の write_scope の中だが予定外の部品で、ほかの4画面（`/admin/masters`・`/admin/masters/promotion`・`/admin/scheme/common`・`/admin/scheme/items`）にも効く。理由は DD-027 に書いた | `src/components/StaleCyclesNotice.test.ts`: 4 passed（「集計し直せる期間が2つ以上でも、直し方の文は1回だけ書き、リンクは期間ごとに置く」を足した） |
| `src/lib/comparison-gap-source.test.ts` の許す一覧 | `FormAlignNotice.tsx` と `domain/form-align.ts` が、比べる警告の文面の置き場の検査に当たる | 許す一覧に2ファイルを足した（P05 の write_scope の外。理由は DD-028 の6） | 13 passed |

### 直せずに報告に回すもの（2026-10-24）

- 全体管理者で `/admin/*` を開くと、パンくずに「ホーム」が2回出る。原因は `src/lib/nav.ts` の `resolveTrail`。この feature の範囲の外なので直さず、バックログの UX-034 に足した。
- SECURITY-014（指摘 C）と P13 は、上の「利用者の判断待ち」のとおり。

### 任された判断と、そのあとに直したもの（2026-10-24）

利用者が「ベストプラクティスの方法でお任せします。」と判断を任せた。上の「利用者の判断待ち」と「直せずに報告に回すもの」は、そのときの記録として残す。

| 対象 | 決めたこと・したこと | 確かめ方 |
|---|---|---|
| 指摘 C（SECURITY-014） | [DD-031](../design-decisions.md) に決めた。書き出しを age の公開鍵で暗号化してから Artifact に置き、平文は置かない。公開鍵の変数 `D1_BACKUP_AGE_RECIPIENT` が無いか形が違えば、移行を伴う Deploy と Migrate は書き出しの前で止まる（fail-closed）。鍵の用意と変数の設定は利用者が行う（[デプロイ時の注意](../../deploy-notes.md) §1 の「書き出しの暗号化」）。それまで移行を伴う Deploy は出ないので、バックログは blocked にした | `pnpm exec vitest run scripts/deploy-workflow-contract.test.mjs`: 13 passed |
| 指摘 I（RELIABILITY-008） | 設問の保存と評価セットの保存で `expectedUpdatedAt` を必須にし、送らない保存は何も書かずに断る。設問の編集画面は開いたときの時刻を必ず渡す。照合を書き込みの条件へ入れることは、D1 の batch で後の文を止める形を決めてからにし、observe に残した | `src/actions/form-to-settings-sync.test.ts`・`src/actions/settings-to-forms-sync.integration.test.ts` に「送らない保存は断り、何も変えない」を足した（15 passed・16 passed）。`src/components/form-freshness-regression.test.ts`: 45 passed（送る時刻が画面の値のままであることを足した） |
| パンくずの「ホーム」の重なり（UX-034） | `resolveTrail` が URL をたどる段で、どの役割のホーム（`/me`・`/manager`・`/admin`・`/system`）も積まないようにした。この feature の範囲の外なので、理由を `src/lib/nav.ts` の注釈に書いた。バックログから除いた | `src/lib/nav.test.ts`: 41 passed（全体管理者が `/admin/*` を開く試験を足した） |
| 4条件の依存関係整合 | C は決まった。P13 の入口は、P05〜P12 のマージ、鍵の用意と変数の設定、本番への書き込みの利用者の承認の3つ（OPS-019）。P13 はこの回では流さない | バックログの OPS-019・SECURITY-014 |

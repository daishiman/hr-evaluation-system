# 要件の受領書（評価レポートと上司の判断・受け入れ10件と検証の対応）

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-20（P01 の受領日。この文書を書いたのは 2026-10-21） |
| graph_node_id | `SYS-EVAL-REPORT-P01`（証跡の節は `SYS-EVAL-REPORT-P11`） |
| beads_id | `hr-inn.1`（証跡の節は `hr-inn.11`） |
| 計画 | `.dev-graph/plans/feature-package-feature-evaluation-report-and-raise-judgment/task-specs/phase-01-requirements.md` |
| 要件 | `features/feature-evaluation-report-and-raise-judgment.context.json`（sha256 `0c36bb81e9f554b7dd2d868d02894601d62b7aa246b24e851c046df34d70cee8`）の受け入れ10件。目標と測り方は [要件定義書](../../../system-spec/00-requirements-definition.md) の G17〜G24・O17〜O24 |
| 基準 sha | `dbe633361a7638c36360cde905a5b5c17822073d`（`main`、#95 のマージ） |
| 判定 | **受け入れ10件のすべてに、検証の種類・置き場所・確かめる phase を付けた。未決の事項3件は P02 が DD-020・DD-024 で決めた。範囲の外の9件を写した** |

## 1. 位置づけ

- 読み替えは [計画レビューの受領書](./2026-10-20-evaluation-report-plan-review.md) の §2 の P01 の行に従う。対応表は「受け入れ × 検証の種類 × テストファイル」の形にし、1つの受け入れに検証の種類が複数あるときは同じ行に並べる。
- テストファイル名の正本は [DD-024](../design-decisions.md) の「固定する検査」。この受領書は、それを受け入れの順に並べ直したものである。
- **この受領書は、P02〜P09 の設計・実装・テストを同じ作業ツリーで終えた後に書いた。** 計画では P01 は実装の前に置くが、ここでは順が逆になった。そのため、置き場所は計画の名前ではなく、実在するファイルを書いた。どのファイルも実在を確かめた（2026-10-21）。
- この作業ツリーの変更は、まだ commit していない。利用者の指示で、PR も出していない。Required evidence の「コミットの sha」は、commit したときに記録する。
- この作業ツリーには、この機能の外の差分（[製品仕様](../spec.md) §28-9 の並べ替えの行。`src/app/globals.css` の `reorder-stack-actions`・`src/components/FormBuilder.tsx`・`src/components/list-row-shape.test.ts`）も載っている。PR を作るときは、この機能の commit から分ける。

## 2. 受け入れ × 検証の種類 × 置き場所 × 確かめる phase

番号は context.json の `acceptance` の順。phase の列は「テストを書く phase → 通すことを確かめる phase」。E2E は P07 が preview で流す。

| # | 目標 | 受け入れ（要約） | 検証の種類と置き場所 | 確かめる phase |
|---|---|---|---|---|
| 1 | O17 | KGI の参照が src・docs・route-ledger・nav に0件。賞与（仮）は KPI評価点の合計から出し、1点あたりの金額が0なら出さない | 静的 `src/lib/kgi-removal.static.test.ts`、単体 `src/lib/domain/bonus.test.ts` | P04 → P06。P08 で 0039 を当てた後にも流し直す |
| 2 | O17 | 2回目の Deploy の後に、本番 DB に KGI の3つの表と評価の2列が無い | 本番の読み取り（`sqlite_master` と `PRAGMA table_info(evaluations)`。読むだけ） | P13 |
| 3 | O18 | 同じデータから2回作ったレポートが一致する。項目が3・5・6ならレーダー図の頂点の数が合い、2以下なら棒グラフになる | 単体 `src/lib/domain/report.test.ts` | P04 → P06 |
| 4 | O18 | 4つの幅（375・768・1280・1600）と A4 縦の印刷で、図と表が切れず、ナビと操作のボタンが出ない。見本のデータで1人分の PDF が2ページで、2枚目は⑤から | 単体 `src/components/ReportTemplate.test.ts`（DOM の順と2枚目の位置）、E2E `e2e/evaluation-report.spec.ts`（4つの幅・2枚目の見出しと図）・`e2e/report-print.spec.ts`（紙に刷らないもの・2枚目の前の改ページ・PDF が2ページ。上長と本人） | P04 → P06・P07。P09 で印刷を直したら P10 が確かめ直す |
| 5 | O19 | 全体管理者・会社の管理者・マネージャー（直属の部下と、部下でない人）・本人・他の社員の組ごとに、見えるか 404 か。本人向けの応答に点数の数値と比べる値の鍵が無い。同じ等級が3人未満なら平均を出さない | 単体 `src/lib/domain/evaluation-authority.test.ts`・`src/components/NoteForm.test.ts`、契約 `src/lib/report-visibility.contract.test.ts`（本人向けの鍵）、結合 `src/app/api/export/route.integration.test.ts`・`src/actions/notes.integration.test.ts`・`src/lib/notes-visibility.integration.test.ts`、単体 `src/lib/domain/report.test.ts`（`REPORT_PEER_MIN` の3人）、E2E `e2e/report-visibility.spec.ts` | P04 → P06・P07 |
| 6 | O20 | 見本データを入れた後に、評価結果・レポートの全ての図・アンケートの各状態（下書き・公開中・締め切り済み・延長あり）・ずれの3種類が出る。2回流しても同じ。本番の設定ではシードが動かない | 単体 `scripts/seed-idempotent.test.mjs`（2回流して同じ・本番向けの引数を断る）・`scripts/seed-target.test.mjs`、E2E `e2e/seed-coverage.spec.ts`（アンケートの4つの状態とずれの3種類）・`e2e/evaluation-report.spec.ts`（レポートの図） | P04 → P06・P07 |
| 7 | O21 | アンケートの状態の変更の組ごと。他社の版を締め切らず、版の番号は会社ごと。配布 URL（ログイン前・等級違い・締切後・古い版）と、回答・回答一覧・締め切る・延長 | 単体 `src/lib/domain/form-transitions.test.ts`、結合 `src/actions/forms-transitions.integration.test.ts`（版の締め切りと採番は会社で閉じる）、E2E `e2e/forms-audit.spec.ts` | P04 → P06・P07 |
| 8 | O22 | 等級要件・行動指針・KPI 項目のそれぞれで、足りない・余分を出す。全ての行にリンクがあり、リンク先が経路台帳にあって見る人が開ける。公開中の版の警告が新しい下書きで消えない | 単体 `src/lib/domain/comparison-items.test.ts`・`src/lib/domain/comparison-gap.test.ts`・`src/components/ComparisonGapNotice.test.ts`、契約 `src/lib/comparison-gap-links.test.ts`、E2E `e2e/forms-audit.spec.ts`・`e2e/seed-coverage.spec.ts` | P04 → P06・P07 |
| 9 | O23 | ずれの比較・アンケートの作成・点数の計算・レポートが、同じ関数から評価セットを得る。別の評価セットを付けたときも4つが同じものを使う。依存関係の図とテストの一覧が一致する | 契約と結合 `src/lib/scheme-resolution.contract.test.ts`（呼ぶ側の一覧・DD-024 の図の矢印・本物の表で4つをそろえる） | P04 → P06 |
| 10 | O24 | 判断を選ばずに確定できない。「変える」で理由が空白なら断る。自分自身や部下でない人の評価に記録できない。最終の可否の5通り（domain のカバレッジ100%）。全ての表示先が同じ関数を使う。E2E で結論・印・理由が見える | 結合 `src/actions/raise-decision.integration.test.ts`・`src/app/api/export/route.integration.test.ts`（CSV の7列）、単体 `src/lib/domain/final-decision.test.ts`（カバレッジは `vitest.config.mts` が `src/lib/domain/` の全ファイルに100%を課す）、契約 `src/lib/final-decision.contract.test.ts`、E2E `e2e/raise-decision.spec.ts` | P04 → P06・P07 |

- 4番の「2枚目は⑤から」は、1つのテストでは言い切れないので3つで分けて確かめる。`src/app/globals.css` の印刷の規則が2枚目の前で改ページし、`ReportTemplate.test.ts` が⑤〜⑦を2枚目の枠に置くことを、`report-print.spec.ts` がその改ページが紙で効くことと PDF が2ページであることを確かめる。改ページが2枚目の前にあり、全部で2ページなら、1枚目に①〜④とコメントが収まり、2枚目は⑤から始まる。
- 2番は、本番 D1 を読めない間（[バックログ](../backlog.md) の OPS-017）は確かめられない。P13 は blocked のまま残す。

## 3. 計画のテストファイルとの違い

P04 の仕様書（`phase-04-test-design.md` の60行）はテストファイルを17件とした。17件はすべて実在する。DD-024 の固定する検査は、ほかに次の11件を受け入れの検査に数える。

| 足したファイル | 受け入れ | 足した理由 |
|---|---|---|
| `src/components/ReportTemplate.test.ts` | 4 | 2枚の枠と節の順を、ブラウザを使わずに確かめる |
| `src/app/api/export/route.integration.test.ts` | 5・10 | CSV の見える範囲（計画レビューの §6 の直し）と、末尾の7列 |
| `src/actions/notes.integration.test.ts`・`src/lib/notes-visibility.integration.test.ts`・`src/components/NoteForm.test.ts` | 5 | メモの公開範囲（計画レビューの §6 の直し） |
| `scripts/seed-target.test.mjs` | 6 | 見本データを入れる先が本番でないこと |
| `e2e/seed-coverage.spec.ts` | 6・8 | 見本データを入れた後の画面。`forms-audit.spec.ts` は試験の中で自分のデータを作るので、見本データそのものは見ない |
| `src/lib/domain/comparison-items.test.ts`・`src/lib/comparison-gap-links.test.ts`・`src/components/ComparisonGapNotice.test.ts` | 8 | 比べる項目の数え方・リンク先・警告の表示を、それぞれの層で確かめる |
| `src/lib/final-decision.contract.test.ts` | 10 | 全ての表示先が `finalDecision` を通すこと |

計画のパッケージは昇格済みで、書き換えない。この違いは、この節と DD-024 で読み替える。

## 4. 未決の事項と担当

P01 の仕様書が挙げた未決の事項3件は、どれも P02 の担当で、P02 が次のとおり決めた。

| 未決の事項 | 担当 | 決めた中身 | 決めた先 |
|---|---|---|---|
| レポートの URL | P02 | `/reports/[id]`（id は社員の利用者 id）。開けない人には 404 を返す | DD-024 の2 |
| migration の番号 | P02 | 1回目（P05 のマージ）は `0038_evaluation_decisions.sql`、2回目（P08 の別の PR のマージ）は `0039_drop_office_kgi.sql`。戻す SQL は `drizzle/rollback/` の2つ | DD-020、DD-024 の1 |
| テストファイル名と、静的検査の除外の一覧 | P02 | テストファイル名は DD-024 の固定する検査（§2・§3）。KGI の静的検査が除く文書は5つ（spec-receipts・backlog-history・elegant-review・判断の記録・デプロイ時の注意）。除外が実在することも検査する | DD-024 の12・13 |

## 5. 範囲の外

context.json の `scope_out` の9件を、そのまま写す。

1. 事業所KGIに代わる仕組みを作ること（将来の再導入は別の依頼で扱う）
2. レポートを PDF などのファイルとしてサーバーで作ること（ブラウザの印刷で紙や PDF にする）
3. 間接の部下（部下の部下）へのマネージャーの閲覧
4. 本番 DB へのテストデータの投入
5. 確定済みの評価の個人Pt・賞与額・根拠の文の作り直し（そのときの計算の記録として変えない）
6. 上司の判断で等級を自動で変えること（等級は今と同じく管理者が人の設定で変える）
7. 上司の判断を賞与（仮）の計算に効かせること
8. 上書きした前の判断の履歴を残すこと（記録した人と時刻だけを持つ）
9. 配色・テーマの変更（AGENTS.md と DD-003 により対象外）

## 6. 証跡（P11）

受け入れ10件のうち9件の証跡をここに書く。残りの1件（2番の本番の読み取り）は P13 の担当として残す。

- 測った日は 2026-10-21。測ったのは、基準 sha `dbe6333` に未 commit の変更を載せた作業ツリーで、0038・0039 の両方が入っている。
- 画面の確認には、見本のデータ（`drizzle/seed.sql`。架空の会社と人）だけを使った。実データは使っていない。

### 6.1 流したコマンドと結果

| コマンド | 結果 |
|---|---|
| `pnpm exec vitest run <§2 の単体・結合・契約・静的の22ファイル>` | 22ファイル・421件が通過（exit 0） |
| `E2E_BASE_URL=http://localhost:8790 pnpm exec playwright test`（preview に見本のデータを入れて流す） | 82件のうち81件が通過。受け入れにかかわる6ファイル・18件はすべて通過。落ちた1件の扱いは 6.3 |
| `pnpm exec vitest run --coverage --exclude 'scripts/handover/**'` | 3580件が通過（skip 1件）。全体と `src/lib/domain/` の全ファイルが、行・分岐・関数・文のすべてで100% |
| `pnpm typecheck` | exit 0 |
| `pnpm check:bundle-size` | 2081.8 KiB（上限の 67.8%）、exit 0 |
| `pnpm cf:dry-run` | exit 0 |
| `pnpm run check:docs` | PASS |

網羅率は `scripts/handover/` を外して測った。そこには別の作業の書きかけの試験があり、この機能とは関係なく落ちる。試験が1件でも落ちると、vitest は網羅率を判定しない。

[最終レビュー](./2026-10-20-evaluation-report-final-review.md)（P10）の指摘を直したあと、1行目と3行目を流し直し、上の数にした。直したのは試験と文書とコードの注で、アプリの動きは変えていない。

- 1行目は 421件のまま。組み合わせ表に足した「同じ上長の別の社員」の1行は、前の実行から入っている。
- 3行目は前の 3574件から6件増えた。増えたのは、戻す SQL の試験 `src/db/migration-rollback-0038-0039.test.ts`（DD-020 の9）の6件。受け入れの10件ではなく、2回の公開の戻し方を確かめるものなので、§2 の表には入れない。
- E2E は `e2e/evaluation-report.spec.ts` だけを流し直した（setup を含む3件が通過）。④のレーダー図の svg を確かめる行を足したため。ほかの5ファイルは試験もアプリも変えていないので、2行目の結果のまま。

### 6.2 受け入れごとの証跡

件数は 6.1 の1行目と2行目の実行で通った数。

| # | 判定 | 証跡 |
|---|---|---|
| 1 | 満たす | `kgi-removal.static.test.ts` 7件・`bonus.test.ts` 19件。0039 を当てた試験用 DB で流した |
| 2 | P13 の担当 | 本番 D1 の読み取り。本番 D1 を読めない間（OPS-017）は blocked |
| 3 | 満たす | `report.test.ts` 30件（2回作って一致・頂点の数・2項目以下の棒グラフ） |
| 4 | 満たす | `ReportTemplate.test.ts` 14件、E2E `evaluation-report.spec.ts` 2件（上長と本人。4つの幅ではみ出さない。④のレーダー図と2枚目の図が svg まで描ける）・`report-print.spec.ts` 2件（上長と本人。A4 の2枚で、画面の骨格を刷らない） |
| 5 | 満たす | `evaluation-authority.test.ts` 35件・`NoteForm.test.ts` 3件・`report-visibility.contract.test.ts` 16件（同じ上長の別の社員を含む）・`export/route.integration.test.ts` 10件・`notes.integration.test.ts` 3件・`notes-visibility.integration.test.ts` 5件・`report.test.ts`（`REPORT_PEER_MIN` を含む）、E2E `report-visibility.spec.ts` 3件（本人・直属の上長と直属でない人・会社の管理者） |
| 6 | 満たす | `seed-idempotent.test.mjs` 37件・`seed-target.test.mjs` 7件、E2E `seed-coverage.spec.ts` 3件（アンケートの各状態・延長中の人・ずれの3種類）・`evaluation-report.spec.ts` 2件（レポートの図） |
| 7 | 満たす | `form-transitions.test.ts` 36件・`forms-transitions.integration.test.ts` 15件、E2E `forms-audit.spec.ts` のうち状態ごとの操作の4件と古い版の配布 URL の1件 |
| 8 | 満たす | `comparison-items.test.ts` 8件・`comparison-gap.test.ts` 56件・`ComparisonGapNotice.test.ts` 30件・`comparison-gap-links.test.ts` 28件、E2E `forms-audit.spec.ts` のうち比べる警告の2件・`seed-coverage.spec.ts` のずれの3種類 |
| 9 | 満たす | `scheme-resolution.contract.test.ts` 22件 |
| 10 | 満たす | `raise-decision.integration.test.ts` 12件・`export/route.integration.test.ts`（CSV の7列）・`final-decision.test.ts` 24件（`final-decision.ts` は網羅率100%）・`final-decision.contract.test.ts` 4件、E2E `raise-decision.spec.ts` 1件 |

### 6.3 E2E で落ちた1件の扱い

- 落ちた試験：`e2e/improvement-requests-2026-10.spec.ts` の A12（右側の余白）のうち `/system/users`。1280px で、中身のある高さの 41% は右側が空いていた（基準は40%以下）。
- この機能とは関係ない。
  - この機能の変更は `/system/users` に触れていない（基準 sha からの差分は0件）。
  - 同じコードで流した前の回（同じ日）では、この試験は通っている。
  - ローカルの D1 の利用者67人のうち36人は、E2E が作る試験用の管理者である。流すたびに一覧が伸びて、右側の空く割合が上がる。
- 扱い：基準は緩めず、D1 も戻していない。受け入れ10件のどれにも当たらない。

### 6.4 まだ記録していないもの

- Required evidence の「コミットの sha」：この作業ツリーは commit していないので、commit したときに記録する。
- 2番の本番の読み取り：P13 が、2回目の Deploy（P08 のマージ）の後に `sqlite_master` と `PRAGMA table_info(evaluations)` を読んで書く。

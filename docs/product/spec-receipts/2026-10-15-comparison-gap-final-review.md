# 最終レビュー 受領書（比べる警告の型と部品・DD-012）

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-15 |
| graph_node_id | `SYS-COMPARISON-GAP-P10`（feature `feature-comparison-gap-two-page-links`） |
| 対象 | [受領書](./2026-10-15-comparison-gap-two-page-links.md) の受入 AC1〜AC7、[設計レビュー](./2026-10-15-comparison-gap-design-review.md)、[DD-012](../design-decisions.md)、P05〜P09 の差分（未コミットの作業ツリー） |
| レビューの仕方 | 実装した担当とは別の担当が、独立の文脈で、受入ごとの証跡と scope_out の差分を通しで見た |
| 判定 | **通過。high 0件・medium 1件・low 6件。レビュー時は AC7 の記録が受領書に無かったが、P11 で記録して解消した。medium は、コミットの分け方の提案として扱う** |

## 受入ごとの証跡と判定

| 番号 | 証跡 | レビュー時 | 解消後 |
|---|---|---|---|
| AC1 2つのページを持つ | `src/lib/domain/comparison-gap.test.ts`（状態の組み合わせの全件で `pages` が2つ・名前に「›」・`href` が台帳の道筋に合う） | PASS | PASS |
| AC2 閉じた1段・開くと2つのリンクと表 | `src/components/ComparisonGapNotice.test.ts`、`src/lib/comparison-gap-source.test.ts`（3画面が部品を使う・画面ごとのいま開いているページ）、[受領書](./2026-10-15-comparison-gap-two-page-links.md)「受け入れの結果（P07）」の3画面×4つの幅 | PASS | PASS |
| AC3 比べる警告は ComparisonGap からだけ | `src/lib/comparison-gap-source.test.ts`（項目の差を使うのは `comparison-gap.ts` だけ・入口は `formSyncGaps` の1つ・字面の閉じ込め） | PASS | PASS |
| AC4 リンク先は台帳にあり役割で開ける・他社の名前が無い | `src/lib/comparison-gap-links.test.ts`（台帳・役割ごとの `href`・D1 の2社の見本） | PASS | PASS |
| AC5 その等級の版だけ増える・他社の等級は拒否 | `src/actions/forms-grade-scope.test.ts`（版が1つだけ増える・他社の等級は理由の文で断られ0件） | PASS | PASS |
| AC6 `scope`・読み上げの文字・4つの幅で同じ振る舞い | `ComparisonGapNotice.test.ts`（`scope="col"`・「ある」「ない」・横に流す枠）、受領書「受け入れの結果（P07）」 | PASS | PASS |
| AC7 `pnpm test`・`check:docs`・カバレッジ 100% | 受領書「証跡（P11）」（2868件 pass・4つの指標 100%・check:docs PASS） | FAIL（記録が無い） | PASS |

## scope_out の確認

| 範囲の外 | 確かめ方 | 判定 |
|---|---|---|
| U7（設定不足の一覧の形） | `src/components/SetupGapList.tsx` の差分0件 | 触れていない |
| 公開後のアンケートの設問の差し替え | `src/actions/forms.ts` の差分は `createForms` の等級の検査の4行だけ | 触れていない |
| 新しいサーバー処理 | 新しい Server Action は無い。`server-actions-contract.test.ts` の変更は、部品から既存の action を `ActionButton` へ渡すことを理由つきで許す一覧を足しただけ | 触れていない |
| 配色・テーマの契約 | `src/app/globals.css`・テーマの契約テスト3本・`T2-experience-spec.md` の差分0件 | 触れていない |
| 所属（memberships） | `src/lib/memberships.ts`・`src/actions/memberships.ts` の差分0件。文書には所属の決定が混ざる（下の指摘1） | コードは触れていない |
| 表・列の追加 | `drizzle/`・`src/lib/db/schema.ts`・`package.json`・`pnpm-lock.yaml` の差分0件 | 触れていない |

## 指摘と扱い

| 番号 | 重さ | 指摘 | 扱い |
|---|---|---|---|
| 1 | medium | 所属の決定（DD-009 の「更新（2026-10-14）」、spec-state の qa-w11〜qa-w13・D-008・D-009 と、それを compile した system-spec の文）が、比べる警告と同じ差分に混ざる | 動かさない。同じ作業の P01 の elicit で、利用者の回答をもとに記録したもの。コミットのときに、所属の決定を別のコミットか PR に分けることを提案する。`memberships.ts` を決定に合わせる作業は follow-up の候補にする。→ レビューのあとに直した（下の「レビューのあとの追記」） |
| 2 | low | AC7 の記録が受領書に無い | 直した。P11 で受領書に「証跡（P11）」の節を足し、コマンドと結果を記録した |
| 3 | low | テスト名の「400」が、画面へ返る形（`ActionFail` は状態コードを持たない）と合わない | 直した。理由の文で確かめる名前にした。DD-012 の7と受領書の AC5 の書き方も合わせた |
| 4 | low | `formSyncGaps` と `isFormInSync` が本番から使われず、テストだけが使う | 直した。`formSyncGaps` は仕様（system-spec の backend (11)・feature の scope_in）が入口と定めているので残し、読み出し（`comparison-gap-loader.ts`）から呼ぶ形にした。`isFormInSync` は消した。入口が1つであることを `comparison-gap-source.test.ts` で固定した（DD-012 の6） |
| 5 | low | `comparison-gap-links.test.ts` の役割ごとの期待値を、台帳から導かずに直に書いている | 直さない。台帳から導くと、台帳を誤って書き換えたときにテストの期待も一緒に変わり、気づけない。役割ごとにリンクを出すか出さないかを、方針として明示する検査にしておく（台帳との照合は、同じファイルの「台帳（AC4）」が別に見る） |
| 6 | low | いま開いているページ（`current`）を画面ごとに固定する静的な検査が無い | 直した。`comparison-gap-source.test.ts` で、一覧は `null`、1本は `"form"`、使うKPIを選ぶは `"selection"` を渡すことを固定した |
| 7 | low | 320px で本文が 29px 横に流れる件（受け入れの幅の外）が、follow-up として起票されていない | 外部への起票はしない。受領書「受け入れの幅の外（320px）」に記録済みで、最後の報告で follow-up の候補として挙げる。→ レビューのあとに直した（下の「レビューのあとの追記」） |

## 4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | DD-012 の6・7、受領書の AC5、テストの名前が、入口（`formSyncGaps`）と断り方（理由の文）で同じことを言う |
| 漏れなし | PASS | AC1〜AC7 のすべてに証跡がある。指摘7件すべてに扱いがある |
| 整合性あり | PASS | scope_out の6項目をファイルの差分で確かめ、コードの差分0件。文書の混ざりは扱いを決めた |
| 依存関係整合 | PASS | P09（品質と安全）の high 0件 → このレビュー（P10）→ 証跡（P11）→ 文書（P12）の順 |

## レビューのあとの追記（2026-10-15）

利用者の「他タスクを全て完了して欲しい」を受けて、follow-up の候補だった2件と、残っていた TODO を片付けた。上の表と4条件は、レビューのときの記録として残す。

| 対象 | したこと | 確かめ方 |
|---|---|---|
| 指摘1（所属の決定の実装） | `memberships.ts` に `activeMembershipsByCompanyName` を足し、選んでいる会社が無いときに開く会社と、会社の切り替えの一覧を、会社名の順（同名は会社 id の順）にした。`users` の写しの基準は古い順のまま（DD-009 の更新）。古い一文が残っていた dev-graph の4ノードは C02 の update で、登録の無い `architecture/improvement-requests-2026-10.md` は手で直した | `session.integration.test.ts`・`memberships.integration.test.ts`。改名で開く会社が変わること、一覧の先頭が開く会社と同じことを固定した |
| 指摘7（320px の横流れ） | アンケート1本の画面で、札「回答画面に配点・ランク基準は表示されません」とボタン「いまの評価項目に合わせて設問を作り直す」の枠の中だけ、文節で折り返す。`globals.css` は変えない | 5本のアンケートを 320px・375px・768px で開き、画面の横流れが 0px |
| `pickFix` の TODO | 直す操作の順は DD-012 の5のまま変えず、その理由を注釈にした。`TODO(human)` は0件 | `comparison-gap.test.ts` |
| 指摘1の影響（見本のマネージャー） | 会社名の順で、見本の `manager@kyufu` はさくら福祉会（一般）が先に開くようになった。手で動かす `capture-theme-gallery.mjs`（`--company`、既定 `cmp_kyufu`）と `scan-rendered-text.mjs` は、会社の切り替えと同じ cookie で給付事業を選ぶ。README と配色ギャラリーの手順に切り替え方を書いた | preview で、cookie なしは `/me`、`cmp_kyufu` は `/manager`、所属の無い `cmp_mirai` は `/me`。走査の上長は 80 経路（うち `/manager` の下を含む） |

所属の変更は、この feature（比べる警告）の範囲の外である。コミットは比べる警告と分ける。

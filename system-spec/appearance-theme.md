# 画面の外観（明るさ・配色） — システム仕様

- graph_node_id: `chore-aidd-kit-1-11-indigo-default`
- beads: `hr-fo1`
- 正本（製品）: `docs/product/spec.md`「テーマ契約（全画面共通）」「配色（テーマの系統）」 / 判断: `docs/product/design-decisions.md` DD-003
- 実装入口: `src/lib/theme.ts` / `src/lib/palette.ts` / `src/lib/theme-preferences.ts` / `src/app/api/theme-choice/route.ts`

## 1. 値の集合

値は1か所で決め、画面・API・DB の3層で同じ集合を検査する。

| 軸 | 値 | 正本 | API（`themePreferenceSchema`） | DB（`theme_user_preferences`） |
|---|---|---|---|---|
| 明るさ `mode` | `auto` / `light` / `dark` | `THEMES`（`theme.ts`） | `mode` | `ck_theme_user_preferences_mode` |
| 実際の明暗 `resolved` | `light` / `dark` | — | `resolved` | `ck_theme_user_preferences_resolved` |
| 系統 `palette` | `indigo` / `graphite` / `azure` / `sand` / `moss` / `midnight` | `PALETTES`（`palette.ts`） | `palette` | `ck_theme_user_preferences_palette` |

- `mode` が `light` か `dark` のとき、`resolved` は同じ値にする。API（`superRefine`）と DB（`ck_theme_user_preferences_consistent`）の両方で拒否する。
- 系統を足すときや消すときは、`PALETTES`、`globals.css` の `html[data-palette]`、`src/db/schema.ts` の CHECK、新しい migration を同じ PR で変える。SQLite は CHECK を ALTER で変えられないので、表を作り直して既存の行を写す（`drizzle/migrations/0030_theme_palette_indigo.sql` が前例）。

## 2. 既定の表し方

- 既定の系統は `DEFAULT_PALETTE = "indigo"`（2026-09-29 に `graphite` から変えた）。
- 既定は**保存値なし・属性なし**で表す。ブラウザの `hr-palette` には既定以外の系統だけが入り、`html` には既定以外のときだけ `data-palette` が付く。
- このため既定を変えると、保存値のない利用者全員の見た目が変わる。既定の変更は製品判断として扱い、DD に記録する。
- 描画前の初期化は `THEME_INIT_SCRIPT` と `PALETTE_INIT_SCRIPT` の2本に分ける。片方が失敗しても、もう片方は効く。

## 3. 現在設定の記録（`theme_user_preferences`）

| 項目 | 契約 |
|---|---|
| 行 | 利用者ごとに1行（主キーは `user_id`。利用者が消えると連動して消える） |
| 書き込み | `PUT /api/theme-choice`。ログインしていれば全ロールで可。未認証は 401。利用者IDは検証済みのセッションだけから取り、本文の余分なキーは受け付けない（`.strict()`）。不正な値と明暗の矛盾は 400 |
| 同じ値 | 同じ組み合わせを再び送っても、行も `updated_at` も変えない（`upsertThemePreference` の `setWhere`） |
| 送る側 | `recordAppliedThemeChoice` は `html` の属性を正本として読み、応答を待たずに送る。送信に失敗しても画面の切り替えは止めない |
| 読み取り | `GET /api/theme-choice` は SUPER_ADMIN のみ（それ以外は 403）。有効な利用者の人数・割合・計測母数・カバー率だけを返し、個人を識別できる値は返さない。`/system` の「配色の利用状況」も同じ `readThemePreferenceUsage` を使う |
| 旧表 | `theme_choice_counts` は過去データとして残すが、今の人気の判定には使わない |

## 4. 色の値

- 画面のコードは意味トークン（`--surface` / `--ink` / `--brand` / `--cta-*` など）だけを参照する。
- 系統ごとに入れ替えるのは骨格の18個だけ。危険・注意・進行中の色と、人物を見分ける色は系統で変えない。
- どの系統でも、明暗の両方で WCAG AA（本文 4.5:1、境界線 3:1）を満たす。印刷はどの系統・明るさを選んでいても明るい配色で出す。

## 5. 開発キット（aidd-agent-kit）との境界

- キットの `jp-web-design` は、既存のアプリも平賀配色（明るいほうだけ）へ移すことを既定にしている。このアプリは移さない（`AGENTS.md`「配色とテーマ」、DD-003）。
- 移さないことの宣言は2か所にある。`docs/product/T2-experience-spec.md` §5 と、`src/app/globals.css` 冒頭の `brand_color_status: approved`・`brand_color_source: app-theme-contract`・`aidd-color-migration: exclude-brand`。キットの判定は `src` だけを走査して T2 を読まないため、両方に書いてある。
- 判定の期待値：`migrate-legacy-colors.mjs src --json` の `eligibility.status` が `report-only`、`source_theme` が `external-brand`。
- 平賀配色の値は、`indigo` の明るいほうとしてだけ使う。値を取り込んだだけで、暗い表示と系統の選択・保存は残しているので移行にはあたらない。

## 6. 自動検査

| 対象 | テスト |
|---|---|
| 0030 が既存の行を残し、`indigo` を保存できる | `src/db/theme-palette-migration.test.ts` |
| 全系統を保存できる（DB の許可値が `PALETTES` と一致）、1人1行、同じ値では更新しない、集計 | `src/lib/theme-preferences.integration.test.ts` |
| 401 / 403 / 400、本文の利用者IDを無視する、個人データを返さない | `src/app/api/theme-choice/route.test.ts` |
| 骨格18個に過不足がない、全系統×明暗で AA | `src/components/palette-contract.test.ts` |
| 明暗・端末追従・印刷・コントラスト強調 | `src/components/theme-contract.test.ts` |
| キットの判定が `report-only`、2か所の宣言、`src` がキットの CSS を読み込まない | `scripts/aidd-kit-boundary.test.mjs` |

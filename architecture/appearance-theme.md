# アーキテクチャ: 画面の外観と開発キットの境界

- graph_node_id: `chore-aidd-kit-1-11-indigo-default`（「切り替えと記録」と設計判断4・7は `refactor-elegant-review-2026-09-29` で更新）
- beads: `hr-fo1` / `hr-s4s`

## 層分け

```
[描画前]
  layout.tsx
    THEME_INIT_SCRIPT   … hr-theme   → html[data-theme]
    PALETTE_INIT_SCRIPT … hr-palette → html[data-palette]（既定の indigo は属性なし）
        │
        ▼
[色]
  globals.css
    :root（indigo の明るいほう）→ html[data-palette="x"] → +[data-theme="dark"] → 端末追従 → @media print
    画面のコードは意味トークン（var(--surface) など）だけを参照する
        │
        ▼
[切り替えと記録]
  ThemeToggle / PaletteToggle（値の契約と表示は各軸が持つ）
    → useAppearanceChoice（属性の付け外し・保存値・同じ値の無視）
  useAppearanceChoice（選択時）と AccountMenu（表示時・自動モードで端末の明暗が変わったとき）
    → recordAppliedThemeChoice（html の属性を読み、送りっぱなし。送信先の例外も外へ出さない）
    → PUT /api/theme-choice（セッションの利用者ID）
        │
        ▼
[データ]
  theme_user_preferences（1人1行。palette / mode / resolved の CHECK）
    → readThemePreferenceUsage → GET /api/theme-choice（SUPER_ADMIN）・/system の利用状況
```

開発キットは、アプリの外側に次の形で置く。

```
aidd-agent-kit/（編集元。配布元のものを丸ごと置き換える）
    │ sync-project-mac.command
    ▼
.claude/  .agents/skills/  .codex/（実配置。直接編集しない）
    │
    ▼
エージェントが作業時に読む ── AGENTS.md（規約の正本。キットの既定より優先する項目を持つ）
```

## 設計判断

### 1. 明るさと系統を別の軸にする

1つの値にまとめると、「暗いまま系統だけ変える」ができなくなる。保存キーも、描画前の初期化も2つに分けた。片方が壊れても、もう片方は効く。

### 2. 既定は「保存値なし」で表す

既定の系統には属性も保存値も持たせない。こうすると、既定の色は `:root` に1回書くだけで済み、属性の書き忘れも起きない。そのかわり、既定を変えると保存値のない利用者全員の見た目が変わる。2026-09-29 の `graphite` から `indigo` への変更では、この性質を承知のうえで変えた（DD-003）。

### 3. 許可値を DB でも検査する

画面とAPIは `PALETTES` を直接使うので、ずれは起きない。DB の CHECK だけは SQL に値を直接書くので、系統を足すとずれる。0030 は、`PALETTES` に `indigo` を足したのと同じ変更で CHECK を広げ、API は受け付けるのに DB が拒否する状態を作らないようにしたもの。結合テストで全系統の保存を確かめ、次に系統を足したときのずれを検出する。

### 4. 記録は見た目の切り替えから切り離す

`theme-usage.ts` を1枚挟んで、切り替えの部品は送信先を知らないようにした。記録に失敗しても色は変わる。送信先を差し替えるときは `setThemeChoiceSink` だけを変えればよい。差し替えた送信先が同期的に例外を投げても、`recordAppliedThemeChoice` の中で止め、切り替えや初回表示へ返さない。

### 5. キットの配色は「値として取り込む」だけにする

キットの既定に従って移行すると、暗い表示と系統の選択・保存が消える。そこで、平賀配色の値を `indigo` の明るいほうとして取り込み、移行はしないと宣言した。宣言は T2 と `globals.css` の2か所に置く。キットの判定は `src` だけを走査するので、T2 だけに書いても判定に効かないからである。境界は `scripts/aidd-kit-boundary.test.mjs` で固定する。

### 6. キットの規約とこのアプリの規約を分けて置く

キットの実配置は sync で上書きされるので、アプリ固有の決まりを書いても次の更新で消える。アプリ固有の決まりは `AGENTS.md` に置き、`CLAUDE.md` からはそれを読み込むだけにする。改善要望の手順（`.claude/commands/improvements.md` / `improve-request.md`）はキットの管理対象外なので、リポジトリ側で直接直す。

### 7. 選ぶ操作だけを共通にし、値の契約は各軸に残す

明るさと系統の切り替えは、保存値の読み込み・属性の付け外し・保存・同じ値の無視・記録という同じ手順を別々に書いていた。片方だけ直すと2軸の振る舞いがずれるので、手順を `useAppearanceChoice` に1つにした。一方、許可値・既定・「保存値なしで表す値」は軸ごとに違うので、`stored` と `explicit` を各軸（`theme.ts` / `palette.ts`）から渡す形にして、フックは値の意味を知らないようにした。描画前の初期化（`THEME_INIT_SCRIPT` / `PALETTE_INIT_SCRIPT`）は React の外で走る必要があるため、共通化しない。

## 主要ファイル

| 役割 | パス |
|---|---|
| 明るさの値・初期化 | `src/lib/theme.ts` |
| 系統の値・既定・初期化 | `src/lib/palette.ts` |
| 色の正本 | `src/app/globals.css` |
| 記録の層 | `src/lib/theme-usage.ts` |
| 保存・集計 | `src/lib/theme-preferences.ts` / `src/app/api/theme-choice/route.ts` |
| DB | `src/db/schema.ts`（`themeUserPreferences`） / `drizzle/migrations/0030_theme_palette_indigo.sql` |
| キットとの境界 | `AGENTS.md` / `docs/product/T2-experience-spec.md` §5 / `scripts/aidd-kit-boundary.test.mjs` |
| キット更新の受け入れ確認 | `AGENTS.md`「キット更新時の受け入れ確認」 |

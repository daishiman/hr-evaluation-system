# 移行マッピング表（元スプレッドシート → データベース）

いまスプレッドシート・Googleフォーム・GASでやっている運用を、このシステムのどこに置き換えたかの対応表。
「元のどのシートの・どの行／設問が」「どのテーブルの・どのレコードになったか」を1対1でたどれるようにしてある。

- 元データは **読み取りのみ**。スプレッドシート・フォームには一切書き込んでいない。
- 抽出した中身は `data/*.json` に保存し、`scripts/seed-data.mjs` がこれを読んでDBに投入する。
  読み取り直しをしなくても、同じデータを何度でも入れ直せる。
- 投入先は **システム標準テンプレート会社（`cmp_template`）** と、**実際に運用している給付事業（`cmp_kyufu`）** の2社。
  新しい会社を作るとテンプレートが丸ごと複製され、その会社だけで自由に直せる。

## 0. 元データの一覧

### 0-1. メインのスプレッドシート（`1zOj1z6wNDAoaTPGZ7vBg20IJ1y-VlMUs-g2Bg-J6Fr0`）

| # | シート名 | gid | 行数 | 抽出先 | 読み取り |
|---|---|---|---|---|---|
| 1 | フォーム管理 | 907180001 | 100 | `data/_source-sheet.txt` | 済 |
| 2 | KPI基準定義_項目マスタ | 1045248833 | 118 | `data/kpi-master.json`（33件） | 済 |
| 3 | KPI基準定義_ランク基準 | 310244027 | 166 | `data/kpi-ranks.json`（165件） | 済 |
| 4 | KPI基準定義_フォーム設問 | 148404623 | 74 | `data/kpi-questions.json`（73件） | 済 |
| 5 | KPI基準定義_配点（保留） | 993024504 | 180 | `data/kpi-points.json`（165件） | 済 |
| 6 | KPI基準定義_昇給ルール（仮） | 664342446 | 95 | `scripts/seed-data.mjs` の `RAISE_POLICY` ほか | 済 |
| 7 | KPI基準定義_昇給設定（管理者） | 2097931523 | 77 | `scripts/seed-data.mjs` の `RAISE_BY_GRADE` ほか | 済 |
| 8 | 等級・行動指針・等級要件の各シート | — | — | `data/grades.json`（7）／`data/behavior-guidelines.json`（10）／`data/grade-requirements.json`（65）／`data/promotion-requirements.json`（30） | 済 |

### 0-2. 等級ごとのGoogleフォームと回答スプレッドシート（7本）

「フォーム管理」シートに、等級ごとのフォームID・回答用URL・編集用URL・回答一覧URL・内部キー（`grade1_col2` など）が並んでいる。
**7本の回答スプレッドシートは中身が `test` 行だけで、本番の回答実績は入っていなかった**ため、回答データの移行は行っていない。
設問そのものは上記の「KPI基準定義_フォーム設問」と「等級要件」「行動指針」から再生成している（§3）。

## 1. 制度マスタの対応表

| 元シート（gid） | 元の1行 = | 投入先テーブル | レコードID の付け方 | 件数（1社あたり） |
|---|---|---|---|---|
| KPI基準定義_項目マスタ（1045248833） | KPI項目1つ | `kpi_items` | `kpi_{会社キー}_{項目No}` | 33 |
| （同上の分類） | — | `kpi_categories` | `cat_{会社キー}_{カテゴリコード}` | 7 |
| KPI基準定義_ランク基準（310244027） | 項目×ランク1組 | `kpi_rank_criteria` | `krc_{会社キー}_{項目No}_{ランク}` | 165 |
| KPI基準定義_フォーム設問（148404623） | 設問1つ | `kpi_questions` | `kq_{会社キー}_{設問ID}`（例 `kq_kyufu_c_1`） | 73 |
| KPI基準定義_配点（保留）（993024504） | 項目×ランク×等級グループの点 | `scheme_items` / `scheme_rank_ratios` | `si_{会社キー}_{項目No}` / `srr_{会社キー}_{ランク}` | 8 / 5 |
| 等級シート | 等級1つ | `grades` | `grd_{会社キー}_{等級コード}` | 7 |
| 等級要件シート | 要件1行 | `grade_requirements` | `greq_{会社キー}_{行番号}` | 65 |
| 昇格要件シート | 要件1行 | `promotion_requirements` | `preq_{会社キー}_{行番号}` | 30 |
| 行動指針シート | 観点1つ | `behavior_guidelines` | `bg_{会社キー}_{等級帯}_{観点}` | 10 |
| 行動指針シート（段階の記述） | 観点×段階 | `behavior_levels` | `blv_{会社キー}_{観点index}_{段階index}` | 50 |

### 1-1. 列レベルの対応（KPI項目マスタ）

| 元の列 | `kpi_items` の列 |
|---|---|
| No | `no` |
| 項目名 | `name` |
| 実績区分 | `measure_type` |
| 実績値の単位 | `unit` |
| 評価方向 | `direction`（「低いほど良い」を含めば `lower`、それ以外は `higher`） |
| 実績値の計算式（設問IDで表記） | `formula` |
| 自動決定・固定値の扱い | `formula_note` |
| ＊評価の意図 | `intent` |
| データ取得元 | `data_source` |
| 判断時期 | `judge_timing` |
| A水準の型／Aランクの基準／制御可能性／なぜその水準をAとするか／備考 | `a_type` / `a_standard` / `controllability` / `a_rationale` / `remarks` |
| （備考に「新規（素案）」を含む行） | `is_provisional = 1` ＋ `provisional_note`（画面に「仮」と表示される） |
| 項目No = 1（等級要件達成率） | `is_fixed_slot = 1`（8項目の固定枠） |

### 1-2. 列レベルの対応（ランク基準＝判定の正本）

| 元の列 | `kpi_rank_criteria` の列 |
|---|---|
| 項目No | `kpi_item_id`（`kpi_{会社キー}_{項目No}` に解決） |
| ランク | `rank` |
| 基準（表示用） | `display_label` |
| 下限 / 上限 | `lower_bound` / `upper_bound`（数値。空欄は NULL＝上限・下限なし） |
| 境界の判定条件 | `boundary_expr` |
| ランクの意味 | `meaning` |
| 対象等級 | `target_grades` |
| 検索キー（`1-A` など） | 使わない。`kpi_item_id` + `rank` の組で一意にしている（VLOOKUPのキーに相当） |

判定は `lower_bound` / `upper_bound` をサーバー側で読んで行う。閾値はコードに一切書いていない。

### 1-3. 昇給ルール（gid=664342446 / 2097931523）

| 元シートの箇所 | 投入先テーブル | 備考 |
|---|---|---|
| 【1】判定の単位・反映時期・対象者 | `raise_policies`（`rp_{会社キー}`） | 元シートが「（仮）」のため全行 `is_provisional = 1` |
| 【3】ランクの組み合わせ表（4パターン） | `raise_patterns`（`rpat_{会社キー}_{連番}`） | 8項目すべてAで昇給、など |
| 【4】連続達成の加算・端数処理 | `raise_policies` の `streak_*` / `rounding_unit` | 元シートでは加算「使わない」設定 |
| 【6】賞与の計算（1点あたり金額・原資） | `raise_policies` の `bonus_yen_per_point` / `bonus_pool_yen` | |
| 事業所KGI達成係数の表 | `kgi_coefficients`（`kgi_{会社キー}_{連番}`） | |
| 特例7件 | `raise_exceptions`（`rexc_{会社キー}_{連番}`） | 自動適用はしない（画面に明記） |
| 等級別の昇給額・回数上限（管理者シート） | `raise_settings`（`rs_{会社キー}_{等級コード}`） | 金額を変えると `raise_revisions` に改定履歴が1行残る |
| 改定履歴（数式入りの欄） | `raise_revisions` | 元シートの履歴は空だったため0件から開始 |

## 2. GASでやっていたこと → システムのどこ

| 元の仕組み | 置き換え先 |
|---|---|
| 「フォーム管理」シートのA列チェック＝フォーム同期 | `/admin/forms`（アンケートのワンクリック発行・公開） |
| 「フォーム管理」シートのI列＝最新KPIで再集計 | `/manager/cycles`・個人ページの「再集計」ボタン（`src/lib/evaluate.ts`） |
| 等級ごとに7本あるGoogleフォーム | 1つの `forms` テーブル。等級は `grade_id` という属性にした（分散をやめた） |
| フォームの回答用URL | `/f/{公開トークン}`（ログイン不要の回答画面） |
| 回答一覧スプレッドシート | `/admin/forms/{id}/responses`（未回答者も並ぶ）＋ CSV書き出し |
| VLOOKUP（検索キー `1-A` で閾値を引く） | サーバー側の判定（`kpi_rank_criteria` をDBから読む） |
| 手作業の等級要件チェック | `evaluation_requirements` / `evaluation_gates` に判定結果を保存 |
| URLを配って回答してもらう運用 | ロール（SUPER_ADMIN / COMPANY_ADMIN / MANAGER / EMPLOYEE）でのアクセス制御 |
| 基準を直したときの手作業の再集計 | 影響検出（`src/lib/impact.ts`）＝基準の更新時刻と評価の計算時刻を比べて、再集計が必要なサイクルを自動で出す |

## 3. アンケート設問の組み立て（`form_questions`）

元の7本のGoogleフォームの設問は、次の3つを合成して1本のアンケートとして再生成している。
1本のフォームIDに対して `frm_{会社キー}_{サイクルキー}_{等級コード}`、設問は `fq_{フォームID}_{連番}`。

| セクション | 元データ | 紐づく列 |
|---|---|---|
| 支援・運営（○×） | 等級要件（`grade_requirements`） | `grade_requirement_id` |
| 行動指針 | 行動指針の段階（`behavior_guidelines` / `behavior_levels`） | `behavior_guideline_id` |
| KPI実績 | KPI設問（`kpi_questions`） | `kpi_item_id` ＋ `kpi_question_key` |
| 昇格要件（研修等） | 昇格要件（`promotion_requirements`） | `promotion_requirement_id` |

**点数・配点・昇格に必要な点数は、回答画面には一切出していない**（設問には閾値を持たせていない）。

## 4. 補足・注意

- **`data/kpi-ranks.json` は33項目×5ランク＝165行がそろっている**（元シート166行＝ヘッダー1行＋165行）。欠けている行はなく、補完した値はない。
- **「新規（素案）」と書かれていたKPI項目**は `is_provisional = 1` で入れてあり、画面に「仮」と表示される。決まった内容に直して保存すれば表示は消える。
- **昇給ルールは元シートが「（仮）」**のため、`raise_policies` / `raise_settings` / `promotion_thresholds` / `scheme_rank_ratios` / `kgi_coefficients` はすべて「仮」扱いで投入している。`/admin/raises` から直せる。
- **仮名化はしていない**。元の回答スプレッドシート7本は `test` 行だけで個人情報を含んでおらず、デモに出てくる社員は架空の人物のため。
- 基準マスタの更新時刻は、投入時に `2025-01-01` を入れている（過去サイクルの評価より前）。ここを投入日にすると、投入直後から「基準を直したのに再集計していない」と警告が出てしまうため。

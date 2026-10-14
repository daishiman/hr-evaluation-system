# 等級名と表示名の書き換え（移行 0033・0034・0035）の旧から新への対応

親文書: [`docs/migration-mapping.md`](./migration-mapping.md) §12

どの画面でも、その会社の等級名（`等級N` / `等級N-M`）だけで等級を表す（要件 (1)・DD-008）。
そのために本番の値を書き換える移行と、1人が複数の会社に所属できるようにする移行の、旧から新への対応をここにまとめる。
予行の記録（件数・2回目の変化・戻しの結果）は
[`eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json`](../eval-log/feature-improvement-requests-2026-10-migration-rehearsal.json) にある。

| 移行 | 何をするか | 戻し方 |
|---|---|---|
| `0033_company_memberships` | 所属の表を作り、今の利用者の会社を最初の所属として写す | アプリの版を戻す（表は残す） |
| `0034_grade_display_names` | 等級名と、等級名を含む表示名を書き換える | `drizzle/rollback/0034_grade_names_rollback.sql` |
| `0035_migration_corrections` | 予行で見つかった 0034 の漏れを直す | `drizzle/rollback/0035_migration_corrections_rollback.sql` |

0033・0034 は本番に当て済みとして扱い、書き換えない。予行で見つかった直しは 0035 の1本にまとめた（P08 の範囲）。

## 12-1. 0033：利用者から所属への写し

`users` の1行から `company_memberships` の1行を作る。全体管理者（`SUPER_ADMIN`）と会社の無い利用者は写さない。

| 旧（`users`） | 新（`company_memberships`） |
|---|---|
| `id` | `id = 'mem_' || users.id`、`user_id = users.id` |
| `company_id` | `company_id` |
| `role`（`EMPLOYEE` / `MANAGER` / `COMPANY_ADMIN`） | `role`（同じ値） |
| `grade_id` `office_id` `manager_id` | 同じ列 |
| `employee_code` `department` `hired_at` `profile_note` | 同じ列 |
| `created_at` `updated_at` | 同じ値 |

- 写す条件は `company_id IS NOT NULL AND role IN ('EMPLOYEE','MANAGER','COMPANY_ADMIN')`。
- `id` を利用者の `id` から作るので、2回目は同じ行に当たって何もしない（`INSERT OR IGNORE`）。
- `users` の同じ列は元の所属の写しとして残す。版を戻しても、表を残したまま元の動きになる。

## 12-2. 0034：等級名と表示名

書き換えた行は `display_name_rewrites` に「表・行・列・旧い値・新しい値・移行名」を残す。
書き換えるのは、今の値が記録の旧い値のままの行だけ。`updated_at` は進めない（基準を変えたことにしない）。
`id` `code` `point_group` は変えない。

### 1-g. 等級名（`grades.name`）

既定の code の等級だけを書き換える。会社が作った code の等級は変えない。

| code | 旧 | 新 |
|---|---|---|
| `beginner` | 等級１：Beginner | 等級1 |
| `regular` | 等級２：Regular | 等級2 |
| `chief` | 等級３：Chief | 等級3 |
| `am1` | 等級４：AM Ⅰ | 等級4-1 |
| `am2` | 等級４：AM Ⅱ | 等級4-2 |
| `manager1` | 等級５：Manager Ⅰ | 等級5-1 |
| `manager2` | 等級５：Manager Ⅱ | 等級5-2 |

### 1-a〜1-f. 等級名を含む表示名

| 記号 | 列 | 旧 | 新 |
|---|---|---|---|
| 1-a | `forms.title` | `{評価期間} {今の等級名} 実績アンケート`（既定の題名） | `''`（題名を保存せず、画面で組み立てる） |
| 1-b | `behavior_band_sets.name` | 英語の区分名を含む名前 | `''`（画面で等級名から組み立てる） |
| 1-c | `promotion_thresholds.label` | B→R / R→C / C→AM / AMⅠ→AMⅡ / AM→M / MⅠ→MⅡ | 等級1→等級2 / 等級2→等級3 / 等級3→等級4-1 / 等級4-1→等級4-2 / 等級4-2→等級5-1 / 等級5-1→等級5-2 |
| 1-d | `promotion_requirements.transition_label` | 等級１→等級２ / 等級２→等級３ / 等級３→等級４ /「AMⅠ→ AMⅡ」/ 等級４→等級５ /「ManagerⅠ→ ManagerⅡ」 | 等級1→等級2 / 等級2→等級3 / 等級3→等級4-1 / 等級4-1→等級4-2 / 等級4-2→等級5-1 / 等級5-1→等級5-2 |
| 1-e | `promotion_requirements.text` | スキルアップ研修（チーフ以上） | スキルアップ研修（等級3以上） |
| 1-f | `grade_point_rules.note` | 20点枠はChief以上のみ / Chief以上から / 利益率はChiefでは選べない / AMⅠとAMⅡは配点が同じ / ManagerⅠとManagerⅡ… | 20点枠は等級3以上のみ / 等級3以上から / 利益率は等級3では選べない / 等級4-1と等級4-2は配点が同じ / 等級5-1と等級5-2… |

- 1-a は、題名が「今の等級名」で作った既定の題名と一致するときだけ。等級名が既定の名前（`等級1` など）なら、会社が書いた題名とみなして変えない。
- 1-b の英語の区分名は語として一致するものだけ（`AM` は前後が英字でないとき）。
- 1-d・1-e は現行版だけ。過去の版（`is_current = false`）は履歴なので書き換えない。
- 昇格要件の内容の不変を守るトリガー（`trg_promreq_semantic_immutable`）は、書き換えの間だけ外して同じ定義で作り直す。

## 12-3. 0035：予行で見つかった直し

| 記号 | 列 | 旧 | 新 | 対象 |
|---|---|---|---|---|
| 1-a | `forms.title` | `{評価期間} {前の等級名} 実績アンケート` | `''` | 前の等級名は、code ごとの seed の名前と、`constitution_events.before_json.name` に残る名前 |
| 1-b | `kpi_items.formula_note` `intent` `remarks` | seed の文（7組。下の表） | `data/kpi-master.json` の文 | 値がまるごと seed の文と同じ行だけ |
| 1-c | `form_questions.title` `form_answers.question_title` `evaluation_gates.text` | スキルアップ研修（チーフ以上） | スキルアップ研修（等級3以上） | 値がまるごと同じで、昇格要件に結び付いた行だけ |
| 1-c | `evaluations.promotion_blocked_reason` `promotion_blocked_reason_employee` | 旧い本文を含む文 | その部分だけ置き換えた文 | 記録には文の全体を残す |

1-b の組（旧 → 新）。

| 列 | 旧 | 新 |
|---|---|---|
| `formula_note` | Beginner=5／Regular=5／Chief=5／AM Ⅰ=3／AM Ⅱ=2／Manager Ⅰ=2／Manager Ⅱ=2 | 等級1=5／等級2=5／等級3=5／等級4-1=3／等級4-2=2／等級5-1=2／等級5-2=2 |
| `formula_note` | Regular/Chief＝本人…、AM/Manager＝事業所全体… | 等級2・等級3＝本人…、等級4-1〜等級5-2＝事業所全体… |
| `formula_note` | AM=3回（対象=Reg・Beg・Pt）／Manager=2回（対象=AM・Chief） | 等級4-1・等級4-2=3回（対象=等級2・等級1・Pt）／等級5-1・等級5-2=2回（対象=等級4-1・等級4-2・等級3） |
| `intent` | Reg/Chiefは個人で…。AM/Managerは事業所全体で… | 等級2・等級3は個人で…。等級4-1〜等級5-2は事業所全体で… |
| `intent` | Reg以下の人を… | 等級2以下の人を… |
| `remarks` | Managerに10点を置くと… | 等級5-1・等級5-2に10点を置くと… |
| `remarks` | 経営責任のあるAM/Managerのみ… | 経営責任のある等級4-1〜等級5-2のみ… |

表の「…」は旧と新で同じ文。全文は 0035 の 1-b と `data/kpi-master.json` にある。

アンケートの設問名・回答の設問名・必須ゲートの文は「当時の文面で読み返す」ための写しだが、0035 で変えるのは等級の呼び名だけで、聞いた中身は変わらない。
0034 が既定の題名や昇格要件の本文を直したのと同じ扱いにした（DD-008）。会社が自由に書いた設問は変えない。

## 12-4. 前の名前を受け付ける取り込み

書き換えたあとも、会社の手元のファイルは前の名前のままのことがある。取り込みは前の名前でも受け付ける。

| 取り込み | 前の名前の引き先 | 今の名前と重なるとき |
|---|---|---|
| 回答CSVの列見出し | `display_name_rewrites`（`form_questions.title`、同じ会社・同じアンケートの設問だけ） | 今の設問名を優先する |
| メンバーCSVの等級 | `display_name_rewrites`（`grades.name`、同じ会社の今ある等級だけ） | 今の等級名・code を優先する |

## 12-5. 戻し方と確かめ方

1. 流す前に `wrangler d1 export` で全体を書き出す。
2. 戻すときは 0035 の戻しを先に流し、そのあとで 0034 の戻しを流す（0035 は 0034 のあとの値を前提に記録している）。
3. 戻すのは「今の値が移行の書いた値のままの行」だけ。移行のあとに会社が直した値は上書きしない。戻らない行は流す前に次で確かめる。

   ```sql
   SELECT * FROM display_name_rewrites
   WHERE migration IN ('0034_grade_display_names', '0035_migration_corrections');
   ```

4. 記録の表（`display_name_rewrites`）と所属の表（`company_memberships`）は消さない。もう一度流しても最初の値の記録は上書きされない。
5. 書き出しから戻すときは、書き出しの文を「PRAGMA → CREATE TABLE 全部 → INSERT → INDEX・TRIGGER」の順に並べ替えてから流す。
   D1 は外部キーを常に確かめるので、書き出しの順のまま流すと、参照先の表より先に参照元の行が入って止まる。

予行では、2回目の実行の変化が 0 行、戻したあとの全表の差が 0 行、書き出しからの復元がバイト単位で一致した。
本番での実行と記録は SYS-IR-P13 の範囲で、本番の D1 への直接の書き込みはこの文書の手順でも行わない（利用者の確認のあとに流す）。

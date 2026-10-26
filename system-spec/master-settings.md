# 制度設定と評価への反映 — システム仕様

- graph_node_id: `feat-master-settings-responsibility-split` / `feat-master-definition-revisions` / `chore-release-safety-and-ssot`
- beads: `hr-hco` / `hr-2qk` / `hr-0p4`
- 正本（製品）: `docs/product/spec.md` §3、§5-1、§7 / `docs/product/spec-master-definition-revisions.md`
- 実装入口: `src/app/admin/` / `src/actions/masters.ts` / `src/lib/masters/` / `src/lib/impact.ts`

## 1. 権限と会社境界

- 制度設定画面と更新APIの最小ロールは `COMPANY_ADMIN`。
- COMPANY_ADMIN は所属会社、SUPER_ADMIN は選択中の操作対象会社だけを扱う。
- ID指定更新は、更新前に `id + viewer.companyId` で対象の存在を確認する。他社IDを受け取っても更新しない。
- ナビゲーションの非表示は認可の代わりにしない。画面は `requireRole`、APIは `apiViewer` で同じ境界を強制する。

## 2. 画面の単一責務

| 画面 | 所有する設定 |
|---|---|
| `/admin/masters` | 等級の名前・水準・半期の目標設定上限数 |
| `/admin/masters/requirements` | 等級要件（支援・運営） |
| `/admin/masters/promotion` | 昇格に必要な点数・点数外の昇格要件 |
| `/admin/behavior` | 行動指針の等級適用・観点・段階文言 |
| `/admin/scheme` | 等級区分ごとの評価項目・配点・ランク割合・KPIランク基準 |
| `/admin/raises` | 昇給方針・等級別金額・事業所調整・改定履歴 |

ダッシュボードの暫定件数は昇格条件と昇給額を別々に数え、前者を `/admin/masters/promotion`、後者を `/admin/raises` へ案内する。合算件数から1画面だけへ案内してはならない。

### KPI項目選択の不変条件

1. 固定の No.1（等級要件達成率）以外は、操作対象会社に登録されたKPI全項目から自由に選べる。
2. `kpi_reference_points` の行の有無、カテゴリ、`is_monetary`、ランク基準の `target_grades` は選択可否の制約にしない。`target_grades` が対象外なら保存を許し、基準が厳しすぎる可能性を警告する。
3. 拘束する正本は `grade_point_rules`。等級区分ごとの件数（1 / 3 / 6 / 7 / 8）、固定・重い・通常の各枠数と配点、合計100点、項目IDの重複禁止を画面とAPIで共有する。8件はManagerだけである。

### KPI項目の実績の聞き方

1. 設問のひな形（`kpi_questions`）は、`/admin/scheme` の KPI 項目の「実績の聞き方」で作る・直す。聞くことは数で答える設問の A〜F の6つまで（[DD-016](../docs/product/design-decisions.md)）。
2. 計算式は聞くことを文字で指して書き、保存のときにサーバーが設問の key に置き換える。key と設問の役割は利用者に打たせない。新しい key は会社のひな形とアンケートの設問のどの番号より大きくし、使い回さない。
3. 回答を集めているアンケートがある項目は、聞くことを足すことも消すこともできない（文言・単位・入力の決まり・並び・計算式は直せる）。画面で表せない設問を持つ項目と固定枠は読むだけにする。
4. 検査は画面と保存で同じ関数を使い、この項目に無い key は 409、同じ key の2回送りと読むだけの項目への送信は 400 で断る。変える前と後の聞き方の要約は `constitution_events` に、本体と同じ batch で残す。

## 3. 変更の反映とスナップショット

1. KPIランク基準、評価項目・配点、ランク割合、昇格点数、KPI計算式は `src/lib/impact.ts` の監視対象とする。更新時刻が評価の `computedAt` より新しい場合、確認中評価を再集計対象として扱う。等級要件・昇格要件・行動指針はフォームへ写した定義を評価するため、監視対象に含めない。
2. `evaluations.status = finalized` は再集計しない。判定時の配点・閾値・根拠を保存したまま据え置く。
3. 再集計可能件数が1件以上なら `/manager/cycles?cycle=...` への導線を出す。0件ならリンクを出さず、確定済みが当時の基準のまま残ることだけを説明する。
4. 行動指針の観点名・段階文言・選択肢は、アンケート作成時に `form_questions` と選択肢へ写す。評価はその写しを使うため、行動指針の変更を既存評価の stale 判定へ含めない。
5. 賞与（仮）は KPI評価点合計と1点あたりの金額（`raise_policies.bonus_yen_per_point`）だけで決まり、評価を作るときに保存する。1点あたりの金額は監視対象に含めない（画面から変える入口が無く、表の他の列は評価の計算に効かないため）。事業所の達成率と達成係数は 2026-10-19 に仕組みごと削除した（[DD-024](../docs/product/design-decisions.md)）。

設定保存後の自動追従（G27・I29・I30）は [製品仕様 §30-2](../docs/product/spec.md) と [設定の写しの一覧](../docs/product/settings-copy-ledger.md) を正とする。判定に効く設定は確定前の評価を集計し直す。等級要件・昇格要件・行動指針はアンケートを追従させるが、既存評価は回答した時点の文を保つため、この3種類の保存では再集計しない（`FOLLOW_TARGETS`）。監視対象と回答時点の写しを分ける上記1・4の原則は維持する。

## 4. UI・API整合

- 画面に表示する現在値と送信値を一致させる。対象を切り替えるフォームは、切替後のレコードの値で入力を初期化する。
- 行動指針の `isActive=false` は設問を生成するときの候補から除外し、既存下書きへの追従は製品仕様 §30-2 の状態別規則に従う。
- KPIランク基準は `/admin/scheme` から遅延取得し、保存後はキャッシュを破棄して再取得する。

## 5. 等級要件・昇格要件の版ライフサイクル

### 5-1. データ不変条件

- `grade_requirements` と `promotion_requirements` は、意味のある内容を直すたびに新しい `id` の行をINSERTする。改訂時は旧行を1列もUPDATEせず、旧版の `is_active` / `seq` も改訂時点の履歴値として残す。
- 新版の `previous_version_id` は、その時点の現行版を指す。過去版の内容を再採用するときも、過去版をactiveにせず、現行版を `previous_version_id` とする新しい行を作る。
- `previous_version_id` は一意。1つの版から複数の後続版を作れない。競合はサーバーが `409` として返す。
- 現行版は、別行の `previous_version_id` から指されていない系譜末尾。過去版は履歴として返すが、future formの候補にはしない。
- `seq` と現行版の `is_active` は将来フォームの構成値としてUPDATEできる。後続版ができた旧版は値にかかわらず現行候補から外す。現行版の `is_active=false` は可逆で、同じ現行版idを `true` に戻す。
- 等級要件のactive上限10は `company_id + grade_id + category` で数える。追加・再開と件数確認は同一の原子的保存単位で行う。
- id指定操作の会社・等級・区分・種類は保存済み行から導出する。リクエスト本文で対象範囲を上書きできない。
- 完全削除は同じ系譜の全版について利用実績を確認する。`form_questions` または評価スナップショットが1件でも参照する系譜は削除しない。

### 5-2. API command

サーバーアクション `saveMaster`（`src/actions/masters.ts`）は操作の意味を `kind` で分離する。
本体と監査記録は1回の D1 batch で書き（`writeMasterBatch`）、同じ実体の監査番号が重なる同時保存は 409 で断る（`uq_ce_entity_seq`、移行 0032）。

| 対象 | 新規 | 意味の改訂 | 使用停止・再開 | 過去内容の再採用 | 並べ替え |
|---|---|---|---|---|---|
| 等級要件 | `gradeRequirementCreate` | `gradeRequirementRevise` | `gradeRequirementActivation` | `gradeRequirementRestoreContent` | `gradeRequirementOrder` |
| 昇格要件 | `promotionRequirementCreate` | `promotionRequirementRevise` | `promotionRequirementActivation` | `promotionRequirementRestoreContent` | `promotionRequirementOrder` |

- Createだけが `gradeId` と区分/種類を受け取る。
- 等級要件・昇格要件・行動指針・基準セットの画面は `useMasterAction` に送信・結果通知を集約する。並べ替え中だけはfieldsetを無効化せず、つまみや矢印のフォーカスを維持する。
- 等級要件の入力の寿命は `key={grade.id}` で対象等級へ結び付ける。同じ等級の再描画・保存失敗では下書きを保持し、別等級へ持ち越さない（`e2e/master-editing-scope.spec.ts`）。
- Reviseは `id` と意味フィールド、Activationは `id + isActive`、RestoreContentは `id + sourceVersionId`、Orderは `ids`（並び全体の id の配列。1〜200件）を受け取る（S11・DD-005）。
- id指定commandは `gradeId` / `category` / `reqKind` を受け取らない。
- 一覧は `previousVersionId` を含む全版を返す。画面と削除判定は同じ系譜関数で現行・履歴を分類する。
- Order は先頭の id の保存済み行から会社・等級・区分/種類を導き、同じ範囲の使用中の現行版の集まりと `ids` を照合する。過不足・重複・別区分/別種類・過去版・使用停止中の行が1つでもあれば `409`（再読み込みを促す文言）とし、1行も書かない。知らない id・別会社の id は `404`。
- 照合が通れば、今の `seq` の集まりを新しい並びへ配り直す（使用停止中の行など並びの外の `seq` と重ならない）。今の `seq` に重複がある旧データだけ1始まりへ振り直す。`seq` の変わった行だけを更新し、行ごとに `reordered` の監査記録（before/after の `seq`、entity は系譜の根）を残す。並びが変わらなければ何も書かず「並び順は変わっていません。」を返す。

### 5-3. フォーム・評価・stale境界

- 新規フォームはactiveな現行版だけを読み、版idと文言を `form_questions` に保存する。
- 回答のない下書きは設定保存後に追従し、回答のある公開中からは次版の下書きを作る。細かな状態別規則と失敗時の応答は製品仕様 §30-2 に集約する。手動同期も回答なし等の安全条件を満たす場合だけ許可する。
- 評価はフォームの写しを読み、等級要件・昇格要件の新版作成やactive変更をstale理由にしない。
- 公開済みフォーム、回答、評価、および過去版の行は変更しない。

公開済みフォーム・回答・過去版の行・確定済み評価を保つ境界は、下書きの自動追従後も変えない。等級要件・昇格要件の文は既存評価へ上書きしない。

## 6. 行動指針の等級割当UI

画面の形の正本は [版管理の製品仕様「行動指針をどの等級に出すか」](../docs/product/spec-master-definition-revisions.md#行動指針をどの等級に出すか)、
断る割り当ての規則は [製品仕様 §28-12](../docs/product/spec.md#28-12-行動指針の分け方2026-10-14-の追加要望)、
判断の経緯は [DD-010](../docs/product/design-decisions.md#dd-010-行動指針の基準セットは等級の並びで続いた等級にだけ出せるようにした2026-10-14)。ここには実装の場所と検査だけを書く。

- 画面は `src/app/admin/behavior/page.tsx`。分け方の枠と、その中の等級のタブを描き、選んだ1等級だけを `BehaviorBandAssignmentEditor`（`src/components/BehaviorBandAssignmentEditor.tsx`）に渡す。
  割り当てを変えるのはこの部品だけで、枠は読むだけ。
- 判定は `src/lib/domain/behavior-band-range.ts` の1つ。画面（選べない選択肢と理由・枠・警告）とサーバー（`saveMaster` の kind=grade。`src/lib/masters/apply-master-update.ts`）が同じ関数を使い、サーバーは断る手を 400 にする。
  並び順（`displayOrder`）が同着の等級は id の順に並べ、呼び名と分け方の判定は `grade-label.ts` の `compareGradeOrder` を共有する。
- `grade-assignment-guard.ts` は判定に使った会社の等級（id・並び・使用中・割当）を本体・監査と同じD1 batch内で照合する。別等級の変更・追加・削除で前提が変わった保存は全体を取り消し409にする。規則に関係しない名称や他社は比較しない。監査表を状態の正本にしたり、スキーマを増やしたりしない。
- 保存APIの権限・会社境界・基準セットの存在/active検査は従来どおりサーバーで行う。
- 検査: `src/lib/domain/behavior-band-range.test.ts`・`src/actions/behavior-band-range.integration.test.ts`（固定した内容は DD-010）、`src/lib/masters/master-concurrent-save.integration.test.ts`（同じ初期状態で検証した別等級の2保存も片方だけ残り、もう片方の等級・監査は書かれない）。

## 7. 制度マスタの変更監査

- 現在状態の正本は各制度マスタテーブルとし、`constitution_events` は変更履歴表示・障害調査用の append-only 監査ジャーナルとする。
- 監査記録の再生結果を画面・計算・復旧の正本にしない。監査欠落または同一 `seq` があっても現在状態の読み取りへ波及させない。
- 制度マスタの更新 command は、本体更新と監査 INSERT を同じ D1 batch（`writeMasterBatch`）で書く。移行0032の `uq_ce_entity_seq` が同一実体の監査番号の重複を拒否し、競合時は本体ごと取り消して409を返す。過去の監査欠落を補完する保証ではない。

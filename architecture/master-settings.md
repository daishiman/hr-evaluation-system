# アーキテクチャ: 制度設定の責務分割

graph_node_id: `feat-master-settings-responsibility-split` / `feat-master-definition-revisions`
beads: `hr-hco` / `hr-2qk`

## 層分け

```
[画面]
  /admin/masters                 … 等級
  /admin/masters/requirements    … 等級要件
  /admin/masters/promotion       … 昇格
  /admin/behavior                … 行動指針
  /admin/scheme                  … KPI・評価セット・ランク基準
  /admin/kgi                     … 達成率・達成係数
  /admin/raises                  … 昇給
  StaleCyclesNotice              … 再集計通知（共通）
        │
        ▼
[API]
  PUT /api/masters
    body-schema.ts          … kind 判別の入力契約
    apply-master-update.ts  … 会社境界確認と保存
  GET /api/masters/rank-criteria … 遅延取得
        │
        ▼
[ドメイン]
  behavior.ts / scoring.rangeLabel / kgi.kgiRangeLabel
  versioned-master.ts（等級要件・昇格要件の現行版と系譜）
  impact.detectStaleCycles（フォームへ写す定義は監視外）
  initial-password.ts（CSV新規発行）
        │
        ▼
[データ]
  grades / grade_requirements / promotion_* /
  behavior_guidelines / behavior_levels /
  kpi_rank_criteria / kgi_coefficients / raise_*
  grade_requirements / promotion_requirements
    previous_version_id（意味変更の一本道）
  form_questions（要件・行動指針の作成時写し）
```

## 設計判断

### 1. 1画面1責務

探しやすさと HTML サイズの両方を理由に分割する。ナビの並びは制度の依存順に固定する。

### 2. 表示ラベルは境界から導く

人が自由に書くと「書いてある範囲」と「判定される範囲」が食い違う。  
`rangeLabel` / `kgiRangeLabel` を正本にし、API は label 入力を受け取らない。

### 3. 行動指針は公開時スナップショット

評価は `form_questions` の写しを読む。マスタを `impact` の監視対象に入れると、再集計しても変わらないサイクルを stale と誤表示する。

### 4. 再集計 CTA は実行可能なときだけ

`recomputable > 0` のときだけ `/manager/cycles` へリンクする。確定済みしかない場合は据え置き説明のみ。

### 5. 仮パスワードはサーバー発行

管理者が共有パスワードを手打ちしない。`crypto.getRandomValues` で行ごとに発行し、レスポンスに一度だけ載せる。

### 6. 500行超ファイルの分割

| 旧 | 新 |
|---|---|
| `api/masters/route.ts` | `body-schema.ts` + `apply-master-update.ts` + `route.ts` |
| `apply-master-update.ts`（要件・行動指針） | `versioned-requirement-update.ts` + `apply-behavior-master-update.ts` |
| `lib/import.ts`（回答+社員） | `import.ts`（回答）+ `import-members.ts`（社員）+ `csv-normalize.ts` |
| `docs/product/spec.md` §7-8 | `docs/product/spec-master-definition-revisions.md` |
| `docs/migration-mapping.md` §11 | `docs/migration-mapping-requirement-revisions.md` |
| `docs/product/backlog.md` 回ごとの記録 | `docs/product/backlog-session-notes.md` |

### 7. 定義の改訂と将来構成を分ける

等級要件・昇格要件の本文は、過去フォームが参照した定義である。
本文等の意味を変えるcommandは、同じ行をUPDATEせず、新idの行をINSERTする。
新行は `previous_version_id` で直前の現行版を指し、DBの一意制約で系譜を一本道にする。
旧行は `is_active` / `seq` を含む全列を改訂時の値のまま残し、後続版の存在によって現行候補から外す。

一方、`is_active` と `seq` は「次のフォームへ出すか・どの順で出すか」という将来構成である。
後続版がまだ無い現行版の同じidを更新できるが、内容改訂と同じcommandへ混ぜない。

```text
旧版 A ──previous_version_id──▶ 現行版 B
  │                                  │
  └─ 過去form/evaluationが参照       ├─ is_active / seq は将来構成
                                     └─ 内容を直すと新版 C をINSERT
```

過去版Aの内容を再採用する場合もAを再開しない。現行版Bの後続Cとして、Aの内容をコピーした新idを作る。
これにより「古い内容へ戻した」という新しい出来事を、系譜を巻き戻さず説明できる。

### 8. commandを操作意図ごとに分ける

| command群 | 入力の責務 | サーバーが決めるもの |
|---|---|---|
| `*Create` | 等級・区分/種類・内容 | 新id、初期順序 |
| `*Revise` | 現行id・意味フィールド | 会社・等級・区分、new id、previous id |
| `*Activation` | 現行id・使用する/しない | bucket、active上限、保存順序 |
| `*RestoreContent` | 現行id・参照する過去版id | 同じ系譜か、new id、previous id |
| `*Order` | 現行id・上下 | 同じbucketの隣接行 |

id指定commandに `gradeId` / `category` / `reqKind` を再送させない。
クライアントの古い状態で別bucketを検査し、別行を更新する不一致を構造上なくす。

### 9. stale通知は再計算で変わるものだけ

等級要件・昇格要件・行動指針は、新フォームへ文言と版idを写す。
既存評価の再計算は同じフォーム写しを読むため、マスタ改訂後も結果は変わらない。
したがってこれらを `impact` の更新時刻監視に含めない。
作成済み下書きへ反映する操作は、評価の再計算ではなく明示的なフォーム同期である。

### 10. 行動指針の割当は等級行が所有する

等級ごとの割当状態を、読み取り一覧と単一編集フォームの2か所へ置かない。
各等級の行/カードが、現在値・select・行内保存をまとめて所有する。
これは等級、等級要件、昇格要件と同じ「対象を見ている場所で直す」操作モデルである。

共通化するのは行/カード内保存という操作規則までとし、行動指針の割当を等級要件の版テーブルへ寄せない。
すべての制度マスタをイベントストア化することも行わない。

## 主要ファイル

| 役割 | パス |
|---|---|
| ナビ | `src/lib/nav.ts` |
| 影響検知 | `src/lib/impact.ts` |
| 更新API | `src/app/api/masters/`（`apply-master-update.ts` / `versioned-requirement-update.ts` / `apply-behavior-master-update.ts`） |
| 版の系譜 | `src/lib/domain/versioned-master.ts` |
| 版UI共通 | `src/components/VersionedMasterSections.tsx` |
| 行動指針UI | `src/components/BehaviorBandAssignmentEditor.tsx` / `BehaviorGuidelineEditor.tsx` ほか |
| 仮パスワード | `src/lib/domain/initial-password.ts` |

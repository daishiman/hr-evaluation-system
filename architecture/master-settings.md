# アーキテクチャ: 制度設定の責務分割

graph_node_id: `feat-master-settings-responsibility-split`  
beads: `hr-hco`

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
  impact.detectStaleCycles（行動指針は監視外）
  initial-password.ts（CSV新規発行）
        │
        ▼
[データ]
  grades / grade_requirements / promotion_* /
  behavior_guidelines / behavior_levels /
  kpi_rank_criteria / kgi_coefficients / raise_*
  form_questions（行動指針の公開時写し）
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
| `lib/import.ts`（回答+社員） | `import.ts`（回答）+ `import-members.ts`（社員）+ `csv-normalize.ts` |

## 主要ファイル

| 役割 | パス |
|---|---|
| ナビ | `src/lib/nav.ts` |
| 影響検知 | `src/lib/impact.ts` |
| 更新API | `src/app/api/masters/` |
| 行動指針UI | `src/components/BehaviorGuidelineEditor.tsx` ほか |
| 仮パスワード | `src/lib/domain/initial-password.ts` |

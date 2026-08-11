# 制度設定と評価への反映 — システム仕様

- graph_node_id: `feat-master-settings-responsibility-split`
- beads: `hr-hco`
- 正本（製品）: `docs/product/spec.md` §3、§5-1、§7
- 実装入口: `src/app/admin/` / `src/app/api/masters/` / `src/lib/impact.ts`

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
| `/admin/kgi` | 事業所別KGI達成率・達成係数 |
| `/admin/raises` | 昇給方針・等級別金額・事業所調整・改定履歴 |

ダッシュボードの暫定件数は昇格条件と昇給額を別々に数え、前者を `/admin/masters/promotion`、後者を `/admin/raises` へ案内する。合算件数から1画面だけへ案内してはならない。

## 3. 変更の反映とスナップショット

1. KPIランク基準、評価項目・配点、ランク割合、昇格点数、KPI計算式、等級要件、昇格要件、KGI係数は `src/lib/impact.ts` の監視対象とする。更新時刻が評価の `computedAt` より新しい場合、確認中評価を再集計対象として扱う。
2. `evaluations.status = finalized` は再集計しない。判定時の配点・閾値・根拠を保存したまま据え置く。
3. 再集計可能件数が1件以上なら `/manager/cycles?cycle=...` への導線を出す。0件ならリンクを出さず、確定済みが当時の基準のまま残ることだけを説明する。
4. 行動指針の観点名・段階文言・選択肢は、アンケート作成時に `form_questions` と選択肢へ写す。評価はその写しを使うため、行動指針の変更を既存評価の stale 判定へ含めない。
5. 事業所KGI達成率は保存時に、同じ事業所・評価期間の確認中評価の賞与欄だけを即時再計算する。達成率自体は全サイクル再集計の監視対象に含めない。KGI係数の変更は監視対象とする。

## 4. UI・API整合

- 画面に表示する現在値と送信値を一致させる。対象を切り替えるフォームは、切替後のレコードの値で入力を初期化する。
- 行動指針の `isActive=false` は、次に作るアンケートの設問から除外する。
- KPIランク基準は `/admin/scheme` から遅延取得し、保存後はキャッシュを破棄して再取得する。
- KGI係数は `/admin/kgi` で表示・編集する。利用者へ見せる適用範囲は `lowerBound` / `upperBound` から `kgiRangeLabel` で導き、移行互換用の `label` を表示・編集の正本にしない。適用範囲の抜けや重なりは既存の coverage 検査結果を表示する。

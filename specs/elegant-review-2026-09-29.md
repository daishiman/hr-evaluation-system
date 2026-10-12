# 仕様メモ: 2026-09-29 レビューの改善

- graph_node_id: `refactor-elegant-review-2026-09-29`
- beads: `hr-s4s`
- 正本（製品）: `docs/product/spec.md`（ロールと権限の表）
- 正本（システム）: `system-spec/appearance-theme.md` §3 / `system-spec/routes-and-access.md`
- 根拠: `docs/reviews/elegant-review-2026-09-29.md`

## 決定事項

1. 明るさと系統の選択操作（保存値の読み込み・属性の付け外し・保存・同じ値の無視・記録）は `useAppearanceChoice` の1か所に置く。許可値・既定・保存値なしで表す値は各軸（`theme.ts` / `palette.ts`）が持ち、フックへ関数で渡す。
2. 今と同じ値を選び直したときは、属性・保存値・記録のどれも変えない。
3. 記録の送信先が同期的に例外を投げても、`recordAppliedThemeChoice` の中で止める。外観の操作と初回表示へ返さない。
4. 描画前の初期化は共通化しない。React の外で、描画の前に走る必要があるため。
5. どこからも読み込まれていないアプリ内の写し（`src/lib/ux-patterns.tsx`）は置かない。必要になったらキットの `ux-design/assets/ux-patterns.tsx` から、その時点の原本を写す。
6. 製品仕様の MANAGER は「本人と直属メンバーの閲覧、直属メンバーの評価の作成・確定、自社の評価基準の閲覧」。権限の正本は `system-spec/routes-and-access.md` で、今回は範囲を変えず説明だけを合わせる。
7. README の使い方は利用者向けの短い入口にとどめ、権限と判定条件は正本へのリンクにする。
8. `.beads/` の設定は共有し、beads のデータベース本体と、端末だけの記録（`.artifact-delivery/`・`.dev-graph/`・`eval-log/`）は共有しない。

## 非決定 / 残すもの

- マネージャーが自分の個人詳細URLを開いたときの、確認中の評価・評価メモの公開範囲（backlog SECURITY-013）

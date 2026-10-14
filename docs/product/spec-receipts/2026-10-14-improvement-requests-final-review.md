# 仕様反映 受領書（改善要望 2026-10 の最終レビュー）

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-14 |
| graph_node_id | `feature-improvement-requests-2026-10`（task は `SYS-IR-P01`〜`SYS-IR-P13`） |
| beads_id | `hr-wcv`（task は `hr-wcv.1`〜`hr-wcv.13`） |
| 前の受領 | [2026-10-13-improvement-requests.md](./2026-10-13-improvement-requests.md)（範囲 S1〜S14・受入 A1〜A13 の受領） |
| 判定 | **影響あり（会社の選択の戻り先と、既存アカウントへの所属の追加の2点）→ 正規フローで反映済み。範囲と受入の番号・意味は前の受領から変えない** |

## 受領した決定

最終レビューの途中で、30思考法のレビュー（[elegant-review-2026-10-14.md](../../reviews/elegant-review-2026-10-14.md)）が、承認済みの2つの記録（qa-v27・qa-v28）と、安全側の実装との食い違いを見つけた。利用者は判断を委ねた（qa-v32-delegated-membership-policy、逐語「ベストプラクティスの方を選択して実行を進めてください。」）。それを受けて、エージェントが [DD-009](../design-decisions.md) で次の2点を裁定した。具体的な方針は利用者の逐語の回答ではないので、委任とは分けて記録している。

| 論点 | 旧（qa-v27・qa-v28 の原文） | 新（DD-009） |
|---|---|---|
| cookie が無いとき・無効なときの会社 | 所属のうち会社名の順で最初の会社 | 有効な所属の `createdAt` 昇順（同時刻は所属 ID 昇順）の先頭。所属を持たない全体管理者は、従来どおり有効な実会社の会社名順 |
| 既存アカウントへの別の会社の所属の追加 | 会社管理者の新規登録で既存メールなら所属を足す | 全体管理者の専用の操作（`addMembership`）だけにする。会社管理者の新規登録では、既存のメールを汎用の文面で拒否する。資格情報は変えず、所属と監査を同じ batch で保存する |

## 影響の判定

| 層 | 影響 | 理由 |
|---|---|---|
| 製品仕様 | あり | `docs/product/spec.md` §28 の所属の節に、戻り先と所属の追加の主体を書いた |
| システム仕様 | あり | `system-spec/spec-state.json` の qa-v27・qa-v28 に、writer（`apply-spec-transition.py`）で `corrections[]` を追記した。原文は凍結したまま残し、compile が `auth.md`・`security.md`・`00-requirements-definition.md`・`index.md` に「訂正あり」として描く |
| 設計 | あり | `docs/product/design-decisions.md` に DD-009 を足した。DD-004 の所属の表・cookie・旧形式への写しの設計は続ける |
| データ | なし | 移行 0033・0034 は変えない。所属の写しの同期（`resumeCompanyStatements` と部分更新の全列の写し）は、既存の列の値をそろえるだけで、表の形は変えない |
| 権限 | あり（狭める側だけ） | 他社の既存アカウントへの所属の追加を、会社管理者から外して全体管理者だけにした。役割の種類は増やさない |
| 配色・テーマ | なし | `globals.css` の変更は `.feedback-fab` の位置（下端の操作バーの高さを避ける）だけ。`brand_color_*`・テーマの契約テスト・DD-003 は変えない |
| 依存 | なし | 新しい依存は足していない |

## 決定論ゲート（2026-10-14、tree `5c12ad4a`）

| ゲート | 結果 |
|---|---|
| `validate-coverage-matrix.py --require-complete --require-basis --require-foundation` | OK |
| `validate-source-citation.py` | OK |
| `validate-spec-doc-sync.py`（spec-state と章の同期） | OK |
| `validate-graph-schema.py`（`.dev-graph/state/graph.json`） | pass、違反 0、23 node の readiness がすべて complete |
| `validate-source-lineage.py`（同上） | **fail**。checked 9、違反 3（下の「残課題」） |
| `pnpm typecheck` / `pnpm test` / `pnpm check:docs` | exit 0 / 177 ファイル・2676 件成功（1 件スキップ） / PASS |

## 4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | 旧の記録は訂正付きで残し、spec.md §28・DD-009・system-spec の訂正・graph の node 文書の注記が同じ2点を同じ意味で書いている。「会社名の順」は、凍結した原文と、全体管理者の既定の説明にしか残っていない |
| 漏れなし | PASS | 2点それぞれに試験がある（`src/lib/session.integration.test.ts`・`src/actions/memberships.integration.test.ts`・`src/actions/account-and-company-admin.integration.test.ts`・`e2e/improvement-data-flows.spec.ts`） |
| 整合性あり | PASS | 範囲 S1〜S14・受入 A1〜A13 の番号と意味は前の受領から変えていない。DD-009 は S6（複数の会社への所属）の中の挙動を定めただけ |
| 依存関係整合 | PASS | 決定（DD-009）→ 仕様の訂正（spec-state の corrections）→ compile → 実装と試験、の順に反映した |

## 残課題

1. **graph の取込元の digest が古い（3 node。backlog の OPS-015）**。`validate-source-lineage.py` の診断は次のとおり。

   | node | 取込元 | 記録の digest | 現物の digest |
   |---|---|---|---|
   | `spec-system-spec-requirements` | `system-spec/00-requirements-definition.md` | `ab8facee…` | `642b2e3f…` |
   | `arch-system-spec-auth` | `system-spec/auth.md` | `07b03528…` | `0acf962c…` |
   | `arch-system-spec-security` | `system-spec/security.md` | `836939d3…` | `25115367…` |

   原因は、DD-009 の訂正を compile で章に描いたため、取込元の中身が変わったこと。dev-graph の C02 writer（`build-graph-node.py`）は、`update` で `source_lineage` と `confirmation_evidence` を変えられず、`add` は同じ id を拒否する。そのため、既存の node を取り込み直す操作が無い。`run-dev-graph-system-spec` の規定に従い、digest の手書きの書き換えで辻褄を合わせず、この診断を残す。取り込み直しの操作が C02 に入ったら、R0 からやり直す。

   なお、上の3 node の文書（`specs/system-spec-requirements.md`・`architecture/system-spec-auth.md`・`architecture/system-spec-security.md`）は、C02 を通さずに本文を DD-009 に合わせた。冒頭の注記には、「旧 `source_lineage`・`confirmation_evidence` の digest と評価は取り込み時点の記録で、訂正後に独立評価を再実行した証跡ではない」と書いている。graph の構造（schema）は壊れていない。

2. P06（マージ後の deploy.yml の実行番号）と P13（本番への配布）は、PR のマージのあとに閉じる。
3. 前の受領で範囲外とした FEATURE-005（行動指針の並べ替え）・OPS-014（見本データの締切が固定の日付）・`/criteria` の網羅率 42% は、今回も範囲外のまま。

## 受領境界

この受領は、DD-009 の2点を製品仕様・システム仕様・設計・graph の node 文書へ反映したことと、ゲートの結果を記録するところまで。本番の D1 への書き込みと配布は含めない。

# 最終レビューと仕様反映 受領書（PR に載せる24コミット・2026-10-16）

| 項目 | 内容 |
|---|---|
| 日付 | 2026-10-16 |
| 対象 | `origin/main`（`42b7f6b`、#94 のマージ）から `f9c2e75` までの24コミットと、この受領書のコミット |
| branch | `devgraph/feature-comparison-gap-two-page-links`（base は `main`。`dev` の枝は無い） |
| dev-graph | feature `feature-comparison-gap-two-page-links`、task `SYS-COMPARISON-GAP-P01`〜`P12`（`P13` は配布の記録で、マージのあとの別の PR） |
| Beads | `hr-wcv`（2026-10 の改善要望。`hr-wcv.13` が配布の確かめ）、`hr-c76`（E7 権限の記録）、`hr-nm6`（E8 ログイン後のスモーク）。参照のみで閉じ済み: `hr-czp`（保存した結果の鮮度）、`hr-s4s` |
| 判定 | **通過。仕様・設計への影響あり（6件）。手で保つ機能の仕様書と設計書へ反映した。compile する章（`spec-state.json` 由来）は変えない** |

## 最終レビュー

| 観点 | 確かめ方 | 結果 |
|---|---|---|
| 取り込む先の枝 | `git fetch` のあと `main`・`origin/main`・merge-base を比べた | どれも `42b7f6b`。取り込むコミットは0件で、`main` を本ブランチへ取り込んでも変化なし |
| 差分の範囲 | `git diff --stat origin/main..HEAD` | 209 ファイル。`src/`・`e2e/`・`drizzle/migrations/`（0036・0037）・`docs/`・`system-spec/`・`specs/`・`architecture/`・`features/`・`tasks/`・`scripts/` |
| 紛れ込み | 秘密（`.dev.vars`・`.env`・`key.ts`）・ログ・一時ファイル・`node_modules`・`.wrangler`・キットの backup をファイル名で探した | 0件 |
| 無関係な差分 | 共有の作業ツリーにある別の作業の未コミットの変更（利用者管理・比べる警告の読み出し・スモークの台本・文書の一部） | このブランチは別の worktree で作り、それらを含めていない |

## 品質ゲート（MVP のため最小限）

| ゲート | 結果 |
|---|---|
| task 仕様書（`validate-system-plan.py`、exact-13 package） | PASS（P01〜P13、違反0、`sha256:2ce1bb44…`） |
| dev-graph の schema（`validate-graph-schema.py`） | PASS（23 node すべて readiness complete、違反0） |
| dev-graph の lineage | 本ブランチの中身で 9 node すべて digest が一致。共有の作業ツリーで流すと `arch-system-spec-backend` が1件不一致になるが、原因はそのツリーの未コミットの `system-spec/backend.md` で、このブランチには入っていない |
| `pnpm run check:docs` | PASS（この受領書を足したあとに流した） |
| コードの検査（`f9c2e75` で記録済み） | `tsc` 0、`test:coverage` 3,358件 PASS（全指標 100%）、TZ=UTC PASS、`cf:dry-run` 0、E2E 54件中52件 PASS（落ちた2件は A12 の余白。既存の失敗と試験用の管理者の蓄積。[レビュー](../../reviews/elegant-review-2026-10-16-refactor.md)） |

このコミットは文書だけを変え、コードとテストの差分は無い。

## 仕様・設計への影響

| 変更 | 影響 | 反映先 | 理由 |
|---|---|---|---|
| 権限にかかわる操作の記録（E7・DD-013・移行 0037） | あり | `system-spec/account-and-users.md` §3-9、`architecture/account-profile.md` §6・主要ファイル・マイグレーション | 新しい表と、利用者の保存の不変条件（本体と同じ batch・秘密を残さない）が増えた |
| 社員CSVの取り込みが所属の行を書く（移行 0036） | あり（実装を既存の決定へ合わせた） | `system-spec/imports-and-readiness.md`、`architecture/account-profile.md` のマイグレーション | 所属の表を正本とする決定（D-004 ②）は変えていない。取り込みの不変条件として明文にした |
| 試しの回答（DD-019） | あり | `system-spec/routes-and-access.md` §2、`system-spec/release-and-forms.md` §6-6 | 既存の route の上で、開ける人と保存しないことの境界が増えた。route は足していない（`route-ledger.json` は変えない） |
| 設問の集計との紐づけの保存（DD-015） | あり | `system-spec/release-and-forms.md` §7-1・7-2 | 保存の入口でサーバーが守る不変条件が増えた |
| KPI 項目の実績の聞き方（DD-016） | あり | `system-spec/master-settings.md`「KPI項目の実績の聞き方」、`system-spec/release-and-forms.md` §7-3 | 制度設定の画面の責務と、公開の前の止め方が増えた |
| 2026-10-15〜16 の追加の照合 | あり（辿り方） | `specs/improvement-requests-2026-10.md`「2026-10-15〜16 の追加」 | S1〜S14 の番号の外で受けたものを、製品仕様の節・DD・置き場所で辿れるようにした |
| 比べる警告（DD-012）、会社の開く順（D-009 の更新）、保存した結果の鮮度の受入、ログイン後のスモーク（E8） | なし（反映済み） | 各コミットで `system-spec/`・`specs/`・`architecture/`・受領書へ反映済み | このレビューで差分を見直し、追加の反映は要らないと判断した |
| 一覧の行の形・保存中に止める入力の束・操作の帯（DD-014・DD-017・DD-018）、日本時間の読み替えの共通化、エレガントレビューの整理 | なし | — | 画面の組み立てとコードの置き場所の決まりで、API・データ・権限の契約を変えない。製品仕様 §28 と DD に記録済み |

### compile する章を変えない理由

`system-spec/` の章のうち `00-requirements-definition.md`・`auth.md`・`backend.md`・`database.md`・`frontend.md`・`infrastructure.md`・`maintenance-ops.md`・`security.md`・`ui-ux.md` は、`spec-state.json` の上位概念（U1〜U9）とカテゴリごとの決定から compile する。今回の変更は、どれも上位概念と決定（D-004〜D-009 など）を変えず、その下の機能の不変条件を足すものである。機能の不変条件は、#93・#94 と同じく手で保つ仕様書（`account-and-users.md` など）と `specs/`・`architecture/` に置いた。そのため spec-state の遷移と compile は行わず、dev-graph の取込元の digest（lineage）も変わらない。権限の記録（E7）は、security の章が上流の指針に挙げる OWASP ASVS の監査記録の範囲に入る。

## 再確認（同じ依頼の2回目・PR の先頭 `1c1abeb`）

PR を作ったあとに同じ依頼をもう一度受けたので、PR の先頭で確かめ直した。

| 観点 | 結果 |
|---|---|
| 取り込む先の枝 | `origin/main`・`main` は `42b7f6b` のまま、PR の先頭も `1c1abeb` のまま。取り込むコミットは0件、`dev` の枝は無い |
| 共有の作業ツリーの未コミットの変更（29ファイル） | 別の作業者（Codex）が進めている利用者管理・比べる警告の読み出しの整理・スモークの台本と、2026-10-15 のレビュー文書。この PR には入れない。中の `system-spec/backend.md` は compile する章を直接書き換えているので、その作業を入れるときは elicit と compile の経路に載せ直す必要がある |
| task 仕様書 / dev-graph の schema | PASS（`sha256:2ce1bb44…`、前回と同じ）/ PASS（23 node） |
| dev-graph の lineage | 9 node すべて、PR の中身の取込元の digest と一致。検査器は repo の外に置いた graph を受けないので、digest を直接比べた |
| `pnpm typecheck` / `pnpm test:coverage` / `pnpm run check:docs` | exit 0 / 3,358件 PASS で exit 0（閾値 100% を通過）/ PASS |
| `git diff --check origin/main` | 1件。`features/comparison-gap-two-page-links.md` の末尾に空行が余分にあった。前回は作業ツリーの差分だけを見ていて気づかなかった。このコミットで消して PASS |

このコミットは末尾の空行1つと受領書だけを変えるので、仕様・設計への影響は無い。

## 残課題

- 配布：マージのあと、Deploy workflow が移行 0036・0037 を本番に当てる。`hr-c76` は 0037 が当たったら、`hr-nm6` は配布のあとにスモークが14件 OK になったら閉じる。`hr-wcv.13` と `SYS-COMPARISON-GAP-P13` は配布の確かめの記録で閉じる
- E2E の A12（`/admin/masters/promotion` 43%・`/system/users` 42%）。基準は緩めない
- エレガントレビューの Q1〜Q7（文言か振る舞いが変わるので利用者が決める。[レビュー](../../reviews/elegant-review-2026-10-16-refactor.md)の「利用者に確かめたいこと」）
- 共有の作業ツリーにある別の作業の未コミットの変更は、その作業の PR で扱う

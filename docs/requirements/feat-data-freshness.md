# 要件定義書: 保存した結果が、どの画面・タブ・端末でもすぐ見える（feat-data-freshness）

dev-graph の requirements が、確定済みの system-spec・設計・feature と、system-dev-planner の13件の実行 package から導いた実装要件をまとめたものです。この文書は実装のコードを含みません。実装は下の「引き渡し」にある build の経路が受け持ちます。

## 固定した版

この要件は、次の版の組み合わせにだけ当てはまります。どれかの digest が変わったら、この文書と引き渡しは古くなったものとして扱い、requirements をやり直します。

| 対象 | パス | sha256 |
|---|---|---|
| graph（rev5、16ノード） | `.dev-graph/state/graph.json` | `234b2888875b5053ce9deb9b267ca5b662ba6633a89128a2b014584786da4774` |
| 実行 package（canonical digest） | `.dev-graph/plans/feature-package-feat-data-freshness/staging-manifest.json` | `b548bcb3ffd30e3e458f0006ac6c9965e2204bad6d561dd5045ea88776c70acd` |
| build への引き渡し（package 側） | `.dev-graph/plans/feature-package-feat-data-freshness/system-build-handoff.json` | `65d0c7dfbe8d30aca132802427363bb5483ab42940cc6103afa3c4a36643d3c3` |
| feature の文脈 | `features/feat-data-freshness.json` | `5a8b6bd16ce2830e8031277d293eaeb258d6df1427de5dff716dda584ea6b1ad` |
| system-spec の索引 | `system-spec/index.md` | `da48a1cd06eb32de04462b01fbe6884c2d11e10691ad5417dff46b00fbcd2de0` |

## 上位の目的

正本は `system-spec/00-requirements-definition.md`。

- U1（本質的な目的）: 利用者が作成・変更・削除した結果を、成功表示の直後の画面・再読み込み・他のタブと画面復帰のどれでも必ず確認できるようにし、「本当に保存できたのか」を疑わずに次の作業へ進める状態をシステムとして保証する。
- G1: 書き込み成功を表示した時点で、同じタブの一覧・件数・会社切替がすべてその結果を含む。
- G2: 通常・強制の再読み込みや URL の直接表示は、直前の書き込み結果を必ず含む。
- G3: 同じ利用者の他のタブや、スマホ・タブレットでの画面復帰（bfcache の復元・タブ復帰）でも、古い一覧のまま操作を続けない。
- G4: 画面や書き込みの入口を足しても、鮮度の保証が共通の契約として当たり、適用漏れは検査で落ちる。
- G5: 複数の表を書く書き込みが途中で失敗しても、一部だけが残る状態を作らない。取り消し・やり直しまで失敗したら記録に残る。

## 受入から出典・担当 task への追跡

受入の文は `features/feat-data-freshness.json` の acceptance をそのまま載せています（A0 から順に）。要件番号（FR・BR・決定事項・AC）は `specs/data-freshness.md` のもの、章は `system-spec/index.md`「章一覧と集約状態」の「資するゴール」から引いたものです。設計の正本は `architecture/data-freshness.md`（D-001 opt-broadcast、D-002 opt-server-functions、D-003 opt-batch-first）。

ゴールの列で「本書の対応づけ」と書いた4件（A6・A14・A15・A16）は、仕様にゴールとの対応が明記されていないので、この文書が対応づけたものです。4件とも安全の要件で、`system-spec/security.md` に記述があるため security 章を出典に足しています。対応づけの理由は次のとおりです。

- A6・A15（控えを開ける人と期限）: 控えは会社の追加が成功したときに同じ描画で出すもの（A12、G1）なので、その見え方の決まりとして G1 に置いた。
- A14（送信元の検査）: 検査は `runAction`・`runRead` の先頭、つまり全機能が通る共通の入口に置く（決定事項12）ので、共通の契約として当たる G4 に置いた。
- A16（会社と利用者の管理の権限）: 鮮度そのものの保証ではない。D-002（書き込みを Server Functions へ移す）の危険として `system-spec/00-requirements-definition.md` に挙がっている「移行の途中で認可や入力検証が抜ける」への備えで、D-002 が資する G1・G4 のうち、共通の入口で当たる G4 に置いた。

仕様の要件番号（FR・BR・AC）は、どれも表のどこかの行に載っています。BR-005（CSV に不正な行があればファイル全体を断る）と BR-006（入力の形が合わなければ 400、大きさの上限を超えれば 413）は、A1 の「断られた保存は1行も書かず描き直さない」の具体的な断り方なので A1 に置きました。確かめているのは `src/lib/import.integration.test.ts`（BR-005）と `src/lib/action.test.ts`・`src/lib/request-body.test.ts`（BR-006）です。

| 受入 | 内容 | ゴール | 要件番号 | system-spec の章 | 担当 task |
|---|---|---|---|---|---|
| A0 | 画面の部品に書き込みの fetch が無く、どのサーバーアクションも runAction か runRead を通る（契約テスト） | G4 | FR-001・FR-004・FR-014・BR-001・決定事項1・3・4・AC-008 | auth backend frontend maintenance-ops | P02 P04 P05 P07 P08 P10 P11 |
| A1 | 成功した保存だけが1回描き直し、断られた保存は1行も書かず描き直さない | G1 | FR-002・BR-005・BR-006・決定事項2 | ui-ux backend frontend | P05 P07 P10 P11 |
| A2 | ログイン後の画面と /api/* の応答が private, no-store | G2 | FR-007・決定事項5 | database auth security infrastructure backend maintenance-ops | P05 P07 P09 P10 P11 |
| A3 | 保存の知らせが他のタブに届き、送ったタブには届かない。取り直しは1.5秒に1回へ間引かれる | G3 | FR-005・FR-006・決定事項6 | ui-ux security frontend | P05 P07 P10 P11 |
| A4 | 会社の追加が最後の段で失敗しても、会社・制度・管理者・控えが1行も残らない | G5 | FR-009・決定事項10・AC-006 | database backend | P02 P05 P07 P10 P11 |
| A5 | 制度マスタの同時保存で後のほうが 409 になり、監査記録の番号が重ならない | G5 | FR-009・FR-010・決定事項8・9 | database backend | P02 P05 P07 P08 P10 P11 |
| A6 | 控えを開けるのはシステム全体管理者と同じ会社の管理者だけで、本人のパスワード変更で消える | G1（本書の対応づけ） | BR-004・決定事項13・14 | ui-ux backend frontend security | P05 P07 P09 P10 P11 |
| A7 | ローカルの preview で、会社の追加の応答に新しい会社が載り、直後の再読み込みにも出る | G1 G2 | FR-002・FR-007・AC-002 | 8章すべて | P07 P10 P11 P13 |
| A8 | check:docs が通り、system-spec の要件定義（U1・G1〜G5）から8章へ辿れる | U1 G1〜G5 | 仕様メモ冒頭の正本の対応 | 8章すべて | P01 P03 P07 P10 P11 P12 |
| A9 | 成功の知らせが出た瞬間の画面に、新しい会社の行・1つ増えた件数・会社切替の選択肢がある（E2E 1。待機なし） | G1 | FR-003・AC-001 | ui-ux backend frontend | P04 P06 P07 P10 P11 |
| A10 | 作成直後のキャッシュを使わない再読み込みで新しい会社が出て、応答の x-generated-at が作成より後（E2E 2） | G2 | FR-007・FR-008・AC-002 | database auth security infrastructure backend maintenance-ops | P04 P06 P07 P10 P11 |
| A11 | 他のタブ・画面復帰・戻る・bfcache の復元で、新しい会社が1秒以内に出る（E2E 3a・3b・4a・4b） | G3 | FR-005・FR-006・AC-003・AC-004・AC-005 | ui-ux security frontend | P04 P06 P07 P10 P11 |
| A12 | 発行した控えは成功の知らせの後ろに畳まれて始まり、押したときだけ値が出る。控えを保存できなかったときは最初から開いている（E2E 5・RecordForm.test.ts） | G1 | FR-011・AC-001 | ui-ux backend frontend | P04 P05 P06 P07 P10 P11 |
| A13 | 別々の await で2つ以上の表を書く関数が無い。パスワード変更の続きが2回とも失敗しても変更済みと伝え rollforward_failed を残す。端末の承認を同時に2回引き換えても1回だけ通る | G5 | FR-009・BR-002・決定事項10・11・AC-006・AC-007 | database backend | P02 P04 P05 P07 P10 P11 |
| A14 | 別のサイト・ポート違いからの書き込みと読み出しを、ログインを確かめる前に断る。allowedOrigins を足していない（action-origin.test.ts） | G4（本書の対応づけ） | FR-013・決定事項12・AC-010 | auth backend frontend maintenance-ops security | P04 P07 P09 P10 P11 |
| A15 | 発行から14日を過ぎた控えは一覧に出ず、開こうとすると 410 と再発行を頼む文面になり、次の発行で消える | G1（本書の対応づけ） | FR-012・BR-004・決定事項14・AC-009 | ui-ux backend frontend security | P05 P07 P09 P10 P11 |
| A16 | 会社の変更・会社の切替・利用者の追加と変更は、システム全体管理者以外だと1行も書かず描き直さない。応答に仮パスワードが無い（SECURITY-001） | G4（本書の対応づけ） | BR-003・決定事項15 | auth backend frontend maintenance-ops security | P05 P07 P09 P10 P11 |
| A17 | スマホ（375px）・タブレット（768px）の幅でも、E2E 1 と 5 が同じに通る（E2E 6-1・6-5） | G1 G3 | AC-001 | ui-ux security backend frontend | P04 P06 P07 P10 P11 |

18項目のすべてに担当の task が1件以上あり、担当の無い受入は0件です。逆に、task の仕様書が挙げる受入番号のうち、上の表に無いものも0件です。

## 13件の task と受け持つ受入

task の正本は `.dev-graph/plans/feature-package-feat-data-freshness/task-specs/` の13件で、この文書は中身を写さず番号だけを引きます。Beads の課題は epic `hr-czp` の子 `hr-czp.1`〜`hr-czp.13`（P01〜P13 の順）。

| task | 題名 | 受け持つ受入 |
|---|---|---|
| SYS-DF-P01 | 鮮度の要件の基準線（受入18項目と U1・G1〜G5 への対応）を固める | A8 |
| SYS-DF-P02 | 保存の入口を1つにする設計と、3つの書き込みの型を決める | A0 A4 A5 A13 |
| SYS-DF-P03 | 設計を独立した評価で確かめる | A8 |
| SYS-DF-P04 | 受入を先に試験の形にする（契約テストと画面の通し試験の設計） | A0 A9 A10 A11 A12 A13 A14 A17 |
| SYS-DF-P05 | 保存の入口・同梱・知らせ・書き込みの型を全機能に実装する | A0 A1 A2 A3 A4 A5 A6 A12 A13 A15 A16 |
| SYS-DF-P06 | 単体・結合・画面の通し試験を回す | A9 A10 A11 A12 A17 |
| SYS-DF-P07 | 目的から導いた受入を、ローカルの preview で確かめる | A0〜A17 |
| SYS-DF-P08 | 移行を既存のデータに当てて確かめ、退避の片付けを済ませる | A0 A5 |
| SYS-DF-P09 | 送信元の検査・控えの暗号化・監査で、安全と運用の備えを確かめる | A2 A6 A14 A15 A16 |
| SYS-DF-P10 | 最終の独立レビュー | A0〜A17 |
| SYS-DF-P11 | 再現できる証跡をまとめる | A0〜A17 |
| SYS-DF-P12 | 製品仕様・設計・運用の文書を揃える | A8 |
| SYS-DF-P13 | 配布と戻し方の準備（今回の本番配布は対象外として閉じる） | A7 |

依存は package の中だけの15本で、根は P01 です（`task-graph.json`）。

## 準備ができているかの判定

引き渡しの前に、次の3つを同じ digest で確かめました。結果の表は `.dev-graph/handoffs/feat-data-freshness/readiness-matrix.json` にあります。

1. graph の検査（`validate-graph-schema.py`）: 違反0件、graph 全体の readiness は complete、不足の節は0件。
2. graph に保存した状態: 16ノードすべてが implementation_readiness complete・evaluation pass・confirmation confirmed。出典の digest は、仕様と設計と feature が `system-spec/index.md` の今の sha256 と一致し、feature の評価済み digest が `features/feat-data-freshness.json` と一致し、13件の task が package の canonical digest と一致する。各 task の仕様書の sha256 も `staging-manifest.json` の記録と一致する。
3. system-dev-planner の検査（`validate-system-plan.py`）: pass。validated_digest は package の canonical digest と同じで、P01〜P13 がちょうど1件ずつ、違反0件。

16ノードのうち、未完了・保留・失敗・古い版のものは0件です。1件でも混ざったときは、そのノードの不足の節と直す担当を表に出し、引き渡しを止めます。

## 引き渡し

- 引き渡し先: build の経路（capability-build / task-graph build）。このリポジトリでは、`system-build-handoff.json` の execution_tasks が実行の正本で、実行の手順は `/improve-app` と通常の開発の手順です。
- 引き渡しの記録: `.dev-graph/handoffs/feat-data-freshness/capability-build-handoff.json`。この文書と readiness matrix の sha256 を持ち、最後に書く（この記録があって digest が合うときだけ、引き渡しが成立したとみなす）。
- いまの状態: 実装と検証は、この requirements より前に済んでいます（P07 で A0〜A17 をローカルの preview で確かめた）。task の完了は「既定のブランチへ PR がマージされた時点」と決まっているので、PR を出していない今は13件とも作業中のままです。

## 範囲外

`specs/data-freshness.md` の「非決定 / 残すもの」と「未決事項」のとおりです。別の利用者・別の端末への押し出し（W1）、本番での作成直後の確認（W2）、本番の `CREDENTIAL_ENC_KEY` の設定（W3）、仮パスワードそのものの失効（W4 / SECURITY-005）、楽観更新（UX-030）は、この要件に含みません。

## 確かめ直す方法

リポジトリの直下で次を回し、上の「固定した版」の digest と見比べます。

```bash
shasum -a 256 .dev-graph/state/graph.json features/feat-data-freshness.json system-spec/index.md
python3 -c "import json;print(json.load(open('.dev-graph/plans/feature-package-feat-data-freshness/staging-manifest.json'))['canonical_digest'])"
```

graph の版が後の作業で進んだときは、`graph_revision` が変わっていても、16ノードの readiness・evaluation・confirmation・出典の digest が上と同じなら要件は変わっていません。違っていれば requirements をやり直します。

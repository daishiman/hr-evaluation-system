---
kind: index
---
# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

人事評価管理システムの**実装に直結するシステム仕様**の入口。

製品側の読みやすい仕様メモは `docs/product/spec.md` を正とする。

ここに置くのは、ロール境界・データ制約・API 契約など、コードが守るべき不変条件の要約である。

## 領域別の仕様文書

| 文書 | 内容 |
|---|---|
| [account-and-users.md](./account-and-users.md) | 本人プロフィール・編集ポリシー・利用者管理の不変条件 |
| [master-settings.md](./master-settings.md) | 制度設定画面の責務・会社境界・スナップショット・再集計・等級/昇格要件の版ライフサイクル・監査ジャーナル契約 |
| [release-and-forms.md](./release-and-forms.md) | 本番Deployの自動migrationとfail-closedゲート、複数等級フォームの原子的作成 |
| [routes-and-access.md](./routes-and-access.md) | 全47画面の目的・対象、ロール×状態×結果、4幅の受入契約 |
| [imports-and-readiness.md](./imports-and-readiness.md) | CSV一括取込の原子性・復元点、評価セット/期間/アンケートの共通readiness |
| [improvement-requests.md](./improvement-requests.md) | 画面内改善要望のroute identity、API/DB、原子保存、冪等、管理更新契約 |
| [appearance-theme.md](./appearance-theme.md) | 明るさ・配色の値集合（画面/API/DBで一致）、既定の表し方、現在設定の記録API、開発キットとの配色境界 |

次の仕様は、下の「要件定義書」と「章一覧と集約状態」にある。

- 書き込み後の表示鮮度（作成・変更・削除の結果がすぐ見えること）
- 等級の呼び名・役割ごとにできること・提出状況・設定の足りない所を、どの画面でも同じ言葉で示すこと
- 個人別の評価レポート（毎回同じ型・A4 縦2枚組で印刷）と、昇給・昇格への上司の判断（点数の判定と、判断と理由）
- レポートと評価結果を見てよい人の範囲（CSV の書き出しとメモを含む）
- 事業所の達成率の削除、全画面を確かめるテストデータ、アンケート・昇給の設定・KPI 評価セットのつながり

これらは system-spec-harness が `spec-state.json` と `fetched-references.json` から生成する章で、集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値（真理値表で導出）。

機械可読なルート正本は [`route-ledger.json`](./route-ledger.json)。`page.tsx` との完全一致を `pnpm run check:docs` で検査する。

会社所属の現在の契約は、利用者が選んだ `qa-w11`・`qa-w12`（D-008・D-009）と [auth の訂正](./auth.md#現在の契約と過去の逐語)・[security の訂正](./security.md#現在の契約と過去の逐語) を優先します。[DD-009](../docs/product/design-decisions.md) の委任に基づく裁定のうち、最古の有効な所属へ戻す部分は `qa-w12` で会社名の順に変わりました。`spec-state.json` は利用者の委任逐語とエージェントの裁定を区別し、既存の承認の質問・回答は保持します。

評価レポート・上司の判断・事業所の達成率の削除の現在の契約は、利用者が選んだ `qa-z03`・`qa-z04` と、各章の「訂正あり」の囲み（`qa-y10`・`qa-y11`・`qa-y13`・`qa-y16`・`qa-x15`・`qa-z01`・`qa-z02` への訂正）を優先します。決めた中身は [DD-020〜DD-024](../docs/product/design-decisions.md) にあります。dev-graph が取り込んだ写し（`architecture/system-spec-*.md` と `specs/system-spec-requirements.md`）は、次の機能の取り込みで新しくなるまで、この訂正の前の文のままです。

## 更新ルール

1. 画面・API・DB のどれかが変わる変更は、対応する system-spec を同じ PR で更新する。
2. 製品向けの言い回しは `docs/product/spec.md` に書き、ここには判定条件と境界を書く。
3. 反映したら `docs/product/spec-receipts/` に受領書を残す。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 利用者が作成・変更・削除した結果を、成功表示の直後の画面・再読み込み・他のタブと画面復帰のどれでも必ず確認できるようにし、『本当に保存できたのか』を疑わずに次の作業へ進める状態をシステムとして保証する。あわせて、等級の呼び名・役割ごとにできること・各人の等級と評価・アンケートの提出状況・設定の足りない所を、どの画面でも同じ言葉で、見てよい人にだけ示し、利用者が『誰が何をできるか』『どこで何を直せばよいか』を迷わずに判断して操作できる状態にする。さらに、管理者・直属の上司・本人が、その人が評価に値するかどうか・点数・項目ごとの強みと弱み・過去の推移を、毎回同じ型で作られる個人別の評価レポートで一目で確かめられるようにする。そのために、アンケートの設問と回答・昇給の設定・KPI 評価セットが、同じ評価期間の定義で食い違わずにつながり、評価の結果がいつ作っても同じになる状態を保つ。使っていない事業所KGIの仕組みは残さない。評価に値するかの結論は、点数の判定だけで決めず、評価を確定する上司が理由とともに記録した判断を合わせて決め、その理由は本人にも同じ文で示す。
- **ゴール (U3)**: G1=書き込み成功を表示した時点で、同じタブの一覧・件数・ナビゲーション（会社切替など）がすべてその結果を含んでいる。, G2=通常・強制の再読み込みや URL の直接表示は、直前の書き込み結果を必ず含む。, G3=同じ利用者の他のタブや、スマホ・タブレットでの画面復帰（bfcache 復元・タブ復帰）でも、古い一覧のまま操作を続けない。, G4=画面や書き込み API を追加しても、鮮度の保証が個別実装に頼らず共通契約として適用され、適用漏れは検査で落ちる。, G5=一つの操作で複数の表を書く書き込みが途中で失敗しても、一部だけ反映された中途状態（会社はあるが管理者が無い等）を残さない。取り消し・やり直しの処理まで失敗したときは、その事実が記録に残って検知でき、手作業で直せる。, G6=等級の呼び名は、その会社の等級名だけで表す。行動指針の向け先・評価セットの区分・昇格の要件・警告文・アンケートのタイトル・ボタンのどこにも英語の区分名を出さず、等級名を変えると次の表示からすべてに反映される。, G7=等級名を変えられるのは、システム全体管理者と、その会社の会社管理者だけにする。マネージャーと一般の社員、他社の会社管理者は、画面からもサーバー処理からも変えられない。, G8=役割ごとに、どのページを開けて、そこで何ができ何ができないかを、ページ名を単位にした同じ形で確かめられる。表示は実際の権限の判定と食い違わない。, G9=マネージャー・会社の管理者・システム全体管理者は、見てよい範囲の利用者について、今の等級と、確定した最新の評価の KPI評価点と等級要件の達成率を一覧で確かめられる。一般の社員には見えない。, G10=同じメールアドレスの人が、1つのアカウントのまま複数の会社に所属でき、会社ごとの役割・等級・上司で使える。所属していない会社のデータは見えない。, G11=アンケートごとに、対象者の誰が提出済みで、誰が入力途中か未回答かを一覧で確かめられる。, G12=設定の不足を知らせる表示は、何が足りないか・どう直すか・どこで直すかを短く示し、そこから直す画面へ1回の操作で移れる。, G13=並び順を持つ全ての編集画面で、矢印のボタンに加えて、長押ししたままのドラッグとキーボードでも並べ替えられる。, G14=アンケートの選択肢を押しても何も起きない画面を無くす。見本として表示している画面では、見本であることと回答できない理由が分かる。, G15=画面の幅に対して内容が片側に寄り、右側の余白が目立つ画面を無くす。, G16=2つのページの内容を比べて出す警告は、比べている両方のページを階層つきのページ名とリンクで示し、項目ごとにどちらのページにあってどちらに無いかを表で示す。既定ではズレがあることと件数だけを1行で出し、中身は押すと開く。どちらのページから見ても、相手のページへ1回の操作で移れる。, G17=事業所KGIの達成率の仕組み（メニュー・画面・計算・保存・表・列・文書・テスト）を残さず消す。賞与（仮）は KGI を使わない式（個人Pt＝KPI評価点の合計、賞与額＝個人Pt×昇給の設定の1点あたりの円）で出し続ける。, G18=個人別の評価レポートを、開くたびに確定した評価から同じテンプレートで作る。評価に値するか（昇給と昇格の判定とその理由）・点数・項目ごとのレーダー図・その等級にいた期の点数と同じ等級の平均・等級ごとの点数・過去の実績を、図とグラフで一目で分かるように示す。, G19=レポートと評価結果の中身を、見てよい人にだけ見せる。全体管理者と会社の管理者は会社の全員、マネージャーは直属の部下と自分、本人は自分の分を見られる。本人向けは点数の数値と他の人との比較を出さない。範囲の外のデータは、CSV の書き出しとメモを含めてサーバーが返さない。, G20=全ての画面と項目（評価結果の中身・レポートの全ての図・アンケートの各状態・ズレの各種類・役割ごとの見え方）を、ローカルと E2E で確かめられるテストデータを用意する。本番には入れない。, G21=アンケートの配布 URL・回答・回答一覧・内容の確認と編集・公開・締め切る・延長が、アンケートの状態と締切に合った操作と案内だけを出し、サーバーも同じ規則で守る。, G22=評価項目とアンケートのズレを、KPI 項目・等級要件・行動指針の全てで比べ、項目ごとに直す画面へのリンクを出す。新しい版が下書きの間は、回答を集めている古い版の警告を消さない（今の設定と一致した新しい版を公開して古い版が締め切られたら出さない）。, G23=アンケートの設問と回答・昇給の設定・KPI 評価セット・評価の結果を、評価期間に指定した評価セットを基準につなぎ、ズレの比較・アンケートの作成・点数の計算・レポートの作成が同じ定義を使う。つながりの抜けを1か所で確かめられる。, G24=昇給と昇格の可否を、点数の判定と、評価を確定する上司が理由とともに記録した判断（点数の判定どおり／変える）を合わせて決め、その結論と理由を、評価レポート・画面・CSV で本人・直属の上司・管理者に同じ形で示す。点数の判定は書き換えずに残す。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G5 G6 G8 G9 G10 G11 G13 G17 G18 G20 G23 G24 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G2 G4 G7 G8 G10 G19 G24 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G6 G8 G9 G11 G12 G13 G14 G15 G16 G17 G18 G19 G21 G22 G24 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G3 G7 G8 G9 G10 G16 G17 G19 G21 G24 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G2 G6 G8 G10 G13 G17 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G2 G4 G5 G6 G7 G8 G9 G10 G11 G12 G13 G14 G16 G17 G18 G19 G21 G22 G23 G24 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 G4 G6 G8 G12 G13 G14 G15 G16 G17 G18 G19 G21 G22 G24 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G2 G4 G6 G7 G8 G9 G10 G11 G12 G13 G14 G15 G16 G17 G18 G19 G20 G21 G22 G23 G24 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)

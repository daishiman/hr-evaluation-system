# 画面ルート・対象・権限 — システム仕様

- 製品向け画面一覧: `docs/product/spec.md` §3
- 機械可読な正本: [`route-ledger.json`](./route-ledger.json)
- 検査: `scripts/route-ledger.test.mjs` / `scripts/check-docs-drift.mjs`

## 1. 台帳の読み方

`route-ledger.json` が、実装にある **44個すべての `page.tsx`** を列挙する。各routeは1つの `accessClass` を参照し、そのclassが「状態 × 4ロール × 期待結果」を定義する。同じ契約を **375 / 768 / 1280 / 1600px** の4幅すべてに適用する。

| 結果 | 意味 |
|---|---|
| `200` | 目的を完了できる画面、または状態理由と復帰先を示す画面を表示 |
| `redirect` | HTTP redirectでログイン・ホーム・確認専用画面などへ移動 |
| `notFound` | 不存在・他社・担当外を区別せず404 |
| `denied` | HTTP 200の権限不足画面。本文を出さず理由と復帰先だけを表示 |

幅は見た目が確認済みという記録ではなく、各routeの受入試験から省いてはいけない契約である。実測していない幅は `docs/product/backlog.md` の UX-018 に残す。

## 2. 権限と対象の共通境界

| 入口 | 正常時に開ける人 | 対象外・不足時 |
|---|---|---|
| 共通・本人入口 | 4ロールすべて | 未ログインはログインへredirect |
| `/manager/*`・`/criteria` | MANAGER以上 | EMPLOYEEは自分のホームへredirect |
| `/manager/members/[id]` | COMPANY_ADMIN以上は自社、MANAGERは本人または直属部下 | 担当外・他社・不存在はnotFound |
| `/manager/evaluations/[id]` | COMPANY_ADMIN以上は自社評価、MANAGERは直属部下の評価 | 本人・担当外・他社・不存在はnotFound |
| `/admin/*` | COMPANY_ADMIN以上 | MANAGER以下は自分のホームへredirect |
| `/system/*` | SUPER_ADMINだけ | ほかのロールは自分のホームへredirect |
| `/me/results/[id]` | 本人の確定済み評価だけ | 未確定・他人・他社・不存在はnotFound |
| `/me/responses/[id]` | 下書きは本人だけ。提出済みは本人・直属上長・COMPANY_ADMIN以上 | 対象外は本文を出さないdenied、他社・不存在はnotFound |
| `/f/[token]` | ログイン必須。対象なら回答へ、別等級なら内容確認へredirect | 無効・他社・受付外は理由と復帰先を200表示 |

COMPANY_ADMIN と SUPER_ADMIN も評価される本人になりうるため、`/me/*` は EMPLOYEE 専用ではなく全ロール共通の自己サービスである。ロールだけでなく、会社・本人・直属上長・確定状態を組み合わせて判定する。

## 3. 44routeの完全性

台帳には通常画面のほか、redirect専用の `/` と `/admin/masters/kpi-categories` も含める。製品仕様から漏れていた次の2画面も独立routeとして扱う。

- `/admin/forms/[id]/responses`: 会社管理者が提出状況と回答を確認する。
- `/me/responses/[id]`: 回答時点の設問と回答本文を権限範囲内で読み返す。
- `/admin/improvements`・`/admin/improvements/[id]`: 各画面から届いた改善要望を読み、対応状況を変える（COMPANY_ADMIN 以上・自社分だけ）。

routeを追加・削除・改名するときは `route-ledger.json` を同じ変更で更新する。漏れ・古いroute・重複は `pnpm run check:docs` が失敗させる。

## 4. 画面名と改善要望の集計単位

`route-ledger.json`の`path`と`label`は、パンくずだけでなく改善要望の画面名・集計単位の正本でもある。`src/lib/nav.ts`は台帳をimportし、別の対応表を持たない。

- 実URLは再現用`improvement_requests.path`へ保持する。
- 動的IDを台帳patternへ戻した値は`route_pattern`へ保持し、一覧の集計・絞込に使う。
- `/f/<token>`は`/f/[token]`・「配布されたアンケート」になる。
- 台帳と実装の一致、代表的な動的URLの解決を契約テストで固定する。

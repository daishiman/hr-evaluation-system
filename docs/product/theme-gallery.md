# 配色の見本

画面の配色（系統）5つ × 明るさ2つ、合計10通りの実物です。
アカウントメニューの「画面の配色」「画面の明るさ」で切り替えられます。

- 撮影画面: 上長のホーム（`/manager`）。ヘッダー・メニュー・カード・押しもの・数字・状態の札が1枚に収まるため、系統ごとの違いが最も読み取れます。
- 撮影条件: 幅1280px、ローカルの `pnpm run preview`（Workers ランタイム）、見本データ。
- 撮り直し方: 見た目を変えたら同じ条件で撮り直し、この表の画像を差し替えてください。

## 見本一覧

| 系統 | 選択肢の名前 | 明るい | 暗い |
|---|---|---|---|
| graphite | グレー（既定） | [graphite-light.png](./theme-gallery/graphite-light.png) | [graphite-dark.png](./theme-gallery/graphite-dark.png) |
| azure | ブルー | [azure-light.png](./theme-gallery/azure-light.png) | [azure-dark.png](./theme-gallery/azure-dark.png) |
| sand | ベージュ | [sand-light.png](./theme-gallery/sand-light.png) | [sand-dark.png](./theme-gallery/sand-dark.png) |
| moss | グリーン | [moss-light.png](./theme-gallery/moss-light.png) | [moss-dark.png](./theme-gallery/moss-dark.png) |
| midnight | ネイビー | [midnight-light.png](./theme-gallery/midnight-light.png) | [midnight-dark.png](./theme-gallery/midnight-dark.png) |

## グレー（既定）

| 明るい | 暗い |
|---|---|
| ![グレー・明るい](./theme-gallery/graphite-light.png) | ![グレー・暗い](./theme-gallery/graphite-dark.png) |

## ブルー

| 明るい | 暗い |
|---|---|
| ![ブルー・明るい](./theme-gallery/azure-light.png) | ![ブルー・暗い](./theme-gallery/azure-dark.png) |

## ベージュ

| 明るい | 暗い |
|---|---|
| ![ベージュ・明るい](./theme-gallery/sand-light.png) | ![ベージュ・暗い](./theme-gallery/sand-dark.png) |

## グリーン

| 明るい | 暗い |
|---|---|
| ![グリーン・明るい](./theme-gallery/moss-light.png) | ![グリーン・暗い](./theme-gallery/moss-dark.png) |

## ネイビー

| 明るい | 暗い |
|---|---|
| ![ネイビー・明るい](./theme-gallery/midnight-light.png) | ![ネイビー・暗い](./theme-gallery/midnight-dark.png) |

## 見比べるときの読みどころ

- 面（背景・カード）は、どの系統でも色みを最小限にしてあります。業務の画面で色が主張すると、数字と状態の札が読みにくくなるためです。
- 系統の違いは主に、押しもの（回答を始める／回答状況を確認する）と見出し・現在地の印に出ます。
- 赤（危険）・黄（注意）・進行中の色と、人物の識別色は系統によらず同じです。「赤はどの配色でも赤」を保つためで、`src/components/palette-contract.test.ts` が固定しています。
- 全10通りが WCAG AA（本文4.5:1・境界線3:1）を満たします。同じテストが数値で検査するため、満たさない色は取り込めません。

仕組みと決めごとは [製品仕様の「配色（テーマの系統）」](./spec.md)、どの配色が選ばれたかの数え方は [/api/theme-choice](../../src/app/api/theme-choice/route.ts) を参照してください。

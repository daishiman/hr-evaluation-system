# hr-evaluation-system

人事評価を作成・管理するためのリポジトリです。

## 概要

評価制度の設計ドキュメントと、評価シートの作成・集計を支援する仕組みを管理します。
技術スタックは未確定のため、現時点ではドキュメントと運用ルールを先行して整備します。

## ⚠️ 取り扱い注意

このリポジトリは **Public** です。以下は絶対にコミットしないでください。

- 従業員の氏名・社員番号・所属などの個人情報
- 実際の評価点、評価コメント、フィードバック内容
- 給与・等級・処遇に関するデータ
- 認証情報（API キー、`.env`、サービスアカウント JSON など）

実データは `data/` 配下に置き、`.gitignore` で除外します。
リポジトリに含めるのは **匿名化されたサンプル** のみとしてください。

## ディレクトリ構成

```
.
├── README.md
├── LICENSE
└── .gitignore
```

## セットアップ

```bash
git clone git@github.com:daishiman/hr-evaluation-system.git
cd hr-evaluation-system
```

## ライセンス

MIT License. 詳細は [LICENSE](./LICENSE) を参照してください。

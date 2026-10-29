# 人事評価システムの打ち合わせ資料

閲覧・配布するのは [説明書（単一HTML）](./人事評価システムの説明書_打ち合わせ資料.html)。ボード01〜14は全体像と代表画面の概要、15〜99は全画面と押すと出る内容の詳細です。会議では概要から読み、必要な詳細へ進みます。

これは既存アプリを説明する派生資料です。画面・業務の要件は [製品仕様](../docs/product/spec.md)、API・データ・認証は [システム仕様](../system-spec/index.md)、設計判断は [アーキテクチャ](../architecture/index.md) を優先し、食い違いは資料側を直します。比較元は `63ae2cc`、資料を追加したコミットは `30da196` です。その後の正本の変更は自動反映されません。

## 編集と再生成

- 編集元は `ヒアリング.md`・`要件定義.md`・`仕様書.md`・`変更点.md`、構成を決める `briefing.json`、ボードの `_src/NN_*.html` と `_src/assets/`。画面の写しは見本データで撮り直します。
- `_src/common.css` は今回ボードの共通スタイルをまとめた編集元です。`_src/tokens.css` は配色の契約です。個別調整を失うため、scaffold の `init --refresh-css` で上書きしません。`common.css` を変えたら全99ボードを描き直します。
- 直下の `NN_*.png`、`_src/book/*.webp`、配布用の単一HTML、`_check/*.json` は生成物です。直接直さず、該当する生成・検査を通します。PNGは個別提示、WebPは冊子への埋込み用なので、形式が違うだけで削除しません。

今回の再生成には **system-briefing-book 0.2.10** を使用します。追加コミット時に使った旧生成器の版は、既存の記録からは確定していません。Node.js 22以上と Chrome が必要です。ブラウザが見つからなければ、実行ファイルの絶対パスを `BRIEFING_BROWSER` に設定します。

生成器はこのリポジトリに同梱していません。`PLUGIN_ROOT` は使用ホストが提示する system-briefing-book の `SKILL.md` の絶対パスから上へたどり、`.claude-plugin/plugin.json` または `.codex-plugin/plugin.json` を持つ祖先に解決します。manifest の名前と版を確認し、各シェル実行内で設定します。Claude Codeでは `CLAUDE_PLUGIN_ROOT` を利用できます。個人の配置パスや現在の作業場所から推測しません。

リポジトリ直下で、解決済みの `PLUGIN_ROOT` を設定して順に実行します。各コマンドが成功してから次へ進みます。

```bash
: "${PLUGIN_ROOT:?ホストが示したSKILL.mdから生成器のルートを解決してください}"
BRIEFING_DIR="$(pwd)/打ち合わせ資料"
node "$PLUGIN_ROOT/scripts/validate-briefing-docs.mjs" --dir "$BRIEFING_DIR" --stage all
node "$PLUGIN_ROOT/scripts/render-board-png.mjs" --dir "$BRIEFING_DIR" --jobs 1
node "$PLUGIN_ROOT/scripts/build-briefing-book.mjs" --dir "$BRIEFING_DIR"
```

今回の環境では並列描画が待機することがあったため、描画は `--jobs 1` で1枚ずつ行います。

個別HTMLだけを直したときは render に `--only 13` などを付けられます。共通CSSや広く使う画像を変えた場合は全件を描き直します。Markdownだけの修正でも validate と build を通します。ボードの説明にも影響する変更ならHTMLを直して render も通します。古い画像を許す `--allow-stale` は通常使いません。

`_check/docs.json` の errors、`boards.json` の errors/warnings、`book.json` の stale/external を確認し、変更したPNGと冊子を目で読みます。機械検査の成功は、正本との意味の一致や操作手順の正しさの確認を代替しません。既存の `profile.json` は構造比較で、内容の忠実度は `not-assessed` です。

## 素材の参照範囲

既存の `_check/materials.json` は親フォルダを走査し、キットや `node_modules` も混ざった2000件で打ち切られています（`truncated: true`）。そのため `docs.json` の未使用素材の警告から、素材の網羅性や削除可否を判断しません。

明示された参照先の存在は、4文書から「素材:」のパスをその場で抽出して確かめます。リポジトリ直下で実行し、新しい一覧ファイルは作りません。画像内の文字やHTMLの `data-source`、参照内容の意味の一致は別途確認します。

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
const documents = ['ヒアリング.md', '要件定義.md', '仕様書.md', '変更点.md'];
const paths = new Set(documents.flatMap(name =>
  [...fs.readFileSync(`打ち合わせ資料/${name}`, 'utf8')
    .matchAll(/素材:([^\s、|)（）。]+)/g)].map(match => match[1])));
const missing = [...paths].filter(path => !fs.existsSync(path) || !fs.statSync(path).isFile());
if (missing.length) throw new Error(`素材が見つかりません: ${missing.join('、')}`);
console.log(`素材参照: ${paths.size}件、全パス存在`);
JS
```

今回の整理と確認結果は [30思考法レビュー](../docs/reviews/elegant-review-2026-10-29-documents.md) に記録しています。

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

/**
 * サーバー側の実行ファイルを webpack で組み立てる。
 *
 * 既定の組み立て方（Turbopack）は、画面やAPIのまとまりごとに
 * 同じ共通コードを別々のファイルへ書き出す。中身が同じ 471 KiB の
 * かたまりが6つ、214 KiB のかたまりが3つ作られ、そのすべてが
 * 1つの実行ファイルへ取り込まれていた。webpack は共通コードを
 * 1つにまとめるため、この重複が消える（圧縮後 2,743 KiB → 1,857 KiB）。
 *
 * Cloudflare Workers の上限（圧縮後 3,072 KiB）に対する余裕を保つための設定で、
 * アプリの動きは変えない。
 */
config.buildCommand = "pnpm exec next build --webpack";

export default config;

/**
 * Cloudflare Workers の入口（wrangler.jsonc の main）。
 *
 * OpenNext が作る `.open-next/worker.js` をそのまま呼び、応答に生成時刻のヘッダーを足すだけの包み。
 * 生成時刻は「反映されない」報告の切り分けに使う（src/lib/generated-at.ts / docs/deploy-notes.md §7）。
 * ミドルウェアで付けるとサーバー側の実行ファイルが容量上限に近づくため（next.config.ts）、
 * Next.js の外側のここで付ける。
 *
 * 公式の手順: https://opennext.js.org/cloudflare/howtos/custom-worker
 */
// @ts-ignore `.open-next/worker.js` はビルド（opennextjs-cloudflare build）のときに作られる
import { default as handler } from "./.open-next/worker.js";
import { stampGeneratedAt } from "./src/lib/generated-at";

export default {
  async fetch(request, env, ctx) {
    const res: Response = await handler.fetch(request, env, ctx);
    return stampGeneratedAt(res);
  },
} satisfies ExportedHandler<CloudflareEnv>;

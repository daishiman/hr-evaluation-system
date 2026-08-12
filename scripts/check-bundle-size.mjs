#!/usr/bin/env node
// 公開ファイル（Worker + 静的アセット）の圧縮後サイズを測り、
// Cloudflare Workers 無料プランの上限（3MB）にどれだけ近いかを報告する。
//
// 使い方（ビルド後に実行すること。ビルドしていないと .open-next が無く失敗する）:
//   pnpm run cf:dry-run        # .open-next/ を作る（ビルドのみ、デプロイはしない）
//   pnpm run check:bundle-size # 圧縮後サイズを測って報告する
//
// 判定:
//   - 上限（3,072 KiB）を超えた  → 失敗（デプロイを止める）
//   - 警告ライン（上限の80%）を超えた → 警告のみ（デプロイは続行）
//   - それ未満 → 何もしない
//
// 参考: docs/deploy-notes.md「7. アセットサイズ」
//   `wrangler deploy --dry-run --outdir=<一時ディレクトリ>` は本番へ配布せずに
//   「実際にデプロイしたら何KBになるか（gzip後）」を教えてくれる。

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Cloudflare Workers 無料プランの圧縮後アップロード上限。
// 環境変数での上書きは動作確認用（わざと閾値を下げて警告・失敗を再現する）。
const LIMIT_KIB = Number.parseFloat(process.env.BUNDLE_SIZE_LIMIT_KIB ?? "") || 3072;
// 上限の80%を超えたら「そろそろ近い」と早めに気づけるようにする（致命的エラーにはしない）。
const WARN_RATIO = Number.parseFloat(process.env.BUNDLE_SIZE_WARN_RATIO ?? "") || 0.8;
const WARN_KIB = LIMIT_KIB * WARN_RATIO;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const outdir = mkdtempSync(join(tmpdir(), "bundle-size-check-"));

let output;
try {
  // wrangler は --dry-run でも $PATH 経由の wrangler ではなく
  // プロジェクトの devDependencies のものを使う（pnpm exec 経由で呼ぶ）。
  output = execFileSync(
    "pnpm",
    ["exec", "wrangler", "deploy", "--dry-run", `--outdir=${outdir}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (error) {
  // execFileSync は非ゼロ終了で例外を投げるが、--dry-run は正常時も
  // stdout/stderr を error.stdout / error.stderr に持つことがあるため両方見る。
  output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  if (!output) {
    fail(
      `容量測定コマンド（wrangler deploy --dry-run）の実行に失敗しました。\n${error.message}\n先に「pnpm run cf:dry-run」でビルドが済んでいるか確認してください。`,
    );
  }
} finally {
  rmSync(outdir, { recursive: true, force: true });
}

// 出力例: "Total Upload: 11705.72 KiB / gzip: 2215.69 KiB"
const match = output.match(
  /Total Upload:\s*([\d.]+)\s*KiB\s*\/\s*gzip:\s*([\d.]+)\s*KiB/,
);

if (!match) {
  fail(
    `wrangler の出力から容量を読み取れませんでした。出力形式が変わった可能性があります。\n--- wrangler の出力 ---\n${output}`,
  );
}

const gzipKiB = Number.parseFloat(match[2]);
const ratio = gzipKiB / LIMIT_KIB;
const percent = (ratio * 100).toFixed(1);

console.log("=== 公開ファイルの容量チェック ===");
console.log(`圧縮後サイズ: ${gzipKiB.toFixed(1)} KiB`);
console.log(`無料プランの上限: ${LIMIT_KIB} KiB`);
console.log(`上限に対する割合: ${percent}%`);

if (gzipKiB > LIMIT_KIB) {
  fail(
    `公開ファイルの容量が無料プランの上限（${LIMIT_KIB} KiB）を超えています（${gzipKiB.toFixed(1)} KiB / ${percent}%）。\nデプロイすると失敗します。参考データの遅延読み込み・不要コードの削除など、docs/deploy-notes.md「7. アセットサイズ」を参照して容量を減らしてください。`,
  );
} else if (gzipKiB > WARN_KIB) {
  // 警告のみ。exit 0 のままにして、正常なデプロイを誤って止めないようにする。
  console.warn(
    `::warning::公開ファイルの容量が上限の${(WARN_RATIO * 100).toFixed(0)}%（${WARN_KIB.toFixed(0)} KiB）を超えました（${gzipKiB.toFixed(1)} KiB / ${percent}%）。上限（${LIMIT_KIB} KiB）に近づいています。docs/product/backlog.md の実測値を更新し、容量削減（参考データの遅延読み込みなど）を検討してください。`,
  );
} else {
  console.log("上限まで余裕があります。");
}

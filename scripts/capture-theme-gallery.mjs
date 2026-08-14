#!/usr/bin/env node

/**
 * Workers preview の /manager を実ブラウザで撮影し、配色ギャラリーを更新する。
 *
 * 追加パッケージを置かずに再実行できるよう、macOS の Google Chrome と
 * Chrome DevTools Protocol を Node.js の標準機能だけで操作する。
 * preview とローカル D1 の見本データは、実行前に別ターミナルで用意する。
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = resolve(ROOT, "docs/product/theme-gallery");
const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEFAULT_ORIGIN = "http://localhost:8787";
const DEFAULT_EMAIL = "manager@kyufu.hyoka-demo.jp";
const DEFAULT_PASSWORD = "Hyoka2026!demo";

const GALLERY_PALETTES = ["azure", "sand", "moss", "midnight"];
const GALLERY_THEMES = ["light", "dark"];
const GALLERY_VIEWPORT = { width: 1280, height: 900, dpr: 1.25 };
const RESPONSIVE_VIEWPORTS = [
  { width: 375, height: 812, dpr: 1 },
  { width: 768, height: 900, dpr: 1 },
  { width: 1280, height: 900, dpr: 1 },
  { width: 1600, height: 1000, dpr: 1 },
];

function usage() {
  console.log(`使い方:
  pnpm exec node scripts/capture-theme-gallery.mjs [options]

options:
  --origin <URL>       preview の URL（既定: ${DEFAULT_ORIGIN}）
  --email <address>    撮影用 MANAGER（既定: ${DEFAULT_EMAIL}）
  --password <value>   撮影用パスワード（既定: ローカル seed のデモ値）
  --chrome <path>      Google Chrome 実行ファイル
  --help               この説明を表示

環境変数 THEME_GALLERY_EMAIL / THEME_GALLERY_PASSWORD / THEME_GALLERY_CHROME
でも同じ値を渡せます。`);
}

function parseArgs(argv) {
  const options = {
    origin: DEFAULT_ORIGIN,
    email: process.env.THEME_GALLERY_EMAIL || DEFAULT_EMAIL,
    password: process.env.THEME_GALLERY_PASSWORD || DEFAULT_PASSWORD,
    chrome: process.env.THEME_GALLERY_CHROME || DEFAULT_CHROME,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      usage();
      process.exit(0);
    }
    if (!["--origin", "--email", "--password", "--chrome"].includes(arg)) {
      throw new Error(`不明な引数です: ${arg}`);
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`${arg} の値がありません。`);
    options[arg.slice(2)] = value;
    index += 1;
  }
  options.origin = options.origin.replace(/\/$/, "");
  const parsedOrigin = new URL(options.origin);
  if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
    throw new Error("--origin は http または https の URL にしてください。");
  }
  return options;
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

class CdpClient {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener("open", resolveReady, { once: true });
      this.socket.addEventListener("error", () => rejectReady(new Error("Chrome のデバッグ接続を開けませんでした。")), {
        once: true,
      });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const callback = this.pending.get(message.id);
      if (!callback) return;
      this.pending.delete(message.id);
      if (message.error) callback.reject(new Error(`${callback.method}: ${message.error.message}`));
      else callback.resolve(message.result);
    });
    this.socket.addEventListener("close", () => {
      for (const callback of this.pending.values()) callback.reject(new Error("Chrome との接続が閉じました。"));
      this.pending.clear();
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    const result = new Promise((resolveResult, rejectResult) => {
      this.pending.set(id, { method, resolve: resolveResult, reject: rejectResult });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  close() {
    this.socket.close();
  }
}

async function findUnusedPort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.unref();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        rejectPort(new Error("Chrome のデバッグ用ポートを確保できませんでした。"));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });
}

async function launchChrome(chromePath) {
  if (!existsSync(chromePath)) {
    throw new Error(`Google Chrome が見つかりません: ${chromePath}\n--chrome で実行ファイルを指定してください。`);
  }
  const profileDir = mkdtempSync(join(tmpdir(), "hr-theme-gallery-"));
  const debugPort = await findUnusedPort();
  const processHandle = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-features=Translate,MediaRouter",
      "--disable-sync",
      "--metrics-recording-only",
      "--password-store=basic",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let chromeError = "";
  processHandle.stderr.setEncoding("utf8");
  processHandle.stderr.on("data", (chunk) => {
    chromeError = `${chromeError}${chunk}`.slice(-4_000);
  });

  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (processHandle.exitCode !== null) {
        throw new Error(`Google Chrome が起動直後に終了しました。${chromeError ? `\n${chromeError.trim()}` : ""}`);
      }
      try {
        const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
        const page = targets.find((target) => target.type === "page");
        if (page?.webSocketDebuggerUrl) {
          return { client: new CdpClient(page.webSocketDebuggerUrl), processHandle, profileDir };
        }
      } catch {
        // Chromeがデバッグ接続を開くまで待つ。
      }
      await delay(50);
    }
    throw new Error(`Chrome のデバッグ接続待ちが時間切れになりました。${chromeError ? `\n${chromeError.trim()}` : ""}`);
  } catch (error) {
    processHandle.kill("SIGTERM");
    rmSync(profileDir, { recursive: true, force: true });
    throw error;
  }
}

async function evaluate(client, expression, { awaitPromise = false, returnByValue = true } = {}) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text;
    throw new Error(`ブラウザ内の処理に失敗しました: ${detail}`);
  }
  return response.result?.value;
}

async function waitForCondition(client, expression, label, timeoutMilliseconds = 20_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`${label} の待機が時間切れになりました。`);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  const expected = JSON.stringify(url);
  await waitForCondition(
    client,
    `location.href === ${expected} && document.readyState === "complete"`,
    `${url} の表示`,
  );
  await settle(client);
}

async function settle(client) {
  await evaluate(
    client,
    `(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 350));
      return true;
    })()`,
    { awaitPromise: true },
  );
}

async function setViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.dpr,
    mobile: false,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await waitForCondition(
    client,
    `innerWidth === ${viewport.width} && innerHeight === ${viewport.height} && devicePixelRatio === ${viewport.dpr}`,
    `${viewport.width}px viewport の反映`,
  );
}

async function login(client, options) {
  await navigate(client, `${options.origin}/login`);
  const email = JSON.stringify(options.email);
  const password = JSON.stringify(options.password);
  const result = await evaluate(
    client,
    `(async () => {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: ${email}, password: ${password} }),
      });
      return { ok: response.ok, status: response.status };
    })()`,
    { awaitPromise: true },
  );
  if (!result?.ok) throw new Error(`撮影用MANAGERでログインできませんでした（HTTP ${result?.status ?? "不明"}）。`);
  await navigate(client, `${options.origin}/manager`);
  const path = await evaluate(client, "location.pathname");
  if (path !== "/manager") throw new Error(`ログイン後に /manager を開けませんでした（現在地: ${path}）。`);
  const loginError = await evaluate(client, `document.querySelector('[role="alert"]')?.textContent?.trim() || ""`);
  if (loginError) throw new Error(`ログイン後の画面にエラーが出ています: ${loginError}`);
}

async function applyAppearance(client, palette, theme) {
  await evaluate(
    client,
    `(() => {
      localStorage.setItem("hr-palette", ${JSON.stringify(palette)});
      localStorage.setItem("hr-theme", ${JSON.stringify(theme)});
      return true;
    })()`,
  );
  await client.send("Page.reload", { ignoreCache: false });
  await waitForCondition(client, `document.readyState === "complete"`, `${palette}-${theme} の再表示`);
  await waitForCondition(
    client,
    `document.documentElement.dataset.palette === ${JSON.stringify(palette)} && document.documentElement.dataset.theme === ${JSON.stringify(theme)}`,
    `${palette}-${theme} の配色反映`,
  );
  await settle(client);
  await evaluate(
    client,
    `(() => {
      const previous = document.querySelector("#theme-gallery-capture-style");
      previous?.remove();
      const style = document.createElement("style");
      style.id = "theme-gallery-capture-style";
      style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
      document.head.append(style);
      window.scrollTo(0, 0);
      return true;
    })()`,
  );
}

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error("Chrome から返った画像が PNG ではありません。");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function capture(client, filename, expectedViewport) {
  windowCleanupGuard(filename);
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const buffer = Buffer.from(result.data, "base64");
  const dimensions = pngDimensions(buffer);
  const expectedWidth = Math.round(expectedViewport.width * expectedViewport.dpr);
  const expectedHeight = Math.round(expectedViewport.height * expectedViewport.dpr);
  if (dimensions.width !== expectedWidth || dimensions.height !== expectedHeight) {
    throw new Error(
      `${filename} の実寸が ${dimensions.width}x${dimensions.height}px です（期待: ${expectedWidth}x${expectedHeight}px）。`,
    );
  }
  const outputPath = resolve(OUTPUT_DIR, filename);
  writeFileSync(outputPath, buffer);
  console.log(`  ${filename}: CSS ${expectedViewport.width}x${expectedViewport.height}, DPR ${expectedViewport.dpr}, PNG ${dimensions.width}x${dimensions.height}`);
  return dimensions;
}

function windowCleanupGuard(filename) {
  if (!/^[a-z0-9-]+\.png$/.test(filename)) throw new Error(`安全でない画像名です: ${filename}`);
  const target = resolve(OUTPUT_DIR, filename);
  if (!target.startsWith(`${OUTPUT_DIR}/`)) throw new Error(`出力先がギャラリーディレクトリ外です: ${target}`);
}

async function inspectLayout(client) {
  return evaluate(
    client,
    `(() => {
      const root = document.documentElement;
      const account = document.querySelector(".account-trigger");
      const rect = account?.getBoundingClientRect();
      return {
        cssViewport: [innerWidth, innerHeight],
        dpr: devicePixelRatio,
        scrollWidth: Math.max(root.scrollWidth, document.body?.scrollWidth || 0),
        horizontalOverflow: Math.max(root.scrollWidth, document.body?.scrollWidth || 0) > innerWidth,
        accountMenuVisible: Boolean(rect && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth),
      };
    })()`,
  );
}

async function openThemeMenu(client) {
  const opened = await evaluate(
    client,
    `(() => {
      const trigger = document.querySelector(".account-trigger");
      if (!(trigger instanceof HTMLButtonElement)) return false;
      if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();
      return true;
    })()`,
  );
  if (!opened) throw new Error("アカウントメニューのボタンを見つけられませんでした。");
  await waitForCondition(
    client,
    `document.querySelector('[aria-label="アカウントメニュー"]') && document.querySelector('.account-trigger')?.getAttribute('aria-expanded') === 'true'`,
    "テーマメニューを開く操作",
  );
  await settle(client);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let previewResponse;
  try {
    previewResponse = await fetch(`${options.origin}/login`, { redirect: "manual" });
  } catch {
    throw new Error(`${options.origin} に接続できません。先に pnpm run preview を起動してください。`);
  }
  if (previewResponse.status >= 500) {
    throw new Error(`preview が HTTP ${previewResponse.status} を返しました。`);
  }

  const chrome = await launchChrome(options.chrome);
  try {
    const client = chrome.client;
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    const browser = await client.send("Browser.getVersion");
    console.log(`Browser: ${browser.product} (${browser.userAgent})`);

    await setViewport(client, GALLERY_VIEWPORT);
    await login(client, options);

    console.log("\n配色ギャラリー:");
    for (const palette of GALLERY_PALETTES) {
      for (const theme of GALLERY_THEMES) {
        await applyAppearance(client, palette, theme);
        await capture(client, `${palette}-${theme}.png`, GALLERY_VIEWPORT);
      }
    }

    await applyAppearance(client, "azure", "light");
    await openThemeMenu(client);
    await capture(client, "theme-menu-open.png", GALLERY_VIEWPORT);

    console.log("\nレスポンシブ確認（azure / light）:");
    for (const viewport of RESPONSIVE_VIEWPORTS) {
      await setViewport(client, viewport);
      await applyAppearance(client, "azure", "light");
      const layout = await inspectLayout(client);
      if (layout.horizontalOverflow || !layout.accountMenuVisible) {
        throw new Error(
          `${viewport.width}px で表示領域外へのはみ出し、またはテーマメニュー導線の欠落を検出しました: ${JSON.stringify(layout)}`,
        );
      }
      await capture(client, `responsive-${viewport.width}.png`, viewport);
      console.log(`    overflow: none / account menu: visible / scrollWidth: ${layout.scrollWidth}px`);
    }

    console.log("\n完了: 既存の graphite 画像は削除せず、今回の対象外として残しています。");
  } finally {
    chrome.client.close();
    chrome.processHandle.kill("SIGTERM");
    await delay(150);
    rmSync(chrome.profileDir, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(`撮影に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

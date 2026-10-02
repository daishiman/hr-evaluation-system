import { expect, type Locator, type Page } from "@playwright/test";

/** setup が保存し、各試験が使うログイン状態（.gitignore 済み） */
export const STORAGE_STATE = "e2e/.auth/super-admin.json";

/** ローカルの見本データ（scripts/seed-data.mjs）のドメインとパスワード。見本の利用者は全員が同じパスワード */
const SEED = { domain: "hyoka-demo.jp", password: "Hyoka2026!demo" };

export interface Account {
  email: string;
  password: string;
}

/**
 * 会社を追加できるのはシステム全体管理者だけ。既定はローカルの見本データの値。
 * 別のアカウントで走らせるときは環境変数で渡す。
 */
export const E2E_ACCOUNT: Account = {
  email: process.env.E2E_EMAIL ?? `super@${SEED.domain}`,
  password: process.env.E2E_PASSWORD ?? SEED.password,
};

/**
 * アンケートに答える一般の社員。既定は見本データの1社目（kyufu）の1人目（e1）。
 * 見本の社員のアドレスは「社員のキー@会社のキー.ドメイン」の形。
 */
export const E2E_RESPONDENT: Account = {
  email: process.env.E2E_RESPONDENT_EMAIL ?? `e1@kyufu.${SEED.domain}`,
  password: process.env.E2E_RESPONDENT_PASSWORD ?? SEED.password,
};

export const COMPANIES_PATH = "/system/companies";
/** 会社の追加の成功の知らせ（src/actions/companies.ts の message）。控えは畳まれているので、知らせの文面で見る */
export const SUCCESS_TEXT = "を追加し、管理者アカウントを作りました";
const LIST_HEADING = /登録されている会社（(\d+)社）/;

export interface NewCompany {
  name: string;
  slug: string;
  adminEmail: string;
}

/** 試験ごとに重ならない会社を作る。名前に E2E と付け、ローカル D1 に残っても見分けられるようにする。 */
export function uniqueCompany(label: string): NewCompany {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const slug = `e2e-${id}`;
  return { name: `E2E ${label} ${id}`, slug, adminEmail: `${slug}@example.com` };
}

/** 一覧に出る会社のカード（会社IDの行は一覧のカードにしか出ない） */
export function companyCard(page: Page, company: NewCompany): Locator {
  return page.getByText(`会社ID：${company.slug}`);
}

/** 画面の部品が動き出す（React が手を付ける）まで待つ。前に押すと、ふつうのフォーム送信になってしまう。 */
export async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((key) => key.startsWith("__reactProps"));
  }, selector);
}

/** ログインし、メニューが出るまで待つ。 */
export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto("/login");
  await waitForHydration(page, "#email");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  // role="alert" では確かめない。Next.js の画面遷移の読み上げ役が空の alert として常にある
  await expect(page.getByRole("complementary", { name: "メニュー" })).toBeVisible();
}

/** システム全体管理者が「操作する会社」を切り替える。メニューの会社切替がある画面を開いてから呼ぶ。 */
export async function switchCompany(page: Page, name: string): Promise<void> {
  await waitForHydration(page, "#company-scope");
  const select = page.locator("#company-scope");
  const current = await select.evaluate((el) =>
    el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.textContent ?? "") : "",
  );
  if (current === name) return;
  await select.selectOption({ label: name });
  await expect(page.getByRole("status").filter({ hasText: "操作する会社を切り替えました。" })).toBeVisible({
    timeout: 30_000,
  });
}

/** 知らせが初めて出た瞬間の画面 */
export interface FirstStatusSnapshot {
  /** 画面全体の文字 */
  text: string;
  /** 名前ごとに、セレクタに当たった要素の文字（入力欄は値） */
  parts: Record<string, string[]>;
}

/**
 * 知らせに statusText が初めて入った瞬間の画面を控える仕掛けを置き、控えを読む関数を返す。押す前に呼ぶ。
 *
 * expect の自動の再試行に任せると「あとから追いついた」場合も通ってしまうため、
 * 同じ描画のうちに画面が新しくなっていたか（O1）はこの控えで判定する。
 * 知らせの場所の既定は role="status"。違う場所に出す部品は within で指す。
 */
export async function watchFirstStatus(
  page: Page,
  statusText: string,
  parts: Record<string, string> = {},
  within = '[role="status"]',
): Promise<() => Promise<FirstStatusSnapshot>> {
  await page.evaluate(
    ({ statusText, parts, within }) => {
      const w = window as unknown as { __e2eFirstStatus?: unknown; __e2eObserver?: MutationObserver };
      w.__e2eObserver?.disconnect();
      delete w.__e2eFirstStatus;
      const read = (el: Element) =>
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? "");
      const observer = new MutationObserver(() => {
        const statuses = Array.from(document.querySelectorAll(within));
        if (!statuses.some((el) => el.textContent?.includes(statusText))) return;
        w.__e2eFirstStatus = {
          text: document.body.textContent ?? "",
          parts: Object.fromEntries(
            Object.entries(parts).map(([name, selector]) => [name, Array.from(document.querySelectorAll(selector), read)]),
          ),
        };
        observer.disconnect();
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      w.__e2eObserver = observer;
    },
    { statusText, parts, within },
  );

  return async () => {
    const snapshot = await page.evaluate(() => (window as unknown as { __e2eFirstStatus?: unknown }).__e2eFirstStatus);
    if (!snapshot) throw new Error(`「${statusText}」が出た瞬間の画面を控えられませんでした`);
    return snapshot as FirstStatusSnapshot;
  };
}

/** 見出し「登録されている会社（N社）」の N */
export async function listedCount(page: Page): Promise<number> {
  const text = (await page.getByText(LIST_HEADING).textContent()) ?? "";
  const match = LIST_HEADING.exec(text);
  if (!match) throw new Error(`会社の件数の見出しが読めません: ${text}`);
  return Number(match[1]);
}

export async function openCompanies(page: Page): Promise<void> {
  await page.goto(COMPANIES_PATH);
  // 会社IDの欄は追加のフォームにしかない（一覧のカードの編集フォームには無い）
  await waitForHydration(page, 'input[name="slug"]');
}

/** 成功表示が DOM に初めて現れた瞬間の、一覧の様子 */
export interface FirstSuccessSnapshot {
  hasCard: boolean;
  count: number | null;
  inSwitcher: boolean;
}

/** 会社を追加し、成功表示が出るまで待つ。成功表示が初めて出た瞬間の一覧（watchFirstStatus の控え）を返す。 */
export async function addCompany(page: Page, company: NewCompany): Promise<FirstSuccessSnapshot> {
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "この内容で会社を追加する" }) });
  await form.locator('input[name="name"]').fill(company.name);
  await form.locator('input[name="slug"]').fill(company.slug);
  await form.locator('input[name="businessType"]').fill("E2E 確認");
  await form.locator('input[name="adminName"]').fill("E2E 管理者");
  await form.locator('input[name="adminEmail"]').fill(company.adminEmail);

  const atSuccess = await watchFirstStatus(page, SUCCESS_TEXT, { switcher: "#company-scope option" });
  await form.getByRole("button", { name: "この内容で会社を追加する" }).click();
  await expect(page.getByRole("status").filter({ hasText: SUCCESS_TEXT })).toBeVisible({ timeout: 30_000 });

  const { text, parts } = await atSuccess();
  const count = LIST_HEADING.exec(text);
  return {
    hasCard: text.includes(`会社ID：${company.slug}`),
    count: count ? Number(count[1]) : null,
    inSwitcher: parts.switcher.includes(company.name),
  };
}

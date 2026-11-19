import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { createVerifiedUser, loadDb } from "../../helpers/auth-otp.js";
import { cardTile } from "../../helpers/catalog.js";
import { API_BASE_URL, WEB_BASE_URL } from "../../helpers/constants.js";
import { deleteUser } from "../../helpers/db.js";

// Seed printings (apps/api/src/test/fixtures/seed.sql).
const ANNIE_FIERY_NORMAL = "019cfc3b-03d6-74cf-adec-1dce41f631eb";
const GAREN_RUGGED_NORMAL = "019cfc3b-03d6-752a-adc5-19033009d65d";

const PASSWORD = "FirstPaintE2ePassword1!";
const TOP_BAR = "main .sticky";
const SIDEBAR = '[data-slot="sidebar-container"]';

function box(page: Page, selector: string) {
  return page.evaluate((target) => {
    const element = [...document.querySelectorAll(target)].find(
      (candidate) => candidate.getBoundingClientRect().width > 0,
    );
    const rect = element?.getBoundingClientRect();
    return rect ? [rect.x, rect.y, rect.width, rect.height] : null;
  }, selector);
}

/** The server HTML as painted before any script runs, signed in as `page`'s user. */
async function serverPaint(browser: Browser, page: Page, path: string, selectors: string[]) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const serverPage = await context.newPage();
    await serverPage.goto(path);
    return await Promise.all(selectors.map((selector) => box(serverPage, selector)));
  } finally {
    await context.close();
  }
}

async function signIn(request: APIRequestContext, email: string) {
  const response = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    headers: { Origin: WEB_BASE_URL },
    data: { email, password: PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
}

async function seedInbox(request: APIRequestContext) {
  const collections = await request.get(`${API_BASE_URL}/api/v1/collections`);
  expect(collections.ok()).toBeTruthy();
  const { items } = (await collections.json()) as { items: { id: string; isInbox: boolean }[] };
  const inbox = items.find((collection) => collection.isInbox);
  const response = await request.post(`${API_BASE_URL}/api/v1/copies`, {
    headers: { Origin: WEB_BASE_URL },
    data: {
      copies: [ANNIE_FIERY_NORMAL, GAREN_RUGGED_NORMAL].map((printingId) => ({
        printingId,
        collectionId: inbox?.id,
      })),
    },
  });
  expect(response.ok()).toBeTruthy();
}

// These pages render only in the browser; the server sends their pending shell.
test.describe("client-rendered pages keep their first-paint layout", () => {
  let email = "";

  test.beforeEach(async ({ page }) => {
    email = `first-paint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
    const sql = loadDb();
    try {
      await createVerifiedUser(page.request, sql, email, PASSWORD);
    } finally {
      await sql.end();
    }
    await signIn(page.request, email);
  });

  test.afterEach(async () => {
    await deleteUser(email);
  });

  test("/collections keeps the sidebar, top bar and first card in place", async ({
    browser,
    page,
  }) => {
    await seedInbox(page.request);
    const [serverBar, serverSidebar] = await serverPaint(browser, page, "/collections", [
      TOP_BAR,
      SIDEBAR,
    ]);
    expect(serverBar).not.toBeNull();
    expect(serverSidebar).not.toBeNull();

    await page.goto("/collections");
    const card = cardTile(page, "Annie, Fiery");
    await card.waitFor({ state: "visible", timeout: 30_000 });
    const cardAtFirstShow = await card.boundingBox();
    await page.waitForLoadState("networkidle");

    expect(await box(page, TOP_BAR)).toEqual(serverBar);
    expect(await box(page, SIDEBAR)).toEqual(serverSidebar);
    expect(await card.boundingBox()).toEqual(cardAtFirstShow);
  });

  test("/decks keeps its top bar in place", async ({ browser, page }) => {
    const [serverBar] = await serverPaint(browser, page, "/decks", [TOP_BAR]);
    expect(serverBar).not.toBeNull();

    await page.goto("/decks");
    await expect(page.getByRole("heading", { name: "Decks" })).toBeVisible({ timeout: 30_000 });

    expect(await box(page, TOP_BAR)).toEqual(serverBar);
  });
});

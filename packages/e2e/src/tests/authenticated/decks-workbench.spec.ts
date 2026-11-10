import { readFileSync } from "node:fs";

import type { Browser, BrowserContextOptions, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { E2eState } from "../../helpers/constants.js";
import { API_BASE_URL, STATE_FILE, WEB_BASE_URL } from "../../helpers/constants.js";
import { connectToDb } from "../../helpers/db.js";

// The beta is a per-user opt-in, so each test signs up its own user: flipping
// the shared fixture user would switch every other deck spec to the beta.
async function signUpFreshUser(
  browser: Browser,
  contextOptions: BrowserContextOptions = {},
): Promise<Page> {
  const email = `workbench-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const password = "WorkbenchTest1!";
  const context = await browser.newContext(contextOptions);
  const headers = { Origin: WEB_BASE_URL };
  const signUp = await context.request.post(`${API_BASE_URL}/api/auth/sign-up/email`, {
    headers,
    data: { email, password, name: "Workbench E2E" },
  });
  expect(signUp.ok()).toBeTruthy();
  const state: E2eState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  const sql = connectToDb(state.tempDbUrl);
  try {
    await sql`UPDATE users SET email_verified = true WHERE email = ${email}`;
  } finally {
    await sql.end();
  }
  const signIn = await context.request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    headers,
    data: { email, password },
  });
  expect(signIn.ok()).toBeTruthy();
  return context.newPage();
}

async function optIn(page: Page) {
  const response = await page.request.put(`${API_BASE_URL}/api/v1/feature-flags/self`, {
    headers: { Origin: WEB_BASE_URL },
    data: { key: "deck-builder-beta", enabled: true },
  });
  expect(response.ok()).toBeTruthy();
}

async function createDeck(page: Page, name: string): Promise<string> {
  const response = await page.request.post(`${API_BASE_URL}/api/v1/decks`, {
    headers: { Origin: WEB_BASE_URL },
    data: { name, format: "constructed" },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

function deckColumn(page: Page) {
  return page.getByRole("complementary", { name: "Your deck" });
}

test.describe("deck builder beta", () => {
  test("opts in from settings and back out from the editor menu", async ({ browser }) => {
    const page = await signUpFreshUser(browser);
    const deckId = await createDeck(page, "Beta Opt-in Deck");

    await page.goto("/profile#beta");
    const toggle = page.getByRole("switch", { name: "New deck builder" });
    await expect(toggle).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await page.goto(`/decks/${deckId}`);
    await expect(page.getByText("Adding to")).toBeVisible({ timeout: 15_000 });
    await expect(deckColumn(page)).toBeVisible();

    await page.getByRole("button", { name: "Deck actions" }).click();
    await page.getByRole("menuitem", { name: "Back to the classic editor" }).click();
    await expect(page.getByText("Adding to")).toBeHidden({ timeout: 15_000 });
    await expect(deckColumn(page)).toBeHidden();

    await page.context().close();
  });

  test("opts in from the classic editor banner", async ({ browser }) => {
    const page = await signUpFreshUser(browser);
    const deckId = await createDeck(page, "Beta Banner Deck");

    await page.goto(`/decks/${deckId}`);
    await page.getByRole("button", { name: "Try it" }).click({ timeout: 15_000 });
    await expect(deckColumn(page)).toBeVisible({ timeout: 15_000 });

    await page.context().close();
  });

  test("adds from the card list in Build and reads the deck in Deck mode", async ({ browser }) => {
    const page = await signUpFreshUser(browser);
    const deckId = await createDeck(page, "Beta Build Deck");
    const optInResponse = await page.request.put(`${API_BASE_URL}/api/v1/feature-flags/self`, {
      headers: { Origin: WEB_BASE_URL },
      data: { key: "deck-builder-beta", enabled: true },
    });
    expect(optInResponse.ok()).toBeTruthy();

    await page.goto(`/decks/${deckId}?editor=build&target=main`);
    await expect(page.getByText("Adding to")).toBeVisible({ timeout: 15_000 });
    const annie = page
      .getByRole("img", { name: "Annie, Fiery" })
      .first()
      .locator(
        "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' group ')][1]",
      );
    await annie.getByRole("button", { name: "Add to deck" }).click({ timeout: 15_000 });
    await expect(deckColumn(page).getByText("Annie, Fiery")).toBeVisible();
    await expect(annie.getByRole("button", { name: "Remove from deck" })).toHaveCount(0);

    await page
      .getByRole("group", { name: "Editor mode" })
      .getByRole("button", { name: "View", exact: true })
      .click();
    await expect(deckColumn(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Add to deck" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit deck", exact: true }).click();
    await expect(deckColumn(page)).toBeVisible();

    await page.context().close();
  });

  test("shows card detail in place of the card list and removes from the row menu", async ({
    browser,
  }) => {
    const page = await signUpFreshUser(browser);
    const deckId = await createDeck(page, "Beta Detail Deck");
    const optInResponse = await page.request.put(`${API_BASE_URL}/api/v1/feature-flags/self`, {
      headers: { Origin: WEB_BASE_URL },
      data: { key: "deck-builder-beta", enabled: true },
    });
    expect(optInResponse.ok()).toBeTruthy();

    await page.goto(`/decks/${deckId}?editor=build&target=main`);
    const annieImage = page.getByRole("img", { name: "Annie, Fiery" }).first();
    await annieImage.click({ timeout: 15_000 });
    const detail = page.getByRole("region", { name: "Card details" });
    await expect(detail).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(deckColumn(page)).toBeVisible();
    await expect(page.getByText("Adding to")).toBeHidden();

    await detail.getByRole("button", { name: "Add to Main Deck" }).click();
    await expect(deckColumn(page).getByText("Annie, Fiery")).toBeVisible();
    await expect(detail.getByText("1 in deck")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
    await expect(page.getByText("Adding to")).toBeVisible();

    await deckColumn(page).getByText("Annie, Fiery").hover();
    await deckColumn(page)
      .getByRole("button", { name: "More actions for Annie, Fiery", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Remove from deck" }).click();
    await expect(deckColumn(page).getByText("Annie, Fiery")).toBeHidden();

    await page.context().close();
  });

  test("opens the row menu from the keyboard with Shift+F10", async ({ browser }) => {
    const page = await signUpFreshUser(browser);
    const deckId = await createDeck(page, "Beta Keyboard Deck");
    await optIn(page);

    await page.goto(`/decks/${deckId}?editor=build&target=main`);
    const annie = page
      .getByRole("img", { name: "Annie, Fiery" })
      .first()
      .locator(
        "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' group ')][1]",
      );
    await annie.getByRole("button", { name: "Add to deck" }).click({ timeout: 15_000 });
    const row = deckColumn(page)
      .getByRole("button", { name: /^Energy 5 Annie, Fiery/u })
      .last();
    await row.focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menuitem", { name: "Remove from deck" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.context().close();
  });

  test("Back leaves the editor in one press after a trip to Deck mode", async ({ browser }) => {
    const page = await signUpFreshUser(browser);
    const deckId = await createDeck(page, "Beta History Deck");
    await optIn(page);

    await page.goto("/decks");
    await page.goto(`/decks/${deckId}`);
    await expect(deckColumn(page)).toBeVisible({ timeout: 15_000 });
    const modes = page.getByRole("group", { name: "Editor mode" });
    await modes.getByRole("button", { name: "Deck", exact: true }).click();
    await expect(deckColumn(page)).toBeHidden();
    await modes.getByRole("button", { name: "Build", exact: true }).click();
    await expect(deckColumn(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/decks$/u, { timeout: 15_000 });

    await page.context().close();
  });

  test("on a phone, the deck sheet opens from the bar and Back closes it", async ({ browser }) => {
    const page = await signUpFreshUser(browser, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const deckId = await createDeck(page, "Beta Phone Deck");
    await optIn(page);

    await page.goto(`/decks/${deckId}?editor=build&target=main`);
    await page.getByRole("button", { name: "Open deck zones" }).click({ timeout: 15_000 });
    await expect(page.getByText("Adding to Main Deck. Tap another zone to switch.")).toBeVisible();
    await page.goBack();
    await expect(page.getByText("Adding to Main Deck. Tap another zone to switch.")).toBeHidden();
    expect(new URL(page.url()).pathname).toBe(`/decks/${deckId}`);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();

    await page.context().close();
  });
});

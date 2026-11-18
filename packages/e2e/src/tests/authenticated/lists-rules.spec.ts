import { readFileSync } from "node:fs";

import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { E2eState } from "../../helpers/constants.js";
import { API_BASE_URL, STATE_FILE, WEB_BASE_URL } from "../../helpers/constants.js";
import { connectToDb } from "../../helpers/db.js";

/** Two pages signed in as one fresh user, each in its own browser context. */
async function twoSessionsOfFreshUser(browser: Browser): Promise<[Page, Page]> {
  const email = `list-rules-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const password = "ListRulesTest1!";
  const headers = { Origin: WEB_BASE_URL };
  const first = await browser.newContext();
  const signUp = await first.request.post(`${API_BASE_URL}/api/auth/sign-up/email`, {
    headers,
    data: { email, password, name: "List Rules E2E" },
  });
  expect(signUp.ok()).toBeTruthy();
  const state: E2eState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  const sql = connectToDb(state.tempDbUrl);
  try {
    await sql`UPDATE users SET email_verified = true WHERE email = ${email}`;
  } finally {
    await sql.end();
  }
  const signIn = await first.request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    headers,
    data: { email, password },
  });
  expect(signIn.ok()).toBeTruthy();
  const second = await browser.newContext({ storageState: await first.storageState() });
  return [await first.newPage(), await second.newPage()];
}

async function createWishlist(page: Page, name: string): Promise<string> {
  const response = await page.request.post(`${API_BASE_URL}/api/v1/lists`, {
    headers: { Origin: WEB_BASE_URL },
    data: { name, intent: "wish", kind: "card" },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

async function openRuleEditor(page: Page, listId: string) {
  await page.goto(`/collections/lists/${listId}`);
  await page.getByRole("button", { name: "Set up dynamic rules" }).click({ timeout: 15_000 });
  const dialog = page.getByRole("dialog", { name: "Dynamic rules" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("list rule editor", () => {
  test("keeps the draft and warns when another session saved the first rules", async ({
    browser,
  }) => {
    const [pageA, pageB] = await twoSessionsOfFreshUser(browser);
    const listId = await createWishlist(pageA, "Summoner Skirmish wants");

    const dialogA = await openRuleEditor(pageA, listId);
    await dialogA.getByRole("button", { name: "Add rule" }).click();
    await dialogA.getByRole("button", { name: "Add rule" }).click();
    await expect(dialogA.getByText("Rule 2", { exact: true })).toBeVisible();

    const dialogB = await openRuleEditor(pageB, listId);
    await dialogB.getByRole("button", { name: "Add rule" }).click();
    await dialogB.getByRole("button", { name: "Save" }).click();
    await expect(dialogB).toBeHidden();

    await dialogA.getByRole("button", { name: "Save" }).click();
    await expect(dialogA.getByText("The saved rules changed")).toBeVisible();
    await expect(dialogA.getByText("Rule 2", { exact: true })).toBeVisible();

    await dialogA.getByRole("button", { name: "Discard my changes" }).click();
    await expect(dialogA.getByText("Rule 1", { exact: true })).toBeVisible();
    await expect(dialogA.getByText("Rule 2", { exact: true })).toBeHidden();
    await expect(dialogA.getByText("The saved rules changed")).toBeHidden();

    await pageA.context().close();
    await pageB.context().close();
  });
});

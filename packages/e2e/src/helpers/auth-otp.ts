import { readFileSync } from "node:fs";

import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { E2eState } from "./constants.js";
import { API_BASE_URL, STATE_FILE, WEB_BASE_URL } from "./constants.js";
import { connectToDb } from "./db.js";
import { waitForHydrated } from "./hydration.js";

type Sql = ReturnType<typeof connectToDb>;

export function loadDb(): Sql {
  const state: E2eState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  return connectToDb(state.tempDbUrl);
}

export async function waitForHydration(page: Page) {
  // button/input fall back for the reset-password page, which has no <form>.
  await waitForHydrated(page.locator("form, button, input").first());
}

export async function signUp(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${API_BASE_URL}/api/auth/sign-up/email`, {
    headers: { Origin: WEB_BASE_URL },
    data: { email, password, name: "Login E2E" },
  });
  expect(response.ok()).toBeTruthy();
}

export async function createVerifiedUser(
  request: APIRequestContext,
  sql: Sql,
  email: string,
  password: string,
) {
  await signUp(request, email, password);
  await sql`UPDATE users SET email_verified = true WHERE email = ${email}`;
}

export function passwordTab(page: Page) {
  return page.getByRole("tabpanel", { name: "Password", exact: true });
}

export function emailCodeTab(page: Page) {
  return page.getByRole("tabpanel", { name: "Email code", exact: true });
}

export async function loginViaForm(page: Page, email: string, password: string) {
  await page.goto("/login");
  await waitForHydrated(page.locator("form").first());
  const panel = passwordTab(page);
  await panel.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await panel.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await panel.getByRole("button", { name: /^sign in$/iu }).click();
  await expect(page).not.toHaveURL(/\/login/u, { timeout: 15_000 });
}

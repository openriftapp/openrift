import { readFileSync } from "node:fs";

import type { APIRequestContext, Page } from "@playwright/test";

import { test, expect } from "../../fixtures/test.js";
import { loginViaForm } from "../../helpers/auth-otp.js";
import type { E2eState } from "../../helpers/constants.js";
import { API_BASE_URL, STATE_FILE, WEB_BASE_URL } from "../../helpers/constants.js";
import { connectToDb } from "../../helpers/db.js";

type Sql = ReturnType<typeof connectToDb>;

function loadDb(): Sql {
  const state: E2eState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  return connectToDb(state.tempDbUrl);
}

async function createVerifiedUser(
  request: APIRequestContext,
  sql: Sql,
  email: string,
  password: string,
) {
  const response = await request.post(`${API_BASE_URL}/api/auth/sign-up/email`, {
    headers: { Origin: WEB_BASE_URL },
    data: { email, password, name: "Signout E2E" },
  });
  expect(response.ok()).toBeTruthy();
  await sql`UPDATE users SET email_verified = true WHERE email = ${email}`;
}

async function promoteToAdmin(sql: Sql, email: string) {
  await sql`
    INSERT INTO admins (user_id)
    SELECT id FROM users WHERE email = ${email}
    ON CONFLICT DO NOTHING
  `;
}

async function openUserMenu(page: Page) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await expect(menu).toBeEnabled({ timeout: 20_000 });
  await menu.click();
}

test.describe("sign out", () => {
  test("user menu shows Sign out and Profile when logged in", async ({ page, request }) => {
    const sql = loadDb();
    const email = `signout-menu-${Date.now()}@test.com`;
    const password = "SignoutTestPassword1!";
    try {
      await createVerifiedUser(request, sql, email, password);
    } finally {
      await sql.end();
    }

    await loginViaForm(page, email, password);
    await openUserMenu(page);

    await expect(page.getByRole("menuitem", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^theme/iu })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });

  test("user menu hides Sign out when anonymous", async ({ page }) => {
    await page.goto("/cards");
    await openUserMenu(page);

    await expect(page.getByRole("menuitem", { name: /^theme/iu })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Profile" })).toHaveCount(0);
  });

  test("signing out returns to /cards with a logged-out header", async ({ page, request }) => {
    const sql = loadDb();
    const email = `signout-happy-${Date.now()}@test.com`;
    const password = "SignoutTestPassword1!";
    try {
      await createVerifiedUser(request, sql, email, password);
    } finally {
      await sql.end();
    }

    await loginViaForm(page, email, password);
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/cards(?:\?|$)/u, { timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await openUserMenu(page);
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Profile" })).toHaveCount(0);
  });

  test("session is cleared after sign-out and survives a reload", async ({ page, request }) => {
    const sql = loadDb();
    const email = `signout-session-${Date.now()}@test.com`;
    const password = "SignoutTestPassword1!";
    try {
      await createVerifiedUser(request, sql, email, password);
    } finally {
      await sql.end();
    }

    await loginViaForm(page, email, password);
    await openUserMenu(page);

    // router.navigate fires immediately after signOut() resolves, so the URL
    // can flip before the Set-Cookie clearing the session actually commits.
    const signOutResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/sign-out") && response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await signOutResponse;
    await expect(page).toHaveURL(/\/cards(?:\?|$)/u, { timeout: 15_000 });

    const sessionResponse = await page.request.get(`${API_BASE_URL}/api/auth/get-session`, {
      headers: { Origin: WEB_BASE_URL },
    });
    expect(sessionResponse.ok()).toBeTruthy();
    const rawSessionBody = await sessionResponse.text();
    const sessionBody = rawSessionBody.trim();
    expect(sessionBody === "" || sessionBody === "null").toBe(true);

    await page.reload();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("post-logout /profile redirects to /login", async ({ page, request }) => {
    const sql = loadDb();
    const email = `signout-guard-profile-${Date.now()}@test.com`;
    const password = "SignoutTestPassword1!";
    try {
      await createVerifiedUser(request, sql, email, password);
    } finally {
      await sql.end();
    }

    await loginViaForm(page, email, password);
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/cards(?:\?|$)/u, { timeout: 15_000 });
    // The redirect can land before the cookie clear propagates; wait for the
    // logged-out header so the /profile visit below sees an anonymous session.
    await expect(page.getByRole("link", { name: /sign in/iu }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/u, { timeout: 15_000 });
  });

  test("post-logout /admin does not grant access", async ({ page, request }) => {
    const sql = loadDb();
    const email = `signout-guard-admin-${Date.now()}@test.com`;
    const password = "SignoutTestPassword1!";
    try {
      await createVerifiedUser(request, sql, email, password);
    } finally {
      await sql.end();
    }

    await loginViaForm(page, email, password);
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/cards(?:\?|$)/u, { timeout: 15_000 });

    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin(?:\/|$)/u, { timeout: 15_000 });
  });

  test("admin menu shows Admin while logged in and hides it after sign-out", async ({
    page,
    request,
  }) => {
    const sql = loadDb();
    const email = `signout-admin-${Date.now()}@test.com`;
    const password = "SignoutTestPassword1!";
    try {
      await createVerifiedUser(request, sql, email, password);
      await promoteToAdmin(sql, email);
    } finally {
      await sql.end();
    }

    await loginViaForm(page, email, password);
    await openUserMenu(page);
    await expect(page.locator('a[href="/admin"]')).toBeVisible();

    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/cards(?:\?|$)/u, { timeout: 15_000 });

    await openUserMenu(page);
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
  });

  test("signing out from /collections still lands on /cards logged out", async ({
    page,
    request,
  }) => {
    const sql = loadDb();
    const email = `signout-deeplink-${Date.now()}@test.com`;
    const password = "SignoutTestPassword1!";
    try {
      await createVerifiedUser(request, sql, email, password);
    } finally {
      await sql.end();
    }

    await loginViaForm(page, email, password);
    await page.goto("/collections");
    await expect(page).toHaveURL(/\/collections/u, { timeout: 15_000 });

    // Collections' nested sidebar has its own "Menu" trigger; scope to the header banner's.
    const menu = page.getByRole("banner").getByRole("button", { name: "Menu", exact: true });
    await expect(menu).toBeEnabled({ timeout: 20_000 });
    await menu.click();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/cards(?:\?|$)/u, { timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });
});

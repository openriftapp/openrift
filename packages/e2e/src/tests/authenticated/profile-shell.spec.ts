import { readFileSync } from "node:fs";

import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "../../fixtures/test.js";
import { loginViaForm } from "../../helpers/auth-otp.js";
import type { E2eState } from "../../helpers/constants.js";
import { API_BASE_URL, STATE_FILE, TEST_USERS, WEB_BASE_URL } from "../../helpers/constants.js";
import { connectToDb, deleteUser } from "../../helpers/db.js";
import { waitForProfileReady } from "../../helpers/hydration.js";

function loadDb() {
  const state: E2eState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  return connectToDb(state.tempDbUrl);
}

async function createVerifiedUser(
  request: APIRequestContext,
  sql: ReturnType<typeof connectToDb>,
  email: string,
  password: string,
  name: string,
) {
  const response = await request.post(`${API_BASE_URL}/api/auth/sign-up/email`, {
    headers: { Origin: WEB_BASE_URL },
    data: { email, password, name },
  });
  expect(response.ok()).toBeTruthy();
  await sql`UPDATE users SET email_verified = true WHERE email = ${email}`;
}

/** Each click below scrolls from a different position, so a scrollend always follows. */
async function clickAndWaitForScrollEnd(page: Page, link: Locator) {
  await page.evaluate(() => {
    (globalThis as { tocScrollEnded?: Promise<void> }).tocScrollEnded = new Promise<void>(
      (resolve) => {
        document.addEventListener("scrollend", () => resolve(), { once: true });
      },
    );
  });
  await link.click();
  await page.evaluate(() => (globalThis as { tocScrollEnded?: Promise<void> }).tocScrollEnded);
}

test.describe("profile shell", () => {
  test.describe("auth gate", () => {
    test("redirects anonymous users from /profile to /login", async ({ page }) => {
      await page.goto("/profile");
      await expect(page).toHaveURL(/\/login\b/u);
      const url = new URL(page.url());
      expect(url.searchParams.get("redirect") ?? "").toContain("/profile");
    });
  });

  test.describe("header card", () => {
    test("shows name, email, avatar, and joined date", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.goto("/profile");

      const { name, email } = TEST_USERS.regular;

      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(email, { exact: true }).first()).toBeVisible();

      // Every date goes through formatDay, so there's no locale variant to allow for.
      await expect(page.getByText(/^Joined \d{4}-\d{2}-\d{2}$/u)).toBeVisible();

      // Gravatar's `d=404` makes test emails miss and show the initials
      // fallback; the header's own comes first in DOM, so target via .last().
      const initials = name
        .split(/[\s@]/u)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
      await expect(page.locator('[data-slot="avatar-fallback"]').last()).toHaveText(initials);
    });

    test("falls back to email when name is empty", async ({ page, request }) => {
      const sql = loadDb();
      const email = `profile-no-name-${Date.now()}@test.com`;
      const password = "ProfileTestPassword1!";
      try {
        await createVerifiedUser(request, sql, email, password, "Placeholder Name");
        // better-auth requires a non-empty name at sign-up; clear it after to
        // exercise the user.name || user.email fallback.
        await sql`UPDATE users SET name = '' WHERE email = ${email}`;
      } finally {
        await sql.end();
      }

      await loginViaForm(page, email, password);
      await page.goto("/profile");

      await expect(page.getByRole("heading", { level: 2, name: email, exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(email, { exact: true }).first()).toBeVisible();
    });
  });

  test.describe("sidebar navigation", () => {
    const sectionLabels = ["Preferences", "Account", "Security", "Danger Zone"] as const;

    test("shows the section nav links on desktop", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.goto("/profile");

      const nav = page.getByRole("navigation").filter({ hasText: "Preferences" });
      await expect(nav).toBeVisible({ timeout: 15_000 });

      // TOC entries are in-page anchor links (href="#id"), not buttons.
      for (const label of sectionLabels) {
        await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      }
    });

    test("hides the nav on mobile viewports", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/profile");

      await expect(
        page.getByRole("heading", { level: 2, name: TEST_USERS.regular.name, exact: true }),
      ).toBeVisible({
        timeout: 15_000,
      });

      const nav = page.getByRole("navigation").filter({ hasText: "Preferences" });
      await expect(nav).toBeHidden();
    });

    test("clicking a nav link scrolls the section into view", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.goto("/profile");

      const nav = page.getByRole("navigation").filter({ hasText: "Preferences" });
      await expect(nav).toBeVisible({ timeout: 15_000 });

      await nav.getByRole("link", { name: "Security", exact: true }).click();

      const securityHeading = page.getByRole("heading", { name: "Security", level: 2 });
      await expect(securityHeading).toBeInViewport();
    });

    // A fresh user: the password form that marks the page live loads that user's sign-in accounts.
    test("active indicator reflects the current section", async ({ page }) => {
      const sql = loadDb();
      const email = `profile-toc-${Date.now()}@test.com`;
      const password = "ProfileTestPassword1!";
      try {
        await createVerifiedUser(page.request, sql, email, password, "Toc Summoner");
      } finally {
        await sql.end();
      }
      try {
        const signIn = await page.request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
          headers: { Origin: WEB_BASE_URL },
          data: { email, password },
        });
        expect(signIn.ok()).toBeTruthy();
        await page.goto("/profile");

        const nav = page.getByRole("navigation").filter({ hasText: "Preferences" });
        await expect(nav).toBeVisible({ timeout: 15_000 });

        const sharingLink = nav.getByRole("link", { name: "Public profile", exact: true });
        await waitForProfileReady(page);
        await expect(sharingLink).toHaveAttribute("aria-current", "location");

        const preferencesLink = nav.getByRole("link", { name: "Preferences", exact: true });
        await clickAndWaitForScrollEnd(page, preferencesLink);
        await expect(page.getByRole("heading", { name: "Preferences", level: 2 })).toBeInViewport();
        await expect(preferencesLink).toHaveAttribute("aria-current", "location");

        const securityLink = nav.getByRole("link", { name: "Security", exact: true });
        await clickAndWaitForScrollEnd(page, securityLink);
        await expect(page.getByRole("heading", { name: "Security", level: 2 })).toBeInViewport();
        await expect(securityLink).toHaveAttribute("aria-current", "location");
        await expect(preferencesLink).not.toHaveAttribute("aria-current", "location");
      } finally {
        await deleteUser(email);
      }
    });
  });

  test.describe("section landmarks", () => {
    test("renders the top-level section headings", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.goto("/profile");

      // Each SettingsGroup renders an uppercase h2 (the DOM text stays Title Case).
      for (const label of ["Preferences", "Account", "Security", "Danger Zone"]) {
        await expect(page.getByRole("heading", { name: label, level: 2 })).toBeVisible({
          timeout: 15_000,
        });
      }
    });

    test("renders a scroll anchor <section> for each top-level group", async ({
      authenticatedPage,
    }) => {
      const page = authenticatedPage;
      await page.goto("/profile");

      for (const [id, name] of [
        ["preferences", "Preferences"],
        ["sharing", "Public profile"],
        ["integrations", "Integrations"],
        ["account", "Account"],
        ["security", "Security"],
        ["danger-zone", "Danger Zone"],
      ] as const) {
        await expect(page.getByRole("region", { name, exact: true })).toHaveAttribute("id", id, {
          timeout: 15_000,
        });
      }
    });
  });

  test.describe("SEO", () => {
    test("sets Profile title and noindex robots meta", async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.goto("/profile");

      await expect(page).toHaveTitle(/Profile/u, { timeout: 15_000 });
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
    });
  });
});

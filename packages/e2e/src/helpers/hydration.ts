import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * The dev server serves each fresh browser context ~950 unbundled modules, so a
 * page can take several seconds to hydrate; events fired before then are dropped.
 */
export async function waitForHydrated(locator: Locator) {
  await locator.waitFor({ state: "attached", timeout: 20_000 });
  await expect(locator.page().locator("html")).toHaveAttribute("data-hydrated", "", {
    timeout: 20_000,
  });
}

/**
 * Route content hydrates after the shell marker. An account form's submit stays disabled
 * until its own subtree hydrates, so an enabled submit means the form is live.
 */
export async function waitForFormReady(submit: Locator) {
  await waitForHydrated(submit);
  await expect(submit).toBeEnabled({ timeout: 20_000 });
}

/** Every profile section hydrates with the password form, the one section whose submit starts enabled. */
export async function waitForProfileReady(page: Page) {
  await waitForFormReady(page.getByRole("button", { name: "Update password", exact: true }));
}

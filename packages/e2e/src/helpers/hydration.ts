import type { Locator } from "@playwright/test";
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

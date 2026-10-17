import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

// The dev server serves each fresh browser context ~950 unbundled modules, so a
// page can take several seconds to hydrate; events fired before then are dropped.
export async function waitForHydrated(locator: Locator) {
  await expect
    .poll(
      () =>
        locator.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps")),
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
}

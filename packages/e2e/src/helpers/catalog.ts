import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { scrollUntilVisible } from "./virtualized.js";

// Card tiles render as an image only, art or drawn placeholder, whose accessible
// name starts with the card name; the grid is window-virtualized.

export function cardImage(page: Page, name: string): Locator {
  return page.getByRole("img", { name });
}

/**
 * A failed art image is replaced by the placeholder, so measure and click the
 * tile frame, which outlives the swap.
 */
export function cardTile(page: Page, name: string): Locator {
  return page
    .locator("[data-printing-id]")
    .filter({ has: cardImage(page, name) })
    .first();
}

/** Card browsers add their ?languages= default right after they render; `pathPattern` is regex source. */
export function urlWithLanguagesDefault(pathPattern: string): RegExp {
  return new RegExp(`${pathPattern}(?:\\?languages=[^&]*)?$`, "u");
}

/**
 * Only the live grid renders [data-index] rows, not the SSR preview; slider
 * thumbs also carry data-index, always beside a data-slot.
 */
export async function waitForCatalogLoaded(page: Page, cardName = "Annie, Fiery") {
  await page
    .locator("[data-index]:not([data-slot])")
    .first()
    .waitFor({ state: "attached", timeout: 30_000 });
  await scrollUntilVisible(page, cardImage(page, cardName));
}

/** Call after waitForCatalogLoaded: the live browser replaces the SSR preview and its input. */
export async function typeSearch(page: Page, query: string): Promise<Locator> {
  const search = page.getByPlaceholder(/search/iu);
  await search.fill(query);
  await expect(page).toHaveURL(/[?&]q=/u);
  return search;
}

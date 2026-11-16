import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { cardImage, typeSearch, waitForCatalogLoaded } from "../../helpers/catalog.js";
import { waitForHydrated } from "../../helpers/hydration.js";
import { scrollUntilVisible } from "../../helpers/virtualized.js";

// The popover trigger renders as "<Group> · <Sort>" (default groupBy="set"
// keeps the middot present).
async function openSortGroupPopover(page: Page) {
  const trigger = page.getByRole("button", { name: /·/u });
  await waitForHydrated(trigger);
  await trigger.click();
  await expect(page.getByText("Group by", { exact: true })).toBeVisible();
}

async function closeSortGroupPopover(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByText("Group by", { exact: true })).toBeHidden();
}

async function selectSortGroupOption(page: Page, name: string) {
  await openSortGroupPopover(page);
  await page.getByRole("radio", { name, exact: true }).click();
  // Regrouping can re-render the popover closed, so read the choice off the trigger.
  await expect(page.getByRole("button", { name: /·/u })).toHaveAccessibleName(
    new RegExp(`(?:^${name} ·|· ${name}$)`, "u"),
  );
}

test.describe("card browser — search bar", () => {
  test("typing filters the grid and updates the count label", async ({ page }) => {
    await page.goto("/cards");
    await waitForCatalogLoaded(page);

    const countLabel = page.getByText(/\b\d+ (?:cards|printings)\b/u).first();
    await expect(countLabel).toBeVisible();
    const initialText = await countLabel.textContent();
    const initialTotal = Number(initialText?.match(/\d+/u)?.[0] ?? 0);
    expect(initialTotal).toBeGreaterThan(1);

    await typeSearch(page, "Garen");

    const filteredLabel = page.getByText(/\d+ \/ \d+ (?:cards|printings)/u);
    await expect(filteredLabel).toBeVisible({ timeout: 5000 });
    await scrollUntilVisible(page, cardImage(page, "Garen, Rugged"));
    await expect(cardImage(page, "Annie, Fiery").first()).not.toBeVisible();
  });

  test("clearing the search restores all cards", async ({ page }) => {
    await page.goto("/cards");
    await waitForCatalogLoaded(page);

    const search = await typeSearch(page, "Garen");
    await expect(cardImage(page, "Annie, Fiery").first()).not.toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).click();

    await expect(search).toHaveValue("");
    await scrollUntilVisible(page, cardImage(page, "Annie, Fiery"));
    await scrollUntilVisible(page, cardImage(page, "Garen, Rugged"));
  });

  test("debounced typing lands on the final result without flashing intermediate state", async ({
    page,
  }) => {
    await page.goto("/cards");
    await waitForCatalogLoaded(page);

    await typeSearch(page, "Garen, Rugged");

    await scrollUntilVisible(page, cardImage(page, "Garen, Rugged"));
    await expect(cardImage(page, "Annie, Fiery").first()).not.toBeVisible();
    await expect(cardImage(page, "Lux, Illuminated").first()).not.toBeVisible();
  });
});

test.describe("card browser — options bar", () => {
  test("switching view between printings and cards changes the count label", async ({ page }) => {
    await page.goto("/cards");
    await waitForCatalogLoaded(page);

    await expect(page.getByText(/\b\d+ cards\b/u).first()).toBeVisible();

    // aria-label="View mode" groups the icon-only [One per card, Every printing] toggles.
    const everyPrinting = page.getByRole("group", { name: "View mode" }).getByRole("button").nth(1);
    await waitForHydrated(everyPrinting);
    await everyPrinting.click();
    await expect(page.getByText(/\b\d+ printings\b/u).first()).toBeVisible();
  });

  test("changing sort order updates which card appears first", async ({ page }) => {
    await page.goto("/cards");
    await waitForCatalogLoaded(page);

    // Default group-by-set reorders within groups; compare the whole visible sequence.
    const cardOrder = () =>
      page
        .locator("main [data-index] [data-printing-id]")
        .evaluateAll((tiles) =>
          tiles.map((tile) => (tile as HTMLElement).dataset.printingId ?? null),
        );
    const before = await cardOrder();
    expect(before.length).toBeGreaterThan(1);
    expect(before).not.toContain(null);

    await selectSortGroupOption(page, "Energy");
    await closeSortGroupPopover(page);

    await expect.poll(cardOrder).not.toEqual(before);
  });

  test("grouping by type shows section headers for each card type", async ({ page }) => {
    await page.goto("/cards");
    await waitForCatalogLoaded(page);

    await selectSortGroupOption(page, "Type");
    await closeSortGroupPopover(page);

    // Headers are buttons (GroupHeaderLabel); the grid is window-virtualized,
    // so headers below the fold aren't in the DOM until scrolled into view.
    for (const name of ["Legend", "Unit", "Spell"]) {
      await scrollUntilVisible(page, page.getByRole("button", { name, exact: true }));
    }
  });

  test("flipping group direction reverses the header order", async ({ page }) => {
    await page.goto("/cards");
    await waitForCatalogLoaded(page);

    await selectSortGroupOption(page, "Type");
    await closeSortGroupPopover(page);

    // The grid is window-virtualized; only the first rendered header is guaranteed present.
    const firstHeader = page.getByRole("button", { name: /^(?:Legend|Unit|Spell)$/u }).first();

    await expect(firstHeader).toHaveText("Legend");

    await openSortGroupPopover(page);
    const flipButton = page
      .getByText("Group by", { exact: true })
      .locator("..")
      .getByRole("button");
    await flipButton.click();
    await closeSortGroupPopover(page);

    await expect(firstHeader).toHaveText("Spell");
  });
});

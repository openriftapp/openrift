import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { cardImage, waitForCatalogLoaded } from "../../helpers/catalog.js";
import { waitForHydrated } from "../../helpers/hydration.js";
import { scrollUntilVisible } from "../../helpers/virtualized.js";

// Seed data: set OGS "Proving Grounds"; Annie, Fiery is a Fury Unit, Firestorm
// a Fury Spell, Lux, Illuminated a Mind Unit.
// Filters are exercised through the mobile "Options" drawer: the desktop
// container-query pane and collapsible toggle aren't reliably drivable in the
// dev-server harness, but the drawer renders the same FilterPanelContent.

const CARDS_URL = "/cards";
const FOOTER_BUTTON = /^(?:Done|Show \d+ (?:cards?|printings?))$/u;

/** A second click on Options while the drawer animates in closes it again, so click once after hydration. */
async function openFilterDrawer(page: Page): Promise<Locator> {
  const options = page.getByRole("button", { name: "Options" });
  await waitForHydrated(options);
  await options.click();
  const drawer = page.getByRole("dialog", { name: "Options" });
  await expect(drawer).toBeVisible();
  return drawer;
}

/**
 * Locates a filter badge by its leading label; badges render the label
 * followed by a faceted count (e.g. "Fury6"), so match a `^Label` prefix.
 */
function drawerBadge(drawer: Locator, labelPrefix: RegExp): Locator {
  return drawer.locator('[data-slot="badge"]', { hasText: labelPrefix }).first();
}

/** The remove button of one chip in the active-filter strip, named "Remove <filter> <value>". */
function activeFilterChipRemove(page: Page, value: string): Locator {
  return page.getByRole("button", { name: new RegExp(`^Remove .+ ${value}$`, "u") });
}

async function toggleDrawerFilter(
  page: Page,
  drawer: Locator,
  labelPrefix: RegExp,
  urlSignal: RegExp,
) {
  await drawerBadge(drawer, labelPrefix).click();
  await expect(page).toHaveURL(urlSignal);
}

async function closeFilterDrawer(page: Page) {
  await page.getByRole("button", { name: FOOTER_BUTTON }).first().click();
  await expect(page.getByRole("dialog", { name: "Options" })).toBeHidden();
}

test.describe("card filters (mobile drawer)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the drawer opens and renders the set, domain, rarity, and type sections", async ({
    page,
  }) => {
    await page.goto(CARDS_URL);
    await waitForCatalogLoaded(page);

    const drawer = await openFilterDrawer(page);

    for (const label of ["Set", "Domain", "Rarity", "Type"]) {
      await expect(drawer.getByRole("heading", { name: label, exact: true })).toBeVisible();
    }

    await expect(drawerBadge(drawer, /^Proving Grounds/u)).toHaveCount(0);
    await drawer.getByRole("button", { name: /^\+\d+ more$/u }).click();
    await expect(drawerBadge(drawer, /^Proving Grounds/u)).toBeVisible();
    await expect(drawerBadge(drawer, /^Fury/u)).toBeVisible();
    await expect(drawerBadge(drawer, /^Unit/u)).toBeVisible();
    await expect(drawerBadge(drawer, /^Epic/u)).toBeVisible();

    // Label only settles once the live result count does.
    await expect(page.getByRole("button", { name: FOOTER_BUTTON })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("clicking a domain badge narrows the grid, adds a chip, and updates the URL", async ({
    page,
  }) => {
    await page.goto(CARDS_URL);
    await waitForCatalogLoaded(page);

    const drawer = await openFilterDrawer(page);
    await toggleDrawerFilter(page, drawer, /^Fury/u, /domains=[^&]*fury/u);
    await expect(page.getByRole("button", { name: FOOTER_BUTTON })).toBeVisible();

    await closeFilterDrawer(page);

    await expect(cardImage(page, "Lux, Illuminated")).toHaveCount(0);
    await scrollUntilVisible(page, cardImage(page, "Annie, Fiery"));

    await expect(activeFilterChipRemove(page, "Fury")).toBeVisible();
  });

  test("combining a domain and a type filter is AND", async ({ page }) => {
    await page.goto(CARDS_URL);
    await waitForCatalogLoaded(page);

    const drawer = await openFilterDrawer(page);
    await toggleDrawerFilter(page, drawer, /^Fury/u, /domains=[^&]*fury/u);
    await toggleDrawerFilter(page, drawer, /^Spell/u, /[?&]types=[^&]*spell/iu);

    await closeFilterDrawer(page);

    await expect(cardImage(page, "Annie, Fiery")).toHaveCount(0);
    await scrollUntilVisible(page, cardImage(page, "Firestorm"));
  });

  test("removing a chip restores the hidden cards and drops the query param", async ({ page }) => {
    await page.goto(CARDS_URL);
    await waitForCatalogLoaded(page);

    const drawer = await openFilterDrawer(page);
    await toggleDrawerFilter(page, drawer, /^Fury/u, /domains=[^&]*fury/u);
    await closeFilterDrawer(page);
    await expect(cardImage(page, "Lux, Illuminated")).toHaveCount(0);

    await activeFilterChipRemove(page, "Fury").click();

    await expect(page).not.toHaveURL(/[?&]domains=/u);
    await scrollUntilVisible(page, cardImage(page, "Lux, Illuminated"));
  });

  test("clear-all resets the grid and clears every active chip", async ({ page }) => {
    await page.goto(CARDS_URL);
    await waitForCatalogLoaded(page);

    const drawer = await openFilterDrawer(page);
    await toggleDrawerFilter(page, drawer, /^Fury/u, /domains=[^&]*fury/u);
    await toggleDrawerFilter(page, drawer, /^Spell/u, /[?&]types=[^&]*spell/iu);
    await closeFilterDrawer(page);
    await expect(cardImage(page, "Lux, Illuminated")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear all filters" }).click();

    await expect(page).not.toHaveURL(/[?&]domains=/u);
    await expect(page).not.toHaveURL(/[?&]types=/u);

    await scrollUntilVisible(page, cardImage(page, "Annie, Fiery"));
    await scrollUntilVisible(page, cardImage(page, "Lux, Illuminated"));
  });

  test("the energy range slider adds energyMin/energyMax query params", async ({ page }) => {
    await page.goto(CARDS_URL);
    await waitForCatalogLoaded(page);

    const drawer = await openFilterDrawer(page);

    // The Slider forwards its aria-label to both thumbs, so there are two
    // sliders named "Energy range" — the min thumb (first) and the max (last).
    const thumbs = drawer.getByRole("slider", { name: "Energy range" });
    await expect(thumbs).toHaveCount(2);

    await expect(page).toHaveURL(/[?&]languages=/u);

    await thumbs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/[?&]energyMin=-?\d+/u);

    await thumbs.last().focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/[?&]energyMax=-?\d+/u);
  });

  test("the Errata flag badge cycles include, exclude, then off", async ({ page }) => {
    await page.goto(CARDS_URL);
    await waitForCatalogLoaded(page);

    const drawer = await openFilterDrawer(page);
    const moreFilters = drawer.getByRole("button", { name: "More filters" });
    await moreFilters.click();
    await expect(moreFilters).toHaveAttribute("aria-expanded", "true");

    await toggleDrawerFilter(page, drawer, /^Errata/u, /[?&]errata=true/u);
    await expect(moreFilters).toHaveAttribute("aria-expanded", "true");
    await toggleDrawerFilter(page, drawer, /^Errata/u, /[?&]errata=false/u);
    await expect(moreFilters).toHaveAttribute("aria-expanded", "true");
    await drawerBadge(drawer, /^Errata/u).click();
    await expect(page).not.toHaveURL(/[?&]errata=/u);
  });
});

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { cardTile } from "../../helpers/catalog.js";
import { API_BASE_URL, WEB_BASE_URL } from "../../helpers/constants.js";
import { waitForHydrated } from "../../helpers/hydration.js";
import { isServerFn } from "../../helpers/server-fn.js";

const PROMOS_TITLE = "Riftbound Promo Cards in English - OpenRift";
const PROMOS_DESCRIPTION =
  "Browse all English promotional card printings for the Riftbound trading card game, grouped by promo type.";

interface PromoFixtureChannel {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  kind: string;
}

interface PromoFixturePrinting {
  id: string;
  cardId: string;
  language: string;
  distributionChannels: { channel: PromoFixtureChannel; distributionNote: string | null }[];
}

interface PromoFixture {
  channels: PromoFixtureChannel[];
  cards: Record<string, unknown>;
  printings: PromoFixturePrinting[];
  sets: { id: string; slug: string }[];
  languages: string[];
  languageCounts: { language: string; printingCount: number; cardCount: number }[];
}

async function fetchPromoList(language = "EN"): Promise<PromoFixture> {
  const res = await fetch(`${API_BASE_URL}/api/v1/promos?language=${language}`);
  if (!res.ok) {
    throw new Error(`/api/v1/promos fetch failed: ${res.status}`);
  }
  return (await res.json()) as PromoFixture;
}

/**
 * SSR resolves the loader server-side and bypasses page.route, so this navigates client-side.
 * The desktop "More" hover menu does not open reliably in Playwright, so it uses the mobile drawer.
 */
async function clientSideNavigateToPromos(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cards");

  const menuButton = page.getByRole("button", { name: "Open menu" });
  await expect(menuButton).toBeVisible({ timeout: 15_000 });

  await expect(menuButton).toBeEnabled({ timeout: 20_000 });
  await menuButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Promos sits under the "Explore" section, which starts collapsed. The row
  // keeps role="button" even though it renders as a link, so match by text.
  const promosItem = dialog.getByText("Promos", { exact: true });
  await dialog.getByText("Explore", { exact: true }).click();
  await expect(promosItem).toBeVisible();
  await promosItem.click();
}

async function openDisplayOptions(page: Page) {
  const trigger = page.getByRole("button", { name: "Display options" });
  await waitForHydrated(trigger);
  await trigger.click();
  await expect(page.getByRole("button", { name: "Grid view" })).toBeVisible();
}

test.describe("promos", () => {
  test.describe("rendering", () => {
    test("redirects to a language and renders the heading and intro paragraph", async ({
      page,
    }) => {
      await page.goto("/promos");

      await expect(page).toHaveURL(/\/promos\/EN$/u, { timeout: 15_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Riftbound Promos" })).toBeVisible();
      await expect(
        page.getByText(/Cards you can.t pull from booster packs, grouped by where/u),
      ).toBeVisible();
    });

    test("sets document title, description meta, and canonical", async ({ page }) => {
      await page.goto("/promos");

      await expect(page).toHaveTitle(PROMOS_TITLE);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        PROMOS_DESCRIPTION,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${WEB_BASE_URL}/promos/EN`,
      );
    });

    test("renders the language counts and channel section dividers", async ({ page }) => {
      const data = await fetchPromoList();
      const enPrintings = data.printings.filter((printing) => printing.language === "EN");
      expect(enPrintings.length, "seed should have EN promo printings").toBeGreaterThan(0);

      await page.goto("/promos");
      await expect(page.getByRole("heading", { level: 1, name: "Riftbound Promos" })).toBeVisible();

      if (data.languageCounts.length > 1) {
        const panel = page.getByRole("navigation", { name: "Promo printings by language" });
        await expect(panel.getByRole("link", { name: /English/u })).toHaveAttribute(
          "aria-current",
          "page",
        );
        await expect(panel).toContainText(/\d+ printings?/u);
      }

      // Each channel is a region named by its divider title, with a "(N)" count beside it.
      const channelLabel = enPrintings[0]?.distributionChannels[0]?.channel.label;
      expect(channelLabel, "seed EN promo printings name a channel").toBeTruthy();
      const firstSection = page.getByRole("region", { name: channelLabel }).first();
      await expect(firstSection).toBeVisible();
      await expect(firstSection).toContainText(/\(\d+\)/u);
    });
  });

  test.describe("empty state", () => {
    test("renders 'No promos yet.' when there are no printings", async ({ page }) => {
      await page.route("**/_serverFn/**", async (route) => {
        if (isServerFn(route.request().url(), "fetchPromoList")) {
          // Plain JSON skips the seroval deserializer; still needs the `{result}`
          // envelope createServerFn's client middleware unwraps.
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              result: {
                channels: [],
                cards: {},
                printings: [],
                sets: [],
                languages: [],
              },
            }),
          });
          return;
        }
        await route.continue();
      });

      await clientSideNavigateToPromos(page);

      // No printings means the loader can't pick a language, so the index stays put.
      await expect(page).toHaveURL(/\/promos$/u, { timeout: 15_000 });
      await expect(page.getByText("No promos yet.")).toBeVisible();
      await expect(page.locator("[data-printing-id]")).toHaveCount(0);
    });
  });

  test.describe("view mode", () => {
    test("defaults to grid view and toggles to table view", async ({ page }) => {
      await page.goto("/promos");
      await expect(page.getByRole("heading", { level: 1, name: "Riftbound Promos" })).toBeVisible();

      await openDisplayOptions(page);
      const gridButton = page.getByRole("button", { name: "Grid view" });
      const tableButton = page.getByRole("button", { name: "Table view" });

      await expect(gridButton).toHaveAttribute("aria-pressed", "true");
      await expect(tableButton).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByRole("row")).toHaveCount(0);
      await expect(cardTile(page, "Master Yi, Wuju Bladesman")).toBeVisible();

      await tableButton.click();
      await expect(tableButton).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("row").first()).toBeVisible();

      await gridButton.click();
      await expect(gridButton).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("row")).toHaveCount(0);
    });
  });

  test.describe("selection", () => {
    test("clicking a grid card opens the card detail", async ({ page }) => {
      await page.goto("/promos");
      await expect(page.getByRole("heading", { level: 1, name: "Riftbound Promos" })).toBeVisible();

      // Anchor on a seeded card's tile, not "the first tile": imageless cards
      // overlay a "suggest image" link.
      const firstCard = cardTile(page, "Master Yi, Wuju Bladesman");
      await expect(firstCard).toBeVisible();
      // A click before hydration follows the tile's link to the card page.
      await waitForHydrated(firstCard);

      // Modal or docked pane depending on preference; both close controls share a name.
      await firstCard.click();
      await expect(page.getByRole("button", { name: /close card details/iu })).toBeVisible();
      await expect(page).toHaveURL(/\/promos\/EN$/u);
    });

    test("clicking a table row opens the card detail", async ({ page }) => {
      await page.goto("/promos");
      await expect(page.getByRole("heading", { level: 1, name: "Riftbound Promos" })).toBeVisible();

      await openDisplayOptions(page);
      const tableButton = page.getByRole("button", { name: "Table view" });
      await tableButton.click();
      await expect(page.getByRole("row").first()).toBeVisible();
      await page.keyboard.press("Escape");

      const firstRow = page.getByRole("row").first();
      await expect(firstRow).toBeVisible();
      await firstRow.click();

      await expect(page.getByRole("button", { name: /close card details/iu })).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  // PromosPending is unreachable here: the index loader awaits the promo fetch
  // before redirecting, so the query is already cached when the target route mounts.

  test.describe("error", () => {
    test("renders the route error fallback when the promo list fetch 500s", async ({ page }) => {
      await page.route("**/_serverFn/**", async (route) => {
        if (isServerFn(route.request().url(), "fetchPromoList")) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "promos unavailable" }),
          });
          return;
        }
        await route.continue();
      });

      await clientSideNavigateToPromos(page);

      await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});

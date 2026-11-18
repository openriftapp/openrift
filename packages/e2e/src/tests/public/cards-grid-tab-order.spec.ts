import { expect, test } from "@playwright/test";

import { waitForCatalogLoaded } from "../../helpers/catalog.js";
import { allGridPrintingIds, tabThroughGrid } from "../../helpers/grid-tab-order.js";

test.describe("card grid keyboard order", () => {
  test("Tab walks every tile of a grid taller than the viewport before leaving it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/cards");
    await waitForCatalogLoaded(page);

    const expected = await allGridPrintingIds(page);
    expect(expected.length).toBeGreaterThan(20);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1440);

    const visited = await tabThroughGrid(page, expected[0] ?? "", expected.length * 3);

    expect(visited).toEqual(expected);
  });
});

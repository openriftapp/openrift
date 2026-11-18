import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const LIVE_GRID_ROW = "[data-index]:not([data-slot])";

async function waitForLiveGrid(page: Page) {
  await page.locator(LIVE_GRID_ROW).first().waitFor({ state: "attached", timeout: 30_000 });
}

function toolbarBoxes(page: Page) {
  return page.evaluate(() => {
    const toolbar = document.querySelector('input[placeholder^="Search"]')?.closest(".sticky");
    const boxes: string[] = [];
    for (const element of toolbar?.querySelectorAll("button, input, [role=combobox]") ?? []) {
      const box = element.getBoundingClientRect();
      // Phones unmount the hidden desktop controls after hydration.
      if (box.width > 0) {
        const label = (element.textContent || element.getAttribute("aria-label") || "").trim();
        boxes.push([label, box.x, box.y, box.width, box.height].map(String).join("|"));
      }
    }
    return boxes;
  });
}

test.describe("cards page first paint", () => {
  test("keeps the search input, its focus and its text while the catalog loads", async ({
    page,
  }) => {
    await page.goto("/cards", { waitUntil: "commit" });
    const search = page.getByPlaceholder(/search/iu);
    // No hydration wait: the visitor clicks into the server-rendered input.
    await search.waitFor({ state: "attached" });
    await search.evaluate((input) => {
      (input as HTMLInputElement & { firstPaint?: boolean }).firstPaint = true;
    });
    await search.click();
    await page.keyboard.type("Garen");

    await waitForLiveGrid(page);

    const focusedIsFirstPaintInput = await page.evaluate(
      () => (document.activeElement as (HTMLElement & { firstPaint?: boolean }) | null)?.firstPaint,
    );
    expect(focusedIsFirstPaintInput).toBe(true);
    await expect(search).toHaveValue("Garen");
    await expect(page).toHaveURL(/[?&]q=Garen/u);
  });

  test("leaves the toolbar controls where the server rendered them", async ({ page }) => {
    await page.goto("/cards", { waitUntil: "commit" });
    await page.getByPlaceholder(/search/iu).waitFor({ state: "attached" });
    const firstPaint = await toolbarBoxes(page);
    expect(firstPaint.length).toBeGreaterThan(1);

    await waitForLiveGrid(page);
    await expect(page).toHaveURL(/[?&]languages=/u);

    expect(await toolbarBoxes(page)).toEqual(firstPaint);
  });

  for (const path of ["/cards", "/promos/EN"]) {
    test(`${path} keeps the price map out of the server HTML`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
      expect(await response.text()).not.toContain('["prices"]');
    });
  }
});

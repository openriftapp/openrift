import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { waitForCatalogLoaded } from "../../helpers/catalog.js";

const ANNIE_PRINTING_ID = "019cfc3b-03d6-74cf-adec-1dce41f631eb";

// Records every window.scrollTo once armed, so a jump that a later scroll undoes still shows up.
async function recordWindowScrolls(page: Page) {
  await page.addInitScript(() => {
    const target = globalThis as unknown as { __scrolls: unknown[]; __armed: boolean };
    target.__scrolls = [];
    target.__armed = false;
    const original = globalThis.scrollTo.bind(globalThis);
    globalThis.scrollTo = ((...args: unknown[]) => {
      if (target.__armed) {
        target.__scrolls.push(args);
      }
      return (original as (...rest: unknown[]) => void)(...args);
    }) as typeof globalThis.scrollTo;
  });
}

async function closeAndReadScroll(page: Page) {
  const before = await page.evaluate(() => {
    (globalThis as unknown as { __armed: boolean }).__armed = true;
    return globalThis.scrollY;
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.waitForTimeout(500);
  return page.evaluate((scrollBefore) => {
    const target = globalThis as unknown as { __scrolls: unknown[] };
    return { before: scrollBefore, after: globalThis.scrollY, scrolls: target.__scrolls };
  }, before);
}

test.describe("card detail modal scroll", () => {
  test.beforeEach(async ({ page }) => {
    await recordWindowScrolls(page);
    await page.setViewportSize({ width: 1280, height: 700 });
  });

  test("closing after stepping with the arrow keys leaves the page where it is", async ({
    page,
  }) => {
    await page.goto("/cards");
    await waitForCatalogLoaded(page);
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(300);
    await page.locator("[data-index] img").nth(6).click();
    const position = page.getByRole("dialog").getByText(/^\d+ \/ \d+$/u);
    await expect(position).toBeVisible();
    const openedAt = await position.textContent();
    for (let step = 0; step < 4; step++) {
      await page.keyboard.press("ArrowDown");
    }
    await expect(position).not.toHaveText(openedAt ?? "");
    await page.waitForTimeout(500);

    const { before, after, scrolls } = await closeAndReadScroll(page);

    expect(scrolls).toEqual([]);
    expect(after).toBe(before);
  });

  test("closing a deep-linked card leaves the page on that card", async ({ page }) => {
    await page.goto(`/cards?printingId=${ANNIE_PRINTING_ID}`);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);

    const { before, after, scrolls } = await closeAndReadScroll(page);

    expect(scrolls).toEqual([]);
    expect(after).toBe(before);
    expect(page.url()).not.toContain("printingId");
  });
});

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { waitForCatalogLoaded } from "../../helpers/catalog.js";

const ANNIE_PRINTING_ID = "019cfc3b-03d6-74cf-adec-1dce41f631eb";

/** Records every window.scrollTo once armed, so a jump that a later scroll undoes still shows up. */
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

/**
 * Escape pops the history entry the open dialog pushes; before that entry
 * lands, Escape closes the dialog without a navigation.
 */
async function waitForDialogHistoryEntry(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => Boolean((history.state as Record<string, unknown> | null)?.cardDetail)),
    )
    .toBe(true);
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
    await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBeGreaterThan(0);
    // Click a tile where it already shows, below the sticky toolbar, so the click scrolls nothing.
    const target = await page.locator("[data-index] [data-printing-id]").evaluateAll((elements) =>
      elements
        .map((element) => element.getBoundingClientRect())
        .map((box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 }))
        .find((point) => point.y > 200 && point.y < globalThis.innerHeight - 20),
    );
    expect(target).toBeDefined();
    const scrolledTo = await page.evaluate(() => globalThis.scrollY);
    expect(scrolledTo).toBeGreaterThan(0);
    await page.mouse.click(target?.x ?? 0, target?.y ?? 0);
    const position = page.getByRole("dialog").getByText(/^\d+ \/ \d+$/u);
    await expect(position).toBeVisible();
    const openedAt = await position.textContent();
    for (let step = 0; step < 4; step++) {
      await page.keyboard.press("ArrowRight");
    }
    await expect(position).not.toHaveText(openedAt ?? "");
    await waitForDialogHistoryEntry(page);

    const { before, after, scrolls } = await closeAndReadScroll(page);

    expect(scrolls).toEqual([]);
    expect(after).toBe(before);
  });

  test("closing a deep-linked card leaves the page on that card", async ({ page }) => {
    await page.goto(`/cards?printingId=${ANNIE_PRINTING_ID}`);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
    await expect(page).not.toHaveURL(/printingId/u);
    await waitForDialogHistoryEntry(page);

    const { before, after, scrolls } = await closeAndReadScroll(page);

    expect(scrolls).toEqual([]);
    expect(after).toBe(before);
    expect(page.url()).not.toContain("printingId");
  });
});

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Live grid rows; slider thumbs also carry data-index, always beside a data-slot. */
const GRID_ROW = "[data-index]:not([data-slot])";

/**
 * Every printing id the window-virtualized grid renders, collected by scrolling the page, again
 * until two passes in a row find the same tiles.
 */
export async function allGridPrintingIds(page: Page): Promise<string[]> {
  let ids: string[] = [];
  await expect
    .poll(
      async () => {
        const previous = ids;
        ids = await collectGridPrintingIds(page);
        return ids.length > 0 && ids.join(",") === previous.join(",");
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return ids;
}

function collectGridPrintingIds(page: Page): Promise<string[]> {
  return page.evaluate(async (rowSelector) => {
    const seen: string[] = [];
    const collect = () => {
      for (const tile of document.querySelectorAll<HTMLElement>(
        `${rowSelector} [data-printing-id]`,
      )) {
        const id = tile.dataset.printingId ?? "";
        if (!seen.includes(id)) {
          seen.push(id);
        }
      }
    };
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const rowsPending = () => document.querySelector(`${rowSelector} [aria-busy="true"]`) !== null;
    globalThis.scrollTo({ top: 0 });
    for (;;) {
      await nextFrame();
      for (let frame = 0; frame < 600 && rowsPending(); frame++) {
        await nextFrame();
      }
      collect();
      const max = document.documentElement.scrollHeight - globalThis.innerHeight;
      if (globalThis.scrollY >= max - 2) {
        break;
      }
      globalThis.scrollBy(0, globalThis.innerHeight / 2);
    }
    globalThis.scrollTo({ top: 0 });
    return seen;
  }, GRID_ROW);
}

/** The printing id of the tile holding the focus, "" for another grid control, null outside the grid. */
async function focusedTile(page: Page): Promise<string | null> {
  return page.evaluate((rowSelector) => {
    const active = document.activeElement;
    if (!active?.closest(rowSelector)) {
      return null;
    }
    return active.closest<HTMLElement>("[data-printing-id]")?.dataset.printingId ?? "";
  }, GRID_ROW);
}

/**
 * Focuses the first tab stop of the tile showing `printingId`, then presses Tab until the focus
 * leaves the grid, and answers the tiles it passed through in order.
 */
export async function tabThroughGrid(
  page: Page,
  printingId: string,
  limit: number,
): Promise<string[]> {
  const tile = page.locator(`${GRID_ROW} [data-printing-id="${printingId}"]`);
  await tile.waitFor({ state: "attached" });
  await page.evaluate((id) => {
    const holder = document.querySelector(`[data-printing-id="${id}"]`);
    const stop = [
      ...(holder?.querySelectorAll<HTMLElement>("a[href], button, [tabindex]") ?? []),
    ].find((element) => element.tabIndex >= 0);
    stop?.focus();
  }, printingId);

  const visited: string[] = [];
  let current = await focusedTile(page);
  while (current !== null && visited.length < limit) {
    if (current !== "" && visited.at(-1) !== current) {
      visited.push(current);
    }
    await page.keyboard.press("Tab");
    current = await focusedTile(page);
  }
  return visited;
}

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// A small intermediate move transitions dnd-kit's PointerSensor from
// "pending" to "active" before the final move; a single long move sometimes
// misses its 8px activation threshold.
// page.mouse needs viewport coordinates; scrollIntoViewIfNeeded detaches the
// tile mid-scroll on this window-virtualized grid, so nudge and re-measure.
export async function scrollIntoViewport(page: Page, locator: Locator, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const box = await locator.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) {
      await page.waitForTimeout(100);
      continue;
    }
    if (box.y >= 0 && box.y + box.height <= viewport.height) {
      return;
    }
    const delta = box.y < 0 ? box.y - 80 : box.y + box.height - viewport.height + 80;
    await page.evaluate((d) => window.scrollBy(0, d), delta);
    await page.waitForTimeout(100);
  }
  throw new Error("scrollIntoViewport: element never settled inside the viewport");
}

export async function dndDrag(page: Page, source: Locator, target: Locator) {
  await expect(source).toBeVisible({ timeout: 15_000 });
  await expect(target).toBeVisible({ timeout: 15_000 });
  await scrollIntoViewport(page, source);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("dnd source/target not visible");
  }
  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 20, startY, { steps: 5 });
  // dnd-kit measures droppable rects when the drag starts; moving on before
  // that lands leaves the collision detection with nothing to hit.
  await page.waitForTimeout(100);
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.mouse.up();
}

export async function dndDragToPoint(page: Page, source: Locator, endX: number, endY: number) {
  await expect(source).toBeVisible({ timeout: 15_000 });
  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error("dnd source not visible");
  }
  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 20, startY, { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.mouse.up();
}

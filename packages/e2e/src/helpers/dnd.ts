import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

interface Point {
  x: number;
  y: number;
}

/**
 * page.mouse needs viewport coordinates; scrollIntoViewIfNeeded detaches the
 * tile mid-scroll on this window-virtualized grid, so re-measure after each scroll.
 */
async function scrollIntoViewport(page: Page, locator: Locator, timeout = 15_000) {
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        const viewport = page.viewportSize();
        if (box && viewport && box.y >= 0 && box.y + box.height <= viewport.height) {
          return true;
        }
        await locator.evaluate((element) => element.scrollIntoView({ block: "center" }));
        return false;
      },
      { timeout, message: "element never settled inside the viewport" },
    )
    .toBe(true);
}

async function centerOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("dnd locator has no layout box");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** dnd-kit announces a pick-up in its live region once a sensor activates. */
async function dragAnnouncement(page: Page): Promise<string> {
  const texts = await page.locator('[id^="DndLiveRegion-"]').allTextContents();
  return texts.join("|");
}

/**
 * A drop that should land: the drop target's ring shows once dnd-kit has measured
 * the droppables and resolved the pointer onto it. Releasing earlier drops nowhere.
 */
export async function expectDropTargetArmed(dropRing: Locator) {
  await expect(dropRing).toHaveClass(/ring-primary/u);
}

/**
 * Presses on the source and moves past dnd-kit's 8px activation distance. With
 * `activates: false` the drag must not start (drag listeners are off on phones).
 */
export async function startDrag(
  page: Page,
  source: Locator,
  options: { activates?: boolean } = {},
): Promise<Point> {
  await expect(source).toBeVisible({ timeout: 15_000 });
  await scrollIntoViewport(page, source);
  const start = await centerOf(source);
  const before = await dragAnnouncement(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y, { steps: 5 });
  if (options.activates === false) {
    expect(await dragAnnouncement(page)).toBe(before);
  } else {
    await expect
      .poll(() => dragAnnouncement(page), { message: "the drag never activated" })
      .not.toBe(before);
  }
  return start;
}

export async function moveDragTo(page: Page, target: Locator | Point, steps = 20) {
  const point = "x" in target ? target : await centerOf(target);
  await page.mouse.move(point.x, point.y, { steps });
}

export async function dndDrag(
  page: Page,
  source: Locator,
  target: Locator,
  options: {
    dropRing?: Locator;
    rejectingZone?: Locator;
    shift?: boolean;
    activates?: boolean;
  } = {},
) {
  await expect(target).toBeVisible({ timeout: 15_000 });
  await startDrag(page, source, { activates: options.activates });
  if (options.shift) {
    await page.keyboard.down("Shift");
  }
  await moveDragTo(page, target);
  if (options.dropRing) {
    await expectDropTargetArmed(options.dropRing);
  }
  if (options.rejectingZone) {
    // A deck zone that refuses the dragged card dims while the drag is live.
    await expect(options.rejectingZone).toHaveClass(/opacity-40/u);
  }
  await page.mouse.up();
  if (options.shift) {
    await page.keyboard.up("Shift");
  }
}

export async function dndDragToPoint(
  page: Page,
  source: Locator,
  end: Point,
  options: { shift?: boolean } = {},
) {
  await startDrag(page, source);
  if (options.shift) {
    await page.keyboard.down("Shift");
  }
  await moveDragTo(page, end);
  await page.mouse.up();
  if (options.shift) {
    await page.keyboard.up("Shift");
  }
}

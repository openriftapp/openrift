import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * A click on a still-animating item retries with a forced scroll, which shifts the
 * scroll-locked page under the pointer and closes hover-opened submenus.
 */
export async function menuSettled(menu: Locator): Promise<void> {
  await expect(menu).toBeVisible();
  await menu.evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
}

/** Opens the submenu behind `trigger` and waits for it to settle. */
export async function openSubmenu(page: Page, trigger: string): Promise<Locator> {
  const item = page.getByRole("menuitem", { name: trigger });
  await menuSettled(page.getByRole("menu").filter({ has: item }));
  await item.click();
  await expect(item).toHaveAttribute("aria-expanded", "true");
  const submenu = page.getByRole("menu").filter({ hasNot: item });
  await menuSettled(submenu);
  return submenu;
}

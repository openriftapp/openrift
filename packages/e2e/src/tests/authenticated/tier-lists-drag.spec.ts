import { expect, test } from "../../fixtures/test.js";
import { cardTile, waitForCatalogLoaded } from "../../helpers/catalog.js";
import { API_BASE_URL, WEB_BASE_URL } from "../../helpers/constants.js";
import { dndLiveRegion, moveDragTo, startDrag } from "../../helpers/dnd.js";

test.describe("tier list builder drag", () => {
  test("announces the dragged card and the tier it lands in", async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const response = await page.request.post(`${API_BASE_URL}/api/v1/tier-lists`, {
      headers: { Origin: WEB_BASE_URL },
      data: { title: `Summoner Skirmish picks ${Date.now()}` },
    });
    expect(response.ok()).toBeTruthy();
    const { id } = (await response.json()) as { id: string };

    try {
      await page.goto(`/tier-lists/${id}`);
      await waitForCatalogLoaded(page);
      const topTier = page.getByRole("textbox", { name: "Tier 1 label" });
      await expect(topTier).toBeVisible();
      const liveRegion = dndLiveRegion(page);

      await startDrag(page, cardTile(page, "Annie, Fiery"));
      await expect(liveRegion).toHaveText("Picked up Annie, Fiery.");
      await moveDragTo(page, topTier);
      await expect(liveRegion).toHaveText("Annie, Fiery is over Row S.");
      await page.mouse.up();
      await expect(liveRegion).toHaveText("Dropped Annie, Fiery on Row S.");
    } finally {
      await page.request.delete(`${API_BASE_URL}/api/v1/tier-lists/${id}`, {
        headers: { Origin: WEB_BASE_URL },
      });
    }
  });
});

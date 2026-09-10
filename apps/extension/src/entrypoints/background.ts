import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { CARDMARKET_MATCH_PATTERN, isCardmarketOffersUrl } from "@/lib/cardmarket-url";
import { annotateTab, captureSnapshot, storedBasket } from "@/lib/inject";
import { isOverlaySyncUrl, openriftMatchPattern } from "@/lib/openrift-url";
import type { PicksBasket } from "@/lib/picks";
import { basketCopies, PICKS_STORAGE_KEY, readBasket } from "@/lib/picks";

const BADGE_COLOUR = "#166534";

async function hasPermission(origin: string): Promise<boolean> {
  return await browser.permissions.contains({ origins: [origin] });
}

/** Everything here needs a granted host permission; the popup covers the rest by hand. */
async function handlePageLoad(tabId: number, url: string): Promise<void> {
  try {
    if (isCardmarketOffersUrl(url) && (await hasPermission(CARDMARKET_MATCH_PATTERN))) {
      await annotateTab(tabId);
      return;
    }
    if (isOverlaySyncUrl(url) && (await hasPermission(openriftMatchPattern()))) {
      await captureSnapshot(tabId);
    }
  } catch {
    // A page that navigated away mid-injection is not worth reporting.
  }
}

// Firefox MV2 has browserAction only; Chrome MV3 has action only.
function toolbarAction() {
  return browser.action ?? browser.browserAction;
}

async function paintBadge(basket: PicksBasket): Promise<void> {
  const copies = basketCopies(basket);
  const action = toolbarAction();
  await action.setBadgeBackgroundColor({ color: BADGE_COLOUR });
  await action.setBadgeText({ text: copies === 0 ? "" : String(copies) });
}

export default defineBackground(() => {
  // Both events matter: a full load reports status, an in-app navigation to
  // the sync page only reports the new URL.
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const navigated = changeInfo.status === "complete" || changeInfo.url !== undefined;
    if (!navigated || tab.url === undefined) {
      return;
    }
    void handlePageLoad(tabId, tab.url);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && PICKS_STORAGE_KEY in changes) {
      void paintBadge(readBasket(changes[PICKS_STORAGE_KEY]?.newValue));
    }
  });
  void (async () => paintBadge(await storedBasket()))();

  // Host permissions can only be requested from an extension page.
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      void browser.runtime.openOptionsPage();
    }
  });
});

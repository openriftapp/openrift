import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { CARDMARKET_MATCH_PATTERN, isCardmarketOffersUrl } from "@/lib/cardmarket-url";
import { annotateTab, captureSnapshot, storedSnapshot } from "@/lib/inject";
import { isOverlaySyncUrl, openriftMatchPattern } from "@/lib/openrift-url";

async function hasPermission(origin: string): Promise<boolean> {
  return await browser.permissions.contains({ origins: [origin] });
}

/** Everything here needs a granted host permission; the popup covers the rest by hand. */
async function handlePageLoad(tabId: number, url: string): Promise<void> {
  try {
    if (isCardmarketOffersUrl(url) && (await hasPermission(CARDMARKET_MATCH_PATTERN))) {
      if ((await storedSnapshot()) !== undefined) {
        await annotateTab(tabId);
      }
      return;
    }
    if (isOverlaySyncUrl(url) && (await hasPermission(openriftMatchPattern()))) {
      await captureSnapshot(tabId);
    }
  } catch {
    // A page that navigated away mid-injection is not worth reporting.
  }
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

  // Host permissions can only be requested from an extension page.
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      void browser.runtime.openOptionsPage();
    }
  });
});

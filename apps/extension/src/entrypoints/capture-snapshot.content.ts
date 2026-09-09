import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import type { OverlaySnapshot } from "@/lib/overlay-snapshot";
import { readSnapshotFromPage, SNAPSHOT_STORAGE_KEY } from "@/lib/overlay-snapshot";

const WAIT_MS = 15_000;

// The sync page renders data-only, so the block lands well after the document
// completes, and only once the visitor has a wishlist picked.
function waitForSnapshot(): Promise<OverlaySnapshot | undefined> {
  // oxlint-disable-next-line promise/avoid-new -- bridges the callback-based MutationObserver API
  return new Promise((resolve) => {
    const read = (): OverlaySnapshot | undefined =>
      readSnapshotFromPage(document, new Date().toISOString());

    const immediate = read();
    if (immediate !== undefined) {
      resolve(immediate);
      return;
    }

    const observer = new MutationObserver(() => {
      const found = read();
      if (found !== undefined) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(found);
      }
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      // oxlint-disable-next-line unicorn/no-useless-undefined -- required: T is `OverlaySnapshot | undefined`, not `void`, so resolve() alone does not typecheck
      resolve(undefined);
    }, WAIT_MS);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

// registration: "runtime" keeps this out of the manifest. It writes the result
// itself: an async main's return value does not survive injection on every build.
export default defineContentScript({
  registration: "runtime",
  async main(): Promise<boolean> {
    const snapshot = await waitForSnapshot();
    if (snapshot === undefined) {
      return false;
    }
    await browser.storage.local.set({ [SNAPSHOT_STORAGE_KEY]: snapshot });
    // The page watches this to tell the user their counts arrived.
    document.documentElement.dataset.openriftOverlayCaptured = snapshot.generatedAt;
    return true;
  },
});

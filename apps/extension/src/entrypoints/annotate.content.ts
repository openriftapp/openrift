import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { annotate } from "@/lib/cardmarket-annotate";
import type { OverlaySnapshot } from "@/lib/overlay-snapshot";
import { SNAPSHOT_STORAGE_KEY } from "@/lib/overlay-snapshot";

const RERUN_DEBOUNCE_MS = 150;

async function storedSnapshot(): Promise<OverlaySnapshot | undefined> {
  const stored = await browser.storage.local.get(SNAPSHOT_STORAGE_KEY);
  return stored[SNAPSHOT_STORAGE_KEY] as OverlaySnapshot | undefined;
}

function watchForRows(snapshot: OverlaySnapshot): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => annotate(document, snapshot, document), RERUN_DEBOUNCE_MS);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// registration: "runtime" keeps this out of the manifest; the background
// script injects it on click or on a page load it has permission for.
export default defineContentScript({
  registration: "runtime",
  async main(): Promise<number> {
    const snapshot = await storedSnapshot();
    if (snapshot === undefined) {
      return -1;
    }

    const annotated = annotate(document, snapshot, document);
    // Cardmarket swaps the table body in place when filters or pages change.
    if (document.documentElement.dataset.openriftOverlay === undefined) {
      document.documentElement.dataset.openriftOverlay = "on";
      watchForRows(snapshot);
    }
    return annotated;
  },
});

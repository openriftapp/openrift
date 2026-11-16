import { toError } from "@openrift/shared/strings";
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import type { OverlaySnapshot } from "@/lib/overlay-snapshot";
import { SNAPSHOT_STORAGE_KEY, watchSnapshots } from "@/lib/overlay-snapshot";

const WAIT_MS = 15_000;

async function store(snapshot: OverlaySnapshot): Promise<void> {
  await browser.storage.local.set({ [SNAPSHOT_STORAGE_KEY]: snapshot });
  // The page watches this to tell the user their counts arrived.
  document.documentElement.dataset.openriftOverlayCaptured = snapshot.generatedAt;
}

// registration: "runtime" keeps this out of the manifest. It writes the result
// itself: an async main's return value does not survive injection on every build.
export default defineContentScript({
  registration: "runtime",
  main(ctx): Promise<boolean> {
    // oxlint-disable-next-line promise/avoid-new -- resolves on the first capture; the watch outlives it
    return new Promise((resolve, reject) => {
      const timer = ctx.setTimeout(() => {
        resolve(false);
      }, WAIT_MS);
      const stop = watchSnapshots(document, (snapshot) => {
        if (ctx.isInvalid) {
          return;
        }
        void (async () => {
          try {
            await store(snapshot);
            clearTimeout(timer);
            resolve(true);
          } catch (error) {
            reject(toError(error));
          }
        })();
      });
      ctx.onInvalidated(() => {
        stop();
        resolve(false);
      });
    });
  },
});

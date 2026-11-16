import { defineContentScript } from "wxt/utils/define-content-script";

import { installOverlay, loadState } from "@/lib/cardmarket-overlay";
import type { AnnotateReport } from "@/lib/popup-actions";

// registration: "runtime" keeps this out of the manifest; the background
// script injects it on click or on a page load it has permission for.
export default defineContentScript({
  registration: "runtime",
  async main(ctx): Promise<AnnotateReport | undefined> {
    const state = await loadState();
    if (ctx.isInvalid) {
      return undefined;
    }
    return installOverlay(ctx, state, document);
  },
});

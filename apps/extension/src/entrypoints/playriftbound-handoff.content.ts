import { playriftboundSyncPayloadSchema } from "@openrift/shared/playriftbound-sync";
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { offerPayload, PLAYRIFTBOUND_SYNC_STORAGE_KEY } from "@/lib/playriftbound-handoff";

// registration: "runtime" keeps this out of the manifest; the background
// injects it when the OpenRift sync page loads.
export default defineContentScript({
  registration: "runtime",
  async main(ctx): Promise<void> {
    const stored = await browser.storage.local.get(PLAYRIFTBOUND_SYNC_STORAGE_KEY);
    const parsed = playriftboundSyncPayloadSchema.safeParse(stored[PLAYRIFTBOUND_SYNC_STORAGE_KEY]);
    if (!parsed.success) {
      return;
    }
    const origin = globalThis.location.origin;
    const stop = offerPayload(
      {
        post: (message) => globalThis.postMessage(message, origin),
        listen: (handler) => {
          const onMessage = (event: MessageEvent) => {
            if (event.source === globalThis.window && event.origin === origin) {
              handler(event.data);
            }
          };
          globalThis.addEventListener("message", onMessage);
          return () => globalThis.removeEventListener("message", onMessage);
        },
      },
      parsed.data,
      () => {
        void browser.storage.local.remove(PLAYRIFTBOUND_SYNC_STORAGE_KEY);
      },
    );
    ctx.onInvalidated(stop);
  },
});

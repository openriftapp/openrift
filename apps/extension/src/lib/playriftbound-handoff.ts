import type { PlayriftboundSyncPayload } from "@openrift/shared/playriftbound-sync";
import { PLAYRIFTBOUND_HANDOFF } from "@openrift/shared/playriftbound-sync";

export const PLAYRIFTBOUND_SYNC_STORAGE_KEY = "playriftboundSync";

export interface HandoffWindow {
  post: (message: unknown) => void;
  listen: (handler: (message: unknown) => void) => () => void;
}

/**
 * Offers the payload to the OpenRift page until it confirms receipt, then
 * calls `done`. Answers every request, since the page may ask more than once.
 */
export function offerPayload(
  target: HandoffWindow,
  payload: PlayriftboundSyncPayload,
  done: () => void,
): () => void {
  const message = { type: PLAYRIFTBOUND_HANDOFF.payload, payload: JSON.stringify(payload) };
  const stop = target.listen((incoming) => {
    const type =
      typeof incoming === "object" && incoming !== null ? Reflect.get(incoming, "type") : undefined;
    if (type === PLAYRIFTBOUND_HANDOFF.request) {
      target.post(message);
    } else if (type === PLAYRIFTBOUND_HANDOFF.received) {
      stop();
      done();
    }
  });
  target.post(message);
  return stop;
}

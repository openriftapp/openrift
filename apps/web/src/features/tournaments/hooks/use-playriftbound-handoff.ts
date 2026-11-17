import type { PlayriftboundSyncPayload } from "@openrift/shared/playriftbound-sync";
import {
  PLAYRIFTBOUND_HANDOFF,
  readPlayriftboundHandoff,
} from "@openrift/shared/playriftbound-sync";
import { useEffect, useState } from "react";

export function usePlayriftboundHandoff(): PlayriftboundSyncPayload | undefined {
  const [payload, setPayload] = useState<PlayriftboundSyncPayload>();

  useEffect(() => {
    const origin = globalThis.location.origin;
    const onMessage = (event: MessageEvent) => {
      // oxlint-disable-next-line unicorn/prefer-global-this -- MessageEvent.source is typed as a Window
      if (event.source !== window || event.origin !== origin) {
        return;
      }
      const received = readPlayriftboundHandoff(event.data);
      if (received === null) {
        return;
      }
      setPayload(received);
      globalThis.postMessage({ type: PLAYRIFTBOUND_HANDOFF.received }, origin);
    };
    globalThis.addEventListener("message", onMessage);
    globalThis.postMessage({ type: PLAYRIFTBOUND_HANDOFF.request }, origin);
    return () => globalThis.removeEventListener("message", onMessage);
  }, []);

  return payload;
}

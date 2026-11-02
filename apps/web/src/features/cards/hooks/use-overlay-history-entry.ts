import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export type OverlayHistoryKey =
  | "cardDetail"
  | "missingCardDetail"
  | "paletteCardDetail"
  | "printingLightbox";

let lastEntryToken = Date.now();

function newEntryToken(): number {
  lastEntryToken += 1;
  return lastEntryToken;
}

let queueTail: Promise<void> | null = null;
let queued = 0;

async function runQueued(previous: Promise<void> | null, push: () => Promise<void>): Promise<void> {
  if (previous) {
    await previous;
  }
  try {
    await push();
  } catch {
    // a failed navigation must not block the overlays queued behind it
  } finally {
    queued -= 1;
    if (queued === 0) {
      queueTail = null;
    }
  }
}

// The router folds a navigation started while another is in flight into one history entry.
function queuePush(push: () => Promise<void>): void {
  queued += 1;
  queueTail = runQueued(queueTail, push);
}

interface OverlayHistoryEntryOptions {
  active: boolean;
  stateKey: OverlayHistoryKey;
  onPop: () => void;
}

/**
 * Pushes a history entry while an overlay is open, so the browser and Android
 * back buttons close it. Must go through the router: a bare `history.pushState`
 * triggers scroll restoration to the top; `resetScroll: false` suppresses it.
 */
export function useOverlayHistoryEntry({
  active,
  stateKey,
  onPop,
}: OverlayHistoryEntryOptions): void {
  const router = useRouter();

  // Must not re-run the effect on a fresh onPop closure: a second push would need a second back press to undo.
  const onPopRef = useRef(onPop);
  useEffect(() => {
    onPopRef.current = onPop;
  }, [onPop]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const token = newEntryToken();
    let cancelled = false;
    queuePush(async () => {
      if (cancelled) {
        return;
      }
      await router.navigate({
        href: router.latestLocation.href,
        state: (prev) => ({ ...prev, [stateKey]: token, overlayEntry: true }),
        resetScroll: false,
      });
    });
    // A pop that lands on an entry still carrying our token closed an overlay stacked above this one.
    const handlePop = () => {
      if ((history.state as Record<string, unknown> | null)?.[stateKey] !== token) {
        onPopRef.current();
      }
    };
    globalThis.addEventListener("popstate", handlePop);
    return () => {
      cancelled = true;
      globalThis.removeEventListener("popstate", handlePop);
    };
  }, [active, router, stateKey]);
}

/**
 * Closes an overlay by popping the entry {@link useOverlayHistoryEntry} pushed.
 * Falls back to the caller's own close when that entry is already gone.
 */
export function closeOverlayHistoryEntry(
  stateKey: OverlayHistoryKey,
  close: () => void,
  afterClose?: () => void,
): void {
  if (hasOverlayHistoryEntry(stateKey)) {
    if (afterClose) {
      globalThis.addEventListener("popstate", afterClose, { once: true });
    }
    history.back();
  } else {
    close();
    afterClose?.();
  }
}

export function hasOverlayHistoryEntry(stateKey: OverlayHistoryKey): boolean {
  return Boolean((history.state as Record<string, unknown> | null)?.[stateKey]);
}

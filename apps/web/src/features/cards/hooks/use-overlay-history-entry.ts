import { useRouter } from "@tanstack/react-router";
import { use, useEffect, useEffectEvent, useState } from "react";

import { OverlayHistoryLayerContext } from "@/features/cards/lib/overlay-history-layer";
import type {
  OverlayHistoryKey,
  OverlayHistoryLayer,
  OverlayLayerId,
} from "@/features/cards/lib/overlay-history-layer";

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

/** The router folds a navigation started while another is in flight into one history entry. */
function queuePush(push: () => Promise<void>): Promise<void> {
  queued += 1;
  const run = runQueued(queueTail, push);
  queueTail = run;
  return run;
}

interface LayerLanding {
  landed: boolean;
  waiters: Set<() => void>;
}

const landings = new WeakMap<OverlayLayerId, LayerLanding>();

function landingFor(id: OverlayLayerId): LayerLanding {
  let landing = landings.get(id);
  if (!landing) {
    landing = { landed: false, waiters: new Set() };
    landings.set(id, landing);
  }
  return landing;
}

function land(landing: LayerLanding): void {
  landing.landed = true;
  const waiters = [...landing.waiters];
  landing.waiters.clear();
  for (const waiter of waiters) {
    waiter();
  }
}

function drop(id: OverlayLayerId, landing: LayerLanding): void {
  if (landings.get(id) === landing) {
    landings.delete(id);
  }
  land(landing);
}

async function pushThenLand(push: () => Promise<void>, landing: LayerLanding): Promise<void> {
  await queuePush(push);
  land(landing);
}

/**
 * Child effects run before their parent's, so a nested overlay opened in the
 * same commit as its parent parks until the parent's entry is on the stack.
 */
function afterParentLands(
  parent: OverlayHistoryLayer | null,
  run: () => void,
): (() => void) | null {
  if (!parent?.active) {
    run();
    return null;
  }
  const landing = landingFor(parent.id);
  if (landing.landed) {
    run();
    return null;
  }
  landing.waiters.add(run);
  return () => landing.waiters.delete(run);
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
 * Overlays nested inside one read the returned layer from `OverlayHistoryLayerContext`.
 */
export function useOverlayHistoryEntry({
  active,
  stateKey,
  onPop,
}: OverlayHistoryEntryOptions): OverlayHistoryLayer {
  const router = useRouter();
  const parent = use(OverlayHistoryLayerContext);
  // oxlint-disable-next-line react/hook-use-state -- a stable per-mount layer identity, never replaced
  const [id] = useState<OverlayLayerId>(() => ({ stateKey }));
  const readParent = useEffectEvent(() => parent);
  const handlePopEvent = useEffectEvent(() => onPop());

  useEffect(() => {
    if (!active) {
      return;
    }
    const token = newEntryToken();
    let cancelled = false;
    const landing = landingFor(id);
    const push = async () => {
      if (cancelled) {
        return;
      }
      await router.navigate({
        href: router.latestLocation.href,
        state: (prev) => ({ ...prev, [stateKey]: token, overlayEntry: true }),
        resetScroll: false,
      });
    };
    const release = afterParentLands(readParent(), () => void pushThenLand(push, landing));
    /** A pop that lands on an entry still carrying our token closed an overlay stacked above this one. */
    const handlePop = () => {
      if ((history.state as Record<string, unknown> | null)?.[stateKey] !== token) {
        handlePopEvent();
      }
    };
    globalThis.addEventListener("popstate", handlePop);
    return () => {
      cancelled = true;
      release?.();
      drop(id, landing);
      globalThis.removeEventListener("popstate", handlePop);
    };
  }, [active, id, router, stateKey]);

  return { id, active };
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

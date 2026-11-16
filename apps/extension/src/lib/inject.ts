import { browser } from "wxt/browser";

import type { PageExtract } from "./deck-extract";
import type { OverlaySnapshot } from "./overlay-snapshot";
import { SNAPSHOT_STORAGE_KEY } from "./overlay-snapshot";
import type { PicksBasket } from "./picks";
import { PICKS_STORAGE_KEY, readBasket } from "./picks";
import type { AnnotateReport } from "./popup-actions";

export async function storedSnapshot(): Promise<OverlaySnapshot | undefined> {
  const stored = await browser.storage.local.get(SNAPSHOT_STORAGE_KEY);
  return stored[SNAPSHOT_STORAGE_KEY] as OverlaySnapshot | undefined;
}

export async function storedBasket(): Promise<PicksBasket> {
  const stored = await browser.storage.local.get(PICKS_STORAGE_KEY);
  return readBasket(stored[PICKS_STORAGE_KEY]);
}

export async function storeBasket(basket: PicksBasket): Promise<void> {
  await browser.storage.local.set({ [PICKS_STORAGE_KEY]: basket });
}

/** The injected script stores what it finds; a fresh capture time is what proves it found something. */
export async function captureSnapshot(tabId: number): Promise<OverlaySnapshot | undefined> {
  const previous = await storedSnapshot();
  const before = previous?.capturedAt;
  await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/capture-snapshot.js"],
  });
  const stored = await storedSnapshot();
  return stored !== undefined && stored.capturedAt !== before ? stored : undefined;
}

/**
 * The injected script's own return value is not load-bearing: an async content
 * script main resolves to undefined on some builds.
 */
export async function annotateTab(tabId: number): Promise<AnnotateReport | undefined> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/annotate.js"],
  });
  return readAnnotateReport(results[0]?.result);
}

export function readAnnotateReport(value: unknown): AnnotateReport | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { rows, resolved, annotated } = value as Record<string, unknown>;
  if (typeof rows !== "number" || typeof resolved !== "number") {
    return undefined;
  }
  return typeof annotated === "number" ? { rows, resolved, annotated } : { rows, resolved };
}

/**
 * Resolves true once a snapshot with a capture time other than `before` is stored, false
 * after `timeoutMs`. Listens from the call on, so call it before starting the capture.
 */
export function snapshotChange(before: string | undefined, timeoutMs: number): Promise<boolean> {
  // oxlint-disable-next-line promise/avoid-new -- bridges the storage event and the timeout
  return new Promise((resolve) => {
    const finish = (changed: boolean) => {
      clearTimeout(timer);
      browser.storage.onChanged.removeListener(listener);
      resolve(changed);
    };
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== "local" || !(SNAPSHOT_STORAGE_KEY in changes)) {
        return;
      }
      const next = changes[SNAPSHOT_STORAGE_KEY]?.newValue as OverlaySnapshot | undefined;
      if (next !== undefined && next.capturedAt !== before) {
        finish(true);
      }
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    browser.storage.onChanged.addListener(listener);
  });
}

export async function extractDeck(tabId: number): Promise<PageExtract | undefined> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/extract.js"],
  });
  return results[0]?.result as PageExtract | undefined;
}

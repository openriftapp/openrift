import { browser } from "wxt/browser";

import type { PageExtract } from "./deck-extract";
import type { OverlaySnapshot } from "./overlay-snapshot";
import { SNAPSHOT_STORAGE_KEY } from "./overlay-snapshot";

export async function storedSnapshot(): Promise<OverlaySnapshot | undefined> {
  const stored = await browser.storage.local.get(SNAPSHOT_STORAGE_KEY);
  return stored[SNAPSHOT_STORAGE_KEY] as OverlaySnapshot | undefined;
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
export async function annotateTab(tabId: number): Promise<number | undefined> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/annotate.js"],
  });
  const annotated = results[0]?.result;
  return typeof annotated === "number" && annotated >= 0 ? annotated : undefined;
}

export async function extractDeck(tabId: number): Promise<PageExtract | undefined> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/extract.js"],
  });
  return results[0]?.result as PageExtract | undefined;
}

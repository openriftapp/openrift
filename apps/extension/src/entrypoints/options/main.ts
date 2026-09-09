import { browser } from "wxt/browser";

import { CARDMARKET_MATCH_PATTERN } from "@/lib/cardmarket-url";
import { openriftMatchPattern, overlaySyncUrl } from "@/lib/openrift-url";
import type { OverlaySnapshot } from "@/lib/overlay-snapshot";
import { SNAPSHOT_STORAGE_KEY } from "@/lib/overlay-snapshot";
import { snapshotSummary } from "@/lib/overlay-status";

const ORIGINS = [CARDMARKET_MATCH_PATTERN, openriftMatchPattern()];

function element<T extends HTMLElement>(id: string): T {
  const found = document.querySelector<T>(`#${id}`);
  if (found === null) {
    throw new Error(`Missing element: ${id}`);
  }
  return found;
}

const permissionStatus = element<HTMLParagraphElement>("permission-status");
const snapshotStatus = element<HTMLParagraphElement>("snapshot-status");
const enableButton = element<HTMLButtonElement>("enable");
const openSyncButton = element<HTMLButtonElement>("open-sync");

async function renderPermission(): Promise<void> {
  const granted = await browser.permissions.contains({ origins: ORIGINS }).catch(() => false);
  permissionStatus.textContent = granted
    ? "Allowed. Counts arrive on their own, on the OpenRift page and on seller offers."
    : "Not allowed yet. Until you allow it, the counts only update when you click the OpenRift icon on the page you are looking at.";
  enableButton.disabled = granted;
  enableButton.textContent = granted ? "Allowed" : "Allow";
}

async function renderSnapshot(): Promise<void> {
  const stored = await browser.storage.local.get(SNAPSHOT_STORAGE_KEY);
  const snapshot = stored[SNAPSHOT_STORAGE_KEY] as OverlaySnapshot | undefined;
  snapshotStatus.textContent = snapshotSummary(snapshot, new Date());
}

enableButton.addEventListener("click", () => {
  // Called before any await: Firefox drops the user gesture across one.
  void (async () => {
    try {
      await browser.permissions.request({ origins: ORIGINS });
      await renderPermission();
    } catch {
      permissionStatus.textContent = "The browser refused that permission.";
    }
  })();
});

openSyncButton.addEventListener("click", () => {
  void browser.tabs.create({ url: overlaySyncUrl() });
});

await Promise.all([renderPermission(), renderSnapshot()]);

import { browser } from "wxt/browser";

import { CARDMARKET_MATCH_PATTERN } from "@/lib/cardmarket-url";
import { annotateTab, captureSnapshot, extractDeck, storedSnapshot } from "@/lib/inject";
import { deckImportUrl, openriftMatchPattern, overlaySyncUrl } from "@/lib/openrift-url";
import { snapshotStatus } from "@/lib/overlay-status";
import type { PopupPlan } from "@/lib/popup-actions";
import { annotateResult, popupPlan } from "@/lib/popup-actions";

const ORIGINS = [CARDMARKET_MATCH_PATTERN, openriftMatchPattern()];
const REFRESH_TIMEOUT_MS = 20_000;
const REFRESH_POLL_MS = 400;

function element<T extends HTMLElement>(id: string): T {
  const found = document.querySelector<T>(`#${id}`);
  if (found === null) {
    throw new Error(`Missing element: ${id}`);
  }
  return found;
}

const headline = element<HTMLParagraphElement>("snapshot-headline");
const detail = element<HTMLParagraphElement>("snapshot-detail");
const primaryButton = element<HTMLButtonElement>("primary");
const importButton = element<HTMLButtonElement>("import");
const enableButton = element<HTMLButtonElement>("enable");
const result = element<HTMLParagraphElement>("result");

interface Tab {
  id: number;
  index: number;
  url: string;
}

function showResult(text: string, failed = false): void {
  result.textContent = text;
  result.classList.toggle("failed", failed);
  result.hidden = false;
}

async function renderSnapshot(): Promise<void> {
  const status = snapshotStatus(await storedSnapshot(), new Date());
  headline.textContent = status.headline;
  headline.classList.toggle("stale", status.stale);
  detail.textContent = status.detail;
}

async function granted(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: ORIGINS });
  } catch {
    // An origin the browser will not accept is a bug, not a denial.
    return false;
  }
}

async function activeTab(): Promise<Tab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id === undefined ? undefined : { id: tab.id, index: tab.index, url: tab.url ?? "" };
}

function sleep(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- bridges the callback-based setTimeout API
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForCapture(before: string | undefined): Promise<boolean> {
  const deadline = Date.now() + REFRESH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(REFRESH_POLL_MS);
    const current = await storedSnapshot();
    if (current?.capturedAt !== before) {
      return true;
    }
  }
  return false;
}

async function capture(tabId: number, quiet: boolean): Promise<void> {
  const snapshot = await captureSnapshot(tabId);
  if (snapshot === undefined) {
    if (!quiet) {
      showResult("Nothing to take from this page yet.", true);
    }
    return;
  }
  showResult("Counts saved.");
  await renderSnapshot();
}

async function annotate(tabId: number): Promise<void> {
  if ((await storedSnapshot()) === undefined) {
    showResult("Refresh your counts first.", true);
    return;
  }
  showResult(annotateResult(await annotateTab(tabId)));
}

/** With the permission granted the sync page captures itself, so the tab can do its work unseen. */
async function refresh(): Promise<void> {
  if (!(await granted())) {
    await browser.tabs.create({ url: overlaySyncUrl() });
    window.close();
    return;
  }

  showResult("Fetching from OpenRift…");
  const previous = await storedSnapshot();
  const before = previous?.capturedAt;
  const tab = await browser.tabs.create({ url: overlaySyncUrl(), active: false });

  if (await waitForCapture(before)) {
    if (tab.id !== undefined) {
      await browser.tabs.remove(tab.id);
    }
    showResult("Counts refreshed.");
    await renderSnapshot();
    return;
  }
  if (tab.id !== undefined) {
    await browser.tabs.update(tab.id, { active: true });
  }
  window.close();
}

async function importDeck(tab: Tab): Promise<void> {
  const extract = await extractDeck(tab.id);
  const deck = extract?.deck;
  if (!deck || deck.kind === "none") {
    showResult("No decklist found on this page.", true);
    return;
  }
  const payload = deck.kind === "text" ? deck.list : deck.code;
  const url = deckImportUrl(payload, { name: deck.name, source: extract?.sourceUrl });
  await browser.tabs.create({ url, index: tab.index + 1 });
  window.close();
}

async function guard(button: HTMLButtonElement, work: () => Promise<void>): Promise<void> {
  button.disabled = true;
  try {
    await work();
  } catch {
    // Injection fails on browser-internal pages and extension stores.
    showResult("This page does not let extensions read it.", true);
  } finally {
    button.disabled = false;
  }
}

async function runPrimary(plan: PopupPlan, tab: Tab | undefined): Promise<void> {
  if (plan.primary === "refresh" || tab === undefined) {
    await refresh();
    return;
  }
  if (plan.primary === "capture") {
    await capture(tab.id, false);
    return;
  }
  await annotate(tab.id);
}

async function render(): Promise<void> {
  await renderSnapshot();
  enableButton.hidden = await granted();

  const tab = await activeTab();
  const plan = popupPlan(tab?.url ?? "");
  primaryButton.textContent = plan.label;
  primaryButton.addEventListener("click", () => {
    void guard(primaryButton, () => runPrimary(plan, tab));
  });

  if (plan.showImport && tab !== undefined) {
    importButton.hidden = false;
    importButton.addEventListener("click", () => {
      void guard(importButton, () => importDeck(tab));
    });
  }

  if (plan.captureOnOpen && tab !== undefined) {
    await guard(primaryButton, () => capture(tab.id, true));
  }
}

enableButton.addEventListener("click", () => {
  // Called before any await: Firefox drops the user gesture across one.
  void (async () => {
    try {
      await browser.permissions.request({ origins: ORIGINS });
      enableButton.hidden = await granted();
    } catch {
      showResult("The browser refused that permission.", true);
    }
  })();
});

await render();

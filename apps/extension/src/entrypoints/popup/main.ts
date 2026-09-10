import { browser } from "wxt/browser";

import { CARDMARKET_MATCH_PATTERN } from "@/lib/cardmarket-url";
import type { PageExtract } from "@/lib/deck-extract";
import {
  annotateTab,
  captureSnapshot,
  extractDeck,
  storeBasket,
  storedBasket,
  storedSnapshot,
} from "@/lib/inject";
import {
  deckImportUrl,
  openriftMatchPattern,
  overlaySyncUrl,
  picksImportUrl,
} from "@/lib/openrift-url";
import { entriesLabel, syncStatus } from "@/lib/overlay-status";
import { picksPayload, removeSeller, sellerPicks, sellerPicksText } from "@/lib/picks";
import type { PopupPlan } from "@/lib/popup-actions";
import { annotateResult, deckSummary, popupPlan } from "@/lib/popup-actions";

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

const optionsButton = element<HTMLButtonElement>("options");
const syncEmpty = element<HTMLParagraphElement>("sync-empty");
const syncLead = element<HTMLParagraphElement>("sync-lead");
const syncLists = element<HTMLUListElement>("sync-lists");
const lastSync = element<HTMLParagraphElement>("last-sync");
const permissionNote = element<HTMLParagraphElement>("permission-note");
const primaryButton = element<HTMLButtonElement>("primary");
const syncButton = element<HTMLButtonElement>("sync");
const enableButton = element<HTMLButtonElement>("enable");
const picksSection = element<HTMLElement>("picks");
const picksList = element<HTMLDivElement>("picks-list");
const deckSection = element<HTMLElement>("deck");
const deckDetail = element<HTMLParagraphElement>("deck-detail");
const importButton = element<HTMLButtonElement>("import");
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

function listRow(name: string, entries: string | undefined): HTMLLIElement {
  const row = document.createElement("li");
  const label = document.createElement("span");
  label.className = "name";
  label.textContent = name;
  row.append(label);
  if (entries !== undefined) {
    const count = document.createElement("span");
    count.className = "entries";
    count.textContent = `(${entries})`;
    row.append(count);
  }
  return row;
}

function restRow(more: number): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "rest";
  row.textContent = `and ${more} more`;
  return row;
}

async function renderSync(): Promise<void> {
  const status = syncStatus(await storedSnapshot(), new Date());
  const synced = status.lastSync !== undefined;

  syncEmpty.hidden = synced;
  syncLead.hidden = !synced;
  syncLists.hidden = !synced;
  lastSync.hidden = !synced;

  syncLists.replaceChildren(
    ...status.lists.map((list) => listRow(list.name, entriesLabel(list.entryCount))),
    ...(status.more > 0 ? [restRow(status.more)] : []),
  );
  lastSync.textContent = `Last sync: ${status.lastSync ?? ""}`;
  lastSync.classList.toggle("stale", status.stale);
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
  await renderSync();
}

async function annotate(tabId: number): Promise<void> {
  const annotated = await annotateTab(tabId);
  if ((await storedSnapshot()) === undefined) {
    showResult("Pick buttons added. Synchronize to see what you own and want.");
    return;
  }
  showResult(annotateResult(annotated));
}

function actionButton(label: string, onClick: () => Promise<void>): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    void guard(button, onClick);
  });
  return button;
}

async function sendPicks(seller: string, tab: Tab | undefined): Promise<void> {
  const basket = await storedBasket();
  const payload = picksPayload(basket, seller);
  if (payload === undefined) {
    await renderPicks(tab);
    return;
  }
  await browser.tabs.create({
    url: picksImportUrl(payload),
    ...(tab === undefined ? {} : { index: tab.index + 1 }),
  });
  await storeBasket(removeSeller(basket, seller));
  window.close();
}

async function clearPicks(seller: string, tab: Tab | undefined): Promise<void> {
  await storeBasket(removeSeller(await storedBasket(), seller));
  await renderPicks(tab);
}

async function renderPicks(tab: Tab | undefined): Promise<void> {
  const sellers = sellerPicks(await storedBasket());
  picksList.replaceChildren();
  picksSection.hidden = sellers.length === 0;
  for (const entry of sellers) {
    const row = document.createElement("div");
    row.className = "seller";
    const text = document.createElement("p");
    text.textContent = sellerPicksText(entry);
    row.append(
      text,
      actionButton("Send to OpenRift", () => sendPicks(entry.seller, tab)),
      actionButton("Clear", () => clearPicks(entry.seller, tab)),
    );
    picksList.append(row);
  }
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
    showResult("Counts synchronized.");
    await renderSync();
    return;
  }
  if (tab.id !== undefined) {
    await browser.tabs.update(tab.id, { active: true });
  }
  window.close();
}

/** Detection already ran, so the import spends no second injection on the page. */
async function importDeck(extract: PageExtract, tab: Tab): Promise<void> {
  const deck = extract.deck;
  if (deck.kind === "none") {
    return;
  }
  const payload = deck.kind === "text" ? deck.list : deck.code;
  const url = deckImportUrl(payload, { name: deck.name, source: extract.sourceUrl });
  await browser.tabs.create({ url, index: tab.index + 1 });
  window.close();
}

async function renderDeck(plan: PopupPlan, tab: Tab | undefined): Promise<void> {
  if (!plan.detectDeck || tab === undefined) {
    return;
  }
  let extract: PageExtract | undefined;
  try {
    extract = await extractDeck(tab.id);
  } catch {
    // A page that refuses injection simply has no deck to offer.
    return;
  }
  const summary = deckSummary(extract?.deck);
  if (extract === undefined || summary === undefined) {
    return;
  }
  deckDetail.textContent = summary;
  deckSection.hidden = false;
  importButton.addEventListener("click", () => {
    void guard(importButton, () => importDeck(extract, tab));
  });
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
  await renderSync();
  const allowed = await granted();
  enableButton.hidden = allowed;
  permissionNote.hidden = allowed;

  const tab = await activeTab();
  await renderPicks(tab);
  const plan = popupPlan(tab?.url ?? "");
  primaryButton.textContent = plan.label;
  primaryButton.addEventListener("click", () => {
    void guard(primaryButton, () => runPrimary(plan, tab));
  });

  if (plan.showSync) {
    syncButton.hidden = false;
    syncButton.addEventListener("click", () => {
      void guard(syncButton, refresh);
    });
  }

  await renderDeck(plan, tab);

  if (plan.captureOnOpen && tab !== undefined) {
    await guard(primaryButton, () => capture(tab.id, true));
  }
}

optionsButton.addEventListener("click", () => {
  void browser.runtime.openOptionsPage();
});

enableButton.addEventListener("click", () => {
  // Called before any await: Firefox drops the user gesture across one.
  void (async () => {
    try {
      await browser.permissions.request({ origins: ORIGINS });
      const allowed = await granted();
      enableButton.hidden = allowed;
      permissionNote.hidden = allowed;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      showResult(`The browser refused that permission: ${reason}`, true);
    }
  })();
});

await render();

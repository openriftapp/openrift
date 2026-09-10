import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { annotate } from "@/lib/cardmarket-annotate";
import { overlayHeader } from "@/lib/cardmarket-cell";
import { pickClick, renderPickControls } from "@/lib/cardmarket-pick-controls";
import { cardmarketSellerFromUrl } from "@/lib/cardmarket-url";
import type { OverlaySnapshot } from "@/lib/overlay-snapshot";
import { SNAPSHOT_STORAGE_KEY } from "@/lib/overlay-snapshot";
import type { PicksBasket } from "@/lib/picks";
import { adjustPick, PICKS_STORAGE_KEY, readBasket } from "@/lib/picks";

const RERUN_DEBOUNCE_MS = 150;

interface PageState {
  seller: string | undefined;
  snapshot: OverlaySnapshot | undefined;
  basket: PicksBasket;
}

async function loadState(): Promise<PageState> {
  const stored = await browser.storage.local.get([SNAPSHOT_STORAGE_KEY, PICKS_STORAGE_KEY]);
  return {
    seller: cardmarketSellerFromUrl(globalThis.location.href),
    snapshot: stored[SNAPSHOT_STORAGE_KEY] as OverlaySnapshot | undefined,
    basket: readBasket(stored[PICKS_STORAGE_KEY]),
  };
}

/** Counts first, so the pick control lands after the pill. */
function paint(state: PageState): number {
  const annotated =
    state.snapshot === undefined ? -1 : annotate(document, state.snapshot, document);
  if (state.seller !== undefined) {
    renderPickControls(document, state.basket, state.seller, document);
    overlayHeader(document, document);
  }
  return annotated;
}

function install(state: PageState): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Cardmarket swaps the table body in place when filters or pages change.
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => paint(state), RERUN_DEBOUNCE_MS);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }
    if (SNAPSHOT_STORAGE_KEY in changes) {
      state.snapshot = changes[SNAPSHOT_STORAGE_KEY]?.newValue as OverlaySnapshot | undefined;
    }
    if (PICKS_STORAGE_KEY in changes) {
      state.basket = readBasket(changes[PICKS_STORAGE_KEY]?.newValue);
    }
    paint(state);
  });

  document.addEventListener("click", (event) => {
    const click = pickClick(event.target);
    if (click === undefined || state.seller === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    state.basket = adjustPick(state.basket, state.seller, click.identity, click.delta);
    paint(state);
    void browser.storage.local.set({ [PICKS_STORAGE_KEY]: state.basket });
  });
}

// registration: "runtime" keeps this out of the manifest; the background
// script injects it on click or on a page load it has permission for.
export default defineContentScript({
  registration: "runtime",
  async main(): Promise<number> {
    const state = await loadState();
    const annotated = paint(state);
    if (document.documentElement.dataset.openriftOverlay === undefined) {
      document.documentElement.dataset.openriftOverlay = "on";
      install(state);
    }
    return annotated;
  },
});

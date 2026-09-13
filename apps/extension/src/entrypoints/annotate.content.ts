import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import { annotate } from "@/lib/cardmarket-annotate";
import { overlayHeader } from "@/lib/cardmarket-cell";
import { pickClick, renderPickControls } from "@/lib/cardmarket-pick-controls";
import { extractCardmarketRows } from "@/lib/cardmarket-rows";
import { cardmarketPageKind, cardmarketSellerFromUrl } from "@/lib/cardmarket-url";
import {
  isPickAllClick,
  relayoutSellerCards,
  renderWizardPanel,
  sellerShipping,
  WIZARD_SELLER,
  wizardLines,
  ZERO_SHIPPING_STORAGE_KEY,
  zeroShippingToggle,
} from "@/lib/cardmarket-wizard";
import type { OverlaySnapshot } from "@/lib/overlay-snapshot";
import { SNAPSHOT_STORAGE_KEY } from "@/lib/overlay-snapshot";
import type { PicksBasket } from "@/lib/picks";
import { adjustPick, pickedQuantity, PICKS_STORAGE_KEY, readBasket } from "@/lib/picks";
import { splitWizardLines } from "@/lib/wizard-split";

const RERUN_DEBOUNCE_MS = 150;

interface PageState {
  kind: "offers" | "wizard" | undefined;
  seller: string | undefined;
  snapshot: OverlaySnapshot | undefined;
  basket: PicksBasket;
  countZeroShipping: boolean;
}

function sellerFor(url: string): Pick<PageState, "kind" | "seller"> {
  const kind = cardmarketPageKind(url);
  return {
    kind,
    seller: kind === "wizard" ? WIZARD_SELLER : cardmarketSellerFromUrl(url),
  };
}

async function loadState(): Promise<PageState> {
  const stored = await browser.storage.local.get([
    SNAPSHOT_STORAGE_KEY,
    PICKS_STORAGE_KEY,
    ZERO_SHIPPING_STORAGE_KEY,
  ]);
  return {
    ...sellerFor(globalThis.location.href),
    snapshot: stored[SNAPSHOT_STORAGE_KEY] as OverlaySnapshot | undefined,
    basket: readBasket(stored[PICKS_STORAGE_KEY]),
    countZeroShipping: stored[ZERO_SHIPPING_STORAGE_KEY] !== false,
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
  if (state.kind === "wizard") {
    renderWizardPanel(
      document,
      extractCardmarketRows(document),
      state.snapshot,
      document,
      state.countZeroShipping,
    );
    relayoutSellerCards(document);
  }
  return annotated;
}

/** Every line CardTrader undercuts goes into the basket at the wizard's quantity. */
function pickAll(state: PageState): PicksBasket {
  if (state.snapshot === undefined || state.seller === undefined) {
    return state.basket;
  }
  const lines = wizardLines(extractCardmarketRows(document), state.snapshot);
  let basket = state.basket;
  const split = splitWizardLines(lines, sellerShipping(document), state.countZeroShipping);
  for (const line of split.cardtrader) {
    const identity = {
      idProduct: line.idProduct,
      finish: line.finish,
      idLanguage: line.idLanguage,
      languageLabel: line.languageLabel,
      productName: line.productName,
    };
    const delta = line.quantity - pickedQuantity(basket, state.seller, identity);
    basket = adjustPick(basket, state.seller, identity, delta);
  }
  return basket;
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
    if (ZERO_SHIPPING_STORAGE_KEY in changes) {
      state.countZeroShipping = changes[ZERO_SHIPPING_STORAGE_KEY]?.newValue !== false;
    }
    paint(state);
  });

  document.addEventListener("change", (event) => {
    const checked = zeroShippingToggle(event.target);
    if (checked === undefined) {
      return;
    }
    state.countZeroShipping = checked;
    paint(state);
    void browser.storage.local.set({ [ZERO_SHIPPING_STORAGE_KEY]: checked });
  });

  document.addEventListener("click", (event) => {
    if (state.seller === undefined) {
      return;
    }
    const click = pickClick(event.target);
    if (click !== undefined) {
      state.basket = adjustPick(state.basket, state.seller, click.identity, click.delta);
    } else if (isPickAllClick(event.target)) {
      state.basket = pickAll(state);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
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

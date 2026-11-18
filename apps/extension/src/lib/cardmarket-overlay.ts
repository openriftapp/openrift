import { browser } from "wxt/browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";

import { annotate } from "./cardmarket-annotate";
import { helpClick, overlayHeader } from "./cardmarket-cell";
import { pickClick, renderPickControls } from "./cardmarket-pick-controls";
import { extractCardmarketRows, rowCoverage } from "./cardmarket-rows";
import { cardmarketPageKind, cardmarketSellerFromUrl } from "./cardmarket-url";
import {
  isPickAllClick,
  relayoutSellerCards,
  renderWizardPanel,
  sellerShipping,
  WIZARD_SELLER,
  wizardLines,
  ZERO_SHIPPING_STORAGE_KEY,
  zeroShippingToggle,
} from "./cardmarket-wizard";
import type { OverlaySnapshot } from "./overlay-snapshot";
import { SNAPSHOT_STORAGE_KEY } from "./overlay-snapshot";
import { watchPage } from "./page-watch";
import type { PicksBasket } from "./picks";
import { adjustPick, PICKS_STORAGE_KEY, readBasket, setPickQuantities } from "./picks";
import type { AnnotateReport } from "./popup-actions";
import { splitWizardLines } from "./wizard-split";

const RERUN_DEBOUNCE_MS = 150;

export interface PageState {
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

export async function loadState(): Promise<PageState> {
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
function paint(state: PageState, doc: Document): AnnotateReport {
  const coverage = rowCoverage(extractCardmarketRows(doc));
  const report: AnnotateReport =
    state.snapshot === undefined
      ? coverage
      : { ...coverage, annotated: annotate(doc, state.snapshot, doc) };
  if (state.seller !== undefined) {
    renderPickControls(doc, state.basket, state.seller, doc);
    overlayHeader(doc, doc);
  }
  if (state.kind === "wizard") {
    renderWizardPanel(
      doc,
      extractCardmarketRows(doc),
      state.snapshot,
      doc,
      state.countZeroShipping,
    );
  }
  return report;
}

/** Every line CardTrader undercuts goes into the basket at the wizard's quantity. */
function pickAll(state: PageState, doc: Document): PicksBasket {
  if (state.snapshot === undefined || state.seller === undefined) {
    return state.basket;
  }
  const lines = wizardLines(extractCardmarketRows(doc), state.snapshot);
  const split = splitWizardLines(lines, sellerShipping(doc), state.countZeroShipping);
  return setPickQuantities(state.basket, state.seller, split.cardtrader);
}

export type OverlayContext = Pick<
  ContentScriptContext,
  "isInvalid" | "onInvalidated" | "setTimeout" | "addEventListener"
>;

/**
 * An orphaned script (extension updated or reloaded) only learns it is orphaned by
 * reading ctx.isInvalid, so every handler checks it first.
 */
export function installOverlay(
  ctx: OverlayContext,
  state: PageState,
  doc: Document,
): AnnotateReport {
  const report = paint(state, doc);
  /**
   * The host's resize handlers run synchronously, so the relayout waits until the
   * paint's own records are drained.
   */
  const relayout = () => {
    if (state.kind === "wizard") {
      relayoutSellerCards(doc, doc);
    }
  };
  let timer: number | undefined;
  // Cardmarket swaps the table body in place when filters or pages change.
  const watch = watchPage(
    doc.body,
    () => paint(state, doc),
    (repaint) => {
      clearTimeout(timer);
      timer = ctx.setTimeout(repaint, RERUN_DEBOUNCE_MS);
    },
    relayout,
  );
  ctx.onInvalidated(() => {
    watch.stop();
  });

  const onStorage = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (ctx.isInvalid || area !== "local") {
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
    watch.repaint();
  };
  browser.storage.onChanged.addListener(onStorage);
  ctx.onInvalidated(() => {
    browser.storage.onChanged.removeListener(onStorage);
  });

  ctx.addEventListener(doc, "change", (event) => {
    if (ctx.isInvalid) {
      return;
    }
    const checked = zeroShippingToggle(event.target);
    if (checked === undefined) {
      return;
    }
    state.countZeroShipping = checked;
    watch.repaint();
    void browser.storage.local.set({ [ZERO_SHIPPING_STORAGE_KEY]: checked });
  });

  // Capture phase, so a help toggle inside a sortable header never reaches the host's handlers.
  ctx.addEventListener(
    doc,
    "click",
    (event) => {
      if (!ctx.isInvalid && helpClick(doc, event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { capture: true },
  );

  ctx.addEventListener(doc, "click", (event) => {
    if (ctx.isInvalid || state.seller === undefined) {
      return;
    }
    const click = pickClick(event.target);
    if (click !== undefined) {
      state.basket = adjustPick(state.basket, state.seller, click.identity, click.delta);
    } else if (isPickAllClick(event.target)) {
      state.basket = pickAll(state, doc);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    watch.repaint();
    void browser.storage.local.set({ [PICKS_STORAGE_KEY]: state.basket });
  });

  relayout();
  return report;
}

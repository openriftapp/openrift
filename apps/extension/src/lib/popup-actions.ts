import { isCardmarketOffersUrl } from "./cardmarket-url";
import type { PageDeckExtract } from "./deck-extract";
import { countTextCards } from "./deck-extract";
import { isOverlaySyncUrl } from "./openrift-url";

export type PopupPrimary = "capture" | "annotate" | "refresh";

export interface PopupPlan {
  primary: PopupPrimary;
  label: string;
  /** The deck importer, the extension's other job, only where a deck could be. */
  detectDeck: boolean;
  showSync: boolean;
  /** Opening the popup on the sync page is the user asking for the counts. */
  captureOnOpen: boolean;
}

const INJECTABLE_PROTOCOLS = new Set(["http:", "https:"]);

function isInjectable(url: string): boolean {
  try {
    return INJECTABLE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function popupPlan(url: string): PopupPlan {
  if (isOverlaySyncUrl(url)) {
    return {
      primary: "capture",
      label: "Synchronize",
      detectDeck: false,
      showSync: false,
      captureOnOpen: true,
    };
  }
  if (isCardmarketOffersUrl(url)) {
    return {
      primary: "annotate",
      label: "Mark this page",
      detectDeck: false,
      showSync: true,
      captureOnOpen: false,
    };
  }
  return {
    primary: "refresh",
    label: "Synchronize",
    detectDeck: isInjectable(url),
    showSync: false,
    captureOnOpen: false,
  };
}

export function deckSummary(deck: PageDeckExtract | undefined): string | undefined {
  if (deck === undefined || deck.kind === "none") {
    return undefined;
  }
  if (deck.kind === "code") {
    return deck.name === undefined
      ? "A deck code is on this page."
      : `${deck.name} · a deck code on this page.`;
  }
  const cards = countTextCards(deck.list);
  if (cards === 0) {
    return deck.name === undefined
      ? "A decklist is on this page."
      : `${deck.name} · a decklist on this page.`;
  }
  const counted = `${cards} card${cards === 1 ? "" : "s"} on this page.`;
  return deck.name === undefined ? `A decklist with ${counted}` : `${deck.name} · ${counted}`;
}

export function annotateResult(annotated: number | undefined): string {
  if (annotated === undefined) {
    return "Counts shown on this page.";
  }
  if (annotated === 0) {
    return "Nothing on this page is on your lists.";
  }
  return `Marked ${annotated} card${annotated === 1 ? "" : "s"}.`;
}

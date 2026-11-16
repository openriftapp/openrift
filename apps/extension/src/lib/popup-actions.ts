import { countNoun } from "@openrift/shared/strings";

import type { RowCoverage } from "./cardmarket-rows";
import { cardmarketPageKind } from "./cardmarket-url";
import type { PageDeckExtract } from "./deck-extract";
import { countTextCards } from "./deck-extract";
import { isOverlaySyncUrl } from "./openrift-url";

type PopupPrimary = "capture" | "annotate" | "refresh";

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
  if (cardmarketPageKind(url) !== undefined) {
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
  const counted = `${countNoun(cards, "card")} on this page.`;
  return deck.name === undefined ? `A decklist with ${counted}` : `${deck.name} · ${counted}`;
}

/** `annotated` is absent when nothing has been synchronized. */
export interface AnnotateReport extends RowCoverage {
  annotated?: number;
}

const UNSYNCED_RESULT = "Pick buttons added. Synchronize to see what you own and want.";

function markedText(annotated: number | undefined): string {
  if (annotated === undefined) {
    return UNSYNCED_RESULT;
  }
  if (annotated === 0) {
    return "Nothing on this page is on your lists.";
  }
  return `Marked ${countNoun(annotated, "card")}.`;
}

export function annotateResult(report: AnnotateReport | undefined, synced: boolean): string {
  if (report === undefined) {
    return synced ? "Counts shown on this page." : UNSYNCED_RESULT;
  }
  if (report.rows === 0) {
    return "Found no cards on this page.";
  }
  if (report.resolved === 0) {
    return "Could not read the cards on this page. Cardmarket may have changed its layout.";
  }
  const marked = markedText(report.annotated);
  const unread = report.rows - report.resolved;
  return unread === 0 ? marked : `${marked} ${countNoun(unread, "card")} could not be read.`;
}

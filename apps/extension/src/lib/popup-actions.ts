import { isCardmarketOffersUrl } from "./cardmarket-url";
import { isOverlaySyncUrl } from "./openrift-url";

export type PopupPrimary = "capture" | "annotate" | "refresh";

export interface PopupPlan {
  primary: PopupPrimary;
  label: string;
  /** The deck importer, the extension's other job, only where a deck could be. */
  showImport: boolean;
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
    return { primary: "capture", label: "Refresh counts", showImport: false, captureOnOpen: true };
  }
  if (isCardmarketOffersUrl(url)) {
    return {
      primary: "annotate",
      label: "Mark this page",
      showImport: false,
      captureOnOpen: false,
    };
  }
  return {
    primary: "refresh",
    label: "Refresh counts",
    showImport: isInjectable(url),
    captureOnOpen: false,
  };
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

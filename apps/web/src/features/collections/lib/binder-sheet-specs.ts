/**
 * Binder-sheet sizes and papers: the tables the dialog's selects render from.
 *
 * Split out of `binder-sheet-pdf` so a component can label its controls without
 * importing the generator, which pulls in jsPDF, the QR encoder and the brand
 * logo raster. `binder-sheet-pdf` re-exports the names its own callers still
 * import from it, so those imports keep working.
 */

import { m } from "@/paraglide/messages.js";

export type BinderSheetSize = "card" | "2x2" | "3x3";
export type BinderSheetPaper = "a4" | "letter";
export type BinderSheetStyle = "light" | "dark";

export interface BinderSheetSpec {
  /** mm */
  width: number;
  /** mm */
  height: number;
  cols: number;
  rows: number;
}

/** mm; matches the proxy printer. */
export const CARD_WIDTH_MM = 63;
const CARD_HEIGHT_MM = 88;

export const BINDER_SHEET_SPECS: Record<BinderSheetSize, BinderSheetSpec> = {
  card: {
    width: CARD_WIDTH_MM,
    height: CARD_HEIGHT_MM,
    cols: 3,
    rows: 3,
  },
  "2x2": {
    width: 2 * CARD_WIDTH_MM,
    height: 2 * CARD_HEIGHT_MM,
    cols: 1,
    rows: 1,
  },
  "3x3": {
    width: 3 * CARD_WIDTH_MM,
    height: 3 * CARD_HEIGHT_MM,
    cols: 1,
    rows: 1,
  },
};

export const BINDER_SHEET_PAPERS: Record<BinderSheetPaper, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

const SIZE_LABEL: Record<BinderSheetSize, () => string> = {
  card: () => m.binder_size_card(),
  "2x2": () => m.binder_size_2x2(),
  "3x3": () => m.binder_size_3x3(),
};

const PAPER_LABEL: Record<BinderSheetPaper, () => string> = {
  a4: () => m.binder_paper_a4(),
  letter: () => m.binder_paper_letter(),
};

export function binderSheetSizeLabel(size: BinderSheetSize): string {
  return SIZE_LABEL[size]();
}

export function binderSheetSizeHint(size: BinderSheetSize): string {
  const spec = BINDER_SHEET_SPECS[size];
  return m.binder_size_hint({
    width: spec.width,
    height: spec.height,
    count: spec.cols * spec.rows,
  });
}

export function binderSheetPaperLabel(paper: BinderSheetPaper): string {
  return PAPER_LABEL[paper]();
}

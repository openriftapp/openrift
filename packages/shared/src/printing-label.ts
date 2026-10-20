import { enumLabel } from "./enum-label.js";
import { WellKnown } from "./well-known.js";

/** Structural on purpose: both the web `Printing` and the Discord bot's compact wire shape satisfy it. */
export interface VariantLabelPrinting {
  language: string;
  artVariant: string;
  finish: string;
  size: string;
  isSigned: boolean;
  isOvernumbered: boolean;
  markers: readonly { slug: string; label: string }[];
  shortCode?: string;
  otherSide?: { cardName: string; shortCode: string };
}

export interface VariantLabelEnumLabels {
  artVariants: Record<string, string>;
  finishes: Record<string, string>;
  cardSizes: Record<string, string>;
}

export interface PrintingVariantLabelParts {
  language: string | null;
  rest: string[];
  otherSide: string | null;
}

export function formatPrintingVariantLabelParts(
  printing: VariantLabelPrinting,
  siblings: readonly VariantLabelPrinting[] | undefined,
  labels: VariantLabelEnumLabels,
): PrintingVariantLabelParts {
  const allSame = (fn: (c: VariantLabelPrinting) => unknown) =>
    siblings ? siblings.every((s) => fn(s) === fn(printing)) : false;

  const language = siblings && !allSame((c) => c.language) ? printing.language : null;
  const rest: string[] = [];
  if (printing.artVariant !== WellKnown.artVariant.NORMAL) {
    rest.push(enumLabel(labels.artVariants, printing.artVariant));
  }
  if (printing.isOvernumbered) {
    rest.push("Overnumbered");
  }
  if (printing.finish !== WellKnown.finish.NORMAL && !allSame((c) => c.finish)) {
    rest.push(enumLabel(labels.finishes, printing.finish));
  }
  // Oversized is always labeled, unlike finish/signed/markers: no allSame() check.
  if (printing.size !== WellKnown.cardSize.STANDARD) {
    rest.push(enumLabel(labels.cardSizes, printing.size));
  }
  if (printing.isSigned && !allSame((c) => c.isSigned)) {
    rest.push("Signed");
  }
  if (printing.markers.length > 0 && !allSame((c) => c.markers.map((m) => m.slug).join("+"))) {
    rest.push(printing.markers.map((m) => m.label).join(" + "));
  }
  return { language, rest, otherSide: otherSideLabel(printing, siblings) };
}

function otherSideLabel(
  printing: VariantLabelPrinting,
  siblings: readonly VariantLabelPrinting[] | undefined,
): string | null {
  const other = printing.otherSide;
  if (!other) {
    return null;
  }
  const nameRepeats = siblings?.some(
    (s) =>
      s.shortCode === printing.shortCode &&
      s.otherSide?.cardName === other.cardName &&
      s.otherSide.shortCode !== other.shortCode,
  );
  return nameRepeats ? `${other.cardName} (${other.shortCode})` : other.cardName;
}

export function formatPrintingVariantLabel(
  printing: VariantLabelPrinting,
  siblings: readonly VariantLabelPrinting[] | undefined,
  labels: VariantLabelEnumLabels,
  withOtherSide: (name: string) => string = (name) => `with ${name}`,
): string {
  const { language, rest, otherSide } = formatPrintingVariantLabelParts(printing, siblings, labels);
  const parts = [...(language ? [`[${language}]`] : []), ...rest];
  if (otherSide) {
    parts.push(withOtherSide(otherSide));
  }
  return parts.length > 0 ? parts.join(" · ") : "Standard";
}

export function printingLabelParts(
  shortCode: string,
  markerSlugs: readonly string[],
  finish: string,
  language?: string | null,
  size?: string | null,
): string[] {
  const parts = [shortCode, markerSlugs.join("+"), finish];
  if (size && size !== WellKnown.cardSize.STANDARD) {
    parts.push(size);
  }
  if (language) {
    parts.unshift(language);
  }
  return parts;
}

export function formatPrintingLabel(
  shortCode: string,
  markerSlugs: readonly string[],
  finish: string,
  language?: string | null,
  size?: string | null,
): string {
  return printingLabelParts(shortCode, markerSlugs, finish, language, size).join(":");
}

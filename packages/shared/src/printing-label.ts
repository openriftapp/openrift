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
  cardId?: string;
  otherSide?: {
    cardName: string;
    shortCode: string;
    cardId?: string;
    finish?: string;
    artVariant?: string;
    isSigned?: boolean;
    isOvernumbered?: boolean;
    markers?: readonly { slug: string; label: string }[];
  };
}

export interface VariantLabelEnumLabels {
  artVariants: Record<string, string>;
  finishes: Record<string, string>;
  cardSizes: Record<string, string>;
  flags?: { overnumbered: string; signed: string };
  onOneSide?: (part: string) => string;
}

export interface PrintingVariantLabelParts {
  language: string | null;
  rest: string[];
  otherSide: string | null;
  otherSideIsSelf: boolean;
}

function otherFaceOf(printing: VariantLabelPrinting): VariantLabelPrinting | undefined {
  const other = printing.otherSide;
  if (other?.finish === undefined) {
    return undefined;
  }
  return {
    ...printing,
    finish: other.finish,
    artVariant: other.artVariant ?? printing.artVariant,
    isSigned: other.isSigned ?? printing.isSigned,
    isOvernumbered: other.isOvernumbered ?? printing.isOvernumbered,
    markers: other.markers ?? printing.markers,
  };
}

export function formatPrintingVariantLabelParts(
  printing: VariantLabelPrinting,
  siblings: readonly VariantLabelPrinting[] | undefined,
  labels: VariantLabelEnumLabels,
): PrintingVariantLabelParts {
  const otherFace = otherFaceOf(printing);
  const allSame = (fn: (c: VariantLabelPrinting) => unknown) =>
    siblings ? siblings.every((s) => fn(s) === fn(printing)) : false;
  const sidesDiffer = (fn: (c: VariantLabelPrinting) => unknown) =>
    otherFace !== undefined && fn(otherFace) !== fn(printing);
  const shown = (fn: (c: VariantLabelPrinting) => unknown) => !allSame(fn) || sidesDiffer(fn);

  const partsOf = (face: VariantLabelPrinting): string[] => {
    const parts: string[] = [];
    if (face.artVariant !== WellKnown.artVariant.NORMAL) {
      parts.push(enumLabel(labels.artVariants, face.artVariant));
    }
    if (face.isOvernumbered) {
      parts.push(labels.flags?.overnumbered ?? "Overnumbered");
    }
    if (face.markers.length > 0 && shown((c) => c.markers.map((m) => m.slug).join("+"))) {
      parts.push(face.markers.map((m) => m.label).join(" + "));
    }
    if (face.finish !== WellKnown.finish.NORMAL && shown((c) => c.finish)) {
      parts.push(enumLabel(labels.finishes, face.finish));
    }
    // Oversized is always labeled, unlike finish/signed/markers: no allSame() check.
    if (face.size !== WellKnown.cardSize.STANDARD) {
      parts.push(enumLabel(labels.cardSizes, face.size));
    }
    if (face.isSigned && shown((c) => c.isSigned)) {
      parts.push(labels.flags?.signed ?? "Signed");
    }
    return parts;
  };

  const own = partsOf(printing);
  const theirs = otherFace ? partsOf(otherFace) : own;
  const onOneSide = labels.onOneSide ?? ((part: string) => `${part} on one side`);
  const rest = [
    ...own.map((part) => (theirs.includes(part) ? part : onOneSide(part))),
    ...theirs.filter((part) => !own.includes(part)).map((part) => onOneSide(part)),
  ];
  const language = siblings && !allSame((c) => c.language) ? printing.language : null;
  const otherSideIsSelf =
    printing.cardId !== undefined && printing.otherSide?.cardId === printing.cardId;
  return { language, rest, otherSide: otherSideLabel(printing, siblings), otherSideIsSelf };
}

export function otherSideLabel(
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
  withOtherSide: (name: string, sameCard: boolean) => string = (name, sameCard) =>
    sameCard ? `${name} on both sides` : `with ${name}`,
): string {
  const { language, rest, otherSide, otherSideIsSelf } = formatPrintingVariantLabelParts(
    printing,
    siblings,
    labels,
  );
  const parts = [...(language ? [`[${language}]`] : []), ...rest];
  if (otherSide) {
    parts.push(withOtherSide(otherSide, otherSideIsSelf));
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

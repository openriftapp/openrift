import { enumLabel } from "./enum-label.js";
import type { LabelMap } from "./enum-label.js";
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
  artVariants: LabelMap;
  finishes: LabelMap;
  cardSizes: LabelMap;
  flags?: { overnumbered: string; signed: string };
  onOneSide?: (part: string) => string;
}

export interface VariantSiblingSummary<ShortCode extends string | undefined = string | undefined> {
  languages: string[];
  rarities: string[];
  finishes: string[];
  markerSlugs: string[][];
  signed: boolean[];
  otherSides: { shortCode: ShortCode; cardName: string; otherShortCode: string }[];
}

export type VariantSiblings = readonly VariantLabelPrinting[] | VariantSiblingSummary;

function markerKey(slugs: readonly string[]): string {
  return slugs.join("+");
}

function slugsOf(markers: readonly { slug: string }[]): string[] {
  return markers.map((marker) => marker.slug);
}

type VariantSiblingFacts = Pick<VariantLabelPrinting, "language" | "finish" | "isSigned"> & {
  rarity?: string;
  shortCode?: string;
  markers: readonly { slug: string }[];
  otherSide?: { cardName: string; shortCode: string };
};

export function summarizeVariantSiblings<Facts extends VariantSiblingFacts>(
  siblings: readonly Facts[],
): VariantSiblingSummary<Facts["shortCode"]> {
  const markerSlugs = new Map<string, string[]>();
  const otherSides = new Map<
    string,
    VariantSiblingSummary<Facts["shortCode"]>["otherSides"][number]
  >();
  for (const sibling of siblings) {
    const slugs = slugsOf(sibling.markers);
    markerSlugs.set(markerKey(slugs), slugs);
    if (sibling.otherSide) {
      const entry = {
        shortCode: sibling.shortCode,
        cardName: sibling.otherSide.cardName,
        otherShortCode: sibling.otherSide.shortCode,
      };
      otherSides.set(JSON.stringify(entry), entry);
    }
  }
  const distinct = <T>(fn: (sibling: (typeof siblings)[number]) => T | undefined): T[] => [
    ...new Set(siblings.flatMap((sibling) => fn(sibling) ?? [])),
  ];
  return {
    languages: distinct((s) => s.language),
    rarities: distinct((s) => s.rarity),
    finishes: distinct((s) => s.finish),
    markerSlugs: [...markerSlugs.values()],
    signed: distinct((s) => s.isSigned),
    otherSides: [...otherSides.values()],
  };
}

export function toVariantSiblingSummary(
  siblings: VariantSiblings | undefined,
): VariantSiblingSummary | undefined {
  if (siblings === undefined || "languages" in siblings) {
    return siblings;
  }
  return summarizeVariantSiblings(siblings);
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
  siblings: VariantSiblings | undefined,
  labels: VariantLabelEnumLabels,
): PrintingVariantLabelParts {
  const summary = toVariantSiblingSummary(siblings);
  const otherFace = otherFaceOf(printing);
  const allSame = <T>(values: readonly T[] | undefined, own: T) =>
    values ? values.every((value) => value === own) : false;
  const sidesDiffer = (fn: (c: VariantLabelPrinting) => unknown) =>
    otherFace !== undefined && fn(otherFace) !== fn(printing);
  const shown = <T>(values: readonly T[] | undefined, fn: (c: VariantLabelPrinting) => T) =>
    !allSame(values, fn(printing)) || sidesDiffer(fn);

  const partsOf = (face: VariantLabelPrinting): string[] => {
    const parts: string[] = [];
    if (face.artVariant !== WellKnown.artVariant.NORMAL) {
      parts.push(enumLabel(labels.artVariants, face.artVariant));
    }
    if (face.isOvernumbered) {
      parts.push(labels.flags?.overnumbered ?? "Overnumbered");
    }
    if (
      face.markers.length > 0 &&
      shown(summary?.markerSlugs.map(markerKey), (c) => markerKey(slugsOf(c.markers)))
    ) {
      parts.push(face.markers.map((m) => m.label).join(" + "));
    }
    if (face.finish !== WellKnown.finish.NORMAL && shown(summary?.finishes, (c) => c.finish)) {
      parts.push(enumLabel(labels.finishes, face.finish));
    }
    // Oversized is always labeled, unlike finish/signed/markers: no allSame() check.
    if (face.size !== WellKnown.cardSize.STANDARD) {
      parts.push(enumLabel(labels.cardSizes, face.size));
    }
    if (face.isSigned && shown(summary?.signed, (c) => c.isSigned)) {
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
  const language =
    summary && !allSame(summary.languages, printing.language) ? printing.language : null;
  const otherSideIsSelf =
    printing.cardId !== undefined && printing.otherSide?.cardId === printing.cardId;
  return { language, rest, otherSide: otherSideLabel(printing, summary), otherSideIsSelf };
}

export function otherSideLabel(
  printing: VariantLabelPrinting,
  siblings: VariantSiblings | undefined,
): string | null {
  const other = printing.otherSide;
  if (!other) {
    return null;
  }
  const nameRepeats = toVariantSiblingSummary(siblings)?.otherSides.some(
    (s) =>
      s.shortCode === printing.shortCode &&
      s.cardName === other.cardName &&
      s.otherShortCode !== other.shortCode,
  );
  return nameRepeats ? `${other.cardName} (${other.shortCode})` : other.cardName;
}

export function printingVariantPartsEnglish(
  printing: VariantLabelPrinting,
  siblings: VariantSiblings | undefined,
  labels: VariantLabelEnumLabels & { languages: LabelMap },
): string[] {
  const { language, rest, otherSide, otherSideIsSelf } = formatPrintingVariantLabelParts(
    printing,
    siblings,
    labels,
  );
  const shownLanguage =
    language ?? (printing.language === WellKnown.language.EN ? null : printing.language);
  const parts = shownLanguage ? [enumLabel(labels.languages, shownLanguage), ...rest] : [...rest];
  if (otherSide) {
    parts.push(otherSideIsSelf ? `${otherSide} on both sides` : `with ${otherSide}`);
  }
  return parts;
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

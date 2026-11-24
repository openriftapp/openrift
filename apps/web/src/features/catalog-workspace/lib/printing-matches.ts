import type {
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

type Candidate = Pick<
  CandidatePrintingResponse,
  | "shortCode"
  | "language"
  | "finish"
  | "artVariant"
  | "rarity"
  | "size"
  | "isSigned"
  | "markerSlugs"
>;

type Existing = Pick<
  AdminPrintingResponse,
  | "id"
  | "shortCode"
  | "language"
  | "finish"
  | "artVariant"
  | "rarity"
  | "size"
  | "isSigned"
  | "markerSlugs"
  | "canonicalRank"
>;

export const MATCH_FIELDS = [
  "finish",
  "artVariant",
  "markerSlugs",
  "rarity",
  "size",
  "isSigned",
] as const;

export type MatchField = (typeof MATCH_FIELDS)[number];

export interface PrintingMatch<P> {
  printing: P;
  differs: MatchField[];
}

export interface PrintingMatches<P> {
  matches: PrintingMatch<P>[];
  sameCodeOtherLanguages: number;
}

function sameMarkers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((slug) => b.includes(slug));
}

function differingFields(candidate: Candidate, printing: Existing): MatchField[] {
  return MATCH_FIELDS.filter((field) => {
    if (field === "markerSlugs") {
      return !sameMarkers(candidate.markerSlugs, printing.markerSlugs);
    }
    const proposed = candidate[field];
    return proposed !== null && proposed !== printing[field];
  });
}

/** Same code and language, closest first. A null source value never counts as a difference. */
export function closestPrintings<P extends Existing>(
  candidate: Candidate,
  printings: readonly P[],
): PrintingMatches<P> {
  const sameCode = printings.filter((printing) => printing.shortCode === candidate.shortCode);
  const matches = sameCode
    .filter((printing) => candidate.language === null || printing.language === candidate.language)
    .map((printing) => ({ printing, differs: differingFields(candidate, printing) }))
    .toSorted(
      (a, b) =>
        a.differs.length - b.differs.length || a.printing.canonicalRank - b.printing.canonicalRank,
    );
  return { matches, sameCodeOtherLanguages: sameCode.length - matches.length };
}

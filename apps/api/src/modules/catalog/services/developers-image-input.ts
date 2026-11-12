import { legendDisplayName } from "@openrift/shared/card-name";
import type {
  CatalogResponse,
  CatalogResponseCardValue,
  CatalogResponsePrintingValue,
} from "@openrift/shared/types/api/catalog";

export interface DevelopersShowcase {
  imageId: string | null;
  name: string;
  energy: number | null;
  tags: string[];
  domains: string[];
  rulesText: string | null;
  publicCode: string;
}

export interface DevelopersImageInput {
  showcase: DevelopersShowcase | null;
  backdropImageIds: string[];
  stats: { cards: number; printings: number; sets: number; languages: number };
  siteHost?: string;
}

// The connector endpoints are placed on this printing's frame layout.
const SHOWCASE_CODE = "OGS-001/024";
const BACKDROP_CODES = ["OGS-007/024", "OGN-197/298"];
const LANGUAGE = "EN";

function firstImageId(printing: CatalogResponsePrintingValue): string | null {
  return printing.images.at(0)?.imageId ?? null;
}

function findByCode(
  printings: CatalogResponsePrintingValue[],
  code: string,
): CatalogResponsePrintingValue | undefined {
  return printings.find((printing) => printing.publicCode === code);
}

function isUnitWithArt(
  printing: CatalogResponsePrintingValue,
  card: CatalogResponseCardValue | undefined,
): boolean {
  return (
    card !== undefined &&
    card.types.includes("unit") &&
    card.energy !== null &&
    firstImageId(printing) !== null
  );
}

export function buildDevelopersImageInput(
  catalog: CatalogResponse,
  siteHost?: string,
): DevelopersImageInput {
  const all = Object.values(catalog.printings);
  const english = all.filter((printing) => printing.language === LANGUAGE);
  const showcasePrinting =
    findByCode(english, SHOWCASE_CODE) ??
    english.find((printing) => isUnitWithArt(printing, catalog.cards[printing.cardId]));
  const card = showcasePrinting ? catalog.cards[showcasePrinting.cardId] : undefined;

  const showcase: DevelopersShowcase | null =
    showcasePrinting && card
      ? {
          imageId: firstImageId(showcasePrinting),
          name: legendDisplayName(card),
          energy: card.energy,
          tags: card.tags,
          domains: card.domains,
          rulesText: showcasePrinting.printedRulesText,
          publicCode: showcasePrinting.publicCode,
        }
      : null;

  const backdropImageIds = BACKDROP_CODES.map((code) => findByCode(english, code))
    .map((printing) => (printing ? firstImageId(printing) : null))
    .filter((id): id is string => id !== null);

  return {
    showcase,
    backdropImageIds,
    stats: {
      cards: Object.keys(catalog.cards).length,
      printings: all.length,
      sets: catalog.sets.length,
      languages: new Set(all.map((printing) => printing.language)).size,
    },
    siteHost,
  };
}

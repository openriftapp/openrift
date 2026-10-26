import type { ProductSuggestion } from "@openrift/shared/marketplace-suggestions";
import {
  productSuggestionKey,
  STRONG_MATCH_THRESHOLD,
} from "@openrift/shared/marketplace-suggestions";
import type {
  AdminMarketplaceName,
  StagedProductResponse,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES, marketplaceCarriesLanguage } from "@openrift/shared/types/pricing";

export interface PrintingAssignment {
  externalId: number;
  finish: string;
  language: string | null;
  printingId: string;
}

export type ListingStrength = "strong" | "weak" | "possible";

interface ListingSuggestion {
  printing: UnifiedMappingPrintingResponse;
  strength: ListingStrength;
}

export interface CardListingRow {
  key: string;
  marketplace: AdminMarketplaceName;
  product: StagedProductResponse;
  isAssigned: boolean;
  assignedPrintings: UnifiedMappingPrintingResponse[];
  suggestion: ListingSuggestion | null;
  assignablePrintings: UnifiedMappingPrintingResponse[];
}

export interface CardListings {
  unassigned: CardListingRow[];
  assigned: CardListingRow[];
  strong: Record<AdminMarketplaceName, PrintingAssignment[]>;
  strongCount: number;
}

function strengthOf(suggestion: ProductSuggestion): ListingStrength {
  if (suggestion.isWeak === true) {
    return "weak";
  }
  return suggestion.score >= STRONG_MATCH_THRESHOLD ? "strong" : "possible";
}

function emptyByMarketplace(): Record<AdminMarketplaceName, PrintingAssignment[]> {
  return { tcgplayer: [], cardmarket: [], cardtrader: [], cardnexus: [] };
}

export function listingAssignment(
  row: Pick<CardListingRow, "product">,
  printingId: string,
): PrintingAssignment {
  return {
    externalId: row.product.externalId,
    finish: row.product.finish,
    language: row.product.language,
    printingId,
  };
}

function sameSku(a: StagedProductResponse, b: StagedProductResponse): boolean {
  return a.externalId === b.externalId && a.finish === b.finish && a.language === b.language;
}

function listingEntries(group: UnifiedMappingGroupResponse) {
  return ALL_MARKETPLACES.flatMap((marketplace) => {
    const { stagedProducts, assignedProducts, assignments = [] } = group[marketplace];
    const products = [...stagedProducts, ...assignedProducts].filter(
      (product, index, all) => all.findIndex((other) => sameSku(other, product)) === index,
    );
    return products.map((product) => ({
      marketplace,
      product,
      isAssigned: assignedProducts.some((assigned) => sameSku(assigned, product)),
      // Cardmarket stores a null assignment language, which matches every language.
      assignedPrintingIds: assignments
        .filter(
          (assignment) =>
            assignment.externalId === product.externalId &&
            assignment.finish === product.finish &&
            (assignment.language === null || assignment.language === product.language),
        )
        .map((assignment) => assignment.printingId),
    }));
  });
}

export function buildCardListings(
  group: UnifiedMappingGroupResponse,
  suggestions: ReadonlyMap<string, ProductSuggestion[]>,
): CardListings {
  const printingById = new Map(group.printings.map((printing) => [printing.printingId, printing]));
  const unassigned: CardListingRow[] = [];
  const assigned: CardListingRow[] = [];
  const strong = emptyByMarketplace();

  for (const entry of listingEntries(group)) {
    const { marketplace, product } = entry;
    const ranked = (
      suggestions.get(
        productSuggestionKey(marketplace, product.externalId, product.finish, product.language),
      ) ?? []
    ).toSorted((a, b) => b.score - a.score);
    const [best] = ranked.filter((suggestion) => printingById.has(suggestion.printingId));
    const row: CardListingRow = {
      key: `${marketplace}:${product.externalId}:${product.finish}:${product.language ?? ""}`,
      marketplace,
      product,
      isAssigned: entry.isAssigned,
      assignedPrintings: entry.assignedPrintingIds
        .map((printingId) => printingById.get(printingId))
        .filter((printing) => printing !== undefined),
      suggestion:
        best === undefined
          ? null
          : {
              printing: printingById.get(best.printingId) as UnifiedMappingPrintingResponse,
              strength: strengthOf(best),
            },
      assignablePrintings: group.printings.filter((printing) =>
        marketplaceCarriesLanguage(marketplace, printing.language),
      ),
    };
    if (entry.isAssigned) {
      assigned.push(row);
      continue;
    }
    unassigned.push(row);
    for (const suggestion of ranked) {
      if (strengthOf(suggestion) === "strong" && printingById.has(suggestion.printingId)) {
        strong[marketplace].push(listingAssignment(row, suggestion.printingId));
      }
    }
  }

  const strongCount = ALL_MARKETPLACES.reduce((sum, mp) => sum + strong[mp].length, 0);
  return { unassigned, assigned, strong, strongCount };
}

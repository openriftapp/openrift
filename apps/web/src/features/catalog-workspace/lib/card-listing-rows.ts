import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import type { ProductSuggestion } from "@openrift/shared/marketplace-suggestions";
import { suggestionStrength } from "@openrift/shared/marketplace-suggestions";
import type {
  AdminMarketplaceName,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import {
  ALL_MARKETPLACES,
  LANGUAGE_KEYED_MARKETPLACES,
  MARKETPLACE_PRINTING_LANGUAGES,
  marketplaceCarriesLanguage,
} from "@openrift/shared/types/pricing";

import type { TableEntry } from "@/features/admin/lib/marketplace-product-entries";
import { collectEntries } from "@/features/admin/lib/marketplace-product-entries";
import type { PrintingAssignment } from "@/features/admin/lib/printing-assignment";
import { emptyAssignmentsByMarketplace } from "@/features/admin/lib/printing-assignment";

type ListingStrength = "strong" | "weak" | "possible";

type RowSuggestion = ProductSuggestion & { printing: UnifiedMappingPrintingResponse };

interface ListingSuggestion {
  printing: UnifiedMappingPrintingResponse;
  strength: ListingStrength;
}

export interface CardListingRow extends TableEntry {
  key: string;
  showProduct: boolean;
  suggestions: RowSuggestion[];
  suggestion: ListingSuggestion | null;
  assignablePrintings: UnifiedMappingPrintingResponse[];
}

export interface CardListings {
  rows: Record<AdminMarketplaceName, CardListingRow[]>;
  unassigned: CardListingRow[];
  assigned: CardListingRow[];
  strong: Record<AdminMarketplaceName, PrintingAssignment[]>;
  weak: Record<AdminMarketplaceName, PrintingAssignment[]>;
  strongCount: number;
  weakCount: number;
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

function spansLanguages(marketplace: AdminMarketplaceName): boolean {
  return (
    MARKETPLACE_PRINTING_LANGUAGES[marketplace] === null &&
    !LANGUAGE_KEYED_MARKETPLACES.has(marketplace)
  );
}

function countAssignments(byMarketplace: Record<AdminMarketplaceName, PrintingAssignment[]>) {
  return ALL_MARKETPLACES.reduce((sum, marketplace) => sum + byMarketplace[marketplace].length, 0);
}

function listingRow(
  entry: TableEntry,
  showProduct: boolean,
  group: UnifiedMappingGroupResponse,
  printingById: ReadonlyMap<string, UnifiedMappingPrintingResponse>,
  suggestions: ReadonlyMap<string, ProductSuggestion[]>,
): CardListingRow {
  const { marketplace, product } = entry;
  const key = marketplaceSkuKey(marketplace, product.externalId, product.finish, product.language);
  const rowSuggestions = (suggestions.get(key) ?? []).flatMap((suggestion) => {
    const printing = printingById.get(suggestion.printingId);
    return printing === undefined ? [] : [{ ...suggestion, printing }];
  });
  const [best] = rowSuggestions.toSorted((a, b) => b.score - a.score);
  return {
    ...entry,
    key,
    showProduct,
    suggestions: rowSuggestions,
    suggestion:
      best === undefined ? null : { printing: best.printing, strength: suggestionStrength(best) },
    assignablePrintings: group.printings.filter((printing) =>
      marketplaceCarriesLanguage(marketplace, printing.language),
    ),
  };
}

export function buildCardListings(
  group: UnifiedMappingGroupResponse,
  suggestions: ReadonlyMap<string, ProductSuggestion[]>,
): CardListings {
  const printingById = new Map(group.printings.map((printing) => [printing.printingId, printing]));
  const entries = collectEntries(group);
  const strong = emptyAssignmentsByMarketplace();
  const weak = emptyAssignmentsByMarketplace();
  const rows = Object.fromEntries(
    ALL_MARKETPLACES.map((marketplace) => {
      const byProduct = Map.groupBy(
        entries.filter((entry) => entry.marketplace === marketplace),
        (entry) => entry.product.externalId,
      );
      const marketplaceRows = [...byProduct.values()].flatMap((variants) =>
        variants.map((entry, index) =>
          listingRow(entry, index === 0, group, printingById, suggestions),
        ),
      );
      return [marketplace, marketplaceRows];
    }),
  ) as Record<AdminMarketplaceName, CardListingRow[]>;

  const all = ALL_MARKETPLACES.flatMap((marketplace) => rows[marketplace]);
  for (const row of all) {
    if (row.isAssigned) {
      continue;
    }
    const [best, runnerUp] = row.suggestions.toSorted((a, b) => b.score - a.score);
    const tied = best !== undefined && runnerUp !== undefined && runnerUp.score === best.score;
    const candidates = spansLanguages(row.marketplace)
      ? row.suggestions
      : best === undefined || tied
        ? []
        : [best];
    for (const suggestion of candidates) {
      const strength = suggestionStrength(suggestion);
      if (strength !== "possible") {
        (strength === "strong" ? strong : weak)[row.marketplace].push(
          listingAssignment(row, suggestion.printingId),
        );
      }
    }
  }

  return {
    rows,
    unassigned: all.filter((row) => !row.isAssigned),
    assigned: all.filter((row) => row.isAssigned),
    strong,
    weak,
    strongCount: countAssignments(strong),
    weakCount: countAssignments(weak),
  };
}

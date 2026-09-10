import type {
  AdminMarketplaceName,
  StagedProductResponse,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { marketplaceCarriesLanguage } from "@openrift/shared/types/pricing";
import { normalizeNameForIdentity } from "@openrift/shared/utils";
import { marketplaceFinish } from "@openrift/shared/well-known";

import { CATALOG_MARKETPLACES } from "@/features/catalog-admin/lib/marketplace-coverage-line";

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export type SuggestionStrength = "strong" | "weak";

export interface ScoredSuggestion {
  printingId: string;
  score: number;
  isWeak?: boolean;
}

export type SuggestionLookup = (
  marketplace: AdminMarketplaceName,
  externalId: number,
  finish: string,
  language: string | null,
) => readonly ScoredSuggestion[];

export function suggestionStrength(
  suggestion: ScoredSuggestion,
  strongScore: number,
): SuggestionStrength {
  if (suggestion.isWeak === true) {
    return "weak";
  }
  return suggestion.score >= strongScore ? "strong" : "weak";
}

/** Cardmarket's price guide is language-aggregate: its rows carry a placeholder "EN". */
export function displayedProductLanguage(
  marketplace: AdminMarketplaceName,
  language: string | null,
): string | null {
  if (marketplace === "cardmarket") {
    return null;
  }
  return language === "" ? null : language;
}

export function isCardNameMismatch(productName: string, cardName: string): boolean {
  const card = normalizeNameForIdentity(cardName);
  if (card.length === 0) {
    return false;
  }
  return normalizeNameForIdentity(productName) !== card;
}

export interface VariantPrinting {
  printingId: string;
  shortCode: string;
  language: string;
  finish: string;
  markerSlugs: string[];
  size: string;
}

export interface VariantSuggestion extends VariantPrinting {
  strength: SuggestionStrength;
}

export interface MarketplaceVariantRow {
  key: string;
  marketplace: AdminMarketplaceName;
  externalId: number;
  finish: string;
  language: string | null;
  displayLanguage: string | null;
  priceCents: number | null;
  currency: string;
  recordedAt: string;
  isStale: boolean;
  isAssigned: boolean;
  isOverride: boolean;
  linked: VariantPrinting[];
  linkedPrintingIds: Set<string>;
  otherAssignedPrintingIds: Set<string>;
  suggestions: VariantSuggestion[];
  unlinkedReason: string | null;
}

export interface MarketplaceProductGroup {
  key: string;
  marketplace: AdminMarketplaceName;
  externalId: number;
  productName: string;
  groupName: string | null;
  nameMismatch: boolean;
  variants: MarketplaceVariantRow[];
}

export interface PrintingAssignment {
  marketplace: AdminMarketplaceName;
  externalId: number;
  finish: string;
  language: string | null;
  printingId: string;
}

function variantKey(
  marketplace: AdminMarketplaceName,
  externalId: number,
  finish: string,
  language: string | null,
): string {
  return `${marketplace}::${externalId}::${finish}::${language ?? ""}`;
}

function toVariantPrinting(printing: UnifiedMappingPrintingResponse): VariantPrinting {
  return {
    printingId: printing.printingId,
    shortCode: printing.shortCode,
    language: printing.language,
    finish: printing.finish,
    markerSlugs: printing.markerSlugs,
    size: printing.size,
  };
}

function unlinkedReason(
  group: UnifiedMappingGroupResponse,
  marketplace: AdminMarketplaceName,
  product: StagedProductResponse,
): string {
  const sellable = group.printings.filter((printing) =>
    marketplaceCarriesLanguage(marketplace, printing.language),
  );
  if (sellable.length === 0) {
    return "This marketplace does not carry any of the card's languages";
  }
  const finish = product.finish.toLowerCase();
  if (!sellable.some((printing) => marketplaceFinish(printing.finish.toLowerCase()) === finish)) {
    return "No printing has this finish";
  }
  return "No confident match";
}

export function buildMarketplaceProductGroups(
  group: UnifiedMappingGroupResponse,
  lookupSuggestions: SuggestionLookup,
  strongScore: number,
): MarketplaceProductGroup[] {
  const printingById = new Map(group.printings.map((printing) => [printing.printingId, printing]));
  const groups: MarketplaceProductGroup[] = [];

  for (const marketplace of CATALOG_MARKETPLACES) {
    const { stagedProducts, assignedProducts, assignments } = group[marketplace];
    const seen = new Set<string>();
    const byProduct = new Map<number, MarketplaceProductGroup>();

    for (const product of [...stagedProducts, ...assignedProducts]) {
      const key = variantKey(marketplace, product.externalId, product.finish, product.language);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const isAssigned = assignedProducts.some(
        (assigned) =>
          assigned.externalId === product.externalId &&
          assigned.finish === product.finish &&
          assigned.language === product.language,
      );

      // Cardmarket stores `null` for the assignment language, so a null
      // assignment matches every row's language.
      const linked = assignments
        .filter(
          (assignment) =>
            assignment.externalId === product.externalId &&
            assignment.finish === product.finish &&
            (assignment.language === null || assignment.language === product.language),
        )
        .map((assignment) => printingById.get(assignment.printingId))
        .filter((printing) => printing !== undefined)
        .map((printing) => toVariantPrinting(printing))
        .toSorted((a, b) => a.shortCode.localeCompare(b.shortCode));

      const offersSuggestions = linked.length === 0 && !isAssigned;
      const suggestions = offersSuggestions
        ? lookupSuggestions(
            marketplace,
            product.externalId,
            product.finish,
            product.language,
          ).flatMap((suggestion) => {
            const printing = printingById.get(suggestion.printingId);
            return printing
              ? [
                  {
                    ...toVariantPrinting(printing),
                    strength: suggestionStrength(suggestion, strongScore),
                  },
                ]
              : [];
          })
        : [];

      const priceCents = product.marketCents ?? product.lowCents;
      const row: MarketplaceVariantRow = {
        key,
        marketplace,
        externalId: product.externalId,
        finish: product.finish,
        language: product.language,
        displayLanguage: displayedProductLanguage(marketplace, product.language),
        priceCents: priceCents !== null && priceCents > 0 ? priceCents : null,
        currency: product.currency,
        recordedAt: product.recordedAt,
        isStale: Date.now() - new Date(product.recordedAt).getTime() > STALE_AFTER_MS,
        isAssigned,
        isOverride: product.isOverride === true,
        linked,
        linkedPrintingIds: new Set(linked.map((printing) => printing.printingId)),
        otherAssignedPrintingIds: new Set(
          assignments
            .filter((assignment) => assignment.externalId !== product.externalId)
            .map((assignment) => assignment.printingId),
        ),
        suggestions,
        unlinkedReason:
          linked.length > 0 || suggestions.length > 0
            ? null
            : unlinkedReason(group, marketplace, product),
      };

      const existing = byProduct.get(product.externalId);
      if (existing) {
        existing.variants.push(row);
        continue;
      }
      const created: MarketplaceProductGroup = {
        key: `${marketplace}::${product.externalId}`,
        marketplace,
        externalId: product.externalId,
        productName: product.productName,
        groupName: product.groupName ?? null,
        nameMismatch: isCardNameMismatch(product.productName, group.cardName),
        variants: [row],
      };
      byProduct.set(product.externalId, created);
      groups.push(created);
    }
  }

  for (const productGroup of groups) {
    productGroup.variants.sort(
      (a, b) =>
        (a.language ?? "").localeCompare(b.language ?? "") || a.finish.localeCompare(b.finish),
    );
  }
  return groups;
}

function assignmentsOfStrength(
  groups: readonly MarketplaceProductGroup[],
  strength: SuggestionStrength,
): PrintingAssignment[] {
  const out: PrintingAssignment[] = [];
  for (const group of groups) {
    for (const variant of group.variants) {
      for (const suggestion of variant.suggestions) {
        if (suggestion.strength !== strength) {
          continue;
        }
        out.push({
          marketplace: variant.marketplace,
          externalId: variant.externalId,
          finish: variant.finish,
          language: variant.language,
          printingId: suggestion.printingId,
        });
      }
    }
  }
  return out;
}

export function strongAssignments(
  groups: readonly MarketplaceProductGroup[],
): PrintingAssignment[] {
  return assignmentsOfStrength(groups, "strong");
}

export function weakAssignments(groups: readonly MarketplaceProductGroup[]): PrintingAssignment[] {
  return assignmentsOfStrength(groups, "weak");
}

export interface AcceptableAssignments {
  strength: SuggestionStrength;
  assignments: PrintingAssignment[];
}

export function acceptableAssignments(
  groups: readonly MarketplaceProductGroup[],
): AcceptableAssignments {
  const strong = strongAssignments(groups);
  if (strong.length > 0) {
    return { strength: "strong", assignments: strong };
  }
  return { strength: "weak", assignments: weakAssignments(groups) };
}

export interface SuggestionCounts {
  strong: number;
  weak: number;
  total: number;
}

export function suggestionCounts(groups: readonly MarketplaceProductGroup[]): SuggestionCounts {
  let strong = 0;
  let weak = 0;
  for (const group of groups) {
    for (const variant of group.variants) {
      for (const suggestion of variant.suggestions) {
        if (suggestion.strength === "strong") {
          strong += 1;
        } else {
          weak += 1;
        }
      }
    }
  }
  return { strong, weak, total: strong + weak };
}

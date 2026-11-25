import { skuKey } from "@openrift/shared/marketplace-sku-key";
import { formatPrintingLabel } from "@openrift/shared/printing-label";
import type {
  AdminMarketplaceName,
  StagedProductResponse,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";

import type { PrintingAssignment } from "@/features/admin/lib/printing-assignment";

export interface MarketplaceHandlers {
  onIgnoreVariant: (externalId: number, finish: string, language: string | null) => void;
  onIgnoreProduct: (externalId: number) => void;
  onAssignToCard: (
    externalId: number,
    finish: string,
    language: string | null,
    cardId: string,
  ) => void;
  onAssignToPrinting: (
    externalId: number,
    finish: string,
    language: string | null,
    printingId: string,
  ) => Promise<unknown>;
  onBatchAssignToPrintings: (mappings: PrintingAssignment[]) => void;
  onUnassign: (externalId: number, finish: string, language: string | null) => void;
  onUnmapPrinting: (
    printingId: string,
    externalId: number,
    finish: string,
    language: string | null,
  ) => void;
  isIgnoring: boolean;
  isAssigning: boolean;
  isAssigningToPrinting: boolean;
  isUnassigning: boolean;
  isUnmappingPrinting: boolean;
}

export interface TableEntry {
  marketplace: AdminMarketplaceName;
  product: StagedProductResponse;
  isAssigned: boolean;
  assignedPrintings: UnifiedMappingPrintingResponse[];
  assignedPrintingIds: Set<string>;
  otherAssignedPrintingIds: Set<string>;
}

export function setPrefix(shortCode: string): string {
  const dash = shortCode.indexOf("-");
  return dash === -1 ? shortCode : shortCode.slice(0, dash);
}

/**
 * Cardmarket's price guide is language-aggregate: every CM staging row carries a
 * placeholder "EN" regardless of the card's real language, so it renders as a dash.
 */
export function displayedProductLanguage(
  marketplace: AdminMarketplaceName,
  language: string | null,
): string | null {
  if (marketplace === "cardmarket") {
    return null;
  }
  return language || null;
}

export function collectEntries(group: UnifiedMappingGroupResponse): TableEntry[] {
  const printingById = new Map(group.printings.map((p) => [p.printingId, p]));
  const entries: TableEntry[] = [];
  for (const marketplace of ALL_MARKETPLACES) {
    const { stagedProducts, assignedProducts, assignments = [] } = group[marketplace];
    const seen = new Set<string>();
    for (const product of [...stagedProducts, ...assignedProducts]) {
      const dedupeKey = skuKey(product.externalId, product.finish, product.language);
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      const isAssigned = assignedProducts.some(
        (ap) =>
          ap.externalId === product.externalId &&
          ap.finish === product.finish &&
          ap.language === product.language,
      );
      // Cardmarket stores `null` for the assignment language, so a null
      // assignment matches every row's language.
      const matchingPrintings = assignments
        .filter(
          (a) =>
            a.externalId === product.externalId &&
            a.finish === product.finish &&
            (a.language === null || a.language === product.language),
        )
        .map((a) => a.printingId)
        .filter((id, index, ids) => ids.indexOf(id) === index)
        .map((id) => printingById.get(id))
        .filter((p): p is UnifiedMappingPrintingResponse => p !== undefined);
      const assignedPrintings = matchingPrintings.toSorted((a, b) =>
        formatPrintingLabel(a.shortCode, a.markerSlugs, a.finish, a.language, a.size).localeCompare(
          formatPrintingLabel(b.shortCode, b.markerSlugs, b.finish, b.language, b.size),
        ),
      );
      const assignedPrintingIds = new Set(matchingPrintings.map((p) => p.printingId));
      const otherAssignedPrintingIds = new Set(
        assignments.filter((a) => a.externalId !== product.externalId).map((a) => a.printingId),
      );
      entries.push({
        marketplace,
        product,
        isAssigned,
        assignedPrintings,
        assignedPrintingIds,
        otherAssignedPrintingIds,
      });
    }
  }
  entries.sort((a, b) => {
    if (a.marketplace !== b.marketplace) {
      return a.marketplace.localeCompare(b.marketplace);
    }
    return (
      (a.product.language ?? "").localeCompare(b.product.language ?? "") ||
      (a.product.groupName ?? "").localeCompare(b.product.groupName ?? "") ||
      b.product.finish.localeCompare(a.product.finish) ||
      a.product.externalId - b.product.externalId
    );
  });
  return entries;
}

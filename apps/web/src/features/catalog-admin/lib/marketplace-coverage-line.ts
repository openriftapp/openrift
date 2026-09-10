import { marketplaceLabel } from "@openrift/shared/marketplace";
import type {
  AdminMarketplaceName,
  UnifiedMappingGroupResponse,
} from "@openrift/shared/types/api/admin";

import { computeCardCoverage } from "@/features/cards/lib/marketplace-coverage";

export const CATALOG_MARKETPLACES = [
  "tcgplayer",
  "cardmarket",
  "cardtrader",
] as const satisfies readonly AdminMarketplaceName[];

export interface CoverageLine {
  marketplace: AdminMarketplaceName;
  label: string;
  linked: number;
  total: number;
}

export function buildCoverageLines(group: UnifiedMappingGroupResponse): CoverageLine[] {
  const coverage = computeCardCoverage(group);
  return CATALOG_MARKETPLACES.filter(
    (marketplace) => coverage[marketplace].printings.total > 0,
  ).map((marketplace) => ({
    marketplace,
    label: marketplaceLabel(marketplace),
    linked: coverage[marketplace].printings.mapped,
    total: coverage[marketplace].printings.total,
  }));
}

export function coverageSentence(lines: readonly CoverageLine[], suggestions: number): string {
  const parts = lines.map(
    (line, index) =>
      `${line.label} ${line.linked} of ${line.total}${index === 0 ? " printings" : ""} linked`,
  );
  if (suggestions > 0) {
    parts.push(`${suggestions} suggestion${suggestions === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Nothing on sale for this card yet";
}

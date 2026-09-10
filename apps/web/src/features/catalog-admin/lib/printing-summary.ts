import { enumLabel } from "@openrift/shared/enum-label";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import type {
  AdminPrintingMarketplaceMappingResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";

export interface PrintingKindLabels {
  artVariants: Record<string, string>;
  markers: Record<string, string>;
}

type KindPrinting = Pick<
  AdminPrintingResponse,
  "isSigned" | "isOvernumbered" | "markerSlugs" | "artVariant"
>;

export function printingKindLabel(printing: KindPrinting, labels: PrintingKindLabels): string {
  const parts: string[] = [];
  if (printing.isSigned && printing.isOvernumbered) {
    parts.push("Signature");
  } else if (printing.isSigned) {
    parts.push("Signed");
  } else if (printing.isOvernumbered) {
    parts.push("Overnumbered");
  }
  if (printing.artVariant !== WellKnown.artVariant.NORMAL) {
    parts.push(enumLabel(labels.artVariants, printing.artVariant));
  }
  for (const slug of printing.markerSlugs) {
    parts.push(enumLabel(labels.markers, slug));
  }
  return parts.length > 0 ? parts.join(" · ") : "Base";
}

export function printingSetLine(
  printing: Pick<AdminPrintingResponse, "setName" | "setSlug" | "rarity" | "finish">,
  labels: { rarities: Record<string, string>; finishes: Record<string, string> },
): string {
  return [
    printing.setName ?? printing.setSlug,
    enumLabel(labels.rarities, printing.rarity),
    enumLabel(labels.finishes, printing.finish),
  ].join(" · ");
}

export function soldOnSummary(
  printingId: string,
  mappings: readonly AdminPrintingMarketplaceMappingResponse[],
): string {
  const marketplaces = new Set(
    mappings
      .filter((mapping) => mapping.targetPrintingId === printingId)
      .map((mapping) => mapping.marketplace),
  );
  if (marketplaces.size === 0) {
    return "Not linked to any marketplace";
  }
  return `Sold on ${[...marketplaces]
    .map((marketplace) => marketplaceLabel(marketplace))
    .toSorted()
    .join(" · ")}`;
}

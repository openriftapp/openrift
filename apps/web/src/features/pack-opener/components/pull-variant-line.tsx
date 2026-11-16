import { CatalogPrintingVariantLine } from "@/features/cards/components/printing-row";
import { useCards } from "@/features/cards/hooks/use-cards";
import type { PackPrinting } from "@/features/pack-opener/lib/pack-types";

export function PullVariantLine({
  printing,
  className,
}: {
  printing: PackPrinting;
  className?: string;
}) {
  const { printingsBySideKey } = useCards();
  const full = printingsBySideKey[printing.id];
  return full ? (
    <CatalogPrintingVariantLine printing={full} className={className} />
  ) : (
    <span className={className}>{printing.shortCode}</span>
  );
}

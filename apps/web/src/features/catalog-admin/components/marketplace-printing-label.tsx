import { WellKnown } from "@openrift/shared/well-known";

import type { VariantPrinting } from "@/features/catalog-admin/lib/marketplace-product-groups";
import { cn } from "@/lib/utils";

const MATCH = "underline decoration-2 underline-offset-2";

export function MarketplacePrintingLabel({
  printing,
  highlightFinish,
  highlightLanguage,
  highlightMarkers,
}: {
  printing: VariantPrinting;
  highlightFinish?: string;
  highlightLanguage?: string | null;
  highlightMarkers?: boolean;
}) {
  const languageMatches =
    highlightLanguage !== null &&
    highlightLanguage !== undefined &&
    printing.language === highlightLanguage;
  const finishMatches = highlightFinish !== undefined && printing.finish === highlightFinish;
  return (
    <span>
      <span className={cn(languageMatches && MATCH)}>{printing.language}</span>:{printing.shortCode}
      {printing.markerSlugs.length > 0 && (
        <>
          :<span className={cn(highlightMarkers && MATCH)}>{printing.markerSlugs.join("+")}</span>
        </>
      )}
      :<span className={cn(finishMatches && MATCH)}>{printing.finish}</span>
      {printing.size !== WellKnown.cardSize.STANDARD && (
        <span className="text-warning">:{printing.size}</span>
      )}
    </span>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { MarketplacePrintingLabel } from "@/features/catalog-admin/components/marketplace-printing-label";
import type { MarketplaceActions } from "@/features/catalog-admin/hooks/use-marketplace-actions";
import type { MarketplaceVariantRow } from "@/features/catalog-admin/lib/marketplace-product-groups";

export function MarketplaceLinkCell({
  variant,
  actions,
  onAssign,
}: {
  variant: MarketplaceVariantRow;
  actions: MarketplaceActions;
  onAssign: (printingId: string) => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {variant.linked.map((printing) => (
        <Badge key={printing.printingId} variant="success" className="gap-1 pr-1">
          <MarketplacePrintingLabel
            printing={printing}
            highlightFinish={variant.finish}
            highlightLanguage={variant.displayLanguage}
          />
          <ChipRemoveButton
            aria-label={`Unlink ${printing.shortCode}`}
            disabled={actions.isPending}
            className="text-muted-foreground hover:text-destructive -mr-0.5 disabled:opacity-50"
            onClick={() =>
              actions.unlink(
                variant.marketplace,
                printing.printingId,
                variant.externalId,
                variant.finish,
                variant.language,
              )
            }
          />
        </Badge>
      ))}

      {variant.suggestions.map((suggestion) => (
        <span key={suggestion.printingId} className="flex items-center gap-1">
          <Badge variant="outline" className="border-dashed">
            <MarketplacePrintingLabel
              printing={suggestion}
              highlightFinish={variant.finish}
              highlightLanguage={variant.displayLanguage}
            />
            <span className="text-muted-foreground">· {suggestion.strength}</span>
          </Badge>
          <Button
            size="xs"
            variant="outline"
            disabled={actions.isPending}
            onClick={() => onAssign(suggestion.printingId)}
          >
            Accept
          </Button>
        </span>
      ))}

      {variant.unlinkedReason !== null && (
        <span className="text-muted-foreground text-sm">Not linked. {variant.unlinkedReason}.</span>
      )}
    </span>
  );
}

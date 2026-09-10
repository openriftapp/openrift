import type { UnifiedMappingPrintingResponse } from "@openrift/shared/types/api/admin";
import { CheckIcon, ChevronDownIcon, LinkIcon } from "lucide-react";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarketplacePrintingLabel } from "@/features/catalog-admin/components/marketplace-printing-label";
import type { MarketplaceVariantRow } from "@/features/catalog-admin/lib/marketplace-product-groups";
import { cn } from "@/lib/utils";

function setPrefix(shortCode: string): string {
  const dash = shortCode.indexOf("-");
  return dash === -1 ? shortCode : shortCode.slice(0, dash);
}

export function MarketplaceAssignMenu({
  printings,
  variant,
  label,
  disabled,
  onAssign,
}: {
  printings: readonly UnifiedMappingPrintingResponse[];
  variant: MarketplaceVariantRow;
  label: string;
  disabled: boolean;
  onAssign: (printingId: string) => void;
}) {
  const sorted = printings.toSorted(
    (a, b) =>
      a.language.localeCompare(b.language) ||
      a.shortCode.localeCompare(b.shortCode) ||
      (a.markerSlugs.length === 0 ? 0 : 1) - (b.markerSlugs.length === 0 ? 0 : 1) ||
      a.markerSlugs.join("+").localeCompare(b.markerSlugs.join("+")) ||
      a.finish.localeCompare(b.finish),
  );
  if (sorted.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="xs" disabled={disabled}>
            <LinkIcon />
            {label}
            <ChevronDownIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {sorted.map((printing, index) => {
          const isLinked = variant.linkedPrintingIds.has(printing.printingId);
          const elsewhere = !isLinked && variant.otherAssignedPrintingIds.has(printing.printingId);
          const previous = sorted[index - 1] ?? null;
          const needsSeparator =
            previous !== null &&
            (previous.language !== printing.language ||
              setPrefix(previous.shortCode) !== setPrefix(printing.shortCode));
          return (
            <Fragment key={printing.printingId}>
              {needsSeparator && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={disabled}
                onClick={() => onAssign(printing.printingId)}
                title={elsewhere ? "Already linked to another product" : undefined}
                className={cn(elsewhere && "text-muted-foreground/60")}
              >
                {isLinked ? (
                  <CheckIcon className="text-success size-3.5" />
                ) : (
                  <span aria-hidden className="inline-block size-3.5" />
                )}
                <MarketplacePrintingLabel
                  printing={{
                    printingId: printing.printingId,
                    shortCode: printing.shortCode,
                    language: printing.language,
                    finish: printing.finish,
                    markerSlugs: printing.markerSlugs,
                    size: printing.size,
                  }}
                  highlightFinish={variant.finish}
                  highlightLanguage={variant.displayLanguage}
                />
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

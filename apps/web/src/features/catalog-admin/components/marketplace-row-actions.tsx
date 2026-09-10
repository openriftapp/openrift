import type { UnifiedMappingPrintingResponse } from "@openrift/shared/types/api/admin";
import { BanIcon, EllipsisVerticalIcon, LinkIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarketplaceAssignMenu } from "@/features/catalog-admin/components/marketplace-assign-menu";
import type { MarketplaceActions } from "@/features/catalog-admin/hooks/use-marketplace-actions";
import type { MarketplaceVariantRow } from "@/features/catalog-admin/lib/marketplace-product-groups";

export function MarketplaceRowActions({
  variant,
  assignable,
  actions,
  onAssign,
  onReassignToCard,
  reassigning,
}: {
  variant: MarketplaceVariantRow;
  assignable: readonly UnifiedMappingPrintingResponse[];
  actions: MarketplaceActions;
  onAssign: (printingId: string) => void;
  onReassignToCard: () => void;
  reassigning: boolean;
}) {
  const canIgnore = !variant.isAssigned;
  const canReassign = !variant.isAssigned && !variant.isOverride;

  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <MarketplaceAssignMenu
        printings={assignable}
        variant={variant}
        label={variant.linked.length > 0 ? "Change" : "Link"}
        disabled={actions.isPending}
        onAssign={onAssign}
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="More actions">
              <EllipsisVerticalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {canIgnore && (
            <>
              <DropdownMenuItem
                disabled={actions.isPending}
                onClick={() =>
                  actions.ignoreVariant(
                    variant.marketplace,
                    variant.externalId,
                    variant.finish,
                    variant.language,
                  )
                }
              >
                <BanIcon className="size-3.5" />
                Ignore this variant
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={actions.isPending}
                onClick={() => actions.ignoreProduct(variant.marketplace, variant.externalId)}
              >
                <BanIcon className="size-3.5" />
                Ignore the whole product
              </DropdownMenuItem>
            </>
          )}
          {canReassign && (
            <DropdownMenuItem onClick={onReassignToCard}>
              {reassigning ? <XIcon className="size-3.5" /> : <LinkIcon className="size-3.5" />}
              {reassigning ? "Cancel move" : "Move to another card"}
            </DropdownMenuItem>
          )}
          {variant.isOverride && (
            <DropdownMenuItem
              disabled={actions.isPending}
              onClick={() =>
                actions.unassignFromCard(
                  variant.marketplace,
                  variant.externalId,
                  variant.finish,
                  variant.language,
                )
              }
            >
              <XIcon className="size-3.5" />
              Take off this card
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

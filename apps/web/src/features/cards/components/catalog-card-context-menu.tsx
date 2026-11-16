import type { Printing } from "@openrift/shared/types/catalog";
import { HeartPlusIcon, PackagePlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ContextMenuSeparator } from "@/components/ui/context-menu";
import { CardContextMenu, CardMenuItem } from "@/features/cards/components/card-context-menu";
import { CardPageLinkItems } from "@/features/cards/components/card-page-link-items";
import {
  dispatchAddToWishlist,
  dispatchIncrement,
} from "@/features/cards/stores/card-row-actions-store";
import { m } from "@/paraglide/messages.js";

interface CatalogCardContextMenuProps {
  printing: Printing;
  canWish: boolean;
  addTargetName?: string;
  children?: ReactNode;
}

export function CatalogCardContextMenu({
  printing,
  canWish,
  addTargetName,
  children,
}: CatalogCardContextMenuProps) {
  return (
    <CardContextMenu
      menu={
        <>
          {addTargetName !== undefined && (
            <CardMenuItem icon={PackagePlusIcon} onSelect={() => dispatchIncrement(printing)}>
              {m.cards_context_add_to({ target: addTargetName })}
            </CardMenuItem>
          )}
          {canWish && (
            <CardMenuItem icon={HeartPlusIcon} onSelect={() => dispatchAddToWishlist(printing)}>
              {m.cards_context_add_to_wishlist()}
            </CardMenuItem>
          )}
          {(addTargetName !== undefined || canWish) && <ContextMenuSeparator />}
          <CardPageLinkItems printing={printing} />
        </>
      }
    >
      {children}
    </CardContextMenu>
  );
}

import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, HeartPlusIcon, PackagePlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ContextMenuSeparator } from "@/components/ui/context-menu";
import { CardContextMenu, CardMenuItem } from "@/features/cards/components/card-context-menu";
import {
  dispatchAddToWishlist,
  dispatchIncrement,
} from "@/features/cards/stores/card-row-actions-store";
import { m } from "@/paraglide/messages.js";

interface CatalogCardContextMenuProps {
  printing: Printing;
  canAdd: boolean;
  canWish: boolean;
  addTargetName: string;
  children?: ReactNode;
}

export function CatalogCardContextMenu({
  printing,
  canAdd,
  canWish,
  addTargetName,
  children,
}: CatalogCardContextMenuProps) {
  return (
    <CardContextMenu
      menu={
        <>
          {canAdd && (
            <CardMenuItem icon={PackagePlusIcon} onSelect={() => dispatchIncrement(printing)}>
              {m.cards_context_add_to({ target: addTargetName })}
            </CardMenuItem>
          )}
          {canWish && (
            <CardMenuItem icon={HeartPlusIcon} onSelect={() => dispatchAddToWishlist(printing)}>
              {m.cards_context_add_to_wishlist()}
            </CardMenuItem>
          )}
          {(canAdd || canWish) && <ContextMenuSeparator />}
          <CardMenuItem
            icon={ExternalLinkIcon}
            render={
              <Link
                to="/cards/$cardSlug/{-$printingSlug}"
                params={{ cardSlug: printing.card.slug }}
              />
            }
          >
            {m.cards_context_open_card_page()}
          </CardMenuItem>
        </>
      }
    >
      {children}
    </CardContextMenu>
  );
}

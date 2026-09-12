import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, HeartPlusIcon, PackagePlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
    <ContextMenu>
      <ContextMenuTrigger
        className="block select-none [-webkit-touch-callout:none]"
        render={<div />}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {canAdd && (
          <ContextMenuItem
            onClick={(event) => {
              event.stopPropagation();
              dispatchIncrement(printing);
            }}
          >
            <PackagePlusIcon />
            {m.cards_context_add_to({ target: addTargetName })}
          </ContextMenuItem>
        )}
        {canWish && (
          <ContextMenuItem
            onClick={(event) => {
              event.stopPropagation();
              dispatchAddToWishlist(printing);
            }}
          >
            <HeartPlusIcon />
            {m.cards_context_add_to_wishlist()}
          </ContextMenuItem>
        )}
        {(canAdd || canWish) && <ContextMenuSeparator />}
        <ContextMenuItem
          render={
            <Link
              to="/cards/$cardSlug/{-$printingSlug}"
              params={{ cardSlug: printing.card.slug }}
            />
          }
        >
          <ExternalLinkIcon />
          {m.cards_context_open_card_page()}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

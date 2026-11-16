import type { Printing } from "@openrift/shared/types/catalog";
import {
  BookOpenIcon,
  HandHeartIcon,
  HeartPlusIcon,
  HandIcon,
  ListPlusIcon,
  NotebookPenIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import { ContextMenuSeparator } from "@/components/ui/context-menu";
import { CardContextMenu, CardMenuItem } from "@/features/cards/components/card-context-menu";
import { CardPageLinkItems } from "@/features/cards/components/card-page-link-items";
import {
  dispatchAddToWishlist,
  dispatchContextAction,
  dispatchTake,
} from "@/features/cards/stores/card-row-actions-store";
import { m } from "@/paraglide/messages.js";

interface CollectionCardContextMenuProps {
  itemId: string;
  printing: Printing;
  canTake?: boolean;
  takeAllCount?: number;
  stacked?: boolean;
  canLend?: boolean;
  children?: ReactNode;
}

/**
 * Right-click / long-press menu on an owned collection card. Each copy action
 * dispatches to the grid, which targets the current multi-selection when this
 * card belongs to it and otherwise selects just this card before acting.
 */
export function CollectionCardContextMenu({
  itemId,
  printing,
  canTake,
  takeAllCount,
  stacked = true,
  canLend,
  children,
}: CollectionCardContextMenuProps) {
  return (
    <CardContextMenu
      menu={
        <>
          {canTake && (
            <>
              <CardMenuItem icon={HandIcon} onSelect={() => dispatchTake(itemId, 1, printing)}>
                {m.collections_menu_take_one()}
              </CardMenuItem>
              {takeAllCount !== undefined && takeAllCount > 1 && (
                <CardMenuItem
                  icon={HandIcon}
                  onSelect={() => dispatchTake(itemId, takeAllCount, printing)}
                >
                  {m.collections_menu_take_many({ count: takeAllCount })}
                </CardMenuItem>
              )}
              <ContextMenuSeparator />
            </>
          )}
          <CardMenuItem
            icon={NotebookPenIcon}
            onSelect={() => dispatchContextAction(itemId, "copyDetails")}
          >
            {stacked ? m.collections_menu_copies() : m.collections_menu_copy_details()}
          </CardMenuItem>
          <CardMenuItem icon={BookOpenIcon} onSelect={() => dispatchContextAction(itemId, "move")}>
            {m.collections_menu_move()}
          </CardMenuItem>
          <CardMenuItem
            icon={ListPlusIcon}
            onSelect={() => dispatchContextAction(itemId, "addToList")}
          >
            {m.collections_menu_add_to_list()}
          </CardMenuItem>
          {canLend && (
            <CardMenuItem
              icon={HandHeartIcon}
              onSelect={() => dispatchContextAction(itemId, "lend", printing)}
            >
              {m.collections_menu_lend()}
            </CardMenuItem>
          )}
          <ContextMenuSeparator />
          <CardMenuItem icon={HeartPlusIcon} onSelect={() => dispatchAddToWishlist(printing)}>
            {m.cards_context_add_to_wishlist()}
          </CardMenuItem>
          <CardPageLinkItems printing={printing} />
          <ContextMenuSeparator />
          <CardMenuItem
            icon={Trash2Icon}
            variant="destructive"
            onSelect={() => dispatchContextAction(itemId, "dispose")}
          >
            {m.collections_menu_dispose()}
          </CardMenuItem>
        </>
      }
    >
      {children}
    </CardContextMenu>
  );
}

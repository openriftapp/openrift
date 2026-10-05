import type { Printing } from "@openrift/shared/types/catalog";
import {
  BookOpenIcon,
  HandHeartIcon,
  HandIcon,
  ListPlusIcon,
  NotebookPenIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import { ContextMenuSeparator } from "@/components/ui/context-menu";
import { CardContextMenu, CardMenuItem } from "@/features/cards/components/card-context-menu";
import {
  dispatchContextAction,
  dispatchTake,
} from "@/features/cards/stores/card-row-actions-store";
import { m } from "@/paraglide/messages.js";

interface CollectionCardContextMenuProps {
  itemId: string;
  canTake?: boolean;
  takeAllCount?: number;
  stacked?: boolean;
  canLend?: boolean;
  lendPrinting?: Printing;
  children?: ReactNode;
}

/**
 * Right-click / long-press menu on an owned collection card, mirroring the
 * floating action bar: Move, Add to list, Dispose. Each item dispatches to the
 * grid, which targets the current multi-selection when this card belongs to it
 * and otherwise selects just this card before acting.
 */
export function CollectionCardContextMenu({
  itemId,
  canTake,
  takeAllCount,
  stacked = true,
  canLend,
  lendPrinting,
  children,
}: CollectionCardContextMenuProps) {
  return (
    <CardContextMenu
      menu={
        <>
          {canTake && (
            <>
              <CardMenuItem icon={HandIcon} onSelect={() => dispatchTake(itemId, 1)}>
                {m.collections_menu_take_one()}
              </CardMenuItem>
              {takeAllCount !== undefined && takeAllCount > 1 && (
                <CardMenuItem icon={HandIcon} onSelect={() => dispatchTake(itemId, takeAllCount)}>
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
              onSelect={() => dispatchContextAction(itemId, "lend", lendPrinting)}
            >
              {m.collections_menu_lend()}
            </CardMenuItem>
          )}
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

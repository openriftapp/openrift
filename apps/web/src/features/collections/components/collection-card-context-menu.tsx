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

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
    <ContextMenu>
      <ContextMenuTrigger
        className="block select-none [-webkit-touch-callout:none]"
        render={<div />}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        {canTake && (
          <>
            <ContextMenuItem
              onClick={(event) => {
                event.stopPropagation();
                dispatchTake(itemId, 1);
              }}
            >
              <HandIcon />
              {m.collections_menu_take_one()}
            </ContextMenuItem>
            {takeAllCount !== undefined && takeAllCount > 1 && (
              <ContextMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  dispatchTake(itemId, takeAllCount);
                }}
              >
                <HandIcon />
                {m.collections_menu_take_many({ count: takeAllCount })}
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          onClick={(event) => {
            event.stopPropagation();
            dispatchContextAction(itemId, "copyDetails");
          }}
        >
          <NotebookPenIcon />
          {stacked ? m.collections_menu_copies() : m.collections_menu_copy_details()}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={(event) => {
            event.stopPropagation();
            dispatchContextAction(itemId, "move");
          }}
        >
          <BookOpenIcon />
          {m.collections_menu_move()}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={(event) => {
            event.stopPropagation();
            dispatchContextAction(itemId, "addToList");
          }}
        >
          <ListPlusIcon />
          {m.collections_menu_add_to_list()}
        </ContextMenuItem>
        {canLend && (
          <ContextMenuItem
            onClick={(event) => {
              event.stopPropagation();
              dispatchContextAction(itemId, "lend", lendPrinting);
            }}
          >
            <HandHeartIcon />
            {m.collections_menu_lend()}
          </ContextMenuItem>
        )}
        <ContextMenuItem
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            dispatchContextAction(itemId, "dispose");
          }}
        >
          <Trash2Icon />
          {m.collections_menu_dispose()}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

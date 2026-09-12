import type { ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { m } from "@/paraglide/messages.js";

interface ListEntryContextMenuProps {
  onRemove?: () => void;
  onTakeOff?: () => void;
  onViewDetail?: () => void;
  onSetPreference?: () => void;
  onMove?: () => void;
  onMoveToCollection?: () => void;
  onExclude?: () => void;
  children?: ReactNode;
}

export function ListEntryContextMenu({
  onRemove,
  onTakeOff,
  onViewDetail,
  onSetPreference,
  onMove,
  onMoveToCollection,
  onExclude,
  children,
}: ListEntryContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="block select-none [-webkit-touch-callout:none]"
        render={<div />}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onViewDetail ? (
          <ContextMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onViewDetail();
            }}
          >
            {m.lists_entry_view_details()}
          </ContextMenuItem>
        ) : null}
        {onSetPreference ? (
          <ContextMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onSetPreference();
            }}
          >
            {m.lists_entry_trade_preference()}
          </ContextMenuItem>
        ) : null}
        {onMove ? (
          <ContextMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onMove();
            }}
          >
            {m.lists_entry_move_to_list()}
          </ContextMenuItem>
        ) : null}
        {onMoveToCollection ? (
          <ContextMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onMoveToCollection();
            }}
          >
            {m.lists_entry_move_to_collection()}
          </ContextMenuItem>
        ) : null}
        {onTakeOff ? (
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onTakeOff();
            }}
          >
            {m.lists_entry_take_off_list()}
          </ContextMenuItem>
        ) : null}
        {onRemove ? (
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            {m.lists_entry_remove_from_list()}
          </ContextMenuItem>
        ) : null}
        {onExclude ? (
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onExclude();
            }}
          >
            {m.lists_entry_exclude()}
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

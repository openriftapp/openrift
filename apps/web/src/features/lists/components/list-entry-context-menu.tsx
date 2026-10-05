import {
  ArrowRightLeftIcon,
  BanIcon,
  BookOpenIcon,
  CircleMinusIcon,
  CopyIcon,
  HandCoinsIcon,
  InfoIcon,
  PackagePlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import { ContextMenuSeparator } from "@/components/ui/context-menu";
import { CardContextMenu, CardMenuItem } from "@/features/cards/components/card-context-menu";
import { m } from "@/paraglide/messages.js";

interface ListEntryContextMenuProps {
  onRemove?: () => void;
  onTakeOff?: () => void;
  onViewDetail?: () => void;
  onSetPreference?: () => void;
  onMove?: () => void;
  onCopy?: () => void;
  onMoveToCollection?: () => void;
  onAddToCollection?: () => void;
  onExclude?: () => void;
  children?: ReactNode;
}

export function ListEntryContextMenu({
  onRemove,
  onTakeOff,
  onViewDetail,
  onSetPreference,
  onMove,
  onCopy,
  onMoveToCollection,
  onAddToCollection,
  onExclude,
  children,
}: ListEntryContextMenuProps) {
  const hasActions = Boolean(
    onViewDetail ?? onSetPreference ?? onMove ?? onCopy ?? onMoveToCollection ?? onAddToCollection,
  );
  const hasDestructive = Boolean(onTakeOff ?? onRemove ?? onExclude);
  return (
    <CardContextMenu
      menu={
        <>
          {onViewDetail && (
            <CardMenuItem icon={InfoIcon} onSelect={onViewDetail}>
              {m.lists_entry_view_details()}
            </CardMenuItem>
          )}
          {onSetPreference && (
            <CardMenuItem icon={HandCoinsIcon} onSelect={onSetPreference}>
              {m.lists_entry_trade_preference()}
            </CardMenuItem>
          )}
          {onMove && (
            <CardMenuItem icon={ArrowRightLeftIcon} onSelect={onMove}>
              {m.lists_entry_move_to_list()}
            </CardMenuItem>
          )}
          {onCopy && (
            <CardMenuItem icon={CopyIcon} onSelect={onCopy}>
              {m.lists_entry_copy_to_list()}
            </CardMenuItem>
          )}
          {onMoveToCollection && (
            <CardMenuItem icon={BookOpenIcon} onSelect={onMoveToCollection}>
              {m.lists_entry_move_to_collection()}
            </CardMenuItem>
          )}
          {onAddToCollection && (
            <CardMenuItem icon={PackagePlusIcon} onSelect={onAddToCollection}>
              {m.lists_entry_add_to_collection()}
            </CardMenuItem>
          )}
          {hasActions && hasDestructive && <ContextMenuSeparator />}
          {onTakeOff && (
            <CardMenuItem icon={CircleMinusIcon} variant="destructive" onSelect={onTakeOff}>
              {m.lists_entry_take_off_list()}
            </CardMenuItem>
          )}
          {onRemove && (
            <CardMenuItem icon={Trash2Icon} variant="destructive" onSelect={onRemove}>
              {m.lists_entry_remove_from_list()}
            </CardMenuItem>
          )}
          {onExclude && (
            <CardMenuItem icon={BanIcon} variant="destructive" onSelect={onExclude}>
              {m.lists_entry_exclude()}
            </CardMenuItem>
          )}
        </>
      }
    >
      {children}
    </CardContextMenu>
  );
}

import { MinusIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

type ListEntryTableActionsProps = {
  isRemovePending: boolean;
} & (
  | {
      showQuantity: false;
      onTakeOff: () => void;
    }
  | {
      showQuantity: true;
      quantity: number;
      onIncrement: () => void;
      onDecrement: () => void;
      onRemove: () => void;
      isQuantityPending: boolean;
    }
);

export function ListEntryTableActions(props: ListEntryTableActionsProps) {
  if (!props.showQuantity) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={(event) => {
          event.stopPropagation();
          props.onTakeOff();
        }}
        disabled={props.isRemovePending}
        aria-label={m.lists_entry_take_off()}
      >
        <XIcon className="size-3.5" />
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(event) => {
          event.stopPropagation();
          if (props.quantity <= 1) {
            props.onRemove();
          } else {
            props.onDecrement();
          }
        }}
        disabled={props.isQuantityPending || props.isRemovePending}
        aria-label={m.lists_entry_decrease_quantity()}
      >
        <MinusIcon className="size-3.5" />
      </Button>
      <span
        className="text-foreground min-w-5 text-center text-xs font-semibold tabular-nums"
        aria-label={m.lists_entry_quantity_aria({ count: props.quantity })}
      >
        {props.quantity}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(event) => {
          event.stopPropagation();
          props.onIncrement();
        }}
        disabled={props.isQuantityPending}
        aria-label={m.lists_entry_increase_quantity()}
      >
        <PlusIcon className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={(event) => {
          event.stopPropagation();
          props.onRemove();
        }}
        disabled={props.isRemovePending}
        aria-label={m.lists_entry_remove_from_list()}
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  );
}

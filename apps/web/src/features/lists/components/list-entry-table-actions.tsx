import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineCountStepper } from "@/components/ui/inline-count-stepper";
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
      <InlineCountStepper
        count={
          <span aria-label={m.lists_entry_quantity_aria({ count: props.quantity })}>
            {props.quantity}
          </span>
        }
        decrementLabel={m.lists_entry_decrease_quantity()}
        incrementLabel={m.lists_entry_increase_quantity()}
        onDecrement={
          props.isQuantityPending || props.isRemovePending
            ? undefined
            : () => (props.quantity <= 1 ? props.onRemove() : props.onDecrement())
        }
        onIncrement={props.isQuantityPending ? undefined : props.onIncrement}
      />
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

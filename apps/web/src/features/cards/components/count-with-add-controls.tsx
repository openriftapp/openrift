import type { Printing } from "@openrift/shared/types/catalog";
import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CountWithTotal } from "@/components/ui/count-pill";
import {
  dispatchDecrement,
  dispatchIncrement,
} from "@/features/cards/stores/card-row-actions-store";
import { m } from "@/paraglide/messages.js";

interface CountWithAddControlsProps {
  printing: Printing;
  ownedCount: number;
  totalOwnedCount?: number;
}

/**
 * Increments and decrements go through the module-stable trampolines on the
 * card-row-actions store; the active surface registers handlers there.
 */
export function CountWithAddControls({
  printing,
  ownedCount,
  totalOwnedCount,
}: CountWithAddControlsProps) {
  return (
    <>
      <span className="text-center font-medium tabular-nums">
        <CountWithTotal count={ownedCount} totalCount={totalOwnedCount} />
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={(event) => {
          event.stopPropagation();
          dispatchDecrement(printing, event.currentTarget, { shift: event.shiftKey });
        }}
        disabled={!ownedCount}
        aria-label={m.cards_count_remove_one()}
      >
        <MinusIcon className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="default"
        size="icon-sm"
        onClick={(event) => {
          event.stopPropagation();
          dispatchIncrement(printing, { shift: event.shiftKey });
        }}
        aria-label={m.cards_count_add_one()}
      >
        <PlusIcon className="size-3.5" />
      </Button>
    </>
  );
}

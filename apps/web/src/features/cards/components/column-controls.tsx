import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { clampColumns, MAX_COLUMNS, MIN_COLUMNS } from "@/features/cards/lib/column-range";
import { m } from "@/paraglide/messages.js";

/** `maxColumns === null` means "Auto"; a number is the user's override within `[MIN_COLUMNS, MAX_COLUMNS]`. */
export function ColumnControls({
  compact,
  maxColumns: storedMaxColumns,
  autoColumns,
  onMaxColumnsChange,
}: {
  compact?: boolean;
  maxColumns: number | null;
  autoColumns: number;
  onMaxColumnsChange: (value: number | null) => void;
}) {
  const maxColumns = storedMaxColumns === null ? null : clampColumns(storedMaxColumns);
  return (
    <ButtonGroup aria-label={m.cards_columns()}>
      <Button
        variant="control"
        size={compact ? "icon-sm" : "icon"}
        onClick={() => {
          if (maxColumns === null) {
            const next = autoColumns - 1;
            if (next >= MIN_COLUMNS) {
              onMaxColumnsChange(next);
            }
          } else if (maxColumns > MIN_COLUMNS) {
            onMaxColumnsChange(maxColumns - 1);
          }
        }}
        disabled={
          (maxColumns !== null && maxColumns <= MIN_COLUMNS) ||
          (maxColumns === null && autoColumns <= MIN_COLUMNS)
        }
        aria-label={m.cards_columns_fewer()}
      >
        <MinusIcon className={compact ? "size-3.5" : "size-4"} />
      </Button>
      <Button
        variant="control"
        size={compact ? "sm" : "default"}
        // oxlint-disable-next-line shadcn/no-restyle -- compact count reads at text-xs, below the sm size
        className={compact ? "min-w-7 px-1.5 text-xs tabular-nums" : "min-w-10 tabular-nums"}
        onClick={() => {
          if (maxColumns !== null) {
            onMaxColumnsChange(null);
          }
        }}
        title={maxColumns === null ? m.cards_columns_auto_title() : m.cards_columns_reset_title()}
        aria-label={
          maxColumns === null ? m.cards_columns_auto_title() : m.cards_columns_reset_aria()
        }
      >
        {maxColumns ?? m.cards_columns_auto()}
      </Button>
      <Button
        variant="control"
        size={compact ? "icon-sm" : "icon"}
        onClick={() => {
          const next = maxColumns === null ? autoColumns + 1 : maxColumns + 1;
          if (next <= MAX_COLUMNS) {
            onMaxColumnsChange(next);
          }
        }}
        disabled={maxColumns === null ? autoColumns >= MAX_COLUMNS : maxColumns >= MAX_COLUMNS}
        aria-label={m.cards_columns_more()}
      >
        <PlusIcon className={compact ? "size-3.5" : "size-4"} />
      </Button>
    </ButtonGroup>
  );
}

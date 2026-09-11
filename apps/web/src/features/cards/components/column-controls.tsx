import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

/** `maxColumns === null` means "Auto"; a number is the user's override, clamped to `[minColumns, maxColumnsLimit]`. */
export function ColumnControls({
  compact,
  maxColumns,
  autoColumns,
  minColumns,
  maxColumnsLimit,
  onMaxColumnsChange,
}: {
  compact?: boolean;
  maxColumns: number | null;
  autoColumns: number;
  minColumns: number;
  maxColumnsLimit: number;
  onMaxColumnsChange: (value: number | null) => void;
}) {
  return (
    <ButtonGroup aria-label="Columns">
      <Button
        variant="control"
        size={compact ? "sm" : "icon"}
        className={compact ? "size-7 p-0" : undefined}
        onClick={() => {
          if (maxColumns === null) {
            const next = autoColumns - 1;
            if (next >= minColumns) {
              onMaxColumnsChange(next);
            }
          } else if (maxColumns > minColumns) {
            onMaxColumnsChange(maxColumns - 1);
          }
        }}
        disabled={
          (maxColumns !== null && maxColumns <= minColumns) ||
          (maxColumns === null && autoColumns <= minColumns)
        }
        aria-label="Fewer columns"
      >
        <MinusIcon className={compact ? undefined : "size-4"} />
      </Button>
      <Button
        variant="control"
        size={compact ? "sm" : "default"}
        className={compact ? "min-w-7 px-1.5 text-xs tabular-nums" : "min-w-10 tabular-nums"}
        onClick={() => {
          if (maxColumns !== null) {
            onMaxColumnsChange(null);
          }
        }}
        title={maxColumns === null ? "Auto columns" : "Reset to auto"}
        aria-label={maxColumns === null ? "Auto columns" : "Reset columns to auto"}
      >
        {maxColumns ?? "Auto"}
      </Button>
      <Button
        variant="control"
        size={compact ? "sm" : "icon"}
        className={compact ? "size-7 p-0" : undefined}
        onClick={() => {
          const next = maxColumns === null ? autoColumns + 1 : maxColumns + 1;
          if (next <= maxColumnsLimit) {
            onMaxColumnsChange(next);
          }
        }}
        disabled={
          maxColumns === null ? autoColumns >= maxColumnsLimit : maxColumns >= maxColumnsLimit
        }
        aria-label="More columns"
      >
        <PlusIcon className={compact ? undefined : "size-4"} />
      </Button>
    </ButtonGroup>
  );
}

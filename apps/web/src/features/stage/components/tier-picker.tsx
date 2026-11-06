import { TIER_LABEL_INK, tierRowColor } from "@openrift/shared/tier-colors";
import { CornerUpLeftIcon } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";

import { CommandSeparator } from "@/components/ui/command";
import { PickerList, PickerRow } from "@/components/ui/picker-list";
import {
  ResponsivePopover,
  ResponsivePopoverContent,
  ResponsivePopoverTrigger,
} from "@/components/ui/responsive-popover";
import { m } from "@/paraglide/messages.js";

export interface TierPickerRow {
  label: string;
  unranked?: boolean;
}

interface TierPickerProps {
  rows: readonly TierPickerRow[];
  cardName: string;
  currentRowIndex: number | null;
  onPick: (rowIndex: number) => void;
  onUnrank: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
}

const POOL_ROW = "pool";

export function TierPicker({
  rows,
  cardName,
  currentRowIndex,
  onPick,
  onUnrank,
  open,
  onOpenChange,
  trigger,
}: TierPickerProps) {
  const [highlightedId, setHighlightedId] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setHighlightedId(currentRowIndex === null ? "" : String(currentRowIndex));
    }
    onOpenChange(next);
  };

  const choose = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <ResponsivePopover open={open} onOpenChange={handleOpenChange}>
      <ResponsivePopoverTrigger render={trigger} />
      <ResponsivePopoverContent
        title={cardName}
        description={m.tier_lists_picker_description()}
        popoverClassName="w-56"
      >
        <PickerList highlightedId={highlightedId} onHighlightChange={setHighlightedId}>
          {rows.map((row, rowIndex) => (
            <PickerRow
              key={rowIndex}
              value={String(rowIndex)}
              onSelect={() => choose(() => onPick(rowIndex))}
            >
              <TierSwatch label={row.label} rowIndex={rowIndex} unranked={row.unranked} />
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              {rowIndex === currentRowIndex && (
                <span className="text-muted-foreground text-sm">
                  {m.tier_lists_picker_current()}
                </span>
              )}
            </PickerRow>
          ))}
          {currentRowIndex !== null && (
            <>
              <CommandSeparator className="my-1" />
              <PickerRow
                value={POOL_ROW}
                className="text-muted-foreground"
                onSelect={() => choose(onUnrank)}
              >
                <CornerUpLeftIcon className="size-4" />
                {m.tier_lists_picker_back_to_pool()}
              </PickerRow>
            </>
          )}
        </PickerList>
      </ResponsivePopoverContent>
    </ResponsivePopover>
  );
}

function TierSwatch({
  label,
  rowIndex,
  unranked,
}: {
  label: string;
  rowIndex: number;
  unranked?: boolean;
}) {
  return (
    <span
      aria-hidden
      className="text-2xs grid size-5 shrink-0 place-items-center rounded-sm font-bold"
      style={{ backgroundColor: tierRowColor(rowIndex, unranked), color: TIER_LABEL_INK }}
    >
      {label.slice(0, 2)}
    </span>
  );
}

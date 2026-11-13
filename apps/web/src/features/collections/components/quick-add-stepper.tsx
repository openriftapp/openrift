import { MinusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const QUICK_ADD_SELECTED_ROW_CLASS =
  "bg-primary/10 text-foreground ring-1 ring-primary/60 ring-inset";

interface QuickAddStepperProps {
  count: number;
  selected: boolean;
  changed: boolean;
  incrementIcon: ReactNode;
  incrementLabel: string;
  decrementLabel: string;
  onIncrement: () => void;
  onDecrement: () => void;
  incrementDisabled?: boolean;
  decrementDisabled?: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
}

export function QuickAddStepper({
  count,
  selected,
  changed,
  incrementIcon,
  incrementLabel,
  decrementLabel,
  onIncrement,
  onDecrement,
  incrementDisabled,
  decrementDisabled,
  onMouseDown,
}: QuickAddStepperProps) {
  return (
    <div className="mr-1.5 ml-1 flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        tabIndex={-1}
        onMouseDown={onMouseDown}
        size="icon-xs"
        variant="ghost"
        onClick={onDecrement}
        disabled={decrementDisabled}
        aria-label={decrementLabel}
      >
        <MinusIcon />
      </Button>
      <span
        className={cn(
          "text-2xs w-5 text-center tabular-nums",
          // `group-not-data` avoids relying on Tailwind class-order specificity here.
          changed
            ? "group-data-[selected=true]:text-foreground group-not-data-[selected=true]:text-success"
            : "text-muted-foreground group-data-[selected=true]:text-foreground/80",
        )}
      >
        {count}
      </span>
      <Button
        type="button"
        tabIndex={-1}
        onMouseDown={onMouseDown}
        size="icon-xs"
        variant={selected ? "default" : "outline"}
        onClick={onIncrement}
        disabled={incrementDisabled}
        aria-label={incrementLabel}
      >
        {incrementIcon}
      </Button>
    </div>
  );
}

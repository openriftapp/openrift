import { MinusIcon, PlusIcon } from "lucide-react";
import type { MouseEvent, ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).

type InlineCountStepperSize = "xs" | "sm";

const BUTTON_SIZE: Record<InlineCountStepperSize, "icon-xs" | "icon-sm"> = {
  xs: "icon-xs",
  sm: "icon-sm",
};

const COUNT_CLASS: Record<InlineCountStepperSize, string> = {
  xs: "min-w-4 text-xs",
  sm: "min-w-5 text-sm",
};

interface InlineCountStepperProps {
  count: ReactNode;
  decrementLabel: string;
  incrementLabel: string;
  onDecrement?: (event: MouseEvent<HTMLButtonElement>) => void;
  onIncrement?: (event: MouseEvent<HTMLButtonElement>) => void;
  size?: InlineCountStepperSize;
  variant?: "ghost" | "outline";
  bulk?: boolean;
  bulkDecrementLabel?: ReactNode;
  bulkIncrementLabel?: ReactNode;
  decrementTooltip?: ReactNode;
  incrementTooltip?: ReactNode;
  className?: string;
}

function WithTooltip({ tooltip, children }: { tooltip?: ReactNode; children: ReactElement }) {
  if (tooltip === undefined) {
    return children;
  }
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function InlineCountStepper({
  count,
  decrementLabel,
  incrementLabel,
  onDecrement,
  onIncrement,
  size = "sm",
  variant = "ghost",
  bulk = false,
  bulkDecrementLabel,
  bulkIncrementLabel,
  decrementTooltip,
  incrementTooltip,
  className,
}: InlineCountStepperProps) {
  const bulkDecrement = bulk && bulkDecrementLabel !== undefined && onDecrement !== undefined;
  const bulkIncrement = bulk && bulkIncrementLabel !== undefined && onIncrement !== undefined;
  const iconClass = size === "xs" ? "size-3" : "size-3.5";
  const bulkClass = "w-auto min-w-7 px-1 text-xs font-semibold tabular-nums";

  return (
    <span
      data-slot="inline-count-stepper"
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
    >
      <WithTooltip tooltip={decrementTooltip}>
        <Button
          type="button"
          variant={bulkDecrement ? "destructive" : variant}
          size={BUTTON_SIZE[size]}
          aria-label={decrementLabel}
          disabled={!onDecrement}
          className={cn(bulkDecrement && bulkClass)}
          onClick={(event) => {
            event.stopPropagation();
            onDecrement?.(event);
          }}
        >
          {bulkDecrement ? bulkDecrementLabel : <MinusIcon className={iconClass} />}
        </Button>
      </WithTooltip>
      <span className={cn("text-center font-medium tabular-nums", COUNT_CLASS[size])}>{count}</span>
      <WithTooltip tooltip={incrementTooltip}>
        <Button
          type="button"
          variant={bulkIncrement ? "default" : variant}
          size={BUTTON_SIZE[size]}
          aria-label={incrementLabel}
          disabled={!onIncrement}
          className={cn(bulkIncrement && bulkClass)}
          onClick={(event) => {
            event.stopPropagation();
            onIncrement?.(event);
          }}
        >
          {bulkIncrement ? bulkIncrementLabel : <PlusIcon className={iconClass} />}
        </Button>
      </WithTooltip>
    </span>
  );
}

export { InlineCountStepper };
export type { InlineCountStepperProps };

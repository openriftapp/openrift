import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";

// Hand-authored primitive (not shadcn-scaffolded).

type Side = "top" | "bottom" | "left" | "right";

/**
 * A tooltip that a phone can open. On a fine pointer it is a hover/focus Tooltip. On a
 * coarse pointer it is a tap-to-open Popover, because a Base UI tooltip ignores touch:
 * its hover interaction is `mouseOnly` and its focus interaction needs `:focus-visible`.
 * SSR and the first client render use the tooltip; the popover takes over one paint later.
 * @returns The trigger wrapping `children` and its overlay.
 */
export function TouchTooltip({
  content,
  children,
  className,
  side = "top",
  "aria-label": ariaLabel,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  side?: Side;
  "aria-label"?: string;
}) {
  const coarsePointer = useCoarsePointer();

  if (coarsePointer) {
    return (
      <Popover>
        <PopoverTrigger className={className} aria-label={ariaLabel}>
          {children}
        </PopoverTrigger>
        <PopoverContent side={side} className="w-auto max-w-[min(20rem,calc(100vw-2rem))]">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger className={className} aria-label={ariaLabel}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

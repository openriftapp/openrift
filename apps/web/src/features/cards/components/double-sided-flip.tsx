import { imageUrl } from "@openrift/shared/image-url";
import type { PrintingOtherSide } from "@openrift/shared/types/catalog";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import type { MouseEvent, ReactElement, ReactNode, TransitionEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface PillProps {
  className: string;
  onClick: (event: MouseEvent) => void;
  "aria-label": string;
  children: ReactNode;
}

const PILL_CLASS = "absolute right-3 bottom-0 z-10 translate-y-1/2 pr-3.5 pl-3";

/** `onFlip` runs once the turn finishes. `renderLink` makes the pill a link that keeps modified clicks. */
export function DoubleSidedFlip({
  otherSide,
  onFlip,
  renderLink,
  children,
}: {
  otherSide: PrintingOtherSide;
  onFlip: () => void;
  renderLink?: (pill: PillProps) => ReactElement;
  children: ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  const reducedMotion = useReducedMotion();
  const pillLabel = m.cards_flip_to_other_side({ name: otherSide.cardName });
  const pillContent = (
    <>
      <RefreshCwIcon aria-hidden="true" />
      {otherSide.cardName}
    </>
  );
  const backSrc = otherSide.imageId ? imageUrl(otherSide.imageId, "400w") : undefined;

  function handleClick(event: MouseEvent) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (flipped) {
      return;
    }
    if (reducedMotion || !backSrc) {
      onFlip();
      return;
    }
    setFlipped(true);
  }

  function handleTransitionEnd(event: TransitionEvent) {
    if (flipped && event.target === event.currentTarget && event.propertyName === "transform") {
      onFlip();
    }
  }

  return (
    <div className="pb-5">
      <div className="relative perspective-distant">
        <div
          data-testid="double-sided-flipper"
          onTransitionEnd={handleTransitionEnd}
          className={cn(
            "relative transition-transform duration-700 ease-[cubic-bezier(0.3,0.7,0.2,1)] transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180",
          )}
        >
          <div className="backface-hidden">{children}</div>
          {backSrc && (
            <img
              src={backSrc}
              alt=""
              className="absolute inset-0 size-full rotate-y-180 rounded-xl object-contain backface-hidden"
            />
          )}
        </div>
        {renderLink ? (
          renderLink({
            className: buttonVariants({ variant: "glass-pill", className: PILL_CLASS }),
            onClick: handleClick,
            "aria-label": pillLabel,
            children: pillContent,
          })
        ) : (
          <Button
            variant="glass-pill"
            onClick={handleClick}
            aria-label={pillLabel}
            className={PILL_CLASS}
          >
            {pillContent}
          </Button>
        )}
      </div>
    </div>
  );
}

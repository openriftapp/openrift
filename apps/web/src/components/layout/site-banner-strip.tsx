import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn, CONTAINER_WIDTH } from "@/lib/utils";

export function SiteBannerStrip({
  icon,
  dismissLabel,
  onDismiss,
  children,
}: {
  /** A lucide-style svg; the strip sizes and tints it. */
  icon: ReactNode;
  dismissLabel: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-primary/10 border-primary/20 relative z-40 border-b">
      <div
        className={cn(
          CONTAINER_WIDTH,
          "px-safe flex items-start gap-3 py-2 text-sm lg:items-center",
        )}
      >
        <span aria-hidden className="text-primary mt-0.5 flex shrink-0 lg:mt-0 [&>svg]:size-4">
          {icon}
        </span>
        {children}
        <Button
          variant="ghost"
          size="icon-xs"
          className="-my-0.5 lg:my-0"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}

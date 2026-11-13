import type { ComponentProps } from "react";

import { accentGlow } from "@/lib/accent-wash";
import { cn } from "@/lib/utils";

const COVER_BAND_GLOW = accentGlow(22);

/**
 * The visual band at the top of a showcase tile — a muted strip with a warm
 * glow behind whatever the tile displays. Size and content layout come from
 * the caller; the band only owns the backdrop.
 */
export function CoverBand({ className, style, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-muted relative shrink-0", className)}
      style={{ backgroundImage: COVER_BAND_GLOW, ...style }}
      {...props}
    />
  );
}

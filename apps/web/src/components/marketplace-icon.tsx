import type { Marketplace } from "@openrift/shared/types/pricing";

import { MARKETPLACE_ICONS } from "@/lib/marketplace-icons";
import { cn } from "@/lib/utils";

// Defaults to decorative (alt=""); pass `alt` only where the icon is the sole identification.
export function MarketplaceIcon({
  marketplace,
  className,
  alt = "",
}: {
  marketplace: Marketplace;
  className?: string;
  alt?: string;
}) {
  // Artwork is light-on-transparent, so it's inverted for light mode and left alone in dark.
  return (
    <img
      src={MARKETPLACE_ICONS[marketplace]}
      alt={alt}
      className={cn("h-3 invert dark:invert-0", className)}
    />
  );
}

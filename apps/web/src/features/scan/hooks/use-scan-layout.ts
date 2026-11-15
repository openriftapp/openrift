import { createMediaQueryHook } from "@/hooks/create-media-query-hook";
import { useIsMobile } from "@/hooks/use-is-mobile";

export type ScanLayout = "boxed" | "portrait" | "landscape";

// 600px keeps laptops/tablets boxed; the largest common tablet-in-landscape
// short side is well above that, the largest phone (~430px) well below.
const useShortLandscape = createMediaQueryHook(
  "(orientation: landscape) and (max-height: 600px)",
  false,
);

// Landscape wins over portrait: a rotated phone can still be under the width
// cutoff, and the side panel is what actually fits there.
export function useScanLayout(): ScanLayout {
  const landscape = useShortLandscape();
  const portrait = useIsMobile();
  if (landscape) {
    return "landscape";
  }
  return portrait ? "portrait" : "boxed";
}

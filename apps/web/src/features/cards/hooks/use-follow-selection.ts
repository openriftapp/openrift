import { useRef } from "react";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { useDisplayStore } from "@/stores/display-store";

/**
 * The desktop modal covers the list, so only the first card it opens scrolls it.
 * Call the returned check from an effect event so it sees the current breakpoint.
 */
export function useFollowSelection(): (itemId?: string | null) => boolean {
  const isMobile = useIsMobile();
  const previousRef = useRef<string | null | undefined>(undefined);

  return (itemId) => {
    const stepped = Boolean(previousRef.current);
    previousRef.current = itemId;
    if (!itemId) {
      return false;
    }
    return !stepped || isMobile || useDisplayStore.getState().paneDocked;
  };
}

import { useEffect, useRef } from "react";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { useDisplayStore } from "@/stores/display-store";

/** The desktop modal covers the list, so only the first card it opens scrolls it. */
export function useFollowSelection(): (itemId?: string | null) => boolean {
  const isMobile = useIsMobile();
  const isMobileRef = useRef(isMobile);
  const previousRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    isMobileRef.current = isMobile;
  });

  return (itemId) => {
    const stepped = Boolean(previousRef.current);
    previousRef.current = itemId;
    if (!itemId) {
      return false;
    }
    return !stepped || isMobileRef.current || useDisplayStore.getState().paneDocked;
  };
}

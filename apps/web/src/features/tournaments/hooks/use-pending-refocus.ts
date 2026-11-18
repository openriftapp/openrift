import { useEffect, useRef } from "react";

/**
 * Hands the focus to an inline editor's opener as it remounts. A request lasts one commit: the
 * opener's effect takes it first, and an opener that does not mount then never takes it later.
 */
export function usePendingRefocus<T>(): {
  request: (target: T) => void;
  take: (target: T) => boolean;
} {
  const pending = useRef<T | null>(null);
  useEffect(() => {
    pending.current = null;
  });
  return {
    request: (target) => {
      pending.current = target;
    },
    take: (target) => {
      if (pending.current !== target) {
        return false;
      }
      pending.current = null;
      return true;
    },
  };
}

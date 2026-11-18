import { useEffect, useRef } from "react";

import { useScrollTargetStore } from "@/features/admin/stores/scroll-target-store";

/** A ref for the element registered under `key`; it scrolls into view when a scroll to `key` is pending. */
export function useScrollTarget<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  const request = useScrollTargetStore((state) =>
    state.request?.key === key ? state.request : null,
  );

  useEffect(() => {
    if (request === null || ref.current === null) {
      return;
    }
    ref.current.scrollIntoView({ behavior: "smooth", block: request.block });
    useScrollTargetStore.getState().done(request);
  }, [request]);

  return ref;
}

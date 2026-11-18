import { useEffect } from "react";

import type {
  CardRowSurface,
  HandlersBySurface,
  SurfaceRowActionsStore,
} from "@/features/cards/stores/card-row-actions-store";

/**
 * Re-registers every render (no dependency array) so cells dispatch the freshest closure.
 * The store's surface decides which handlers the caller may register.
 */
export function useRowActionHandlers<TSurface extends CardRowSurface>(
  store: SurfaceRowActionsStore<TSurface>,
  handlers: HandlersBySurface[TSurface],
): void {
  useEffect(() => {
    store.getState().setHandlers(handlers);
  });
}

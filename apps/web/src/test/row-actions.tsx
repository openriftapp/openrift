import type { ReactNode } from "react";

import type { CardRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import {
  CardRowActionsStoreContext,
  createCardRowActionsStore,
} from "@/features/cards/stores/card-row-actions-store";

/** A render `wrapper` that mounts its children inside one card surface's row-actions store. */
export function rowActionsWrapper(store: CardRowActionsStore = createCardRowActionsStore()) {
  return function RowActionsWrapper({ children }: { children: ReactNode }) {
    return <CardRowActionsStoreContext value={store}>{children}</CardRowActionsStoreContext>;
  };
}

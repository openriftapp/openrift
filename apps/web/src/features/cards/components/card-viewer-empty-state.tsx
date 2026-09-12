import { SearchXIcon, WifiOffIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

/** Shows a connectivity error when nothing loaded, or a no-results hint when filters excluded everything. */
export function CardViewerEmptyState({
  totalItems,
  noResultsDescription,
}: {
  totalItems: number;
  noResultsDescription?: ReactNode;
}) {
  if (totalItems === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={WifiOffIcon}
        title={m.cards_grid_load_error_title()}
        description={m.cards_grid_load_error_description()}
      >
        <Button type="button" variant="ghost" onClick={() => globalThis.location.reload()}>
          {m.common_retry()}
        </Button>
      </EmptyState>
    );
  }
  return (
    <EmptyState
      className="flex-1"
      icon={SearchXIcon}
      title={m.cards_grid_no_results_title()}
      description={noResultsDescription ?? m.cards_grid_no_results_description()}
    />
  );
}

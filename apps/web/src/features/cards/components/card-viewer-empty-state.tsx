import { SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { SearchAlternativeHint } from "@/features/cards/components/search-alternative-hint";
import { m } from "@/paraglide/messages.js";

/** A failed load never reaches here: the surfaces read their source through suspense queries. */
export function CardViewerEmptyState({
  totalItems,
  noResultsDescription,
}: {
  totalItems: number;
  noResultsDescription?: ReactNode;
}) {
  if (totalItems === 0) {
    return (
      <EmptyState className="flex-1" icon={SearchXIcon} title={m.cards_grid_no_results_title()} />
    );
  }
  return (
    <EmptyState
      className="flex-1"
      icon={SearchXIcon}
      title={m.cards_grid_no_results_title()}
      description={noResultsDescription ?? m.cards_grid_no_results_description()}
    >
      <SearchAlternativeHint />
    </EmptyState>
  );
}

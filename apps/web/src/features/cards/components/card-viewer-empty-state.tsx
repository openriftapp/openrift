import { SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { CatalogTailNote } from "@/features/cards/components/catalog-tail-note";
import { SearchAlternativeHint } from "@/features/cards/components/search-alternative-hint";
import { useCatalogTailStatus } from "@/features/cards/hooks/use-cards";
import { m } from "@/paraglide/messages.js";

/** A failed load never reaches here: the surfaces read their source through suspense queries. */
export function CardViewerEmptyState({
  totalItems,
  noResultsDescription,
}: {
  totalItems: number;
  noResultsDescription?: ReactNode;
}) {
  const catalogTail = useCatalogTailStatus();
  const tailNote = catalogTail.status !== "complete" && (
    <CatalogTailNote
      status={catalogTail.status}
      retry={catalogTail.retry}
      loadingText={m.cards_grid_languages_loading()}
      failedText={m.cards_grid_languages_failed()}
      className="text-muted-foreground text-sm"
    />
  );
  if (totalItems === 0) {
    return (
      <EmptyState className="flex-1" icon={SearchXIcon} title={m.cards_grid_no_results_title()}>
        {tailNote}
      </EmptyState>
    );
  }
  return (
    <EmptyState
      className="flex-1"
      icon={SearchXIcon}
      title={m.cards_grid_no_results_title()}
      description={noResultsDescription ?? m.cards_grid_no_results_description()}
    >
      {tailNote}
      <SearchAlternativeHint />
    </EmptyState>
  );
}

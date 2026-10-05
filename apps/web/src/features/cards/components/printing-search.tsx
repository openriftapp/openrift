import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";

import { CatalogSearchCombobox } from "@/features/cards/components/card-search-dropdown";
import { PrintingHoverPreview } from "@/features/cards/components/printing-hover-preview";
import { ImportPrintingLabel } from "@/features/cards/components/printing-label";
import { PrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { useCardSearch } from "@/features/cards/hooks/use-card-search";
import { usePrintingSearchIndex } from "@/features/cards/hooks/use-search-index";
import type { PrintingSearchRow } from "@/features/cards/lib/card-search-rows";
import { m } from "@/paraglide/messages.js";

const MAX_RESULTS = 20;
const MIN_QUERY_LENGTH = 1;

export function PrintingSearch({
  allPrintings,
  onSelect,
}: {
  allPrintings: Printing[];
  onSelect: (printing: Printing) => void;
}) {
  const [query, setQuery] = useState("");

  const { rows, codesByRowId } = usePrintingSearchIndex(allPrintings);
  const results = useCardSearch(rows, query, codesByRowId, MAX_RESULTS, MIN_QUERY_LENGTH);

  return (
    <CatalogSearchCombobox<PrintingSearchRow>
      ariaLabel={m.cards_search_catalog_label()}
      placeholder={m.cards_search_catalog_placeholder()}
      className="h-7 w-44"
      results={results}
      onQueryChange={setQuery}
      getKey={(row) => row.id}
      renderItem={(row) => (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <PrintingThumbnail printing={row.printing} className="h-10" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{row.name}</span>
            <span className="text-muted-foreground min-w-0 truncate text-xs">
              <ImportPrintingLabel printing={row.printing} />
            </span>
          </span>
        </div>
      )}
      renderActivePreview={(row, anchorRef) => (
        // Keyed per printing: without a fresh mount, the position effect won't
        // re-run after an imageless entry unmounts the preview.
        <PrintingHoverPreview key={row.id} printing={row.printing} anchorRef={anchorRef} />
      )}
      onSelect={(row) => onSelect(row.printing)}
    />
  );
}

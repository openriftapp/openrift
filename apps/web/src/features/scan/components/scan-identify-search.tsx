import { legendDisplayName } from "@openrift/shared/card-name";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { PrintingRowContent } from "@/features/cards/components/printing-row";
import { useCardSearch } from "@/features/cards/hooks/use-card-search";
import { usePrintingSearchIndex } from "@/features/cards/hooks/use-search-index";
import { shownPrintingHits } from "@/features/cards/lib/card-lookup-rows";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

const MAX_RESULTS = 20;
const MIN_QUERY_LENGTH = 1;

interface ScanIdentifySearchProps {
  allPrintings: Printing[];
  onPick: (printing: Printing) => void;
}

export function ScanIdentifySearch({ allPrintings, onPick }: ScanIdentifySearchProps) {
  const [query, setQuery] = useState("");
  const languages = useDisplayStore((state) => state.languages);

  const printings =
    languages.length === 0
      ? allPrintings
      : allPrintings.filter((printing) => languages.includes(printing.language));
  const siblingsByCardId = Map.groupBy(printings, (printing) => printing.cardId);

  const index = usePrintingSearchIndex(allPrintings);

  const hits = useCardSearch(index, query, MAX_RESULTS, MIN_QUERY_LENGTH);
  const results = shownPrintingHits(hits, siblingsByCardId).slice(0, MAX_RESULTS);
  const searched = query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={m.scan_identify_search_placeholder()}
        aria-label={m.scan_identify_search_label()}
      />
      {searched && results.length === 0 && (
        <p className="text-muted-foreground">{m.scan_identify_search_empty()}</p>
      )}
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {results.map((printing) => (
          <Pressable
            key={sideKey(printing)}
            className="hover:bg-muted flex w-full items-center rounded-md px-2 py-1.5"
            onClick={() => onPick(printing)}
          >
            <PrintingRowContent
              printing={printing}
              siblings={siblingsByCardId.get(printing.cardId)}
              name={legendDisplayName(printing.card)}
            />
          </Pressable>
        ))}
      </div>
    </div>
  );
}

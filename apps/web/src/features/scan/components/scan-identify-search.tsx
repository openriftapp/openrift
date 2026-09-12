import type { Printing } from "@openrift/shared/types/catalog";
import { cardSearchAltNames, legendDisplayName } from "@openrift/shared/utils";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { PrintingRowContent } from "@/features/cards/components/printing-row";
import { useCardSearch } from "@/features/cards/hooks/use-card-search";
import { m } from "@/paraglide/messages.js";

const MAX_RESULTS = 20;
const MIN_QUERY_LENGTH = 1;

interface ScanIdentifySearchProps {
  allPrintings: Printing[];
  onPick: (printing: Printing) => void;
}

export function ScanIdentifySearch({ allPrintings, onPick }: ScanIdentifySearchProps) {
  const [query, setQuery] = useState("");

  const searchable = useMemo(
    () =>
      allPrintings.map((printing) => ({
        id: printing.id,
        slug: printing.shortCode,
        name: legendDisplayName(printing.card),
        altNames: cardSearchAltNames(printing.card, [printing.printedName]),
        printing,
      })),
    [allPrintings],
  );
  const codesByRowId = useMemo(
    () =>
      new Map(
        allPrintings.map((printing) => [
          printing.id,
          [{ shortCode: printing.shortCode, publicCode: printing.publicCode }],
        ]),
      ),
    [allPrintings],
  );

  const results = useCardSearch(searchable, query, codesByRowId, MAX_RESULTS, MIN_QUERY_LENGTH);
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
        {results.map((row) => (
          <Pressable
            key={row.id}
            className="hover:bg-muted flex w-full items-center rounded-md px-2 py-1.5"
            onClick={() => onPick(row.printing)}
          >
            <PrintingRowContent printing={row.printing} name={row.name} />
          </Pressable>
        ))}
      </div>
    </div>
  );
}

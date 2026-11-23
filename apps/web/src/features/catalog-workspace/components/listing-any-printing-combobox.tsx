import { enumLabel } from "@openrift/shared/enum-label";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { uniquePrintings } from "@openrift/shared/printing-side";
import { useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import { useCardSearch } from "@/features/cards/hooks/use-card-search";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrintingSearchIndex } from "@/features/cards/hooks/use-search-index";
import { useEnumOrders } from "@/hooks/use-enums";

const MAX_MATCHES = 8;
const MIN_QUERY_LENGTH = 3;
const SEARCH_LIMIT = 200;

export function ListingAnyPrintingCombobox({
  language,
  disabled,
  onPick,
}: {
  language: string | null;
  disabled: boolean;
  onPick: (printingId: string) => void;
}) {
  const { labels } = useEnumOrders();
  const { allPrintings } = useCards();
  const [query, setQuery] = useState("");

  const index = usePrintingSearchIndex(allPrintings);
  // Rows are per face, so a two-faced printing can match twice.
  const results = useCardSearch(index, query.trim(), SEARCH_LIMIT, MIN_QUERY_LENGTH);
  const matches = uniquePrintings(results.map((row) => row.printing))
    .filter((printing) => language === null || printing.language === language)
    .slice(0, MAX_MATCHES);

  return (
    <ComboboxPicker
      trigger="input"
      inline
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- shown only after the admin asks to search all cards
      autoFocus
      aria-label="Printing of any card"
      placeholder="Name or code, e.g. OGN-030"
      disabled={disabled}
      options={matches.map((printing) => ({
        value: printing.printingId,
        label: [
          printing.card.name,
          formatPrintingCode(printing.publicCode),
          enumLabel(labels.finishes, printing.finish),
          printing.language,
        ].join(" · "),
      }))}
      filter="none"
      query={query}
      onQueryChange={setQuery}
      hint={
        query.trim().length < MIN_QUERY_LENGTH
          ? `Type ${MIN_QUERY_LENGTH} characters to search.`
          : undefined
      }
      emptyText="No printing matches."
      value={null}
      onChange={(printingId) => {
        if (printingId !== null) {
          onPick(printingId);
        }
      }}
      clearOnSelect
    />
  );
}

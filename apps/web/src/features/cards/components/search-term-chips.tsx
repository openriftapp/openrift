import { removeSearchSpan } from "@openrift/shared/search-query/edit";

import { FilterChip } from "@/components/ui/filter-chip";
import type { SearchTermChip } from "@/features/cards/lib/search-clause-labels";
import { m } from "@/paraglide/messages.js";

interface SearchTermChipsProps {
  query: string;
  terms: readonly SearchTermChip[];
  onQueryChange: (query: string) => void;
}

export function SearchTermChips({ query, terms, onQueryChange }: SearchTermChipsProps) {
  return (
    <ul aria-label={m.search_query_label()} className="contents">
      {terms.map((term) => (
        <li key={term.id} className="flex max-w-full min-w-0">
          <FilterChip
            wrap
            tone={term.tone === "term" ? undefined : term.tone}
            label={term.text}
            removeLabel={m.cards_filter_remove_search_term({
              term: query.slice(term.span.start, term.span.end),
            })}
            onRemove={() => onQueryChange(removeSearchSpan(query, term.span))}
          />
        </li>
      ))}
    </ul>
  );
}

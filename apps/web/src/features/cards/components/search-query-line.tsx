import type { SearchVocabulary } from "@openrift/shared/search-query/bind";

import { SearchAlternativeLinks } from "@/features/cards/components/search-alternative-links";
import { SearchTermChips } from "@/features/cards/components/search-term-chips";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import type { SearchAlternative } from "@/features/cards/lib/search-alternative";
import type { SearchValueLabeler } from "@/features/cards/lib/search-clause-labels";
import { describeSearchTerms } from "@/features/cards/lib/search-clause-labels";

interface SearchQueryLineProps {
  filteredCount: number;
  showTerms: boolean;
  vocabulary: SearchVocabulary;
  valueLabel: SearchValueLabeler;
  alternatives?: readonly SearchAlternative[];
}

export function SearchQueryLine({
  filteredCount,
  showTerms,
  vocabulary,
  valueLabel,
  alternatives = [],
}: SearchQueryLineProps) {
  const { filterState, queryFilterSpans } = useFilterValues();
  const { setSearch } = useFilterActions();
  const terms = showTerms
    ? describeSearchTerms(filterState.search, vocabulary, valueLabel, queryFilterSpans)
    : [];
  const shownAlternatives = filteredCount > 0 ? alternatives : [];

  if (terms.length === 0 && shownAlternatives.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-2 sm:mb-0">
      {terms.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <SearchTermChips query={filterState.search} terms={terms} onQueryChange={setSearch} />
        </div>
      )}
      <SearchAlternativeLinks alternatives={shownAlternatives} />
    </div>
  );
}

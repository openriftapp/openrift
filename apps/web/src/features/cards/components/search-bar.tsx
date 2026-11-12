import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { Link } from "@tanstack/react-router";
import { CircleHelpIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { SearchInput } from "@/components/search-input";
import { TextLink } from "@/components/ui/text-link";
import {
  SearchSuggestionList,
  suggestionOptionId,
} from "@/features/cards/components/search-suggestion-list";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import type { SearchSuggestion } from "@/features/cards/lib/search-suggestions";
import { applySuggestion, searchSuggestions } from "@/features/cards/lib/search-suggestions";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface SearchBarProps {
  totalCards: number;
  filteredCount: number;
  suggestionVocabulary?: SearchVocabulary;
  countInPlaceholder?: boolean;
  className?: string;
}

const NO_VOCABULARY: SearchVocabulary = {};

function unitCount(view: string, count: number): string {
  if (view === "cards") {
    return m.common_cards({ count });
  }
  return view === "copies" ? m.common_copies({ count }) : m.common_printings({ count });
}

export function SearchBar({
  totalCards,
  filteredCount,
  suggestionVocabulary = NO_VOCABULARY,
  countInPlaceholder,
  className,
}: SearchBarProps) {
  const { filterState, hasActiveFilters, view } = useFilterValues();
  const { setSearch } = useFilterActions();

  const [searchFocused, setSearchFocused] = useState(false);
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredCountRef = useRef(filteredCount);
  useEffect(() => {
    filteredCountRef.current = filteredCount;
  }, [filteredCount]);

  const commitSearch = (value: string) => {
    setSearch(value);
    if (value) {
      trackEvent("search", { query: value, resultCount: filteredCountRef.current });
    }
  };

  const [localSearch, setLocalSearch] = useSearchUrlSync({
    urlValue: filterState.search,
    onCommit: commitSearch,
  });

  const isFiltered = hasActiveFilters && filteredCount !== totalCards;
  const countInField = countInPlaceholder && !isFiltered;
  const placeholder = countInField
    ? m.cards_browser_search_placeholder_count({ items: unitCount(view, totalCards) })
    : m.cards_browser_search_placeholder();

  const suggestions =
    searchFocused && !suggestionsDismissed
      ? searchSuggestions(localSearch, Math.min(caret, localSearch.length), suggestionVocabulary)
      : null;
  const activeSuggestion =
    suggestions && activeIndex >= 0 && activeIndex < suggestions.suggestions.length
      ? activeIndex
      : -1;

  const updateQuery = (value: string, nextCaret: number) => {
    setLocalSearch(value);
    setCaret(nextCaret);
    setActiveIndex(-1);
    setSuggestionsDismissed(false);
  };

  const pick = (suggestion: SearchSuggestion) => {
    if (!suggestions) {
      return;
    }
    const applied = applySuggestion(localSearch, suggestions, suggestion);
    updateQuery(applied.query, applied.caret);
    const input = inputRef.current;
    if (input) {
      requestAnimationFrame(() => input.setSelectionRange(applied.caret, applied.caret));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const options = suggestions?.suggestions ?? [];
    if (options.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((activeSuggestion + step + options.length) % options.length);
        return;
      }
      const tabTarget =
        options[activeSuggestion] ?? (options[0]?.kind === "value" ? options[0] : null);
      if (event.key === "Tab" && !event.shiftKey && tabTarget) {
        event.preventDefault();
        pick(tabTarget);
        return;
      }
      if (event.key === "Enter" && activeSuggestion >= 0) {
        event.preventDefault();
        pick(options[activeSuggestion] as SearchSuggestion);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSuggestionsDismissed(true);
        return;
      }
    }
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  };

  const cardCountLabel = isFiltered
    ? `${filteredCount} / ${unitCount(view, totalCards)}`
    : unitCount(view, totalCards);

  const showSuggestions = suggestions !== null && suggestions.suggestions.length > 0;

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <div className="relative">
        <SearchInput
          className="w-full"
          inputRef={inputRef}
          value={localSearch}
          onValueChange={(value) => {
            updateQuery(value, inputRef.current?.selectionStart ?? value.length);
          }}
          onClear={() => {
            updateQuery("", 0);
            setSearch("");
          }}
          placeholder={placeholder}
          trailing={countInField ? undefined : cardCountLabel}
          action={
            <TextLink
              variant="muted"
              className="flex items-center"
              aria-label={m.search_syntax_link()}
              title={m.search_syntax_link()}
              render={<Link to="/help/$slug" params={{ slug: "search-syntax" }} />}
            >
              <CircleHelpIcon className="size-3.5" />
            </TextLink>
          }
          onFocus={() => {
            setSearchFocused(true);
            setCaret(inputRef.current?.selectionStart ?? localSearch.length);
          }}
          onBlur={() => {
            setSearchFocused(false);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          suggestionsId={showSuggestions ? listId : undefined}
          activeSuggestionId={
            showSuggestions && activeSuggestion >= 0
              ? suggestionOptionId(listId, activeSuggestion)
              : undefined
          }
        />
        {showSuggestions && (
          <SearchSuggestionList
            id={listId}
            suggestions={suggestions.suggestions}
            activeIndex={activeSuggestion}
            onPick={pick}
          />
        )}
      </div>
    </div>
  );
}

import { Pressable } from "@/components/ui/pressable";
import { searchKeyLabel } from "@/features/cards/lib/search-clause-labels";
import type { SearchSuggestion } from "@/features/cards/lib/search-suggestions";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface SearchSuggestionListProps {
  id: string;
  suggestions: SearchSuggestion[];
  activeIndex: number;
  onPick: (suggestion: SearchSuggestion) => void;
}

export function suggestionOptionId(listId: string, index: number): string {
  return `${listId}-${index}`;
}

export function SearchSuggestionList({
  id,
  suggestions,
  activeIndex,
  onPick,
}: SearchSuggestionListProps) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label={m.search_suggestions_label()}
      className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 w-full max-w-sm rounded-md border p-1 shadow-md"
    >
      {suggestions.map((suggestion, index) => (
        <Pressable
          key={`${suggestion.kind}-${suggestion.insert}`}
          id={suggestionOptionId(id, index)}
          role="option"
          aria-selected={index === activeIndex}
          tabIndex={-1}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1 text-sm",
            index === activeIndex ? "bg-muted" : "hover:bg-muted",
          )}
          // Keeps focus (and the caret) in the input.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(suggestion)}
        >
          <span className="font-mono">{suggestion.label}</span>
          <span className="text-muted-foreground text-xs">{searchKeyLabel(suggestion.key)}</span>
        </Pressable>
      ))}
    </div>
  );
}

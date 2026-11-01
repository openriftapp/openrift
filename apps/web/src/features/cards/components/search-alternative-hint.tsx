import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import { useFilterMetaOptional } from "@/features/cards/components/card-browser-filter-scaffold";
import {
  alternativeLabel,
  alternativeSearch,
} from "@/features/cards/components/search-alternative-links";
import { m } from "@/paraglide/messages.js";

export function SearchAlternativeHint() {
  const alternatives = useFilterMetaOptional()?.searchAlternatives ?? [];
  if (alternatives.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-muted-foreground">{m.cards_search_hint_text()}</p>
      {alternatives.map((alternative) => (
        <Link
          key={alternative.kind}
          to="."
          search={alternativeSearch(alternative.query)}
          className={buttonVariants({ variant: "outline" })}
        >
          {alternativeLabel(alternative)}
        </Link>
      ))}
    </div>
  );
}

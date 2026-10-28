import { useRouter } from "@tanstack/react-router";
import { useContext } from "react";

import { Button } from "@/components/ui/button";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { searchAlternative } from "@/features/cards/lib/search-alternative";
import { m } from "@/paraglide/messages.js";

export function SearchAlternativeHint() {
  const search = useContext(FilterSearchProvider);
  const router = useRouter();
  const alternative = search?.q ? searchAlternative(search.q) : null;
  if (!alternative) {
    return null;
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-muted-foreground">{m.cards_search_hint_text()}</p>
      <Button
        variant="outline"
        onClick={() =>
          void router.navigate({
            to: ".",
            search: (prev: Record<string, unknown>) => ({ ...prev, q: alternative }),
          })
        }
      >
        {m.cards_search_hint_try({ query: alternative })}
      </Button>
    </div>
  );
}

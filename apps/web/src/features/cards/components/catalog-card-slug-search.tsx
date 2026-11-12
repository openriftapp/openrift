import { useState } from "react";

import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCatalogCardSearch } from "@/features/cards/hooks/use-catalog-card-search";

export function CatalogCardSlugSearch({
  onPick,
  autoFocus,
}: {
  onPick: (cardSlug: string) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useCatalogCardSearch(query);
  const { cardsById } = useCards();

  return (
    <CardSearchDropdown
      results={results}
      onSearch={setQuery}
      onSelect={(cardId) => {
        const slug = cardsById[cardId]?.slug;
        if (slug) {
          onPick(slug);
        }
      }}
      placeholder="Search the catalog…"
      className="w-full"
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- forwarded; each caller states why
      autoFocus={autoFocus}
    />
  );
}

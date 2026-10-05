import type { Card } from "@openrift/shared/types/catalog";
import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Input } from "@/components/ui/input";
import { CardPickerButton } from "@/features/cards/components/card-picker-button";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { cardSearchLeading } from "@/features/cards/components/printing-option-content";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCatalogCardSearch } from "@/features/cards/hooks/use-catalog-card-search";
import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";
import { m } from "@/paraglide/messages.js";

type CatalogCardPick = (card: Card, catalog: UseCardsResult, cardId: string) => void;

/** The catalog loads only once the picker opens. */
export function CatalogCardPicker({
  label,
  onPick,
  variant = "outline",
  size = "sm",
  icon,
  disabled,
}: {
  label: string;
  onPick: CatalogCardPick;
  variant?: "outline" | "ghost";
  size?: "xs" | "sm";
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <CardPickerButton
      type="button"
      variant={variant}
      size={size}
      label={label}
      icon={icon ?? <SearchIcon className="size-4" />}
      disabled={disabled}
      closeLabel={m.cards_catalog_picker_close()}
    >
      {({ close }) => (
        <Suspense
          fallback={
            <Input className="w-56" placeholder={m.cards_catalog_picker_loading()} disabled />
          }
        >
          <CatalogSearch
            onPick={(card, catalog, cardId) => {
              close();
              onPick(card, catalog, cardId);
            }}
          />
        </Suspense>
      )}
    </CardPickerButton>
  );
}

// Split out so useCards suspends inside the boundary above, not on the page's first render.
function CatalogSearch({ onPick }: { onPick: CatalogCardPick }) {
  const [search, setSearch] = useState("");
  const results = useCatalogCardSearch(search, undefined, cardSearchLeading);
  const catalog = useCards();

  const handleSelect = (cardId: string) => {
    const card = catalog.cardsById[cardId];
    if (!card) {
      return;
    }
    onPick(card, catalog, cardId);
  };

  return (
    <CardSearchDropdown
      results={results}
      onSearch={setSearch}
      onSelect={handleSelect}
      placeholder={m.cards_catalog_picker_placeholder()}
      className="w-56"
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the trigger button just swapped itself for this input
      autoFocus
    />
  );
}

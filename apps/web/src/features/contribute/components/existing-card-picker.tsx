import { SearchIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { Input } from "@/components/ui/input";
import { CardPickerButton } from "@/features/cards/components/card-picker-button";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { cardSearchLeading } from "@/features/cards/components/printing-option-content";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCatalogCardSearch } from "@/features/cards/hooks/use-catalog-card-search";
import type { ContributeFormState } from "@/features/contribute/lib/contribute-json";
import { prefillFromCard } from "@/features/contribute/lib/contribute-json";
import { m } from "@/paraglide/messages.js";

export function ExistingCardPicker({
  onPick,
}: {
  onPick: (prefilled: ContributeFormState) => void;
}) {
  return (
    <CardPickerButton
      type="button"
      variant="ghost"
      size="sm"
      label={m.contribute_picker_select_existing()}
      icon={<SearchIcon className="size-4" />}
      closeLabel={m.contribute_picker_close()}
    >
      {({ close }) => (
        <Suspense
          fallback={<Input className="w-56" placeholder={m.contribute_picker_loading()} disabled />}
        >
          <CatalogSearch
            onPick={(prefilled) => {
              close();
              onPick(prefilled);
            }}
          />
        </Suspense>
      )}
    </CardPickerButton>
  );
}

// Split out so useCards suspends inside the boundary above, not on the form's first render.
function CatalogSearch({ onPick }: { onPick: (prefilled: ContributeFormState) => void }) {
  const [search, setSearch] = useState("");
  const results = useCatalogCardSearch(search, undefined, cardSearchLeading);
  const { cardsById, printingsByCardId, sets } = useCards();

  const handleSelect = (cardId: string) => {
    const card = cardsById[cardId];
    if (!card) {
      return;
    }
    const setSlugById = new Map(sets.map((set) => [set.id, set.slug]));
    const setNameById = new Map(sets.map((set) => [set.id, set.name]));
    onPick(prefillFromCard(card, printingsByCardId.get(cardId) ?? [], setSlugById, setNameById));
  };

  return (
    <CardSearchDropdown
      results={results}
      onSearch={setSearch}
      onSelect={handleSelect}
      placeholder={m.contribute_picker_placeholder()}
      className="w-56"
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the trigger button just swapped itself for this input
      autoFocus
    />
  );
}

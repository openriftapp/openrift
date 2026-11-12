import { buildCardLookupIndex } from "@openrift/shared/card-lookup";
import { legendDisplayName } from "@openrift/shared/card-name";
import { enumLabel } from "@openrift/shared/enum-label";
import { XIcon } from "lucide-react";
import { useState } from "react";

import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { PreferredPrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { useCardSearch } from "@/features/cards/hooks/use-card-search";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import type { HoverHandler } from "@/features/cards/lib/card-row-interactions";
import type { CardSearchResult } from "@/features/cards/lib/card-search-result";
import { EnergyGlyph, PowerPips } from "@/features/decks/components/deck-card-row";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useEnumOrders } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface CardCandidate {
  cardId: string;
  cardName?: string;
}

/**
 * Rendered as its own component so the chip and the picker's dropdown rows
 * show the same power pips and energy glyph without either owning the lookup.
 */
function CardStats({ cardId }: { cardId: string }) {
  const { getPreferredPrinting } = usePreferredPrinting();
  const domainColors = useDomainColors();
  const { labels } = useEnumOrders();
  const card = getPreferredPrinting(cardId)?.card;
  const powerPips = card?.power ?? 0;
  const energy = card?.energy ?? null;
  if (powerPips <= 0 && energy === null) {
    return null;
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <PowerPips
        power={powerPips}
        domains={card?.domains ?? []}
        colors={domainColors}
        domainLabels={labels.domains}
      />
      {energy !== null && <EnergyGlyph value={energy} />}
    </span>
  );
}

const MAX_PICKER_RESULTS = 50;

const PICKER_MIN_QUERY_LENGTH = 1;

// An empty query lists the whole candidate set for a zone-backed dropdown;
// a catalog-backed caller turns listAllWhenEmpty off instead.
function usePickerResults(
  candidates: readonly CardCandidate[],
  query: string,
  listAllWhenEmpty: boolean,
): CardSearchResult[] {
  const { cardsById, printingsByCardId } = useCards();
  const { getPreferredPrinting } = usePreferredPrinting();
  const { labels } = useEnumOrders();
  const cards = candidates.map(({ cardId, cardName }) => {
    const card = cardsById[cardId];
    return card
      ? { id: cardId, slug: cardId, name: card.name, types: card.types, tags: card.tags }
      : { id: cardId, slug: cardId, name: cardName ?? cardId, types: [], tags: [] };
  });
  const index = buildCardLookupIndex(
    cards,
    cards.flatMap((card) => printingsByCardId.get(card.id) ?? []),
  );

  const matches = useCardSearch(index, query.trim(), MAX_PICKER_RESULTS, PICKER_MIN_QUERY_LENGTH);
  const rowsById = new Map(index.entries.map((entry) => [entry.card.id, entry.card]));
  const emptyList = listAllWhenEmpty
    ? cards.flatMap((card) => rowsById.get(card.id) ?? []).slice(0, MAX_PICKER_RESULTS)
    : [];
  const shown = query.trim() === "" ? emptyList : matches;

  return shown.map((card) => {
    const printing = getPreferredPrinting(card.id);
    const detail = printing?.card.types.map((slug) => enumLabel(labels.cardTypes, slug)).join(" ");
    return {
      id: card.id,
      label: card.displayName,
      detail,
      leading: <PreferredPrintingThumbnail cardId={card.id} className="h-8" />,
      adornment: <CardStats cardId={card.id} />,
    };
  });
}

export function CardChip({
  cardId,
  onRemove,
  onHoverCard,
  variant = "pill",
}: {
  cardId: string;
  onRemove?: () => void;
  onHoverCard?: HoverHandler;
  variant?: "pill" | "field";
}) {
  const { getPreferredPrinting } = usePreferredPrinting();
  const printing = getPreferredPrinting(cardId);
  const field = variant === "field";
  return (
    <span
      className={cn(
        "min-w-0 items-center text-sm",
        field
          ? "dark:bg-input/30 border-input flex h-8 w-full gap-2 rounded-lg border bg-transparent px-2.5"
          : "bg-muted inline-flex gap-1.5 rounded-md py-0.5 pr-1 pl-1.5",
      )}
      onMouseEnter={() => onHoverCard?.(cardId)}
      onMouseLeave={() => onHoverCard?.(null)}
    >
      <PreferredPrintingThumbnail cardId={cardId} className="h-5" />
      <span className="min-w-0 truncate">
        {printing ? legendDisplayName(printing.card) : m.decks_editor_unknown_card()}
      </span>
      <CardStats cardId={cardId} />
      {onRemove ? (
        <ChipRemoveButton
          onClick={onRemove}
          aria-label={m.decks_editor_remove()}
          className={cn("text-muted-foreground shrink-0 p-0.5", field ? "ml-auto" : "ml-0")}
        >
          <XIcon className="size-3.5" />
        </ChipRemoveButton>
      ) : null}
    </span>
  );
}

// Remounts the dropdown after each pick; otherwise its input keeps the chosen label.
export function CardPicker({
  candidates,
  onSelect,
  placeholder,
  listAllWhenEmpty = true,
}: {
  candidates: readonly CardCandidate[];
  onSelect: (cardId: string) => void;
  placeholder: string;
  listAllWhenEmpty?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const results = usePickerResults(candidates, query, listAllWhenEmpty);
  // The combobox fires onInputValueChange with the picked label on selection,
  // which would leave `query` stuck on it; clearing on the resetKey bump wins.
  const [clearedFor, setClearedFor] = useState(resetKey);
  if (clearedFor !== resetKey) {
    setClearedFor(resetKey);
    setQuery("");
  }
  return (
    <CardSearchDropdown
      key={resetKey}
      results={results}
      onSearch={setQuery}
      onSelect={(cardId) => {
        onSelect(cardId);
        setResetKey((key) => key + 1);
      }}
      placeholder={placeholder}
      className="h-(--control-h)"
    />
  );
}

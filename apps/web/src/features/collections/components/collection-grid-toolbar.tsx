import type { Printing } from "@openrift/shared/types/catalog";
import type { GroupByField } from "@openrift/shared/types/search";
import { HeartIcon, LibraryBigIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { BrowserToolbar } from "@/features/cards/components/card-browser-filter-scaffold";
import { defaultGroupByOptions } from "@/features/cards/components/options-bar";
import { groupByLabel } from "@/features/cards/lib/group-by-field";
import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { m } from "@/paraglide/messages.js";

interface CollectionGridToolbarProps {
  sortedCards: Printing[];
  stackByPrintingId: Map<string, StackedEntry>;
  view: "cards" | "printings" | "copies";
  dataView: "cards" | "printings";
  hasActiveFilters: boolean;
  totalCopies: number;
  totalUniqueCards: number;
  showLibrary: boolean;
  collectionGroupingAvailable: boolean;
  groupBy: GroupByField;
  isGroupCollection: boolean;
  wantedOnly: boolean;
  onWantedOnlyChange?: (next: boolean) => void;
  addTarget: string | undefined;
  onToggleLibrary: () => void;
}

export function CollectionGridToolbar({
  sortedCards,
  stackByPrintingId,
  view,
  dataView,
  hasActiveFilters,
  totalCopies,
  totalUniqueCards,
  showLibrary,
  collectionGroupingAvailable,
  groupBy,
  isGroupCollection,
  wantedOnly,
  onWantedOnlyChange,
  addTarget,
  onToggleLibrary,
}: CollectionGridToolbarProps) {
  const wantedButton =
    isGroupCollection && onWantedOnlyChange ? (
      <Toggle
        variant="control"
        pressed={wantedOnly}
        onPressedChange={onWantedOnlyChange}
        title={wantedOnly ? m.collections_grid_wanted_show_all() : m.collections_grid_wanted_only()}
        aria-label={
          wantedOnly ? m.collections_grid_wanted_show_all() : m.collections_grid_wanted_only()
        }
      >
        <HeartIcon className="size-4" />
        <span className="hidden sm:inline">{m.collections_grid_wanted()}</span>
      </Toggle>
    ) : null;

  const showLibraryButton = addTarget ? (
    <Button
      variant="control"
      size="icon"
      onClick={onToggleLibrary}
      title={showLibrary ? m.collections_grid_hide_library() : m.collections_grid_show_library()}
      aria-label={
        showLibrary ? m.collections_grid_hide_library() : m.collections_grid_show_library()
      }
      aria-pressed={showLibrary}
    >
      <LibraryBigIcon className="size-4" />
    </Button>
  ) : null;

  // In cards+set / cards+rarity, a card splits into one tile per section, so
  // sortedCards over-counts; count distinct cardIds instead.
  const filteredCardCount =
    dataView === "cards"
      ? new Set(sortedCards.map((card) => card.cardId)).size
      : sortedCards.length;

  return (
    <BrowserToolbar
      totalCards={view === "copies" ? totalCopies : totalUniqueCards}
      filteredCount={
        view === "copies"
          ? sortedCards.reduce(
              (sum, card) => sum + (stackByPrintingId.get(card.id)?.copyIds.length ?? 0),
              0,
            )
          : filteredCardCount
      }
      mobileDoneLabel={
        hasActiveFilters
          ? dataView === "cards"
            ? m.collections_grid_show_cards({ count: filteredCardCount })
            : m.collections_grid_show_printings({ count: filteredCardCount })
          : undefined
      }
      extras={
        <>
          {wantedButton}
          {showLibraryButton}
        </>
      }
      showCopies={!showLibrary}
      groupByOptions={
        collectionGroupingAvailable
          ? [...defaultGroupByOptions(), { value: "collection", label: groupByLabel("collection") }]
          : undefined
      }
      groupByValue={groupBy}
    />
  );
}

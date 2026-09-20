import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFilterMetaOptional } from "@/features/cards/components/card-browser-filter-scaffold";
import {
  getApplicablePlacementUnits,
  placementUnitLabel,
  keepPlacementUnits,
} from "@/features/cards/lib/filter-sections";
import type { FilterPlacementUnit } from "@/features/cards/lib/filter-sections";
import { useCustomTagList } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface FilterPlacement {
  applicable: FilterPlacementUnit[];
  topLevel: ReadonlySet<string>;
  overridden: boolean;
  setPlacement: (key: string, top: boolean) => void;
  reset: () => void;
}

function useFilterPlacement(): FilterPlacement | null {
  const meta = useFilterMetaOptional();
  const topLevelFilters = useDisplayStore((state) => state.topLevelFilters);
  const setTopLevelFilters = useDisplayStore((state) => state.setTopLevelFilters);
  const overridden = useDisplayStore((state) => state.overrides.topLevelFilters !== null);
  const resetPreference = useDisplayStore((state) => state.resetPreference);
  const { byCategory } = useCustomTagList();

  if (!meta) {
    return null;
  }

  const customTagCategoryCount = meta.visibleCustomTagCategories
    ? [...byCategory.keys()].filter((category) => meta.visibleCustomTagCategories?.has(category))
        .length
    : byCategory.size;

  const applicable = getApplicablePlacementUnits({
    availableFilters: meta.availableFilters,
    availableLanguages: meta.availableLanguages,
    surfaceHiddenSections: meta.hiddenSections,
    customTagCategoryCount,
  });

  if (applicable.length === 0) {
    return null;
  }

  const setPlacement = (key: string, top: boolean) => {
    const next = new Set(keepPlacementUnits(topLevelFilters));
    if (top) {
      next.add(key);
    } else {
      next.delete(key);
    }
    setTopLevelFilters([...next]);
  };

  return {
    applicable,
    topLevel: new Set(keepPlacementUnits(topLevelFilters)),
    overridden,
    setPlacement,
    reset: () => resetPreference("topLevelFilters"),
  };
}

function FilterPlacementBody({ placement }: { placement: FilterPlacement }) {
  return (
    <>
      <p className="text-muted-foreground pb-1 text-xs">{m.cards_filter_placement_description()}</p>
      <div className="flex flex-col">
        {placement.applicable.map((unit) => {
          const isTop = placement.topLevel.has(unit.key);
          return (
            <div key={unit.key} className="flex items-center justify-between gap-2 px-1 py-1">
              <span className="min-w-0 flex-1 truncate">{placementUnitLabel(unit.key)}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant={isTop ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("h-6 px-2", !isTop && "text-muted-foreground")}
                  aria-pressed={isTop}
                  onClick={() => placement.setPlacement(unit.key, true)}
                >
                  {m.cards_filter_placement_top()}
                </Button>
                <Button
                  variant={isTop ? "ghost" : "secondary"}
                  size="sm"
                  className={cn("h-6 px-2", isTop && "text-muted-foreground")}
                  aria-pressed={!isTop}
                  onClick={() => placement.setPlacement(unit.key, false)}
                >
                  {m.cards_filter_placement_more()}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {placement.overridden && (
        <div className="flex items-center justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={() => placement.reset()}>
            {m.cards_reset_to_default()}
          </Button>
        </div>
      )}
    </>
  );
}

/** Inline section for the desktop display popover; renders nothing off a card-browser surface. */
export function FilterPlacementSection() {
  const placement = useFilterPlacement();
  if (!placement) {
    return null;
  }
  return (
    <div className="flex flex-col">
      <p className="text-xs font-medium">{m.cards_filter_placement_title()}</p>
      <FilterPlacementBody placement={placement} />
    </div>
  );
}

export function FilterCustomizeControl({ className }: { className?: string }) {
  const placement = useFilterPlacement();
  if (!placement) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        className={cn("text-muted-foreground relative", className)}
        aria-label={
          placement.overridden ? m.cards_customize_filters_changed() : m.cards_customize_filters()
        }
      >
        <SlidersHorizontalIcon className="size-4" />
        {placement.overridden && (
          <span className="bg-primary ring-background absolute top-0.5 right-0.5 size-2 rounded-full ring-2" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>{m.cards_filter_placement_title()}</PopoverTitle>
        </PopoverHeader>
        <FilterPlacementBody placement={placement} />
      </PopoverContent>
    </Popover>
  );
}

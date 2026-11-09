import { LayoutGridIcon, ListIcon, RotateCcwIcon, SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColumnControls } from "@/features/cards/components/column-controls";
import { DetailPaneToggle, MobileOptionsDrawer } from "@/features/cards/components/options-bar";
import { SortGroupControls } from "@/features/cards/components/sort-group-controls";
import type { SortGroupOption } from "@/features/cards/components/sort-group-controls";
import { deckOverviewSortOptions } from "@/features/decks/components/deck-overview-list";
import type { DeckOverviewGroup } from "@/features/decks/lib/deck-card-group";
import type { DeckOverviewSort } from "@/features/decks/lib/deck-overview-list-sort";
import type { DeckOverviewDisplayMode } from "@/features/decks/stores/deck-overview-view-store";
import { useDeckOverviewViewStore } from "@/features/decks/stores/deck-overview-view-store";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Built once by the overview and handed to both control clusters: the Box tab
// carries the same ordering control as the Deck tab, since the box lists the
// deck in that order.
export interface DeckOrderingControls {
  sortBy: DeckOverviewSort;
  sortDir: "asc" | "desc";
  onSortByChange: (value: DeckOverviewSort) => void;
  onSortDirChange: (value: "asc" | "desc") => void;
  groupOptions: SortGroupOption<DeckOverviewGroup>[];
  groupBy: DeckOverviewGroup;
  groupDir: "asc" | "desc";
  onGroupByChange: (value: DeckOverviewGroup) => void;
  onGroupDirChange: (value: "asc" | "desc") => void;
}

interface DeckOptionSwitch {
  key: string;
  label: string;
  description?: string;
  checked: boolean;
  modified: boolean;
  nested?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function OptionSwitchRow({
  label,
  description,
  checked,
  nested,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  nested?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Label className={cn("justify-between gap-3 leading-normal font-normal", nested && "pl-4")}>
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {description && <span className="text-muted-foreground text-xs">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </Label>
  );
}

export function DeckOrderingControl({
  ordering,
  compact,
}: {
  ordering: DeckOrderingControls;
  compact?: boolean;
}) {
  const handleSortByChange = ordering.onSortByChange;
  const handleSortDirChange = ordering.onSortDirChange;
  return (
    <SortGroupControls
      compact={compact}
      sortOptions={deckOverviewSortOptions()}
      sortBy={ordering.sortBy}
      sortDir={ordering.sortDir}
      onSortByChange={handleSortByChange}
      onSortDirChange={handleSortDirChange}
      group={{
        options: ordering.groupOptions,
        value: ordering.groupBy,
        dir: ordering.groupDir,
        onValueChange: ordering.onGroupByChange,
        onDirChange: ordering.onGroupDirChange,
      }}
    />
  );
}

interface DeckOverviewViewControlsProps {
  compact?: boolean;
  displayMode: DeckOverviewDisplayMode;
  ordering: DeckOrderingControls;
  columnOverride: number | null;
  autoColumns: number;
  minColumns: number;
  maxColumnsLimit: number;
  showAllCopies: boolean;
  showAllRuneCopies: boolean;
  showBands: boolean;
  showPrices: boolean;
  showStatsSummary: boolean;
  hasStatsSummary: boolean;
  preferOwned: boolean;
  canPreferOwned: boolean;
  hasOwnershipData: boolean;
  paneToggle?: boolean;
}

export function DeckOverviewViewControls({
  compact,
  displayMode,
  ordering,
  columnOverride,
  autoColumns,
  minColumns,
  maxColumnsLimit,
  showAllCopies,
  showAllRuneCopies,
  showBands,
  showPrices,
  showStatsSummary,
  hasStatsSummary,
  preferOwned,
  canPreferOwned,
  hasOwnershipData,
  paneToggle = true,
}: DeckOverviewViewControlsProps) {
  const setDisplayMode = useDeckOverviewViewStore((state) => state.setDisplayMode);
  const setColumns = useDeckOverviewViewStore((state) => state.setColumns);
  const setShowAllCopies = useDeckOverviewViewStore((state) => state.setShowAllCopies);
  const setShowAllRuneCopies = useDeckOverviewViewStore((state) => state.setShowAllRuneCopies);
  const setShowOwnershipBands = useDeckOverviewViewStore((state) => state.setShowOwnershipBands);
  const setShowGridPrices = useDeckOverviewViewStore((state) => state.setShowPrices);
  const setShowListPrices = useDeckOverviewViewStore((state) => state.setShowListPrices);
  const setShowStatsSummary = useDeckOverviewViewStore((state) => state.setShowStatsSummary);
  const setPreferOwnedPrintings = useDeckOverviewViewStore(
    (state) => state.setPreferOwnedPrintings,
  );

  const hasThumbnails = displayMode !== "list";

  // Shared by both clusters: it's the one view control that stays on the row
  // on phones, since it changes what the cards look like, not how they sort.
  const displayModeToggle = (
    <ToggleGroup
      variant="control"
      spacing={0}
      value={[displayMode]}
      onValueChange={([next]) => {
        if (next === "grid" || next === "list") {
          setDisplayMode(next);
        }
      }}
      aria-label={m.decks_overview_display_mode()}
    >
      <Tooltip>
        <TooltipTrigger
          render={<ToggleGroupItem value="grid" aria-label={m.decks_overview_view_grid()} />}
        >
          <LayoutGridIcon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>{m.decks_overview_view_grid()}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={<ToggleGroupItem value="list" aria-label={m.decks_overview_view_list()} />}
        >
          <ListIcon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>{m.decks_overview_view_list()}</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );

  // `modified` drives the dot on the popover trigger: ownership, the stats
  // summary and list prices default to on, the rest to off.
  const optionSwitches: DeckOptionSwitch[] = [
    ...(hasStatsSummary
      ? [
          {
            key: "stats-summary",
            label: m.decks_overview_option_stats_summary(),
            checked: showStatsSummary,
            modified: !showStatsSummary,
            onCheckedChange: setShowStatsSummary,
          },
        ]
      : []),
    {
      key: "copies",
      label: m.decks_overview_option_every_copy(),
      description: hasThumbnails
        ? m.decks_overview_option_every_copy_hint()
        : m.decks_overview_option_every_copy_list_hint(),
      checked: showAllCopies,
      modified: showAllCopies,
      onCheckedChange: setShowAllCopies,
    },
    ...(showAllCopies
      ? [
          {
            key: "rune-copies",
            label: m.decks_overview_option_runes(),
            description: m.decks_overview_option_runes_hint(),
            checked: showAllRuneCopies,
            modified: showAllRuneCopies,
            nested: true,
            onCheckedChange: setShowAllRuneCopies,
          },
        ]
      : []),
    ...(canPreferOwned
      ? [
          {
            key: "bands",
            label: m.decks_overview_option_bands(),
            description: hasThumbnails
              ? m.decks_overview_option_bands_hint()
              : m.decks_overview_option_bands_list_hint(),
            checked: showBands,
            modified: !showBands,
            onCheckedChange: setShowOwnershipBands,
          },
        ]
      : []),
    ...(hasOwnershipData
      ? [
          {
            key: "prices",
            label: m.decks_overview_option_prices(),
            checked: showPrices,
            modified: hasThumbnails ? showPrices : !showPrices,
            onCheckedChange: hasThumbnails ? setShowGridPrices : setShowListPrices,
          },
        ]
      : []),
    ...(canPreferOwned
      ? [
          {
            key: "owned-printings",
            label: m.decks_overview_option_owned_printings(),
            description: m.decks_overview_option_owned_printings_hint(),
            checked: preferOwned,
            modified: preferOwned,
            onCheckedChange: setPreferOwnedPrintings,
          },
        ]
      : []),
  ];

  const optionSwitchRows = optionSwitches.map((option) => (
    <OptionSwitchRow
      key={option.key}
      label={option.label}
      description={option.description}
      checked={option.checked}
      nested={option.nested}
      // oxlint-disable-next-line react/jsx-handler-names -- forwarded store setter, name fixed by the descriptor
      onCheckedChange={option.onCheckedChange}
    />
  ));

  if (compact) {
    return (
      <MobileOptionsDrawer>
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-muted-foreground w-18 text-xs font-medium">
            {m.decks_overview_display_mode()}
          </p>
          {displayModeToggle}
        </div>
        {hasThumbnails && (
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-muted-foreground w-18 text-xs font-medium">
              {m.decks_overview_columns()}
            </p>
            <ColumnControls
              compact
              maxColumns={columnOverride}
              autoColumns={autoColumns}
              minColumns={minColumns}
              maxColumnsLimit={maxColumnsLimit}
              onMaxColumnsChange={setColumns}
            />
          </div>
        )}
        <DeckOrderingControl compact ordering={ordering} />
        {optionSwitchRows.length > 0 && (
          <div className="flex flex-col gap-4 pt-4">{optionSwitchRows}</div>
        )}
      </MobileOptionsDrawer>
    );
  }

  const optionsModified = optionSwitches.some((option) => option.modified);

  const optionsPopover = optionSwitches.length > 0 && (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button variant="outline" size="icon" />}
              className="relative"
              aria-label={
                optionsModified
                  ? m.decks_overview_display_options_changed()
                  : m.decks_overview_display_options()
              }
            />
          }
        >
          <SlidersHorizontalIcon className="size-4" />
          {optionsModified && (
            <span className="bg-primary ring-background absolute top-0.5 right-0.5 size-2 rounded-full ring-2" />
          )}
        </TooltipTrigger>
        <TooltipContent>{m.decks_overview_display_options()}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 gap-4">
        {hasThumbnails && (
          <div className="hidden min-w-0 items-center gap-2 md:max-lg:flex">
            <p className="text-muted-foreground w-18 text-xs font-medium">
              {m.decks_overview_columns()}
            </p>
            <ColumnControls
              compact
              maxColumns={columnOverride}
              autoColumns={autoColumns}
              minColumns={minColumns}
              maxColumnsLimit={maxColumnsLimit}
              onMaxColumnsChange={setColumns}
            />
          </div>
        )}
        {optionSwitchRows}
        {optionsModified && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              for (const option of optionSwitches) {
                if (option.modified) {
                  option.onCheckedChange(!option.checked);
                }
              }
            }}
          >
            <RotateCcwIcon className="size-4" />
            {m.decks_overview_options_reset()}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex items-center gap-2">
      {hasThumbnails && (
        <div className="contents md:max-lg:hidden">
          <ColumnControls
            maxColumns={columnOverride}
            autoColumns={autoColumns}
            minColumns={minColumns}
            maxColumnsLimit={maxColumnsLimit}
            onMaxColumnsChange={setColumns}
          />
        </div>
      )}
      <DeckOrderingControl ordering={ordering} />
      {displayModeToggle}
      {optionsPopover}
      {paneToggle && <DetailPaneToggle />}
    </div>
  );
}

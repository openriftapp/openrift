import type { AvailableFilters } from "@openrift/shared/filters-available";
import type { FilterCounts } from "@openrift/shared/filters-counts";
import type { PresenceDimension } from "@openrift/shared/types/search";
import { CheckIcon, ChevronDownIcon, MinusIcon } from "lucide-react";
import { Fragment } from "react";

import { MultiSelectCombobox } from "@/components/multi-select-combobox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterRangeSections } from "@/features/cards/components/filter-range-sections";
import {
  FilterValueDropdown,
  FilterVariantDropdown,
} from "@/features/cards/components/filter-value-dropdown";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import {
  useSingleActiveFilterLabel,
  useVisibleFilterDimensions,
} from "@/features/cards/hooks/use-filter-dimensions";
import { filterDimension, ownedBuckets } from "@/features/cards/lib/filter-dimensions";
import { nextOversize, oversizeCount, oversizeState } from "@/features/cards/lib/oversize-filter";
import type { PresenceParamValue } from "@/features/cards/lib/presence-filter";
import {
  presenceLabel,
  presenceFlagCount,
  presenceToFlagState,
} from "@/features/cards/lib/presence-filter";
import { groupTagsByCategory } from "@/features/collections/lib/tag-category-groups";
import { useCustomTagList, useTagCategories } from "@/hooks/use-enums";
import type { SignedFilterBinding } from "@/lib/filter-sign";
import { bindSignedFilter } from "@/lib/filter-sign";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface FilterMoreMenuProps {
  availableFilters: AvailableFilters;
  availableLanguages?: string[];
  setDisplayLabel?: (code: string) => string;
  hiddenSections?: ReadonlySet<string>;
  /** See {@link FilterPanelContentProps.visibleCustomTagCategories}. */
  visibleCustomTagCategories?: ReadonlySet<string>;
  filterCounts?: FilterCounts;
  /** See {@link FilterPanelContentProps.ownedCountMax}. */
  ownedCountMax?: number;
  activeCount: number;
  /** Menu hosts every applicable unit not in this set, including demoted core dimensions. */
  topLevelUnits: ReadonlySet<string>;
}

function FlagMenuItem({
  label,
  state,
  count,
  onToggle,
}: {
  label: string;
  state: boolean | null;
  count?: number;
  onToggle: () => void;
}) {
  const isZero = count !== undefined && count === 0;
  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={onToggle}
      className={cn("pr-8", isZero && state === null && "opacity-40")}
    >
      <span className="flex-1">
        {label}
        {count !== undefined && (
          <span className="text-muted-foreground text-2xs ml-1.5 tabular-nums">{count}</span>
        )}
      </span>
      {state !== null && (
        <span className="absolute right-2 flex size-4 items-center justify-center">
          {state ? <CheckIcon className="size-4" /> : <MinusIcon className="size-4" />}
        </span>
      )}
    </DropdownMenuItem>
  );
}

function groupCount(counts: Map<string, number> | undefined, group: string): number | undefined {
  return counts === undefined ? undefined : (counts.get(group) ?? 0);
}

interface DimensionOption {
  value: string;
  label: string;
  count?: number;
}

function MoreDimension({
  label,
  options,
  included,
  onIncludeChange,
  excluded,
  signed,
  searchPlaceholder,
  emptyText,
  flag,
  anyCount,
}: {
  label: string;
  options: readonly DimensionOption[];
  included: string[];
  onIncludeChange?: (next: string[]) => void;
  excluded?: string[];
  signed?: SignedFilterBinding;
  searchPlaceholder: string;
  emptyText: string;
  flag?: { label: string; state: boolean | null; count?: number; onToggle: () => void };
  anyCount?: number;
}) {
  if (options.length === 0) {
    return null;
  }
  const counts = new Map(
    options.flatMap((option) => (option.count === undefined ? [] : [[option.value, option.count]])),
  );
  const facetedCounts = counts.size > 0 ? counts : undefined;
  const excludeCapable = excluded !== undefined && signed !== undefined;
  return (
    <MultiSelectCombobox
      triggerStyle="menu"
      label={label}
      options={options}
      selected={included}
      onChange={excludeCapable ? undefined : onIncludeChange}
      excluded={excludeCapable ? excluded : undefined}
      {...(excludeCapable ? signed : undefined)}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      counts={facetedCounts}
      flags={flag ? [flag] : undefined}
      flagPosition="top"
      anyCount={anyCount}
    />
  );
}

function RangeSliderBlock({
  scope,
  availableFilters,
  filterCounts,
  hiddenSections,
  ownedCountMax,
}: {
  scope: "price" | "copies" | "stats";
  availableFilters: AvailableFilters;
  filterCounts?: FilterCounts;
  hiddenSections?: ReadonlySet<string>;
  ownedCountMax?: number;
}) {
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- the wrapper only guards keydown bubbling; the focusable controls are its slider children
    <div
      className="hover:bg-muted focus-within:bg-muted flex flex-col gap-3 rounded-md px-2 py-1.5"
      // Stops the menu's roving-focus keydown handling so the slider's own arrow/Home/End keys work.
      onKeyDown={(event) => event.stopPropagation()}
    >
      <FilterRangeSections
        scope={scope}
        availableFilters={availableFilters}
        filterCounts={filterCounts}
        hiddenSections={hiddenSections}
        ownedCountMax={ownedCountMax}
        labelClassName="text-inherit text-sm font-normal"
        valueClassName="w-10"
      />
    </div>
  );
}

export function FilterMoreMenu({
  availableFilters,
  availableLanguages,
  setDisplayLabel,
  hiddenSections,
  visibleCustomTagCategories,
  filterCounts,
  ownedCountMax,
  activeCount,
  topLevelUnits,
}: FilterMoreMenuProps) {
  const { filterState } = useFilterValues();
  const actions = useFilterActions();
  const {
    setArrayFilter,
    toggleSigned,
    toggleOvernumbered,
    cyclePresence,
    toggleBanned,
    toggleErrata,
    toggleNoImage,
    toggleStandard,
  } = actions;
  const visibleDimensions = useVisibleFilterDimensions({
    availableFilters,
    availableLanguages,
    hiddenSections,
    visibleCustomTagCategories,
    ownedCountMax,
  });
  const singleActiveLabel = useSingleActiveFilterLabel({
    availableFilters,
    setDisplayLabel,
    topLevelUnits,
  });
  const { byCategory: customTagsByCategory } = useCustomTagList();
  const visibleCategories = [...customTagsByCategory.entries()].filter(([category]) =>
    visibleCustomTagCategories === undefined ? true : visibleCustomTagCategories.has(category),
  );
  const { categories: tagCategories, categoryByTag } = useTagCategories();
  const tagGroups = groupTagsByCategory(availableFilters.tags, tagCategories, categoryByTag);

  // Variant and Stats resolve through their own axes (artVariants / finishes /
  // signed, energy / might / power), so a per-axis hide still applies to them.
  const shows = (key: string) =>
    visibleDimensions.has(key) && !topLevelUnits.has(filterDimension(key).unit);

  const showArtVariantSection = shows("artVariants");
  const showFinishSection = shows("finishes");
  const showVariantRow = showArtVariantSection || showFinishSection;
  const signedInVariantRow = shows("signed") && showArtVariantSection;
  const showSignedRow = shows("signed") && !signedInVariantRow;
  const overnumberedInVariantRow = shows("overnumbered") && showArtVariantSection;
  const showOvernumberedRow = shows("overnumbered") && !overnumberedInVariantRow;
  const showStats = shows("energy") || shows("might") || shows("power");
  const showPrice = shows("price");
  const showOwned = shows("owned");
  const showCopies = shows("copies");
  const showCustomTags = shows("customTags");
  const showTags = shows("tags");

  const presenceRow = (dimension: PresenceDimension, value: PresenceParamValue, shown: boolean) => {
    if (!shown) {
      return null;
    }
    const state = presenceToFlagState(value);
    return (
      <FlagMenuItem
        key={`presence-${dimension}`}
        label={presenceLabel(dimension)}
        state={state}
        count={presenceFlagCount(filterCounts?.presence[dimension], state)}
        onToggle={() => cyclePresence(dimension)}
      />
    );
  };
  const customTagsPresenceNode = presenceRow(
    "customTags",
    filterState.customTagsPresence,
    showCustomTags,
  );
  const tagsPresenceNode = presenceRow("tags", filterState.tagsPresence, showTags);

  const dropdownProps = { availableFilters, availableLanguages, setDisplayLabel, filterCounts };
  const dropdownRow = (key: string) =>
    shows(key) ? (
      <FilterValueDropdown key={key} dimension={key} triggerStyle="menu" {...dropdownProps} />
    ) : null;
  const variantNode = showVariantRow ? (
    <FilterVariantDropdown
      key="variant"
      triggerStyle="menu"
      availableFilters={availableFilters}
      filterCounts={filterCounts}
      showArtVariant={showArtVariantSection}
      showFinish={showFinishSection}
      showOvernumberedFlag={overnumberedInVariantRow}
      showSignedFlag={signedInVariantRow}
    />
  ) : null;
  const statsNode = showStats ? (
    <RangeSliderBlock
      key="stats"
      scope="stats"
      availableFilters={availableFilters}
      filterCounts={filterCounts}
      hiddenSections={hiddenSections}
    />
  ) : null;

  const promoState = presenceToFlagState(filterState.markersPresence);
  const promoNode = shows("promo") ? (
    <FlagMenuItem
      key="promo"
      label={m.cards_filter_flag_promo()}
      state={promoState}
      count={presenceFlagCount(filterCounts?.presence.markers, promoState)}
      onToggle={() => cyclePresence("markers")}
    />
  ) : null;

  const showOversizeNode = shows("cardSizes");
  const oversizeState_ = oversizeState(filterState.cardSizes);
  const oversizeNode = showOversizeNode ? (
    <FlagMenuItem
      key="oversize"
      label={m.cards_flag_oversized()}
      state={oversizeState_}
      count={oversizeCount(filterCounts?.cardSizes, oversizeState_)}
      onToggle={() => setArrayFilter("cardSizes", nextOversize(filterState.cardSizes))}
    />
  ) : null;
  const overnumberedNode = showOvernumberedRow ? (
    <FlagMenuItem
      key="overnumbered"
      label={m.cards_flag_overnumbered()}
      state={filterState.overnumbered}
      count={filterCounts?.flags.overnumbered}
      onToggle={toggleOvernumbered}
    />
  ) : null;
  const signedNode = showSignedRow ? (
    <FlagMenuItem
      key="signed"
      label={m.cards_flag_signed()}
      state={filterState.signed}
      count={filterCounts?.flags.signed}
      onToggle={toggleSigned}
    />
  ) : null;
  const bannedNode = shows("banned") ? (
    <FlagMenuItem
      key="banned"
      label={m.cards_flag_banned()}
      state={filterState.banned}
      count={filterCounts?.flags.banned}
      onToggle={toggleBanned}
    />
  ) : null;
  const errataNode = shows("errata") ? (
    <FlagMenuItem
      key="errata"
      label={m.cards_flag_errata()}
      state={filterState.errata}
      count={filterCounts?.flags.errata}
      onToggle={toggleErrata}
    />
  ) : null;
  const noImageNode = shows("noImage") ? (
    <FlagMenuItem
      key="noImage"
      label={m.cards_flag_no_image()}
      state={filterState.noImage}
      count={filterCounts?.flags.noImage}
      onToggle={toggleNoImage}
    />
  ) : null;
  const standardNode = shows("standard") ? (
    <FlagMenuItem
      key="standard"
      label={m.cards_label_standard()}
      state={filterState.standard}
      count={filterCounts?.flags.standard}
      onToggle={toggleStandard}
    />
  ) : null;

  const customTagNodes = showCustomTags
    ? visibleCategories.map(([category, tagsInCategory]) => {
        const categoryLabel = tagsInCategory[0]?.categoryLabel ?? category;
        // Shared `customTags`/`customTagsEx` keys across categories; slice per category.
        const categorySlugs = new Set(tagsInCategory.map((tag) => tag.slug));
        const selectedInCategory = filterState.customTags.filter((slug) => categorySlugs.has(slug));
        const excludedInCategory = filterState.customTagsEx.filter((slug) =>
          categorySlugs.has(slug),
        );
        return (
          <MoreDimension
            key={category}
            label={categoryLabel}
            options={tagsInCategory.map((tag) => ({ value: tag.slug, label: tag.label }))}
            included={selectedInCategory}
            excluded={excludedInCategory}
            signed={bindSignedFilter(
              actions,
              "customTags",
              "customTagsEx",
              filterState.customTags,
              filterState.customTagsEx,
            )}
            searchPlaceholder={m.cards_filter_search_placeholder({
              label: categoryLabel.toLowerCase(),
            })}
            emptyText={m.cards_filter_no_match({ label: categoryLabel.toLowerCase() })}
            anyCount={groupCount(filterCounts?.customTagGroups, category)}
          />
        );
      })
    : [];
  const tagNodes = showTags
    ? tagGroups.map((group) => {
        const groupValues = new Set(group.tags);
        const selectedInGroup = filterState.tags.filter((tag) => groupValues.has(tag));
        const excludedInGroup = filterState.tagsEx.filter((tag) => groupValues.has(tag));
        return (
          <MoreDimension
            key={`tags-${group.slug}`}
            label={group.label}
            options={group.tags.map((tag) => ({
              value: tag,
              label: tag,
              count: filterCounts?.tags.get(tag),
            }))}
            included={selectedInGroup}
            excluded={excludedInGroup}
            signed={bindSignedFilter(
              actions,
              "tags",
              "tagsEx",
              filterState.tags,
              filterState.tagsEx,
            )}
            searchPlaceholder={m.cards_filter_search_placeholder({
              label: group.label.toLowerCase(),
            })}
            emptyText={m.cards_filter_no_match({ label: group.label.toLowerCase() })}
            anyCount={groupCount(filterCounts?.tagGroups, group.slug)}
          />
        );
      })
    : [];
  const ownedNode = showOwned ? (
    <MoreDimension
      key="owned"
      label={m.cards_label_owned()}
      options={ownedBuckets().map((bucket) => ({ value: bucket.value, label: bucket.label }))}
      included={filterState.owned}
      onIncludeChange={(next) => setArrayFilter("owned", next)}
      searchPlaceholder={m.cards_filter_search_owned()}
      emptyText={m.cards_filter_no_options_match()}
    />
  ) : null;
  const copiesNode = showCopies ? (
    <RangeSliderBlock
      key="copies"
      scope="copies"
      availableFilters={availableFilters}
      filterCounts={filterCounts}
      hiddenSections={hiddenSections}
      ownedCountMax={ownedCountMax}
    />
  ) : null;
  const priceNode = showPrice ? (
    <RangeSliderBlock
      key="price"
      scope="price"
      availableFilters={availableFilters}
      filterCounts={filterCounts}
      hiddenSections={hiddenSections}
    />
  ) : null;

  const blocks = [
    {
      id: "core",
      items: [
        dropdownRow("languages"),
        dropdownRow("sets"),
        dropdownRow("domains"),
        dropdownRow("rarities"),
        dropdownRow("types"),
        dropdownRow("superTypes"),
        variantNode,
        statsNode,
      ],
    },
    {
      id: "dimensions",
      items: [
        dropdownRow("markers"),
        dropdownRow("channels"),
        dropdownRow("keywords"),
        ...customTagNodes,
        customTagsPresenceNode,
        ...tagNodes,
        tagsPresenceNode,
      ],
    },
    {
      id: "flags",
      items: [
        standardNode,
        promoNode,
        oversizeNode,
        overnumberedNode,
        signedNode,
        bannedNode,
        errataNode,
        noImageNode,
      ],
    },
    { id: "market", items: [ownedNode, copiesNode, priceNode] },
  ]
    .map((block) => ({ id: block.id, items: block.items.filter(Boolean) }))
    .filter((block) => block.items.length > 0);

  if (blocks.length === 0) {
    return null;
  }
  const showWideContent = showPrice || showCopies || showStats;

  const active = activeCount > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="control"
            size="sm"
            data-active={active || undefined}
            className="font-medium"
          />
        }
        aria-label={
          singleActiveLabel
            ? m.cards_filter_more_single({ label: singleActiveLabel })
            : active
              ? m.cards_filter_more_selected({ count: activeCount })
              : m.cards_filter_more()
        }
      >
        {singleActiveLabel ?? m.cards_filter_more()}
        {active && !singleActiveLabel && <span className="tabular-nums">({activeCount})</span>}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn(showWideContent ? "w-80" : "min-w-56")}>
        {blocks.map((block, index) => (
          <Fragment key={block.id}>
            {index > 0 && <DropdownMenuSeparator />}
            {block.items}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

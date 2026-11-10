import { enumLabel } from "@openrift/shared/enum-label";
import type { AvailableFilters } from "@openrift/shared/filters-available";
import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { XIcon } from "lucide-react";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterIcon } from "@/features/cards/components/filter-icon";
import { SearchTermChips } from "@/features/cards/components/search-term-chips";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import type {
  ActiveFilterChip,
  ChipValueLabel,
  FlagFilterParam,
} from "@/features/cards/lib/filter-dimensions";
import {
  ACTIVE_FILTER_CHIPS,
  ownedBucketLabel,
  PRESENCE_PARAMS,
} from "@/features/cards/lib/filter-dimensions";
import type { SearchValueLabeler } from "@/features/cards/lib/search-clause-labels";
import { describeSearchTerms } from "@/features/cards/lib/search-clause-labels";
import { groupTagsByCategory } from "@/features/collections/lib/tag-category-groups";
import { useCustomTagList, useEnumOrders, useTagCategories } from "@/hooks/use-enums";
import { formatDomainFilterLabel } from "@/lib/domain";
import { compactFormatterForMarketplace } from "@/lib/format";
import { rangeBadgeLabel } from "@/lib/range-label";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface ActiveFiltersProps {
  availableFilters: AvailableFilters;
  setDisplayLabel?: (code: string) => string;
  hiddenSections?: ReadonlySet<string>;
  ownedCountMax?: number;
  searchVocabulary?: SearchVocabulary;
  searchValueLabel?: SearchValueLabeler;
}

const NO_VOCABULARY: SearchVocabulary = {};
const RAW_VALUE: SearchValueLabeler = (_key, value) => value;
const identity = (value: string) => value;

export function ActiveFilters({
  availableFilters,
  setDisplayLabel,
  hiddenSections,
  ownedCountMax,
  searchVocabulary = NO_VOCABULARY,
  searchValueLabel = RAW_VALUE,
}: ActiveFiltersProps) {
  const { labels } = useEnumOrders();
  const { all: allCustomTags } = useCustomTagList();
  const { filterState, ranges, queryFilterSpans } = useFilterValues();
  const searchTerms = describeSearchTerms(
    filterState.search,
    searchVocabulary,
    searchValueLabel,
    queryFilterSpans,
  );
  const {
    toggleArrayFilter,
    setRange,
    setOwnedCountRange,
    clearSigned,
    clearOvernumbered,
    clearPresence,
    clearBanned,
    clearErrata,
    clearNoImage,
    clearStandard,
    clearAllFilters,
    setSearch,
  } = useFilterActions();
  const flagClears: Record<FlagFilterParam, () => void> = {
    signed: clearSigned,
    overnumbered: clearOvernumbered,
    banned: clearBanned,
    errata: clearErrata,
    noImage: clearNoImage,
    standard: clearStandard,
  };
  const favoriteMarketplace = useDisplayStore((s) => s.marketplaceOrder[0]);
  const formatPrice = compactFormatterForMarketplace(favoriteMarketplace);

  const markerLabel = (slug: string) =>
    availableFilters.markers.find((marker) => marker.slug === slug)?.label ?? slug;
  const channelBreadcrumbs = buildChannelBreadcrumbsBySlug(availableFilters.distributionChannels);
  const channelLabel = (slug: string) => channelBreadcrumbs.get(slug) ?? slug;
  const valueLabels: Record<ChipValueLabel, (value: string) => string> = {
    set: setDisplayLabel ?? identity,
    rarity: (v) => enumLabel(labels.rarities, v),
    type: (v) => enumLabel(labels.cardTypes, v),
    superType: (v) => enumLabel(labels.superTypes, v),
    domain: (v) => formatDomainFilterLabel(v, labels.domains),
    artVariant: (v) => enumLabel(labels.artVariants, v),
    finish: (v) => enumLabel(labels.finishes, v),
    cardSize: (v) => enumLabel(labels.cardSizes, v),
    marker: markerLabel,
    channel: channelLabel,
    ownedBucket: (v) => ownedBucketLabel(v),
    raw: identity,
  };

  // Unknown slugs (e.g. a tag deleted after being saved into a deck URL) fall
  // into an "Other" bucket so the user can still remove them.
  const customTagBySlug = new Map(allCustomTags.map((tag) => [tag.slug, tag]));
  const customTagGroups: { categorySlug: string; categoryLabel: string; values: string[] }[] = [];
  for (const slug of filterState.customTags) {
    const tag = customTagBySlug.get(slug);
    const categorySlug = tag?.category ?? "__unknown";
    const categoryLabel = tag?.categoryLabel ?? m.cards_filter_tag_category_fallback();
    const existing = customTagGroups.find((g) => g.categorySlug === categorySlug);
    if (existing) {
      existing.values.push(slug);
    } else {
      customTagGroups.push({ categorySlug, categoryLabel, values: [slug] });
    }
  }
  const customTagExcludeGroups: { categoryLabel: string; values: string[] }[] = [];
  for (const slug of filterState.customTagsEx) {
    const tag = customTagBySlug.get(slug);
    const categoryLabel = tag?.categoryLabel ?? m.cards_filter_tag_category_fallback();
    const existing = customTagExcludeGroups.find((group) => group.categoryLabel === categoryLabel);
    if (existing) {
      existing.values.push(slug);
    } else {
      customTagExcludeGroups.push({ categoryLabel, values: [slug] });
    }
  }

  // The values ARE the labels; there is no separate label lookup.
  const { categories: tagCategories, categoryByTag } = useTagCategories();
  const tagGroups = groupTagsByCategory(filterState.tags, tagCategories, categoryByTag);
  const tagExcludeGroups = groupTagsByCategory(filterState.tagsEx, tagCategories, categoryByTag);

  const chipIsShown = (chip: ActiveFilterChip): boolean => {
    switch (chip.kind) {
      case "values": {
        return filterState[chip.param].length > 0 && !hiddenSections?.has(chip.hiddenBy);
      }
      case "customTags": {
        const groups = chip.excluded ? customTagExcludeGroups : customTagGroups;
        return groups.length > 0 && !hiddenSections?.has("customTags");
      }
      case "tags": {
        const groups = chip.excluded ? tagExcludeGroups : tagGroups;
        return groups.length > 0 && !hiddenSections?.has("tags");
      }
      case "range": {
        return ranges[chip.range].min !== null || ranges[chip.range].max !== null;
      }
      case "copies": {
        return (
          !hiddenSections?.has("owned") &&
          (filterState.ownedCountMin !== null || filterState.ownedCountMax !== null)
        );
      }
      case "flag": {
        return filterState[chip.param] !== null;
      }
      case "presence": {
        return filterState[PRESENCE_PARAMS[chip.dimension]] !== null;
      }
    }
  };
  const shownChips = ACTIVE_FILTER_CHIPS.filter((chip) => chipIsShown(chip));

  const renderChip = (chip: ActiveFilterChip) => {
    switch (chip.kind) {
      case "values": {
        const label = chip.label();
        const displayFn = valueLabels[chip.valueLabel];
        const icon = chip.icon;
        return (
          <div key={chip.param} className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-muted-foreground hidden text-xs sm:inline">{label}:</span>
            {filterState[chip.param].map((value) => (
              <FilterChip
                key={`${chip.param}-${value}`}
                excluded={chip.excluded}
                label={displayFn(value)}
                icon={icon ? <FilterIcon category={icon} value={value} /> : undefined}
                removeLabel={
                  chip.excluded
                    ? m.cards_filter_remove_excluded_value({ label, value: displayFn(value) })
                    : m.cards_filter_remove_value({ label, value: displayFn(value) })
                }
                onRemove={() => toggleArrayFilter(chip.param, value)}
              />
            ))}
          </div>
        );
      }
      case "customTags": {
        if (chip.excluded) {
          return customTagExcludeGroups.map(({ categoryLabel, values }) => (
            <div
              key={`customTagsEx-${categoryLabel}`}
              className="flex min-w-0 flex-wrap items-center gap-1"
            >
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {categoryLabel}:
              </span>
              {values.map((slug) => {
                const tag = customTagBySlug.get(slug);
                return (
                  <FilterChip
                    key={`customTagsEx-${slug}`}
                    excluded
                    label={tag?.label ?? slug}
                    removeLabel={m.cards_filter_remove_excluded_tag({ tag: tag?.label ?? slug })}
                    onRemove={() => toggleArrayFilter("customTagsEx", slug)}
                  />
                );
              })}
            </div>
          ));
        }
        return customTagGroups.map(({ categorySlug, categoryLabel, values }) => (
          <div
            key={`customTags-${categorySlug}`}
            className="flex min-w-0 flex-wrap items-center gap-1"
          >
            <span className="text-muted-foreground hidden text-xs sm:inline">{categoryLabel}:</span>
            {values.map((slug) => {
              const tag = customTagBySlug.get(slug);
              return (
                <FilterChip
                  key={`customTags-${slug}`}
                  label={tag?.label ?? slug}
                  removeLabel={m.cards_filter_remove_tag({ tag: tag?.label ?? slug })}
                  onRemove={() => toggleArrayFilter("customTags", slug)}
                />
              );
            })}
          </div>
        ));
      }
      case "tags": {
        const groups = chip.excluded ? tagExcludeGroups : tagGroups;
        return groups.map(({ slug: groupSlug, label: groupLabel, tags }) => (
          <div
            key={`${chip.param}-${groupSlug}`}
            className="flex min-w-0 flex-wrap items-center gap-1"
          >
            <span className="text-muted-foreground hidden text-xs sm:inline">{groupLabel}:</span>
            {tags.map((tag) => (
              <FilterChip
                key={`${chip.param}-${tag}`}
                excluded={chip.excluded}
                label={tag}
                removeLabel={
                  chip.excluded
                    ? m.cards_filter_remove_excluded_tag({ tag })
                    : m.cards_filter_remove_tag({ tag })
                }
                onRemove={() => toggleArrayFilter(chip.param, tag)}
              />
            ))}
          </div>
        ));
      }
      case "range": {
        const range = ranges[chip.range];
        return (
          <RangeBadge
            key={chip.range}
            label={chip.label()}
            min={range.min}
            max={range.max}
            availableMin={availableFilters[chip.range].min}
            availableMax={availableFilters[chip.range].max}
            onClear={() => setRange(chip.range, null, null)}
            formatValue={chip.range === "price" ? formatPrice : undefined}
          />
        );
      }
      case "copies": {
        return (
          <RangeBadge
            key="copies"
            label={m.cards_filter_range_copies()}
            min={filterState.ownedCountMin}
            max={filterState.ownedCountMax}
            availableMin={0}
            availableMax={ownedCountMax ?? 0}
            onClear={() => setOwnedCountRange(null, null)}
          />
        );
      }
      case "flag": {
        return (
          <FlagChip
            key={chip.param}
            label={chip.label()}
            state={filterState[chip.param] === true}
            onClear={() => flagClears[chip.param]()}
          />
        );
      }
      case "presence": {
        return (
          <FlagChip
            key={`presence-${chip.dimension}`}
            label={chip.label()}
            state={filterState[PRESENCE_PARAMS[chip.dimension]] === "any"}
            onClear={() => clearPresence(chip.dimension)}
          />
        );
      }
    }
  };

  if (searchTerms.length === 0 && shownChips.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        {searchTerms.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <SearchTermChips
              query={filterState.search}
              terms={searchTerms}
              onQueryChange={setSearch}
            />
          </div>
        )}
        {shownChips.map((chip) => (
          <Fragment key={chipKey(chip)}>{renderChip(chip)}</Fragment>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground shrink-0 self-start"
        onClick={clearAllFilters}
        title={m.cards_filter_clear_all()}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}

function chipKey(chip: ActiveFilterChip): string {
  switch (chip.kind) {
    case "range": {
      return chip.range;
    }
    case "copies": {
      return "copies";
    }
    case "presence": {
      return `presence-${chip.dimension}`;
    }
    default: {
      return chip.param;
    }
  }
}

/** Caller only renders this when the flag is set, so `state` is never null here. */
function FlagChip({
  label,
  state,
  onClear,
}: {
  label: string;
  state: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground hidden text-xs sm:inline">
        {m.cards_filter_active_flag_label()}
      </span>
      <FilterChip
        excluded={state === false}
        label={label}
        removeLabel={m.cards_filter_clear_named({ label })}
        onRemove={onClear}
      />
    </div>
  );
}

function RangeBadge({
  label,
  min,
  max,
  availableMin,
  availableMax,
  onClear,
  formatValue,
}: {
  label: string;
  min: number | null;
  max: number | null;
  availableMin: number;
  availableMax: number;
  onClear: () => void;
  formatValue?: (value: number) => string;
}) {
  const valueLabel = rangeBadgeLabel(min, max, availableMin, availableMax, formatValue);

  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground hidden text-xs sm:inline">{label}:</span>
      <FilterChip
        label={
          <>
            {/* On mobile the external prefix is hidden, so carry the label inside the chip. */}
            <span className="sm:hidden">{label} </span>
            {valueLabel}
          </>
        }
        removeLabel={m.cards_filter_clear_named({ label })}
        onRemove={onClear}
      />
    </div>
  );
}

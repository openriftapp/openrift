import { enumLabel } from "@openrift/shared/enum-label";
import type { AvailableFilters } from "@openrift/shared/filters-available";
import type { PresenceDimension, RangeKey } from "@openrift/shared/types/search";
import { MinusIcon, XIcon } from "lucide-react";

import { CardIcon } from "@/components/card-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import { ownedBucketLabel } from "@/features/cards/lib/filter-dimensions";
import { presenceLabel } from "@/features/cards/lib/presence-filter";
import { groupTagsByCategory } from "@/features/collections/lib/tag-category-groups";
import { useCustomTagList, useEnumOrders, useTagCategories } from "@/hooks/use-enums";
import { formatDomainFilterLabel } from "@/lib/domain";
import { compactFormatterForMarketplace } from "@/lib/format";
import { getFilterIconPath } from "@/lib/icons";
import { rangeBadgeLabel } from "@/lib/range-label";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface RangeBadgeSection {
  key: RangeKey;
  label: string;
  formatValue?: (v: number) => string;
}

function statRangeBadgeSections(): RangeBadgeSection[] {
  return [
    { key: "energy", label: m.cards_filter_range_energy() },
    { key: "might", label: m.cards_filter_range_might() },
    { key: "power", label: m.cards_filter_range_power() },
  ];
}

interface ActiveFiltersProps {
  availableFilters: AvailableFilters;
  setDisplayLabel?: (code: string) => string;
  hiddenSections?: ReadonlySet<string>;
  ownedCountMax?: number;
}

export function ActiveFilters({
  availableFilters,
  setDisplayLabel,
  hiddenSections,
  ownedCountMax,
}: ActiveFiltersProps) {
  const { labels } = useEnumOrders();
  const { all: allCustomTags } = useCustomTagList();
  const { filterState, ranges } = useFilterValues();
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
  const presenceChips: [PresenceDimension, "any" | "none" | null][] = [
    ["markers", filterState.markersPresence ?? null],
    ["superTypes", filterState.superTypesPresence ?? null],
    ["customTags", filterState.customTagsPresence ?? null],
    ["distributionChannels", filterState.channelsPresence ?? null],
    ["keywords", filterState.keywordsPresence ?? null],
    ["tags", filterState.tagsPresence ?? null],
  ];
  const favoriteMarketplace = useDisplayStore((s) => s.marketplaceOrder[0]);

  const rangeBadgeSections: RangeBadgeSection[] = [
    ...statRangeBadgeSections(),
    {
      key: "price",
      label: m.cards_filter_range_price(),
      formatValue: compactFormatterForMarketplace(favoriteMarketplace),
    },
  ];
  type FilterKey =
    | "sets"
    | "rarities"
    | "types"
    | "superTypes"
    | "domains"
    | "artVariants"
    | "finishes"
    | "cardSizes"
    | "markers"
    | "channels"
    | "keywords"
    | "owned";

  const markerLabel = (slug: string) =>
    availableFilters.markers.find((marker) => marker.slug === slug)?.label ?? slug;
  const channelBreadcrumbs = buildChannelBreadcrumbsBySlug(availableFilters.distributionChannels);
  const channelLabel = (slug: string) => channelBreadcrumbs.get(slug) ?? slug;

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
  // `section` drives both the hidden-section guard and the icon lookup (icons
  // key off the base dimension, not the `*Ex` slug).
  type ExcludeKey =
    | "setsEx"
    | "raritiesEx"
    | "typesEx"
    | "superTypesEx"
    | "domainsEx"
    | "artVariantsEx"
    | "finishesEx"
    | "markersEx"
    | "channelsEx"
    | "keywordsEx";
  // Excludes the icon-less "owned"/"cardSizes" sections; markers/channels are
  // guarded out separately before reaching `getFilterIconPath`.
  type ExcludeSection =
    | "sets"
    | "rarities"
    | "types"
    | "superTypes"
    | "domains"
    | "artVariants"
    | "finishes"
    | "markers"
    | "channels"
    | "keywords";
  const excludeGroupDefs: {
    key: ExcludeKey;
    section: ExcludeSection;
    label: string;
    values: string[];
    displayLabel?: (v: string) => string;
  }[] = [
    {
      key: "setsEx",
      section: "sets",
      label: m.cards_filter_unit_sets(),
      values: filterState.setsEx,
    },
    {
      key: "raritiesEx",
      section: "rarities",
      label: m.cards_filter_unit_rarities(),
      values: filterState.raritiesEx,
      displayLabel: (v: string) => enumLabel(labels.rarities, v),
    },
    {
      key: "typesEx",
      section: "types",
      label: m.cards_filter_unit_types(),
      values: filterState.typesEx,
      displayLabel: (v: string) => enumLabel(labels.cardTypes, v),
    },
    {
      key: "superTypesEx",
      section: "superTypes",
      label: m.cards_filter_unit_super_types(),
      values: filterState.superTypesEx,
      displayLabel: (v: string) => enumLabel(labels.superTypes, v),
    },
    {
      key: "domainsEx",
      section: "domains",
      label: m.cards_filter_unit_domains(),
      values: filterState.domainsEx,
      displayLabel: (v: string) => formatDomainFilterLabel(v, labels.domains),
    },
    {
      key: "artVariantsEx",
      section: "artVariants",
      label: m.cards_filter_label_art_variant(),
      values: filterState.artVariantsEx,
      displayLabel: (v: string) => enumLabel(labels.artVariants, v),
    },
    {
      key: "finishesEx",
      section: "finishes",
      label: m.cards_filter_label_finish(),
      values: filterState.finishesEx,
      displayLabel: (v: string) => enumLabel(labels.finishes, v),
    },
    {
      key: "markersEx",
      section: "markers",
      label: m.cards_filter_label_marker(),
      values: filterState.markersEx,
      displayLabel: markerLabel,
    },
    {
      key: "channelsEx",
      section: "channels",
      label: m.cards_filter_label_channel(),
      values: filterState.channelsEx,
      displayLabel: channelLabel,
    },
    {
      key: "keywordsEx",
      section: "keywords",
      label: m.cards_filter_label_keyword(),
      values: filterState.keywordsEx,
    },
  ];
  const excludeGroups = excludeGroupDefs.filter(
    (group) => group.values.length > 0 && !hiddenSections?.has(group.section),
  );

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

  const customTagsHidden = hiddenSections?.has("customTags") ?? false;

  // The values ARE the labels; there is no separate label lookup.
  const { categories: tagCategories, categoryByTag } = useTagCategories();
  const tagsHidden = hiddenSections?.has("tags") ?? false;
  const tagGroups = groupTagsByCategory(filterState.tags, tagCategories, categoryByTag);
  const tagExcludeGroups = groupTagsByCategory(filterState.tagsEx, tagCategories, categoryByTag);

  const copiesRangeActive =
    !hiddenSections?.has("owned") &&
    (filterState.ownedCountMin !== null || filterState.ownedCountMax !== null);

  interface FilterGroup {
    key: FilterKey;
    label: string;
    values: string[];
    displayLabel?: (v: string) => string;
  }
  const filterGroupDefs: FilterGroup[] = [
    { key: "sets", label: m.cards_filter_unit_sets(), values: filterState.sets },
    {
      key: "rarities",
      label: m.cards_filter_unit_rarities(),
      values: filterState.rarities,
      displayLabel: (v: string) => enumLabel(labels.rarities, v),
    },
    {
      key: "types",
      label: m.cards_filter_unit_types(),
      values: filterState.types,
      displayLabel: (v: string) => enumLabel(labels.cardTypes, v),
    },
    {
      key: "superTypes",
      label: m.cards_filter_unit_super_types(),
      values: filterState.superTypes,
      displayLabel: (v: string) => enumLabel(labels.superTypes, v),
    },
    {
      key: "domains",
      label: m.cards_filter_unit_domains(),
      values: filterState.domains,
      displayLabel: (v: string) => formatDomainFilterLabel(v, labels.domains),
    },
    {
      key: "artVariants",
      label: m.cards_filter_label_art_variant(),
      values: filterState.artVariants,
      displayLabel: (v: string) => enumLabel(labels.artVariants, v),
    },
    {
      key: "finishes",
      label: m.cards_filter_label_finish(),
      values: filterState.finishes,
      displayLabel: (v: string) => enumLabel(labels.finishes, v),
    },
    {
      key: "cardSizes",
      label: m.cards_filter_unit_card_sizes(),
      values: filterState.cardSizes,
      displayLabel: (v: string) => enumLabel(labels.cardSizes, v),
    },
    {
      key: "markers",
      label: m.cards_filter_label_marker(),
      values: filterState.markers,
      displayLabel: markerLabel,
    },
    {
      key: "channels",
      label: m.cards_filter_label_channel(),
      values: filterState.channels,
      displayLabel: channelLabel,
    },
    {
      key: "keywords",
      label: m.cards_filter_label_keyword(),
      values: filterState.keywords,
    },
    {
      key: "owned",
      label: m.cards_filter_unit_owned(),
      values: filterState.owned,
      displayLabel: (v: string) => ownedBucketLabel(v),
    },
  ];
  const filterGroups = filterGroupDefs.filter(
    (g) => g.values.length > 0 && !hiddenSections?.has(g.key),
  );

  const hasVisibleContent =
    filterState.search !== "" ||
    filterGroups.length > 0 ||
    excludeGroups.length > 0 ||
    (!customTagsHidden && customTagGroups.length > 0) ||
    (!customTagsHidden && customTagExcludeGroups.length > 0) ||
    (!tagsHidden && tagGroups.length > 0) ||
    (!tagsHidden && tagExcludeGroups.length > 0) ||
    rangeBadgeSections.some(({ key }) => ranges[key].min !== null || ranges[key].max !== null) ||
    copiesRangeActive ||
    filterState.signed !== null ||
    filterState.overnumbered !== null ||
    presenceChips.some(([, value]) => value !== null) ||
    filterState.banned !== null ||
    filterState.errata !== null ||
    filterState.noImage !== null ||
    filterState.standard !== null;

  if (!hasVisibleContent) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        {filterState.search && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {m.cards_filter_active_search_label()}
            </span>
            <Badge variant="secondary" className="gap-1">
              &ldquo;{filterState.search}&rdquo;
              <ChipRemoveButton
                aria-label={m.cards_filter_clear_search()}
                onClick={() => setSearch("")}
              />
            </Badge>
          </div>
        )}
        {filterGroups.map(({ key, label, values, displayLabel: groupDisplayLabel }) => (
          <div key={key} className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-muted-foreground hidden text-xs sm:inline">{label}:</span>
            {values.map((value) => {
              const icon =
                key === "markers" || key === "channels" || key === "owned" || key === "keywords"
                  ? undefined
                  : getFilterIconPath(key, value);
              const displayFn =
                groupDisplayLabel ??
                (key === "sets" && setDisplayLabel ? setDisplayLabel : (v: string) => v);
              return (
                <Badge key={`${key}-${value}`} variant="secondary" className="gap-1">
                  {icon && <CardIcon src={icon} />}
                  {displayFn(value)}
                  <ChipRemoveButton
                    aria-label={m.cards_filter_remove_value({ label, value: displayFn(value) })}
                    onClick={() => toggleArrayFilter(key, value)}
                  />
                </Badge>
              );
            })}
          </div>
        ))}
        {!customTagsHidden &&
          customTagGroups.map(({ categorySlug, categoryLabel, values }) => (
            <div
              key={`customTags-${categorySlug}`}
              className="flex min-w-0 flex-wrap items-center gap-1"
            >
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {categoryLabel}:
              </span>
              {values.map((slug) => {
                const tag = customTagBySlug.get(slug);
                return (
                  <Badge key={`customTags-${slug}`} variant="secondary" className="gap-1">
                    {tag?.label ?? slug}
                    <ChipRemoveButton
                      aria-label={m.cards_filter_remove_tag({ tag: tag?.label ?? slug })}
                      onClick={() => toggleArrayFilter("customTags", slug)}
                    />
                  </Badge>
                );
              })}
            </div>
          ))}
        {!tagsHidden &&
          tagGroups.map(({ slug: groupSlug, label: groupLabel, tags }) => (
            <div key={`tags-${groupSlug}`} className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="text-muted-foreground hidden text-xs sm:inline">{groupLabel}:</span>
              {tags.map((tag) => (
                <Badge key={`tags-${tag}`} variant="secondary" className="gap-1">
                  {tag}
                  <ChipRemoveButton
                    aria-label={m.cards_filter_remove_tag({ tag })}
                    onClick={() => toggleArrayFilter("tags", tag)}
                  />
                </Badge>
              ))}
            </div>
          ))}
        {excludeGroups.map(({ key, section, label, values, displayLabel: groupDisplayLabel }) => (
          <div key={key} className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-muted-foreground hidden text-xs sm:inline">{label}:</span>
            {values.map((value) => {
              const icon =
                section === "markers" || section === "channels" || section === "keywords"
                  ? undefined
                  : getFilterIconPath(section, value);
              const displayFn =
                groupDisplayLabel ??
                (section === "sets" && setDisplayLabel ? setDisplayLabel : (v: string) => v);
              return (
                <Badge
                  key={`${key}-${value}`}
                  variant="outline"
                  className="border-destructive/40 text-destructive gap-1"
                >
                  <MinusIcon className="size-3 shrink-0" />
                  {icon && <CardIcon src={icon} />}
                  <span className="line-through">{displayFn(value)}</span>
                  <ChipRemoveButton
                    aria-label={m.cards_filter_remove_excluded_value({
                      label,
                      value: displayFn(value),
                    })}
                    onClick={() => toggleArrayFilter(key, value)}
                  />
                </Badge>
              );
            })}
          </div>
        ))}
        {!customTagsHidden &&
          customTagExcludeGroups.map(({ categoryLabel, values }) => (
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
                  <Badge
                    key={`customTagsEx-${slug}`}
                    variant="outline"
                    className="border-destructive/40 text-destructive gap-1"
                  >
                    <MinusIcon className="size-3 shrink-0" />
                    <span className="line-through">{tag?.label ?? slug}</span>
                    <ChipRemoveButton
                      aria-label={m.cards_filter_remove_excluded_tag({ tag: tag?.label ?? slug })}
                      onClick={() => toggleArrayFilter("customTagsEx", slug)}
                    />
                  </Badge>
                );
              })}
            </div>
          ))}
        {!tagsHidden &&
          tagExcludeGroups.map(({ slug: groupSlug, label: groupLabel, tags }) => (
            <div key={`tagsEx-${groupSlug}`} className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="text-muted-foreground hidden text-xs sm:inline">{groupLabel}:</span>
              {tags.map((tag) => (
                <Badge
                  key={`tagsEx-${tag}`}
                  variant="outline"
                  className="border-destructive/40 text-destructive gap-1"
                >
                  <MinusIcon className="size-3 shrink-0" />
                  <span className="line-through">{tag}</span>
                  <ChipRemoveButton
                    aria-label={m.cards_filter_remove_excluded_tag({ tag })}
                    onClick={() => toggleArrayFilter("tagsEx", tag)}
                  />
                </Badge>
              ))}
            </div>
          ))}
        {rangeBadgeSections.map(({ key, label, formatValue }) => {
          const range = ranges[key];
          if (range.min === null && range.max === null) {
            return null;
          }
          return (
            <RangeBadge
              key={key}
              label={label}
              min={range.min}
              max={range.max}
              availableMin={availableFilters[key].min}
              availableMax={availableFilters[key].max}
              onClear={() => setRange(key, null, null)}
              formatValue={formatValue}
            />
          );
        })}
        {copiesRangeActive && (
          <RangeBadge
            label={m.cards_filter_range_copies()}
            min={filterState.ownedCountMin}
            max={filterState.ownedCountMax}
            availableMin={0}
            availableMax={ownedCountMax ?? 0}
            onClear={() => setOwnedCountRange(null, null)}
          />
        )}
        {filterState.overnumbered !== null && (
          <FlagChip
            label={m.cards_filter_flag_overnumbered()}
            state={filterState.overnumbered}
            onClear={clearOvernumbered}
          />
        )}
        {filterState.signed !== null && (
          <FlagChip
            label={m.cards_filter_flag_signed()}
            state={filterState.signed}
            onClear={clearSigned}
          />
        )}
        {presenceChips.map(([dimension, value]) =>
          value === null ? null : (
            <FlagChip
              key={dimension}
              label={presenceLabel(dimension)}
              state={value === "any"}
              onClear={() => clearPresence(dimension)}
            />
          ),
        )}
        {filterState.banned !== null && (
          <FlagChip
            label={m.cards_filter_flag_banned()}
            state={filterState.banned}
            onClear={clearBanned}
          />
        )}
        {filterState.errata !== null && (
          <FlagChip
            label={m.cards_filter_flag_errata()}
            state={filterState.errata}
            onClear={clearErrata}
          />
        )}
        {filterState.noImage !== null && (
          <FlagChip
            label={m.cards_filter_flag_no_image()}
            state={filterState.noImage}
            onClear={clearNoImage}
          />
        )}
        {filterState.standard !== null && (
          <FlagChip
            label={m.cards_filter_flag_standard()}
            state={filterState.standard}
            onClear={clearStandard}
          />
        )}
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
  const excluded = state === false;
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground hidden text-xs sm:inline">
        {m.cards_filter_active_flag_label()}
      </span>
      <Badge
        variant={excluded ? "outline" : "secondary"}
        className={cn("gap-1", excluded && "border-destructive/40 text-destructive")}
      >
        {excluded && <MinusIcon className="size-3 shrink-0" />}
        <span className={cn(excluded && "line-through")}>{label}</span>
        <ChipRemoveButton aria-label={m.cards_filter_clear_named({ label })} onClick={onClear} />
      </Badge>
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
      <Badge variant="secondary" className="gap-1">
        {/* On mobile the external prefix is hidden, so carry the label inside the chip. */}
        <span className="sm:hidden">{label}</span>
        {valueLabel}
        <ChipRemoveButton aria-label={m.cards_filter_clear_named({ label })} onClick={onClear} />
      </Badge>
    </div>
  );
}

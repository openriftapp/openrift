import type { ReactNode } from "react";
import { Fragment } from "react";

import { FilterSection } from "@/features/cards/components/filter-badge-row";
import { FlagBadge } from "@/features/cards/components/filter-flag-badge";
import type { FilterPanelContentProps } from "@/features/cards/components/filter-panel-content";
import { FilterValueDropdown } from "@/features/cards/components/filter-value-dropdown";
import { MultiSelectCombobox } from "@/features/cards/components/multi-select-combobox";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { useVisibleFilterDimensions } from "@/features/cards/hooks/use-filter-dimensions";
import { filterDimension, ownedBuckets } from "@/features/cards/lib/filter-dimensions";
import { nextOversize, oversizeCount, oversizeState } from "@/features/cards/lib/oversize-filter";
import {
  presenceFlagCount,
  presenceLabel,
  presenceToFlagState,
} from "@/features/cards/lib/presence-filter";
import { groupTagsByCategory } from "@/features/collections/lib/tag-category-groups";
import { useCustomTagList, useTagCategories } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

export function FilterChipSections({
  availableFilters,
  hiddenSections,
  visibleCustomTagCategories,
  filterOverrides,
  filterCounts,
  units,
  variant = "rows",
}: Pick<
  FilterPanelContentProps,
  | "availableFilters"
  | "hiddenSections"
  | "visibleCustomTagCategories"
  | "filterOverrides"
  | "filterCounts"
> & {
  units?: ReadonlySet<string>;
  /** "rows" = labelled panel rows; "inline" = bare chips for the compact bar. */
  variant?: "rows" | "inline";
}) {
  const visibleDimensions = useVisibleFilterDimensions({
    availableFilters,
    hiddenSections,
    visibleCustomTagCategories,
  });
  const { filterState } = useFilterValues();
  const {
    setArrayFilter,
    cycleArrayFilter,
    toggleSigned,
    toggleOvernumbered,
    cyclePresence,
    toggleBanned,
    toggleErrata,
    toggleNoImage,
    toggleStandard,
  } = useFilterActions();
  const { byCategory: customTagsByCategory } = useCustomTagList();
  const visibleCategories = [...customTagsByCategory.entries()].filter(([category]) =>
    visibleCustomTagCategories === undefined ? true : visibleCustomTagCategories.has(category),
  );
  const { categories: tagCategories, categoryByTag } = useTagCategories();
  const tagGroups = groupTagsByCategory(availableFilters.tags, tagCategories, categoryByTag);
  const selected = (key: keyof typeof filterState) => {
    const urlValue = filterState[key];
    const arr = Array.isArray(urlValue) ? urlValue : [];
    return arr.length > 0 ? arr : (filterOverrides?.[key] ?? []);
  };
  const showUnit = (unit: string) => units === undefined || units.has(unit);
  const shows = (key: string) => visibleDimensions.has(key) && showUnit(filterDimension(key).unit);
  const triggerStyle = variant === "inline" ? "button" : "chip";
  const placeholder = variant === "rows" ? m.cards_filter_placeholder_any() : undefined;

  const showMarkers = shows("markers");
  const showChannels = shows("channels");
  const showCustomTags = shows("customTags");
  const showTags = shows("tags");
  const showKeywords = shows("keywords");
  const showOwned = shows("owned");
  const showOversize = shows("cardSizes");
  const showSigned = shows("signed") && !shows("artVariants");
  const showOvernumbered = shows("overnumbered") && !shows("artVariants");
  const showBanned = shows("banned");
  const showErrata = shows("errata");
  const showNoImage = shows("noImage");
  const showStandard = shows("standard");
  const showFlags = showOvernumbered || showSigned || showBanned || showErrata || showNoImage;

  if (
    !showStandard &&
    !showMarkers &&
    !showOversize &&
    !showChannels &&
    !showCustomTags &&
    !showTags &&
    !showKeywords &&
    !showOwned &&
    !showFlags
  ) {
    return null;
  }

  const dropdownProps = { availableFilters, filterCounts, placeholder };

  const entries: { key: string; label: string; node: ReactNode }[] = [];
  if (showStandard) {
    entries.push({
      key: "standard",
      label: m.cards_filter_flag_standard(),
      node: (
        <FlagBadge
          label={m.cards_filter_flag_standard()}
          state={filterState.standard}
          count={filterCounts?.flags.standard}
          onClick={toggleStandard}
          triggerStyle={triggerStyle}
        />
      ),
    });
  }
  if (showMarkers) {
    entries.push({
      key: "markers",
      label: m.cards_filter_unit_markers(),
      node: (
        <FilterValueDropdown dimension="markers" triggerStyle={triggerStyle} {...dropdownProps} />
      ),
    });
  }
  if (showOversize) {
    entries.push({
      key: "cardSizes",
      label: m.cards_filter_unit_card_sizes(),
      node: (
        <FlagBadge
          label={m.cards_filter_flag_oversized()}
          state={oversizeState(filterState.cardSizes)}
          count={oversizeCount(filterCounts?.cardSizes, oversizeState(filterState.cardSizes))}
          onClick={() => setArrayFilter("cardSizes", nextOversize(filterState.cardSizes))}
          triggerStyle={triggerStyle}
        />
      ),
    });
  }
  if (showChannels) {
    entries.push({
      key: "channels",
      label: m.cards_filter_unit_channels_short(),
      node: (
        <FilterValueDropdown dimension="channels" triggerStyle={triggerStyle} {...dropdownProps} />
      ),
    });
  }
  if (showCustomTags) {
    entries.push({
      key: "customTags",
      label: m.cards_filter_unit_custom_tags(),
      node: (
        <>
          {visibleCategories.map(([category, tagsInCategory]) => {
            // All categories share the `customTags`/`customTagsEx` URL keys; slice per category before toggling.
            const allSelected = selected("customTags");
            const categorySlugs = new Set(tagsInCategory.map((t) => t.slug));
            const selectedInCategory = allSelected.filter((slug) => categorySlugs.has(slug));
            const excludedInCategory = filterState.customTagsEx.filter((slug) =>
              categorySlugs.has(slug),
            );
            const label = tagsInCategory[0]?.categoryLabel ?? category;
            const tagOptions = tagsInCategory.map((t) => ({ value: t.slug, label: t.label }));
            return (
              <MultiSelectCombobox
                key={category}
                label={label}
                searchPlaceholder={m.cards_filter_search_named({ label: label.toLowerCase() })}
                emptyText={m.cards_filter_empty_named({ label: label.toLowerCase() })}
                options={tagOptions}
                selected={selectedInCategory}
                excluded={excludedInCategory}
                onCycle={(value) => cycleArrayFilter("customTags", "customTagsEx", value)}
                triggerStyle={triggerStyle}
              />
            );
          })}
          <FlagBadge
            label={presenceLabel("customTags")}
            state={presenceToFlagState(filterState.customTagsPresence)}
            count={presenceFlagCount(
              filterCounts?.presence.customTags,
              presenceToFlagState(filterState.customTagsPresence),
            )}
            onClick={() => cyclePresence("customTags")}
            triggerStyle={triggerStyle}
          />
        </>
      ),
    });
  }
  if (showTags) {
    entries.push({
      key: "tags",
      label: m.cards_filter_unit_tags(),
      node: (
        <>
          {tagGroups.map((group) => {
            const groupValues = new Set(group.tags);
            const selectedInGroup = selected("tags").filter((tag) => groupValues.has(tag));
            const excludedInGroup = filterState.tagsEx.filter((tag) => groupValues.has(tag));
            const tagOptions = group.tags.map((tag) => ({ value: tag, label: tag }));
            return (
              <MultiSelectCombobox
                key={group.slug}
                label={group.label}
                searchPlaceholder={m.cards_filter_search_named({
                  label: group.label.toLowerCase(),
                })}
                emptyText={m.cards_filter_empty_named({ label: group.label.toLowerCase() })}
                options={tagOptions}
                selected={selectedInGroup}
                excluded={excludedInGroup}
                onCycle={(value) => cycleArrayFilter("tags", "tagsEx", value)}
                counts={filterCounts?.tags}
                triggerStyle={triggerStyle}
              />
            );
          })}
          <FlagBadge
            label={presenceLabel("tags")}
            state={presenceToFlagState(filterState.tagsPresence)}
            count={presenceFlagCount(
              filterCounts?.presence.tags,
              presenceToFlagState(filterState.tagsPresence),
            )}
            onClick={() => cyclePresence("tags")}
            triggerStyle={triggerStyle}
          />
        </>
      ),
    });
  }
  if (showKeywords) {
    entries.push({
      key: "keywords",
      label: m.cards_filter_unit_keywords(),
      node: (
        <FilterValueDropdown dimension="keywords" triggerStyle={triggerStyle} {...dropdownProps} />
      ),
    });
  }
  if (showFlags) {
    entries.push({
      key: "flags",
      label: m.cards_filter_unit_flags(),
      node: (
        <>
          {showOvernumbered && (
            <FlagBadge
              label={m.cards_filter_flag_overnumbered()}
              state={filterState.overnumbered}
              count={filterCounts?.flags.overnumbered}
              onClick={toggleOvernumbered}
              triggerStyle={triggerStyle}
            />
          )}
          {showSigned && (
            <FlagBadge
              label={m.cards_filter_flag_signed()}
              state={filterState.signed}
              count={filterCounts?.flags.signed}
              onClick={toggleSigned}
              triggerStyle={triggerStyle}
            />
          )}
          {showBanned && (
            <FlagBadge
              label={m.cards_filter_flag_banned()}
              state={filterState.banned}
              count={filterCounts?.flags.banned}
              onClick={toggleBanned}
              triggerStyle={triggerStyle}
            />
          )}
          {showErrata && (
            <FlagBadge
              label={m.cards_filter_flag_errata()}
              state={filterState.errata}
              count={filterCounts?.flags.errata}
              onClick={toggleErrata}
              triggerStyle={triggerStyle}
            />
          )}
          {showNoImage && (
            <FlagBadge
              label={m.cards_filter_flag_no_image()}
              state={filterState.noImage}
              count={filterCounts?.flags.noImage}
              onClick={toggleNoImage}
              triggerStyle={triggerStyle}
            />
          )}
        </>
      ),
    });
  }
  if (showOwned) {
    entries.push({
      key: "owned",
      label: m.cards_filter_unit_owned(),
      node: (
        <MultiSelectCombobox
          label={m.cards_filter_unit_owned()}
          placeholder={placeholder}
          searchPlaceholder={m.cards_filter_search_owned()}
          emptyText={m.cards_filter_empty_options()}
          options={ownedBuckets().map((bucket) => ({
            value: bucket.value,
            label: bucket.label,
          }))}
          selected={filterState.owned}
          onChange={(values) => setArrayFilter("owned", values)}
          triggerStyle={triggerStyle}
        />
      ),
    });
  }

  if (variant === "inline") {
    return (
      <>
        {entries.map((entry) => (
          <Fragment key={entry.key}>{entry.node}</Fragment>
        ))}
      </>
    );
  }
  return (
    <>
      {entries.map((entry) => (
        <FilterSection key={entry.key} label={entry.label}>
          {entry.node}
        </FilterSection>
      ))}
    </>
  );
}

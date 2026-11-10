import { enumLabel } from "@openrift/shared/enum-label";

import { FilterSection } from "@/features/cards/components/filter-badge-row";
import { FlagBadge } from "@/features/cards/components/filter-flag-badge";
import type { FilterPanelContentProps } from "@/features/cards/components/filter-panel-content";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { formatDomainFilterLabel } from "@/lib/domain";
import { bindSignedFilter } from "@/lib/filter-sign";
import { getFilterIconPath } from "@/lib/icons";
import { m } from "@/paraglide/messages.js";

export function FilterBadgeSections({
  availableFilters,
  availableLanguages,
  setDisplayLabel,
  hiddenSections,
  filterOverrides,
  filterCounts,
  units,
}: Omit<FilterPanelContentProps, "visibleCustomTagCategories" | "topLevelUnits"> & {
  /** Placement units to render here; omit to render every badge section (collection stats page). */
  units?: ReadonlySet<string>;
}) {
  const { labels } = useEnumOrders();
  const { filterState } = useFilterValues();
  const actions = useFilterActions();
  const { toggleSigned, toggleOvernumbered } = actions;
  const languageLabels = useLanguageLabels();
  const showUnit = (unit: string) => units === undefined || units.has(unit);
  const signedApplicable = availableFilters.hasSigned && !hiddenSections?.has("signed");
  const overnumberedApplicable =
    availableFilters.hasOvernumbered && !hiddenSections?.has("overnumbered");
  const artVariantShown =
    showUnit("variant") &&
    availableFilters.artVariants.length > 1 &&
    !hiddenSections?.has("artVariants");
  const signedInArtVariant = signedApplicable && artVariantShown;
  const overnumberedInArtVariant = overnumberedApplicable && artVariantShown;
  const artVariantFlags = (
    <>
      {overnumberedInArtVariant && (
        <FlagBadge
          label={m.cards_filter_flag_overnumbered()}
          state={filterState.overnumbered}
          count={filterCounts?.flags.overnumbered}
          onClick={toggleOvernumbered}
        />
      )}
      {signedInArtVariant && (
        <FlagBadge
          label={m.cards_filter_flag_signed()}
          state={filterState.signed}
          count={filterCounts?.flags.signed}
          onClick={toggleSigned}
        />
      )}
    </>
  );
  // Use overrides when URL state is empty (zone presets that aren't in the URL)
  const selected = (key: keyof typeof filterState) => {
    const urlValue = filterState[key];
    const arr = Array.isArray(urlValue) ? urlValue : [];
    return arr.length > 0 ? arr : (filterOverrides?.[key] ?? []);
  };
  return (
    <>
      {showUnit("languages") &&
        availableLanguages &&
        availableLanguages.length > 1 &&
        !hiddenSections?.has("languages") && (
          <FilterSection
            label={m.cards_filter_unit_languages()}
            options={availableLanguages}
            selected={filterState.languages}
            excluded={filterState.languagesEx}
            signed={bindSignedFilter(
              actions,
              "languages",
              "languagesEx",
              filterState.languages,
              filterState.languagesEx,
            )}
            displayLabel={(code) => enumLabel(languageLabels, code)}
            counts={filterCounts?.languages}
          />
        )}
      {showUnit("sets") && !hiddenSections?.has("sets") && (
        <FilterSection
          label={m.cards_filter_unit_sets()}
          options={availableFilters.sets}
          selected={filterState.sets}
          excluded={filterState.setsEx}
          signed={bindSignedFilter(actions, "sets", "setsEx", filterState.sets, filterState.setsEx)}
          displayLabel={setDisplayLabel}
          secondaryOptions={availableFilters.supplementalSets}
          collapsible={availableFilters.supplementalSets}
          counts={filterCounts?.sets}
          wide
        />
      )}
      {showUnit("domains") && !hiddenSections?.has("domains") && (
        <FilterSection
          label={m.cards_filter_unit_domains()}
          options={availableFilters.domains}
          selected={selected("domains")}
          excluded={filterState.domainsEx}
          signed={bindSignedFilter(
            actions,
            "domains",
            "domainsEx",
            filterState.domains,
            filterState.domainsEx,
          )}
          iconPath={(v) => getFilterIconPath("domains", v)}
          displayLabel={(v) => formatDomainFilterLabel(v, labels.domains)}
          counts={filterCounts?.domains}
        />
      )}
      {showUnit("rarities") && !hiddenSections?.has("rarities") && (
        <FilterSection
          label={m.cards_filter_unit_rarities()}
          options={availableFilters.rarities}
          selected={filterState.rarities}
          excluded={filterState.raritiesEx}
          signed={bindSignedFilter(
            actions,
            "rarities",
            "raritiesEx",
            filterState.rarities,
            filterState.raritiesEx,
          )}
          iconPath={(v) => getFilterIconPath("rarities", v)}
          displayLabel={(v) => enumLabel(labels.rarities, v)}
          counts={filterCounts?.rarities}
        />
      )}
      {showUnit("types") && !hiddenSections?.has("types") && (
        <FilterSection
          label={m.cards_filter_unit_types()}
          options={availableFilters.types}
          selected={selected("types")}
          excluded={filterState.typesEx}
          signed={bindSignedFilter(
            actions,
            "types",
            "typesEx",
            filterState.types,
            filterState.typesEx,
          )}
          iconPath={(v) => getFilterIconPath("types", v)}
          displayLabel={(v) => enumLabel(labels.cardTypes, v)}
          counts={filterCounts?.types}
        />
      )}
      {showUnit("superTypes") &&
        availableFilters.superTypes.length > 0 &&
        !hiddenSections?.has("superTypes") && (
          <FilterSection
            label={m.cards_filter_unit_super_types()}
            options={availableFilters.superTypes}
            selected={selected("superTypes")}
            excluded={filterState.superTypesEx}
            signed={bindSignedFilter(
              actions,
              "superTypes",
              "superTypesEx",
              filterState.superTypes,
              filterState.superTypesEx,
            )}
            iconPath={(v) => getFilterIconPath("superTypes", v)}
            displayLabel={(v) => enumLabel(labels.superTypes, v)}
            counts={filterCounts?.superTypes}
          />
        )}
      {artVariantShown && (
        <FilterSection
          label={m.cards_filter_label_art_variant()}
          options={availableFilters.artVariants}
          selected={filterState.artVariants}
          excluded={filterState.artVariantsEx}
          signed={bindSignedFilter(
            actions,
            "artVariants",
            "artVariantsEx",
            filterState.artVariants,
            filterState.artVariantsEx,
          )}
          displayLabel={(v) => enumLabel(labels.artVariants, v)}
          counts={filterCounts?.artVariants}
          trailing={artVariantFlags}
        />
      )}
      {showUnit("variant") &&
        availableFilters.finishes.length > 1 &&
        !hiddenSections?.has("finishes") && (
          <FilterSection
            label={m.cards_filter_label_finish()}
            options={availableFilters.finishes}
            selected={filterState.finishes}
            excluded={filterState.finishesEx}
            signed={bindSignedFilter(
              actions,
              "finishes",
              "finishesEx",
              filterState.finishes,
              filterState.finishesEx,
            )}
            displayLabel={(v) => enumLabel(labels.finishes, v)}
            counts={filterCounts?.finishes}
          />
        )}
    </>
  );
}

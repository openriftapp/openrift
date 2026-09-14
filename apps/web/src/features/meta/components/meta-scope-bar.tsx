import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectCombobox } from "@/features/cards/components/multi-select-combobox";
import { metaEventTierLabels } from "@/features/meta/lib/meta-format";
import type {
  MetaEra,
  MetaScope,
  MetaScopeControls,
  MetaScopeFacet,
  ScopeFacetDefaults,
} from "@/features/meta/lib/meta-scope";
import {
  cycleScopeFacet,
  defaultEraId,
  ERA_ALL,
  ERA_CUSTOM,
  isScopeCustomized,
  scopeFacetValues,
} from "@/features/meta/lib/meta-scope";
import type { ScopeFacetCounts, ScopeFacetPresence } from "@/features/meta/lib/meta-scope-match";
import { useDeckFormatList } from "@/hooks/use-enums";
import { countryLabel, normalizeCountryCode } from "@/lib/country";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export interface MetaScopeBarProps extends MetaScopeControls {
  eras: readonly MetaEra[];
  countries?: readonly string[];
  extras?: ReactNode;
  extrasActive?: boolean;
  facetDefaults?: ScopeFacetDefaults;
  facetCounts?: Partial<ScopeFacetCounts>;
  present?: Partial<ScopeFacetPresence>;
  /** The era an absent `era` param stands for, when the surface's default is not the current set. */
  defaultEra?: string;
  showTier?: boolean;
  className?: string;
}

export function MetaScopeBar({
  scope,
  setScope,
  clearScope,
  eras,
  countries = [],
  extras,
  extrasActive = false,
  facetDefaults,
  facetCounts,
  present,
  defaultEra,
  showTier = true,
  className,
}: MetaScopeBarProps) {
  const { formats } = useDeckFormatList();

  const eraItems: Record<string, string> = { [ERA_ALL]: m.meta_scope_era_all() };
  for (const era of eras) {
    eraItems[era.id] = era.label;
  }
  eraItems[ERA_CUSTOM] = m.meta_scope_era_custom();

  const offered = (
    facet: MetaScopeFacet,
    options: readonly { value: string; label: string }[],
    key: (value: string) => string,
  ) => {
    const carried = present?.[facet];
    if (carried === undefined) {
      return { options, show: options.length > 1 };
    }
    const { included, excluded } = scopeFacetValues(scope, facet, facetDefaults);
    const picked = new Set([...included, ...excluded].map((value) => key(value)));
    const kept = options.filter(
      (option) => carried.has(key(option.value)) || picked.has(key(option.value)),
    );
    const stray = [...picked].some((value) => !carried.has(value));
    return { options: kept, show: kept.length > 1 || stray };
  };

  const formatFacet = offered(
    "formats",
    formats.map((format) => ({ value: format.slug, label: format.label })),
    (value) => value,
  );

  const tierFacet = offered(
    "tiers",
    Object.entries(metaEventTierLabels()).map(([value, label]) => ({ value, label })),
    (value) => value,
  );

  const countryFacet = offered(
    "countries",
    countries
      .map((code) => ({ value: code, label: countryLabel(code) }))
      .filter((option): option is { value: string; label: string } => option.label !== null),
    (value) => normalizeCountryCode(value) ?? value,
  );

  const countryCounts =
    facetCounts?.countries === undefined
      ? undefined
      : new Map(
          countries.map((code) => [
            code,
            facetCounts.countries?.get(normalizeCountryCode(code) ?? "") ?? 0,
          ]),
        );

  return (
    <div
      data-slot="meta-scope-bar"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      <ScopeSelect
        label={m.meta_scope_era()}
        value={scope.era ?? defaultEra ?? defaultEraId(eras) ?? ERA_ALL}
        fallback={ERA_ALL}
        items={eraItems}
        onValueChange={(next) =>
          // Leaving the custom range clears from/to; it does not re-apply hidden dates.
          setScope(
            next === ERA_CUSTOM
              ? { era: ERA_CUSTOM }
              : { era: next, from: undefined, to: undefined },
          )
        }
      />

      {scope.era === ERA_CUSTOM && (
        <>
          <DatePicker
            value={scope.from ?? ""}
            onChange={(iso) => setScope({ from: iso })}
            onClear={() => setScope({ from: undefined })}
            placeholder={m.meta_scope_from()}
            className="w-36"
          />
          <DatePicker
            value={scope.to ?? ""}
            onChange={(iso) => setScope({ to: iso })}
            onClear={() => setScope({ to: undefined })}
            placeholder={m.meta_scope_to()}
            className="w-36"
          />
        </>
      )}

      {showTier && tierFacet.show && (
        <ScopeFacet
          label={m.meta_scope_tier()}
          facet="tiers"
          options={tierFacet.options}
          scope={scope}
          setScope={setScope}
          defaults={facetDefaults}
          counts={facetCounts?.tiers}
        />
      )}

      {formatFacet.show && (
        <ScopeFacet
          label={m.meta_scope_format()}
          facet="formats"
          options={formatFacet.options}
          scope={scope}
          setScope={setScope}
          defaults={facetDefaults}
          counts={facetCounts?.formats}
        />
      )}

      {countryFacet.show && (
        <ScopeFacet
          label={m.meta_scope_country()}
          facet="countries"
          options={countryFacet.options}
          scope={scope}
          setScope={setScope}
          defaults={facetDefaults}
          counts={countryCounts}
        />
      )}

      {extras}

      {(isScopeCustomized(scope, defaultEra) || extrasActive) && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground ml-auto"
          onClick={clearScope}
          aria-label={m.cards_clear_all_filters()}
        >
          <XIcon className="size-4" />
        </Button>
      )}
    </div>
  );
}

function ScopeFacet({
  label,
  facet,
  options,
  scope,
  setScope,
  defaults,
  counts,
}: {
  label: string;
  facet: MetaScopeFacet;
  options: readonly { value: string; label: string }[];
  scope: MetaScope;
  setScope: (patch: Partial<MetaScope>) => void;
  defaults?: ScopeFacetDefaults;
  counts?: Map<string, number>;
}) {
  const { included, excluded } = scopeFacetValues(scope, facet, defaults);
  return (
    <MultiSelectCombobox
      label={label}
      triggerStyle="button"
      triggerSize="sm"
      options={options}
      selected={[...included]}
      excluded={[...excluded]}
      counts={counts}
      onCycle={(value) => setScope(cycleScopeFacet(scope, facet, value, defaults))}
      searchPlaceholder={m.meta_scope_search_label({ label: label.toLowerCase() })}
    />
  );
}

export function ScopeSelect({
  label,
  value,
  fallback,
  items,
  counts,
  className,
  onValueChange,
}: {
  label: string;
  value: string;
  fallback: string;
  items: Record<string, string>;
  counts?: Map<string, number>;
  className?: string;
  onValueChange: (value: string) => void;
}) {
  const shown = value in items ? value : fallback;
  return (
    // BaseUI passes null on clear; map it to fallback.
    <Select value={shown} onValueChange={(next) => onValueChange(next ?? fallback)} items={items}>
      <SelectTrigger size="sm" className={cn("font-medium", className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([itemValue, itemLabel]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {itemLabel}
            {counts !== undefined && (
              <span
                className={cn(
                  "text-muted-foreground text-2xs ml-1.5 tabular-nums",
                  (counts.get(itemValue) ?? 0) === 0 && "opacity-50",
                )}
              >
                {counts.get(itemValue) ?? 0}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

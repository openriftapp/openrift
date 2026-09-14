import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterSection } from "@/features/cards/components/filter-badge-row";
import { LabelledRow } from "@/features/cards/components/labelled-row";
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
  removeScopeFacetValue,
  scopeFacetValues,
} from "@/features/meta/lib/meta-scope";
import type { ScopeFacetCounts, ScopeFacetPresence } from "@/features/meta/lib/meta-scope-match";
import { useDeckFormatList } from "@/hooks/use-enums";
import { useSmUp } from "@/hooks/use-sm-up";
import { countryLabel, normalizeCountryCode } from "@/lib/country";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** A surface's own pick, shown in the phone strip beside the scope's. */
interface MetaScopeActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface MetaScopeBarProps extends MetaScopeControls {
  eras: readonly MetaEra[];
  countries?: readonly string[];
  search?: ReactNode;
  extras?: ReactNode;
  extrasActive?: boolean;
  activeChips?: readonly MetaScopeActiveChip[];
  facetDefaults?: ScopeFacetDefaults;
  facetCounts?: Partial<ScopeFacetCounts>;
  present?: Partial<ScopeFacetPresence>;
  eraCounts?: Map<string, number>;
  /** The era an absent `era` param stands for, when the surface's default is not the current set. */
  defaultEra?: string;
  showTier?: boolean;
  className?: string;
}

interface FacetView {
  facet: MetaScopeFacet;
  label: string;
  options: readonly { value: string; label: string }[];
  counts?: Map<string, number>;
  show: boolean;
}

export function MetaScopeBar({
  scope,
  setScope,
  clearScope,
  eras,
  countries = [],
  search,
  extras,
  extrasActive = false,
  activeChips = [],
  facetDefaults,
  facetCounts,
  present,
  eraCounts: eraCountMap,
  defaultEra,
  showTier = true,
  className,
}: MetaScopeBarProps) {
  const { formats } = useDeckFormatList();
  const smUp = useSmUp();

  const eraItems: Record<string, string> = { [ERA_ALL]: m.meta_scope_era_all() };
  for (const era of eras) {
    eraItems[era.id] = era.label;
  }
  eraItems[ERA_CUSTOM] = m.meta_scope_era_custom();
  const eraValue = scope.era ?? defaultEra ?? defaultEraId(eras) ?? ERA_ALL;
  const setEra = (next: string) =>
    // Leaving the custom range clears from/to; it does not re-apply hidden dates.
    setScope(
      next === ERA_CUSTOM ? { era: ERA_CUSTOM } : { era: next, from: undefined, to: undefined },
    );

  const offered = (
    facet: MetaScopeFacet,
    label: string,
    options: readonly { value: string; label: string }[],
    counts: Map<string, number> | undefined,
    key: (value: string) => string,
  ): FacetView => {
    const carried = present?.[facet];
    if (carried === undefined) {
      return { facet, label, options, counts, show: options.length > 1 };
    }
    const { included, excluded } = scopeFacetValues(scope, facet, facetDefaults);
    const picked = new Set([...included, ...excluded].map((value) => key(value)));
    const kept = options.filter(
      (option) => carried.has(key(option.value)) || picked.has(key(option.value)),
    );
    const stray = [...picked].some((value) => !carried.has(value));
    return { facet, label, options: kept, counts, show: kept.length > 1 || stray };
  };

  const countryCounts =
    facetCounts?.countries === undefined
      ? undefined
      : new Map(
          countries.map((code) => [
            code,
            facetCounts.countries?.get(normalizeCountryCode(code) ?? "") ?? 0,
          ]),
        );

  const facets: FacetView[] = [
    offered(
      "tiers",
      m.meta_scope_tier(),
      Object.entries(metaEventTierLabels()).map(([value, label]) => ({ value, label })),
      facetCounts?.tiers,
      (value) => value,
    ),
    offered(
      "formats",
      m.meta_scope_format(),
      formats.map((format) => ({ value: format.slug, label: format.label })),
      facetCounts?.formats,
      (value) => value,
    ),
    offered(
      "countries",
      m.meta_scope_country(),
      countries
        .map((code) => ({ value: code, label: countryLabel(code) }))
        .filter((option): option is { value: string; label: string } => option.label !== null),
      countryCounts,
      (value) => normalizeCountryCode(value) ?? value,
    ),
  ].filter((view) => view.show && (showTier || view.facet !== "tiers"));

  const active = isScopeCustomized(scope, defaultEra) || extrasActive;
  const strip = activeStrip(scope, eras, facets, defaultEra, facetDefaults);
  const activeCount = strip.length + activeChips.length;

  const datePickers = scope.era === ERA_CUSTOM && (
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
  );

  return (
    <div data-slot="meta-scope-bar" className={cn("flex flex-col gap-2", className)}>
      {(search !== undefined || !smUp) && (
        <div className="flex items-center gap-2">
          {search}
          {!smUp && (
            <ScopeDrawer count={activeCount}>
              <LabelledRow label={m.meta_scope_era()}>
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  <ScopeSelect
                    label={m.meta_scope_era()}
                    value={eraValue}
                    fallback={ERA_ALL}
                    items={eraItems}
                    counts={eraCountMap}
                    onValueChange={setEra}
                  />
                  {datePickers}
                </div>
              </LabelledRow>
              {facets.map((view) => (
                <FacetSection
                  key={view.facet}
                  view={view}
                  scope={scope}
                  setScope={setScope}
                  defaults={facetDefaults}
                />
              ))}
              {extras !== undefined && (
                <div className="flex flex-wrap items-center gap-1.5">{extras}</div>
              )}
            </ScopeDrawer>
          )}
        </div>
      )}

      {smUp && (
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          <ScopeSelect
            label={m.meta_scope_era()}
            value={eraValue}
            fallback={ERA_ALL}
            items={eraItems}
            counts={eraCountMap}
            onValueChange={setEra}
          />
          {datePickers}
          {facets.map((view) => (
            <FacetChip
              key={view.facet}
              view={view}
              scope={scope}
              setScope={setScope}
              defaults={facetDefaults}
            />
          ))}
          {extras}
          {active && (
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
      )}

      {!smUp && active && (
        <div className="flex flex-wrap items-center gap-1 sm:hidden">
          {strip.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1">
              {chip.label}
              <ChipRemoveButton
                aria-label={m.cards_filter_remove_value({ label: chip.group, value: chip.label })}
                onClick={() => setScope(chip.patch)}
              />
            </Badge>
          ))}
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1">
              {chip.label}
              <ChipRemoveButton
                aria-label={m.cards_filter_clear_named({ label: chip.label })}
                onClick={() => chip.onRemove()}
              />
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={clearScope}
          >
            {m.cards_clear_all_filters()}
          </Button>
        </div>
      )}
    </div>
  );
}

interface StripChip {
  key: string;
  group: string;
  label: string;
  patch: Partial<MetaScope>;
}

function activeStrip(
  scope: MetaScope,
  eras: readonly MetaEra[],
  facets: readonly FacetView[],
  defaultEra: string | undefined,
  defaults: ScopeFacetDefaults | undefined,
): StripChip[] {
  const chips: StripChip[] = [];
  if (scope.era !== undefined && scope.era !== defaultEra) {
    const label =
      scope.era === ERA_ALL
        ? m.meta_scope_era_all()
        : scope.era === ERA_CUSTOM
          ? [scope.from, scope.to].filter(Boolean).join(" – ") || m.meta_scope_era_custom()
          : (eras.find((era) => era.id === scope.era)?.label ?? scope.era);
    chips.push({
      key: "era",
      group: m.meta_scope_era(),
      label,
      patch: { era: undefined, from: undefined, to: undefined },
    });
  }
  for (const view of facets) {
    const explicit = scope[view.facet] !== undefined || scope[`${view.facet}Ex`] !== undefined;
    if (!explicit) {
      continue;
    }
    const { included, excluded } = scopeFacetValues(scope, view.facet, defaults);
    const name = (value: string) =>
      view.options.find((option) => option.value === value)?.label ?? value;
    for (const value of included) {
      chips.push({
        key: `${view.facet}:${value}`,
        group: view.label,
        label: name(value),
        patch: removeScopeFacetValue(scope, view.facet, value, defaults),
      });
    }
    for (const value of excluded) {
      chips.push({
        key: `${view.facet}:-${value}`,
        group: view.label,
        label: `−${name(value)}`,
        patch: removeScopeFacetValue(scope, view.facet, value, defaults),
      });
    }
  }
  return chips;
}

function ScopeDrawer({ count, children }: { count: number; children: ReactNode }) {
  const [openedOnce, setOpenedOnce] = useState(false);
  return (
    <Drawer showSwipeHandle onOpenChange={(open) => open && setOpenedOnce(true)}>
      <DrawerTrigger
        render={<Button variant="outline" size="icon" className="relative shrink-0" />}
        aria-label={m.cards_filters()}
      >
        <SlidersHorizontalIcon className="size-4" />
        {count > 0 && (
          <span className="bg-primary text-primary-foreground text-2xs absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-semibold tabular-nums">
            {count}
          </span>
        )}
      </DrawerTrigger>
      <DrawerContent className="pb-4 data-ending-style:duration-250" keepMounted={openedOnce}>
        <DrawerHeader className="sr-only">
          <DrawerTitle>{m.cards_filters()}</DrawerTitle>
          <DrawerDescription>{m.meta_scope_filters_description()}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
          {children}
        </div>
        <DrawerFooter>
          <DrawerClose render={<Button className="w-full" />}>{m.common_done()}</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function FacetSection({
  view,
  scope,
  setScope,
  defaults,
}: {
  view: FacetView;
  scope: MetaScope;
  setScope: (patch: Partial<MetaScope>) => void;
  defaults?: ScopeFacetDefaults;
}) {
  const { included, excluded } = scopeFacetValues(scope, view.facet, defaults);
  const labels = new Map(view.options.map((option) => [option.value, option.label]));
  return (
    <FilterSection
      label={view.label}
      options={view.options.map((option) => option.value)}
      selected={[...included]}
      excluded={[...excluded]}
      onCycle={(value) => setScope(cycleScopeFacet(scope, view.facet, value, defaults))}
      displayLabel={(value) => labels.get(value) ?? value}
      counts={view.counts}
    />
  );
}

function FacetChip({
  view,
  scope,
  setScope,
  defaults,
}: {
  view: FacetView;
  scope: MetaScope;
  setScope: (patch: Partial<MetaScope>) => void;
  defaults?: ScopeFacetDefaults;
}) {
  const { included, excluded } = scopeFacetValues(scope, view.facet, defaults);
  return (
    <MultiSelectCombobox
      label={view.label}
      triggerStyle="button"
      triggerSize="sm"
      options={view.options}
      selected={[...included]}
      excluded={[...excluded]}
      counts={view.counts}
      onCycle={(value) => setScope(cycleScopeFacet(scope, view.facet, value, defaults))}
      searchPlaceholder={m.meta_scope_search_label({ label: view.label.toLowerCase() })}
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

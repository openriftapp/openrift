import { filterCards } from "@openrift/shared/filters";
import { getAvailableFilters } from "@openrift/shared/filters-available";
import type { Marketplace } from "@openrift/shared/types/pricing";
import type {
  CardFilters,
  FilterRange,
  PresenceDimension,
  PresenceState,
} from "@openrift/shared/types/search";
import { PlusIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectCombobox } from "@/features/cards/components/multi-select-combobox";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { cycleIncludeExclude } from "@/features/cards/lib/filter-cycle";
import { presenceLabel, presenceToFlagState } from "@/features/cards/lib/presence-filter";
import { useCustomTagAssignments } from "@/features/collections/hooks/use-custom-tag-assignments";
import { useCustomTagList, useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

export const CONTROL_WIDTH =
  "h-8 w-44 justify-between rounded-lg bg-transparent text-sm font-normal hover:bg-muted dark:bg-input/30 dark:hover:bg-input/50";

const PRICE_MARKETPLACE_OPTIONS: { value: Marketplace; label: string }[] = [
  { value: "cardtrader", label: "CardTrader (EUR)" },
  { value: "tcgplayer", label: "TCGplayer (USD)" },
  { value: "cardmarket", label: "Cardmarket (EUR)" },
];

export function FilterRow({
  label,
  hint,
  onRemove,
  children,
}: {
  label: string;
  hint?: string;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1 text-sm font-medium">
        {label}
        {hint && <InfoHint label={label}>{hint}</InfoHint>}
      </span>
      {onRemove ? (
        <div className="flex items-center gap-1">
          {children}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={m.lists_rule_remove_filter({ label })}
            onClick={onRemove}
          >
            <XIcon />
          </Button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface Option {
  value: string;
  label: string;
}

type ArrayKey = {
  [K in keyof CardFilters]: CardFilters[K] extends string[] ? K : never;
}[keyof CardFilters];

type FlagKey = {
  [K in keyof CardFilters]: CardFilters[K] extends boolean | null ? K : never;
}[keyof CardFilters];

type DimGroup = "standard" | "card" | "printing";

interface DimEntry {
  key: string;
  label: string;
  group: DimGroup;
  available: boolean;
  active: boolean;
  node: ReactNode;
}

export function RuleFilterEditor({
  value,
  onChange,
  priceMarketplace,
  onPriceMarketplaceChange,
}: {
  value: CardFilters;
  onChange: (next: CardFilters) => void;
  /** Null until the price criterion is used. */
  priceMarketplace: Marketplace | null;
  onPriceMarketplaceChange: (marketplace: Marketplace) => void;
}) {
  const { allPrintings, sets } = useCards();
  const { orders, labels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  const { all: customTags } = useCustomTagList();
  const prices = usePrices();
  const customTagAssignments = useCustomTagAssignments();
  const marketplaceOrder = useDisplayStore((state) => state.marketplaceOrder);
  const shownMarketplace = priceMarketplace ?? marketplaceOrder[0];
  const available = getAvailableFilters(allPrintings, { orders, sets });

  const [shownKeys, setShownKeys] = useState<readonly string[]>([]);

  const patch = (next: Partial<CardFilters>) => onChange({ ...value, ...next });

  const pin = (key: string) =>
    setShownKeys((current) => (current.includes(key) ? current : [...current, key]));

  const presenceWithout = (
    dimension: PresenceDimension,
  ): Partial<Record<PresenceDimension, PresenceState>> => {
    const next: Partial<Record<PresenceDimension, PresenceState>> = {};
    for (const [existing, existingState] of Object.entries(value.presence) as [
      PresenceDimension,
      PresenceState,
    ][]) {
      if (existing !== dimension) {
        next[existing] = existingState;
      }
    }
    return next;
  };

  const patchPresence = (dimension: PresenceDimension, state?: PresenceState) => {
    const nextPresence = presenceWithout(dimension);
    if (state !== undefined) {
      nextPresence[dimension] = state;
    }
    patch({ presence: nextPresence });
  };

  const languageOptions: Option[] = [...new Set(allPrintings.map((printing) => printing.language))]
    .sort((first, second) => first.localeCompare(second))
    .map((language) => ({ value: language, label: languageLabels[language] ?? language }));

  const namedOptions = (slugs: readonly string[], lookup: Record<string, string>): Option[] =>
    slugs.map((slug) => ({ value: slug, label: lookup[slug] ?? slug }));

  const setNames = new Map(sets.map((set) => [set.slug, set.name]));

  const dimension = (
    key: string,
    label: string,
    group: DimGroup,
    includeKey: ArrayKey,
    excludeKey: ArrayKey,
    options: Option[],
    presenceDimension?: PresenceDimension,
  ): DimEntry => {
    const presenceState = presenceDimension ? value.presence[presenceDimension] : undefined;
    return {
      key,
      label,
      group,
      available: options.length > 0,
      active:
        value[includeKey].length > 0 || value[excludeKey].length > 0 || presenceState !== undefined,
      node: (
        <FilterRow
          key={key}
          label={label}
          onRemove={() => {
            const next: Partial<CardFilters> = { [includeKey]: [], [excludeKey]: [] };
            if (presenceDimension) {
              next.presence = presenceWithout(presenceDimension);
            }
            patch(next);
            setShownKeys((current) => current.filter((entry) => entry !== key));
          }}
        >
          <MultiSelectCombobox
            triggerStyle="button"
            triggerClassName={CONTROL_WIDTH}
            placeholder={m.lists_rule_placeholder_any()}
            label={label}
            searchPlaceholder={m.lists_rule_search_placeholder({ label: label.toLowerCase() })}
            options={options}
            selected={value[includeKey]}
            excluded={value[excludeKey]}
            onCycle={(toggled) => {
              const next = cycleIncludeExclude(value[includeKey], value[excludeKey], toggled);
              pin(key);
              patch({ [includeKey]: next.included, [excludeKey]: next.excluded });
            }}
            flagPosition="top"
            flags={
              presenceDimension
                ? [
                    {
                      label: presenceLabel(presenceDimension),
                      state: presenceToFlagState(presenceState ?? null),
                      onToggle: () => {
                        const cycled = cycleIncludeExclude(
                          presenceState === "any" ? ["1"] : [],
                          presenceState === "none" ? ["1"] : [],
                          "1",
                        );
                        pin(key);
                        patchPresence(
                          presenceDimension,
                          cycled.included.length > 0
                            ? "any"
                            : cycled.excluded.length > 0
                              ? "none"
                              : undefined,
                        );
                      },
                    },
                  ]
                : undefined
            }
          />
        </FilterRow>
      ),
    };
  };

  const flag = (
    key: string,
    label: string,
    optionLabel: string,
    field: FlagKey,
    group: DimGroup,
    isAvailable: boolean,
    hint?: string,
  ): DimEntry => {
    const options: Option[] = [{ value: "1", label: optionLabel }];
    return {
      key,
      label,
      group,
      available: isAvailable,
      active: value[field] !== null,
      node: (
        <FilterRow
          key={key}
          label={label}
          hint={hint}
          onRemove={() => {
            patch({ [field]: null });
            setShownKeys((current) => current.filter((entry) => entry !== key));
          }}
        >
          <MultiSelectCombobox
            triggerStyle="button"
            triggerClassName={CONTROL_WIDTH}
            placeholder={m.lists_rule_placeholder_any()}
            label={label}
            options={options}
            selected={value[field] === true ? ["1"] : []}
            excluded={value[field] === false ? ["1"] : []}
            onCycle={() => {
              const next = cycleIncludeExclude(
                value[field] === true ? ["1"] : [],
                value[field] === false ? ["1"] : [],
                "1",
              );
              pin(key);
              patch({
                [field]: next.included.length > 0 ? true : next.excluded.length > 0 ? false : null,
              });
            }}
          />
        </FilterRow>
      ),
    };
  };

  const priceActive = value.price.min !== null || value.price.max !== null;
  // Printings matching the filter but with no price on the chosen marketplace
  // are silently dropped; this count is surfaced under the row so it isn't mistaken for a bug.
  const pricelessMatchCount = priceActive
    ? filterCards(
        allPrintings,
        { ...value, price: { min: null, max: null } },
        { customTagAssignments },
      ).filter((printing) => prices.get(printing.id, shownMarketplace) === undefined).length
    : 0;

  const patchPrice = (price: FilterRange) => {
    pin("price");
    patch({ price });
    if (priceMarketplace === null) {
      onPriceMarketplaceChange(shownMarketplace);
    }
  };

  const priceBoundInput = (bound: "min" | "max") => (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      className="h-8 w-20"
      placeholder={bound === "min" ? m.lists_rule_price_min() : m.lists_rule_price_max()}
      aria-label={bound === "min" ? m.lists_rule_price_min_aria() : m.lists_rule_price_max_aria()}
      value={value.price[bound] ?? ""}
      onChange={(event) => {
        // oxlint-disable-next-line unicorn/prefer-number-coercion -- lenient parse of an input value; Number("") is 0, not the intended "no bound"
        const parsed = Number.parseFloat(event.target.value);
        patchPrice({
          ...value.price,
          [bound]: Number.isNaN(parsed) ? null : Math.max(0, parsed),
        });
      }}
    />
  );

  const priceEntry: DimEntry = {
    key: "price",
    label: m.lists_rule_dim_price(),
    group: "printing",
    available: true,
    active: priceActive,
    node: (
      <div key="price" className="flex flex-col gap-3">
        <FilterRow
          label={m.lists_rule_dim_price()}
          hint={m.lists_rule_hint_price()}
          onRemove={() => {
            patch({ price: { min: null, max: null } });
            setShownKeys((current) => current.filter((entry) => entry !== "price"));
          }}
        >
          <div className="flex items-center gap-1">
            {priceBoundInput("min")}
            <span className="text-muted-foreground" aria-hidden>
              –
            </span>
            {priceBoundInput("max")}
          </div>
        </FilterRow>
        <FilterRow label={m.lists_rule_dim_marketplace()}>
          <Select
            items={PRICE_MARKETPLACE_OPTIONS}
            value={shownMarketplace}
            onValueChange={(next) => onPriceMarketplaceChange(next as Marketplace)}
          >
            <SelectTrigger
              className={CONTROL_WIDTH}
              aria-label={m.lists_rule_price_marketplace_aria()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PRICE_MARKETPLACE_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FilterRow>
        <p className="text-muted-foreground -mt-1 text-sm">
          {m.lists_rule_price_note()}
          {pricelessMatchCount > 0 &&
            ` ${m.lists_rule_price_skipped({ count: pricelessMatchCount })}`}
        </p>
      </div>
    ),
  };

  const searchEntry: DimEntry = {
    key: "search",
    label: m.lists_rule_dim_search(),
    group: "card",
    available: true,
    active: value.search.trim() !== "",
    node: (
      <FilterRow
        key="search"
        label={m.lists_rule_dim_search()}
        onRemove={() => {
          patch({ search: "" });
          setShownKeys((current) => current.filter((entry) => entry !== "search"));
        }}
      >
        <Input
          className="h-8 w-44"
          placeholder={m.lists_rule_search_text_placeholder()}
          value={value.search}
          onChange={(event) => {
            pin("search");
            patch({ search: event.target.value });
          }}
          aria-label={m.lists_rule_search_text_aria()}
        />
      </FilterRow>
    ),
  };

  const entries: DimEntry[] = [
    flag(
      "standard",
      m.lists_rule_dim_standard_printings(),
      m.lists_rule_flag_standard(),
      "isStandard",
      "standard",
      available.hasNonStandard,
      m.lists_rule_hint_standard(),
    ),
    searchEntry,
    dimension(
      "types",
      m.lists_rule_dim_types(),
      "card",
      "types",
      "typesExclude",
      namedOptions(available.types, labels.cardTypes),
    ),
    dimension(
      "superTypes",
      m.lists_rule_dim_super_type(),
      "card",
      "superTypes",
      "superTypesExclude",
      namedOptions(available.superTypes, labels.superTypes),
      "superTypes",
    ),
    dimension(
      "domains",
      m.lists_rule_dim_domains(),
      "card",
      "domains",
      "domainsExclude",
      namedOptions(available.domains, labels.domains),
    ),
    dimension(
      "customTags",
      m.lists_rule_dim_custom_tags(),
      "card",
      "customTagSlugs",
      "customTagSlugsExclude",
      customTags.map((tag) => ({ value: tag.slug, label: tag.label })),
      "customTags",
    ),
    dimension(
      "tags",
      m.lists_rule_dim_tags(),
      "card",
      "tags",
      "tagsExclude",
      available.tags.map((tag) => ({ value: tag, label: tag })),
      "tags",
    ),
    dimension(
      "keywords",
      m.lists_rule_dim_keywords(),
      "card",
      "keywords",
      "keywordsExclude",
      available.keywords.map((keyword) => ({ value: keyword, label: keyword })),
      "keywords",
    ),
    flag(
      "banned",
      m.lists_rule_dim_banned(),
      m.lists_rule_flag_banned(),
      "isBanned",
      "card",
      available.hasBanned,
    ),
    dimension(
      "sets",
      m.lists_rule_dim_sets(),
      "printing",
      "sets",
      "setsExclude",
      available.sets.map((slug) => ({ value: slug, label: setNames.get(slug) ?? slug })),
    ),
    dimension(
      "rarities",
      m.lists_rule_dim_rarities(),
      "printing",
      "rarities",
      "raritiesExclude",
      namedOptions(available.rarities, labels.rarities),
    ),
    dimension(
      "finishes",
      m.lists_rule_dim_finishes(),
      "printing",
      "finishes",
      "finishesExclude",
      namedOptions(available.finishes, labels.finishes),
    ),
    dimension(
      "artVariants",
      m.lists_rule_dim_art_variants(),
      "printing",
      "artVariants",
      "artVariantsExclude",
      namedOptions(available.artVariants, labels.artVariants),
    ),
    dimension(
      "languages",
      m.lists_rule_dim_languages(),
      "printing",
      "languages",
      "languagesExclude",
      languageOptions,
    ),
    dimension(
      "markers",
      m.lists_rule_dim_markers(),
      "printing",
      "markerSlugs",
      "markerSlugsExclude",
      available.markers.map((marker) => ({ value: marker.slug, label: marker.label })),
      "markers",
    ),
    dimension(
      "channels",
      m.lists_rule_dim_channels(),
      "printing",
      "distributionChannelSlugs",
      "distributionChannelSlugsExclude",
      available.distributionChannels.map((channel) => ({
        value: channel.slug,
        label: channel.label,
      })),
      "distributionChannels",
    ),
    flag(
      "overnumbered",
      m.lists_rule_dim_overnumbered(),
      m.lists_rule_flag_overnumbered(),
      "isOvernumbered",
      "printing",
      available.hasOvernumbered,
    ),
    flag(
      "signed",
      m.lists_rule_dim_signed(),
      m.lists_rule_flag_signed(),
      "isSigned",
      "printing",
      available.hasSigned,
    ),
    priceEntry,
  ];

  const shownSet = new Set(shownKeys);
  const shown = entries.filter((entry) => entry.active || shownSet.has(entry.key));
  const addable = entries.filter(
    (entry) => entry.available && !entry.active && !shownSet.has(entry.key),
  );
  const addableInGroup = (group: DimGroup) => addable.filter((entry) => entry.group === group);

  const addStandard = addableInGroup("standard");
  const addCard = addableInGroup("card");
  const addPrinting = addableInGroup("printing");

  const renderItems = (group: DimEntry[]) =>
    group.map((entry) => (
      <DropdownMenuItem
        key={entry.key}
        onClick={() => setShownKeys((current) => [...current, entry.key])}
      >
        {entry.label}
      </DropdownMenuItem>
    ));

  return (
    <>
      {shown.map((entry) => entry.node)}

      {addable.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="outline" size="sm" className="self-start">
                <PlusIcon />
                {m.lists_rule_add_filter()}
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            {renderItems(addStandard)}
            {addStandard.length > 0 && (addCard.length > 0 || addPrinting.length > 0) && (
              <DropdownMenuSeparator />
            )}
            {addCard.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel>{m.lists_rule_group_card()}</DropdownMenuLabel>
                {renderItems(addCard)}
              </DropdownMenuGroup>
            )}
            {addPrinting.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel>{m.lists_rule_group_printing()}</DropdownMenuLabel>
                {renderItems(addPrinting)}
              </DropdownMenuGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

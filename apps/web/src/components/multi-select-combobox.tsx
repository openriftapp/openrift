import { CheckIcon, MinusIcon } from "lucide-react";
import { useState } from "react";

import { CardIcon } from "@/components/card-icon";
import type { ComboboxPickerOption } from "@/components/combobox-picker";
import { ComboboxPicker } from "@/components/combobox-picker";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { FilterSign } from "@/lib/filter-sign";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface MultiSelectOption {
  value: string;
  label: string;
  prefix?: string;
}

interface MultiSelectGroup {
  label: string;
  options: readonly MultiSelectOption[];
  included: string[];
  excluded: string[];
  sign: FilterSign | null;
  onSignedToggle: (value: string, sign: FilterSign) => void;
  onSignFlip: () => void;
  counts?: Map<string, number>;
}

export interface MultiSelectComboboxProps {
  label: string;
  options: readonly MultiSelectOption[];
  selected: string[];
  onChange?: (next: string[]) => void;
  excluded?: string[];
  sign?: FilterSign | null;
  onSignedToggle?: (value: string, sign: FilterSign) => void;
  onSignFlip?: () => void;
  searchPlaceholder?: string;
  emptyText?: string;
  triggerStyle?: "chip" | "button" | "menu";
  icon?: (value: string) => string | undefined;
  iconAfterLabel?: boolean;
  counts?: Map<string, number>;
  mutedOptions?: ReadonlySet<string>;
  primaryLabel?: string;
  groups?: readonly MultiSelectGroup[];
  flags?: readonly MultiSelectFlag[];
  flagPosition?: "top" | "bottom";
  fitContent?: boolean;
  placeholder?: string;
  triggerClassName?: string;
  triggerSize?: "sm" | "default";
  anyCount?: number;
}

const MENU_SEARCH_THRESHOLD = 8;

interface MultiSelectFlag {
  label: string;
  state: boolean | null;
  count?: number;
  onToggle: () => void;
}

const FLAG_PREFIX = "__flag__:";
const FLAG_GROUP = "flags";
const flagId = (index: number) => `${FLAG_PREFIX}${index}`;

/**
 * A space never appears in a slug, so a group option's id (` <groupIndex> <value>`)
 * never collides with a primary option's raw value.
 */
const GROUP_SEP = " ";

interface Section {
  index: number;
  label?: string;
  options: readonly MultiSelectOption[];
  selected: string[];
  onChange?: (next: string[]) => void;
  excluded?: string[];
  sign?: FilterSign | null;
  onSignedToggle?: (value: string, sign: FilterSign) => void;
  onSignFlip?: () => void;
  counts?: Map<string, number>;
  icon?: (value: string) => string | undefined;
  iconAfterLabel?: boolean;
  mutedOptions?: ReadonlySet<string>;
}

function encodeId(sectionIndex: number, value: string): string {
  return sectionIndex === 0 ? value : `${GROUP_SEP}${sectionIndex}${GROUP_SEP}${value}`;
}

function decodeId(id: string): { sectionIndex: number; value: string } {
  if (!id.startsWith(GROUP_SEP)) {
    return { sectionIndex: 0, value: id };
  }
  const rest = id.slice(GROUP_SEP.length);
  const separator = rest.indexOf(GROUP_SEP);
  return {
    sectionIndex: Number(rest.slice(0, separator)),
    value: rest.slice(separator + GROUP_SEP.length),
  };
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function stateMark(state: boolean | null) {
  if (state === null) {
    return;
  }
  return state ? <CheckIcon className="size-4" /> : <MinusIcon className="size-4" />;
}

function sectionRows(section: Section, sign: FilterSign): ComboboxPickerOption[] {
  const known = new Set(section.options.map((option) => option.value));
  // A selection can outlive its option (e.g. a set filter after the last card
  // in it leaves the collection); keep it as an orphan row so it stays clearable.
  const orphans = [...section.selected, ...(section.excluded ?? [])]
    .filter((value) => !known.has(value))
    .map((value): MultiSelectOption => ({ value, label: value }));
  const signed = section.onSignedToggle !== undefined;
  return [...section.options, ...orphans].map((option) => {
    const iconPath = section.icon?.(option.value);
    const included = signed && section.selected.includes(option.value);
    const excluded = signed && (section.excluded?.includes(option.value) ?? false);
    return {
      value: encodeId(section.index, option.value),
      label: option.label,
      prefix: option.prefix || undefined,
      keywords: option.prefix,
      icon: iconPath && (
        <CardIcon
          src={iconPath}
          className={
            section.iconAfterLabel ? "ml-1.5 inline-block size-4 align-text-bottom" : "size-4"
          }
        />
      ),
      iconAfterLabel: section.iconAfterLabel,
      count: section.counts?.get(option.value),
      muted:
        (section.mutedOptions?.has(option.value) ?? false) &&
        !section.selected.includes(option.value),
      belowDivider: section.mutedOptions?.has(option.value),
      group: String(section.index),
      excluded,
      indicator: signed ? stateMark(included ? true : excluded ? false : null) : undefined,
      onSelect: signed ? () => section.onSignedToggle?.(option.value, sign) : undefined,
    };
  });
}

export function MultiSelectCombobox({
  label,
  options,
  selected,
  onChange,
  excluded,
  sign,
  onSignedToggle,
  onSignFlip,
  searchPlaceholder = m.cards_filter_search_generic(),
  emptyText = m.cards_filter_empty_generic(),
  triggerStyle = "chip",
  icon,
  iconAfterLabel,
  counts,
  mutedOptions,
  primaryLabel,
  groups,
  flags,
  flagPosition = "bottom",
  fitContent,
  placeholder,
  triggerClassName,
  anyCount,
  triggerSize = "sm",
}: MultiSelectComboboxProps) {
  const hasGroups = (groups?.length ?? 0) > 0;
  const sections: Section[] = [
    {
      index: 0,
      label: hasGroups ? primaryLabel : undefined,
      options,
      selected,
      onChange,
      excluded,
      sign,
      onSignedToggle,
      onSignFlip,
      counts,
      icon,
      iconAfterLabel,
      mutedOptions,
    },
    ...(groups ?? []).map((group, groupIndex): Section => ({
      index: groupIndex + 1,
      label: group.label,
      options: group.options,
      selected: group.included,
      excluded: group.excluded,
      sign: group.sign,
      onSignedToggle: group.onSignedToggle,
      onSignFlip: group.onSignFlip,
      counts: group.counts,
    })),
  ];

  const [pendingSigns, setPendingSigns] = useState<Readonly<Record<number, FilterSign>>>({});
  const shownSign = (section: Section): FilterSign =>
    section.sign ?? pendingSigns[section.index] ?? "include";
  const chooseSign = (section: Section, next: FilterSign) => {
    if (next === shownSign(section)) {
      return;
    }
    setPendingSigns((current) => ({ ...current, [section.index]: next }));
    if (section.sign !== null && section.sign !== undefined) {
      section.onSignFlip?.();
    }
  };

  const optionTotal = sections.reduce((total, section) => total + section.options.length, 0);
  const searchable = triggerStyle !== "menu" || optionTotal > MENU_SEARCH_THRESHOLD;

  const flagList = flags ?? [];
  const flagRows = flagList.map((entry, index): ComboboxPickerOption => ({
    value: flagId(index),
    label: entry.label,
    count: entry.count,
    group: FLAG_GROUP,
    indicator: stateMark(entry.state),
    onSelect: entry.onToggle,
  }));
  const sectionOptions = sections.flatMap((section) => sectionRows(section, shownSign(section)));
  const pickerOptions =
    flagPosition === "top" ? [...flagRows, ...sectionOptions] : [...sectionOptions, ...flagRows];
  const groupLabels = new Map(
    sections.flatMap((section) =>
      section.label === undefined ? [] : [[String(section.index), section.label] as const],
    ),
  );

  // Signed sections stay out of the picker's value; their rows carry their own mark.
  const signedSections = sections.filter((section) => section.onSignedToggle !== undefined);
  const selectedIds = sections
    .filter((section) => section.onSignedToggle === undefined)
    .flatMap((section) => section.selected.map((value) => encodeId(section.index, value)));

  const includedCount = signedSections.reduce(
    (total, section) => total + section.selected.length,
    0,
  );
  const excludedCount = signedSections.reduce(
    (total, section) => total + (section.excluded?.length ?? 0),
    0,
  );
  const flagCount = flagList.filter((entry) => entry.state !== null).length;
  const firstActiveFlag = flagList.findIndex((entry) => entry.state !== null);
  const totalCount = selectedIds.length + includedCount + excludedCount + flagCount;
  const isActive = totalCount > 0;
  const optionById = new Map(sectionOptions.map((option) => [option.value, option]));
  const labelFor = (id: string) => {
    if (id.startsWith(FLAG_PREFIX)) {
      return flagList[Number(id.slice(FLAG_PREFIX.length))]?.label ?? "";
    }
    const option = optionById.get(id);
    if (!option) {
      return decodeId(id).value;
    }
    return option.keywords ? `${option.keywords} · ${option.label}` : option.label;
  };
  const summarise = (section: Section, values: readonly string[]) =>
    values.length === 1
      ? labelFor(encodeId(section.index, values[0] ?? ""))
      : String(values.length);
  const hasExclude = excludedCount > 0 || flagList.some((entry) => entry.state === false);
  const signedSummary = (): string => {
    const parts: string[] = [];
    for (const section of sections) {
      if (section.onSignedToggle !== undefined) {
        if (section.selected.length > 0) {
          parts.push(`+${summarise(section, section.selected)}`);
        }
        if ((section.excluded?.length ?? 0) > 0) {
          parts.push(`−${summarise(section, section.excluded ?? [])}`);
        }
      } else if (section.selected.length > 0) {
        parts.push(summarise(section, section.selected));
      }
    }
    for (const entry of flagList) {
      if (entry.state === true) {
        parts.push(entry.label);
      } else if (entry.state === false) {
        parts.push(`−${entry.label}`);
      }
    }
    return parts.join(", ");
  };
  const singleId =
    selectedIds[0] ??
    signedSections.flatMap((section) =>
      section.selected.map((value) => encodeId(section.index, value)),
    )[0] ??
    (firstActiveFlag === -1 ? "" : flagId(firstActiveFlag));
  const triggerLabel = isActive
    ? hasExclude || (placeholder !== undefined && (includedCount > 0 || excludedCount > 0))
      ? signedSummary()
      : totalCount === 1
        ? labelFor(singleId)
        : placeholder === undefined
          ? `${label} (${totalCount})`
          : m.cards_filter_n_selected({ count: totalCount })
    : (placeholder ?? label);
  const menuSummary = hasExclude
    ? signedSummary()
    : totalCount === 1
      ? labelFor(singleId)
      : m.cards_filter_n_selected({ count: totalCount });

  const handleChange = (next: string[]) => {
    for (const section of sections) {
      if (section.onSignedToggle !== undefined) {
        continue;
      }
      const subset = next
        .filter((id) => !id.startsWith(FLAG_PREFIX) && decodeId(id).sectionIndex === section.index)
        .map((id) => decodeId(id).value);
      if (!sameMembers(subset, section.selected)) {
        section.onChange?.(subset);
      }
    }
  };

  const signHeader =
    signedSections.length > 0 ? (
      <div className="flex flex-col gap-1.5 border-b p-1.5">
        {signedSections.map((section) => {
          const sectionLabel = section.label ?? label;
          const current = shownSign(section);
          return (
            <div key={section.index} className="flex items-center gap-2">
              {signedSections.length > 1 && (
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                  {sectionLabel}
                </span>
              )}
              <ToggleGroup
                aria-label={m.cards_filter_sign_label({ label: sectionLabel })}
                value={[current]}
                onValueChange={(next) => {
                  const picked = next[0] as FilterSign | undefined;
                  if (picked !== undefined) {
                    chooseSign(section, picked);
                  }
                }}
                size="sm"
                spacing={0}
                className={cn("grid grid-cols-2", signedSections.length > 1 ? "w-44" : "w-full")}
              >
                <ToggleGroupItem value="include">
                  <CheckIcon />
                  {m.cards_filter_sign_include()}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="exclude"
                  className="aria-pressed:bg-destructive/20 aria-pressed:text-destructive"
                >
                  <MinusIcon />
                  {m.cards_filter_sign_exclude()}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          );
        })}
      </div>
    ) : undefined;

  return (
    <ComboboxPicker
      multiple
      options={pickerOptions}
      value={selectedIds}
      onChange={handleChange}
      header={signHeader}
      groupLabels={groupLabels}
      wrapLabels
      containKeys
      searchable={searchable ? true : "hidden"}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      contentClassName="w-max max-w-[90vw] min-w-72"
      listClassName={cn(fitContent && "max-h-[calc(var(--available-height)---spacing(9))]")}
      trigger={triggerStyle}
      active={isActive}
      size={triggerSize}
      aria-label={
        triggerStyle === "menu" ? (isActive ? `${label}: ${menuSummary}` : label) : undefined
      }
      className={
        triggerStyle === "button"
          ? cn("w-auto font-medium [&>svg]:text-current", triggerClassName)
          : undefined
      }
      triggerLabel={
        triggerStyle === "menu" ? (
          <>
            <span className="shrink-0 text-left">
              {label}
              {!isActive && anyCount !== undefined && (
                <span className="text-muted-foreground text-2xs ml-1.5 tabular-nums">
                  {anyCount}
                </span>
              )}
            </span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-right">
              {isActive && menuSummary}
            </span>
          </>
        ) : triggerStyle === "button" ? (
          <span className="min-w-0 truncate">{triggerLabel}</span>
        ) : (
          triggerLabel
        )
      }
    />
  );
}

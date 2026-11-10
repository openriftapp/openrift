import { ArrowLeftRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { CardIcon } from "@/components/card-icon";
import { Badge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import { LabelledRow } from "@/features/cards/components/labelled-row";
import { collapseFilterOptions } from "@/features/cards/lib/collapse-filter-options";
import type { SignedFilterBinding } from "@/lib/filter-sign";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function FilterSection({
  label,
  options,
  selected,
  excluded,
  onToggle,
  signed,
  iconPath,
  displayLabel,
  secondaryOptions,
  counts,
  wide,
  children,
  trailing,
  collapsible,
}: {
  label: string;
  children?: ReactNode;
  options?: string[];
  selected?: string[];
  excluded?: string[];
  onToggle?: (value: string) => void;
  signed?: SignedFilterBinding;
  iconPath?: (value: string) => string | undefined;
  displayLabel?: (value: string) => string;
  secondaryOptions?: ReadonlySet<string>;
  counts?: Map<string, number>;
  /** Span the full row in any multi-column parent grid. */
  wide?: boolean;
  /** Extra control(s) appended after the badges (e.g. the Signed flag in Art Variant). */
  trailing?: ReactNode;
  collapsible?: ReadonlySet<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!children && !trailing && (!options || options.length === 0)) {
    return null;
  }
  const allOptions = options ?? [];
  const { visible, hiddenCount } = collapseFilterOptions(allOptions, collapsible ?? new Set(), [
    ...(selected ?? []),
    ...(excluded ?? []),
  ]);
  const collapsed = hiddenCount > 0 && !expanded;
  const foldToggle =
    hiddenCount > 0 ? (
      <Badge
        variant="outline"
        className="text-muted-foreground border-dashed"
        render={<Pressable aria-expanded={expanded} onClick={() => setExpanded(!expanded)} />}
      >
        {collapsed ? m.cards_filter_show_more({ count: hiddenCount }) : m.common_show_less()}
      </Badge>
    ) : null;
  const flipToggle =
    signed && signed.sign !== null ? (
      <Badge
        variant="outline"
        className="text-muted-foreground border-dashed"
        render={<Pressable onClick={() => signed.onSignFlip()} />}
      >
        <ArrowLeftRightIcon />
        {signed.sign === "include"
          ? m.cards_filter_flip_to_exclude()
          : m.cards_filter_flip_to_include()}
      </Badge>
    ) : null;

  return (
    <LabelledRow label={label} className={cn(wide && "lg:col-span-2")}>
      {children ? (
        <div className="flex flex-1 flex-wrap gap-1">{children}</div>
      ) : (
        <FilterBadgeGrid
          options={collapsed ? visible : allOptions}
          selected={selected}
          excluded={excluded}
          onToggle={onToggle}
          signed={signed}
          iconPath={iconPath}
          displayLabel={displayLabel}
          secondaryOptions={secondaryOptions}
          counts={counts}
          trailing={
            <>
              {trailing}
              {flipToggle}
              {foldToggle}
            </>
          }
        />
      )}
    </LabelledRow>
  );
}

/** Shared by the expanded `FilterSection` and the compact bar's dropdown-chip popovers so both render identical badges. */
function FilterBadgeGrid({
  options,
  selected,
  excluded,
  onToggle,
  signed,
  iconPath,
  displayLabel,
  secondaryOptions,
  counts,
  className,
  trailing,
}: {
  options: string[];
  selected?: string[];
  /** Values in this dimension's exclude (`*Ex`) array; rendered struck-out. */
  excluded?: string[];
  onToggle?: (value: string) => void;
  signed?: SignedFilterBinding;
  iconPath?: (value: string) => string | undefined;
  displayLabel?: (value: string) => string;
  secondaryOptions?: ReadonlySet<string>;
  counts?: Map<string, number>;
  className?: string;
  /** Extra control(s) rendered inline after the badges (e.g. the Signed flag in Art Variant). */
  trailing?: ReactNode;
}) {
  // A selected/excluded value can drop out of `options` when the available set
  // narrows; append it after the real options so it stays toggleable.
  const orphaned = [...(selected ?? []), ...(excluded ?? [])].filter(
    (value, index, all) => !options.includes(value) && all.indexOf(value) === index,
  );
  const renderedOptions = orphaned.length > 0 ? [...options, ...orphaned] : options;

  return (
    <div className={cn("flex flex-1 flex-wrap gap-1", className)}>
      {renderedOptions.map((option) => {
        const icon = iconPath?.(option);
        const isSelected = selected?.includes(option);
        const isExcluded = excluded?.includes(option);
        const isSecondary = secondaryOptions?.has(option);
        const count = counts?.get(option);
        const isZero = counts !== undefined && (count ?? 0) === 0;
        return (
          <Badge
            key={option}
            variant={!icon && isSelected ? "default" : "outline"}
            className={cn(
              "cursor-pointer",
              icon && "pr-0",
              !icon && isExcluded && "border-destructive/40 text-destructive line-through",
              isSecondary && !isSelected && !isExcluded && "opacity-65",
              isZero && !isSelected && !isExcluded && "opacity-40",
            )}
            onClick={() =>
              signed ? signed.onSignedToggle(option, signed.sign ?? "include") : onToggle?.(option)
            }
          >
            {icon && <CardIcon src={icon} />}
            <span
              className={cn(
                icon && "-my-0.5 inline-flex h-5 items-center rounded-full px-2",
                icon && isSelected && "bg-primary text-primary-foreground",
                icon && isExcluded && "bg-destructive text-white line-through",
              )}
            >
              {displayLabel ? displayLabel(option) : option}
              {count !== undefined && <span className="ml-1 tabular-nums opacity-60">{count}</span>}
            </span>
          </Badge>
        );
      })}
      {trailing}
    </div>
  );
}

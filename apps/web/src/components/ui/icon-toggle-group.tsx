import type { LucideIcon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface IconToggleOption<Value extends string> {
  value: Value;
  icon: LucideIcon;
  label: string;
  title?: string;
  ariaLabel?: string;
}

/** A single-choice toggle row: icons only, or icons with their labels when `compact`. */
export function IconToggleGroup<Value extends string>({
  "aria-label": ariaLabel,
  options,
  value,
  onValueChange,
  compact,
  className,
}: {
  "aria-label": string;
  options: readonly IconToggleOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      className={className}
      variant="control"
      size={compact ? "sm" : "default"}
      spacing={0}
      value={[value]}
      onValueChange={([next]) => {
        const option = options.find((candidate) => candidate.value === next);
        if (option) {
          onValueChange(option.value);
        }
      }}
    >
      {options.map(({ value: optionValue, icon: Icon, label, title, ariaLabel: itemLabel }) => (
        <ToggleGroupItem
          key={optionValue}
          value={optionValue}
          className={compact ? "gap-1.5 text-xs" : undefined}
          title={title}
          aria-label={itemLabel}
        >
          <Icon className={compact ? undefined : "size-4"} />
          {compact && label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

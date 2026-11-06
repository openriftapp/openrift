import type { ReactNode } from "react";
import { Fragment } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Sentinel for a "no selection" option. BaseUI treats `""` as an unset value
 * and shows the placeholder, so an explicit "none" row needs a real string.
 */
export const SELECT_NONE = "__none__";

export interface SimpleSelectItem<T extends string = string> {
  value: T;
  label: string;
  content?: ReactNode;
  detail?: ReactNode;
  disabled?: boolean;
  lang?: string;
  className?: string;
  group?: string;
}

export interface SimpleSelectGroup {
  key: string;
  label?: string;
}

interface SimpleSelectProps<T extends string> {
  items: readonly SimpleSelectItem<T>[];
  groups?: readonly SimpleSelectGroup[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  renderValue?: (item: SimpleSelectItem<T>) => ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  "aria-labelledby"?: string;
}

export function SimpleSelect<T extends string>({
  items,
  groups,
  value,
  onChange,
  label,
  placeholder,
  size = "default",
  disabled,
  className,
  contentClassName,
  renderValue,
  open,
  defaultOpen,
  onOpenChange,
  id,
  "aria-labelledby": ariaLabelledBy,
}: SimpleSelectProps<T>) {
  const byValue = new Map(items.map((item) => [item.value, item]));
  const triggerValue =
    renderValue ?? (items.some((item) => item.content !== undefined) ? itemContent : undefined);
  // BaseUI types a single select's value as nullable; every item carries a
  // string, so null only arrives when the selection is cleared.
  function pick(next: T | null) {
    if (next !== null) {
      onChange(next);
    }
  }

  const renderItem = (item: SimpleSelectItem<T>) => (
    <SelectItem
      key={item.value}
      value={item.value}
      disabled={item.disabled}
      lang={item.lang}
      className={item.className}
    >
      {itemContent(item)}
      {item.detail !== undefined && (
        <span className="text-muted-foreground text-2xs tabular-nums">{item.detail}</span>
      )}
    </SelectItem>
  );

  const sections = groups
    ? [
        { key: undefined, label: undefined },
        ...groups.map((group) => ({ key: group.key, label: group.label })),
      ]
        .map((section) => ({
          ...section,
          rows: items.filter((item) => item.group === section.key),
        }))
        .filter((section) => section.rows.length > 0)
    : undefined;

  return (
    <Select<T>
      items={items.map((item) => ({ value: item.value, label: item.label }))}
      value={value}
      onValueChange={pick}
      disabled={disabled}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? (next: boolean) => onOpenChange(next) : undefined}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        aria-label={ariaLabelledBy ? undefined : label}
        aria-labelledby={ariaLabelledBy}
      >
        {triggerValue ? (
          <SelectValue placeholder={placeholder}>
            {(current: T | null) => {
              const item = current === null ? undefined : byValue.get(current);
              return item ? triggerValue(item) : placeholder;
            }}
          </SelectValue>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {sections
          ? sections.map((section, index) => (
              <Fragment key={section.key ?? "__ungrouped__"}>
                {index > 0 && <SelectSeparator />}
                <SelectGroup>
                  {section.label !== undefined && <SelectLabel>{section.label}</SelectLabel>}
                  {section.rows.map((item) => renderItem(item))}
                </SelectGroup>
              </Fragment>
            ))
          : items.map((item) => renderItem(item))}
      </SelectContent>
    </Select>
  );
}

function itemContent<T extends string>(item: SimpleSelectItem<T>): ReactNode {
  return item.content ?? item.label;
}

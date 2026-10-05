import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { moveInOrder, toggleInOrder } from "@/features/account/lib/ordered-toggle";

export interface OrderedToggleOption<T extends string> {
  value: T;
  label: string;
  meta?: ReactNode;
}

/** Enabled values come first, in their order. */
export function OrderedToggleList<T extends string>({
  idPrefix,
  order,
  options,
  onChange,
  firstBadge,
  moveUpLabel,
  moveDownLabel,
  keepOne = false,
}: {
  idPrefix: string;
  order: readonly T[];
  options: readonly OrderedToggleOption<T>[];
  onChange: (next: T[]) => void;
  firstBadge: ReactNode;
  moveUpLabel: (label: string) => string;
  moveDownLabel: (label: string) => string;
  keepOne?: boolean;
}) {
  const enabledSet = new Set<T>(order);
  const optionsByValue = new Map(options.map((option) => [option.value, option]));
  const rows = [
    ...order.flatMap((value) => optionsByValue.get(value) ?? []),
    ...options.filter((option) => !enabledSet.has(option.value)),
  ];

  return (
    <div className="flex flex-col gap-1">
      {rows.map(({ value, label, meta }) => {
        const enabled = enabledSet.has(value);
        const index = order.indexOf(value);
        const id = `${idPrefix}-${value}`;
        return (
          <div key={value} className="flex min-h-8 items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id={id}
                checked={enabled}
                disabled={keepOne && enabled && order.length === 1}
                onCheckedChange={() => onChange(toggleInOrder(order, value))}
              />
              <Label htmlFor={id} className="font-normal">
                {label}
              </Label>
              {meta === undefined ? null : (
                <span className="text-muted-foreground text-xs">{meta}</span>
              )}
              {enabled && index === 0 && <Badge variant="subtle">{firstBadge}</Badge>}
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!enabled || index === 0}
                onClick={() => onChange(moveInOrder(order, value, -1))}
                aria-label={moveUpLabel(label)}
              >
                <ArrowUpIcon className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!enabled || index === order.length - 1}
                onClick={() => onChange(moveInOrder(order, value, 1))}
                aria-label={moveDownLabel(label)}
              >
                <ArrowDownIcon className="size-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

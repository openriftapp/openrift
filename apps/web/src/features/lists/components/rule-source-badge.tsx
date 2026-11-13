import type { EntrySource } from "@openrift/shared/types/api/list";
import { BanIcon, PinIcon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function isRuleSourced(source: EntrySource): boolean {
  return source === "rule" || source === "both";
}

export function RuleSourceBadge({
  quantity,
  className,
  onExclude,
  excludeLabel = m.lists_rule_badge_exclude_default(),
  keep,
}: {
  quantity?: number;
  className?: string;
  onExclude?: () => void;
  excludeLabel?: string;
  keep?: { handleKeep: () => void; label: string };
}) {
  return (
    <Badge
      variant="subtle"
      // Must match countPillVariants in ui/count-pill.tsx.
      className={cn(
        "rounded-md border-0 bg-transparent",
        (onExclude ?? keep) && "pr-0.5",
        className,
      )}
      title={
        quantity === undefined
          ? m.lists_rule_badge_title()
          : m.lists_rule_badge_title_quantity({ count: quantity })
      }
    >
      <SparklesIcon aria-hidden />
      {quantity === undefined ? (
        m.lists_rule_badge_label()
      ) : (
        <span className="tabular-nums">{quantity}</span>
      )}
      {onExclude ? (
        <ChipRemoveButton
          tabIndex={-1}
          aria-label={excludeLabel}
          title={excludeLabel}
          className="hover:bg-destructive/15 hover:text-destructive -my-0.5 p-0.5"
          onClick={(event) => {
            event.stopPropagation();
            onExclude();
          }}
        >
          <BanIcon className="size-3" aria-hidden />
        </ChipRemoveButton>
      ) : null}
      {keep ? (
        <ChipRemoveButton
          tabIndex={-1}
          aria-label={keep.label}
          title={keep.label}
          className="hover:bg-primary/15 hover:text-primary -my-0.5 p-0.5"
          onClick={(event) => {
            event.stopPropagation();
            keep.handleKeep();
          }}
        >
          <PinIcon className="size-3" aria-hidden />
        </ChipRemoveButton>
      ) : null}
    </Badge>
  );
}

import { totalQuantity } from "@openrift/shared/deck-rules";

import { CardIcon } from "@/components/card-icon";
import type { DeckCardGroup, DeckOverviewGroup } from "@/features/decks/lib/deck-card-group";
import { getTypeIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Shared by the overview's list rows and thumbnail wraps so both read
 * identically. The "none" group has no label and renders nothing.
 */
export function DeckCardGroupHeader({
  group,
  groupBy,
  count,
  className,
}: {
  group: DeckCardGroup;
  groupBy: DeckOverviewGroup;
  count?: number;
  className?: string;
}) {
  if (group.label === null) {
    return null;
  }
  const shownCount = count ?? totalQuantity(group.cards);
  const iconPath = groupBy === "type" ? getTypeIconPath(group.key, []) : undefined;
  return (
    <div className={cn("text-muted-foreground flex items-center gap-1.5 text-xs", className)}>
      {iconPath && <CardIcon src={iconPath} className="size-3.5" />}
      <span className="whitespace-nowrap">
        {group.label} <span className="text-muted-foreground/60">· {shownCount}</span>
      </span>
    </div>
  );
}

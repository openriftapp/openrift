import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import type { CardSection } from "@/features/admin/lib/card-sections";
import { CARD_SECTION_LABELS, DEFAULT_CARD_SECTION } from "@/features/admin/lib/card-sections";
import { cn } from "@/lib/utils";

export interface CardSectionCount {
  waiting?: number;
  total?: number;
}

export function CardSectionNav({
  cardSlug,
  sections,
  section,
  counts,
  search,
}: {
  cardSlug: string;
  sections: readonly CardSection[];
  section: CardSection;
  counts: Partial<Record<CardSection, CardSectionCount>>;
  search: Record<string, unknown>;
}) {
  return (
    <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
      {sections.map((value) => {
        const count = counts[value];
        return (
          <Link
            key={value}
            to="/admin/cards/$cardSlug"
            params={{ cardSlug }}
            search={{ ...search, section: value === DEFAULT_CARD_SECTION ? undefined : value }}
            className={cn(
              "hover:bg-muted/50 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm",
              value === section && "bg-muted",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{CARD_SECTION_LABELS[value]}</span>
            {count?.total !== undefined && count.total > 0 && (
              <span className="text-muted-foreground text-xs tabular-nums">{count.total}</span>
            )}
            {count?.waiting !== undefined && count.waiting > 0 && (
              <Badge variant="count">{count.waiting}</Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

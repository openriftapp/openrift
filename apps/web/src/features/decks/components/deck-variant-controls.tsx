import { ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CountPillButton } from "@/components/ui/count-pill";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DeckFamilyEntry } from "@/features/decks/lib/deck-family";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// z-10 keeps this above the row's stretched-link overlay so its clicks register.
export function VariantCountToggle({
  family,
  onToggle,
  className,
}: {
  family: DeckFamilyEntry;
  onToggle: (familyId: string) => void;
  className?: string;
}) {
  return (
    <CountPillButton
      className={cn("relative z-10 shrink-0", className)}
      aria-expanded={family.expanded}
      aria-label={family.expanded ? m.decks_dialog_variants_hide() : m.decks_dialog_variants_show()}
      onClick={() => {
        onToggle(family.id);
      }}
    >
      <ChevronRightIcon
        className={cn("size-3 transition-transform", family.expanded && "rotate-90")}
      />
      {m.decks_dialog_variant_count({ count: family.memberCount })}
    </CountPillButton>
  );
}

// Renders as a span, like `LocalDeckBadge`, so it adds no tab stop to a row
// that already has one for the deck itself.
export function DraftBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="muted" className={cn("shrink-0", className)} />}>
        {m.decks_dialog_draft_badge()}
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-center">
        {m.decks_dialog_draft_badge_tooltip()}
      </TooltipContent>
    </Tooltip>
  );
}

import type { DeckCheckEntrySummaryResponse } from "@openrift/shared/types/api/deck-check";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages.js";

interface StateBadge {
  label: string;
  variant: ComponentProps<typeof Badge>["variant"];
}

export function deckCheckStateBadges(
  state: DeckCheckEntrySummaryResponse["state"],
  reviewOutcome: DeckCheckEntrySummaryResponse["reviewOutcome"],
  audience: "staff" | "player",
): StateBadge[] {
  const issue = reviewOutcome === "issue";
  switch (state) {
    case "editable": {
      const editing: StateBadge = {
        label:
          audience === "staff"
            ? m.tournaments_deck_check_state_editing()
            : m.tournaments_my_deck_state_not_submitted(),
        variant: "outline",
      };
      return issue
        ? [{ label: m.tournaments_my_deck_changes_requested(), variant: "destructive" }, editing]
        : [editing];
    }
    case "approved": {
      return [{ label: m.tournaments_deck_check_state_approved(), variant: "default" }];
    }
    case "checked": {
      return issue
        ? [{ label: m.tournaments_deck_check_state_checked_issue(), variant: "destructive" }]
        : [{ label: m.tournaments_deck_check_state_checked(), variant: "default" }];
    }
    case "withdrawn": {
      return [{ label: m.tournaments_deck_check_state_withdrawn(), variant: "secondary" }];
    }
    case "submitted": {
      return issue
        ? [{ label: m.tournaments_deck_check_state_submitted_issue(), variant: "destructive" }]
        : [{ label: m.tournaments_deck_check_state_submitted(), variant: "secondary" }];
    }
  }
}

export function DeckCheckStateBadge({
  state,
  reviewOutcome,
  audience,
}: {
  state: DeckCheckEntrySummaryResponse["state"];
  reviewOutcome: DeckCheckEntrySummaryResponse["reviewOutcome"];
  audience: "staff" | "player";
}) {
  return (
    <>
      {deckCheckStateBadges(state, reviewOutcome, audience).map((badge) => (
        <Badge key={badge.label} variant={badge.variant}>
          {badge.label}
        </Badge>
      ))}
    </>
  );
}

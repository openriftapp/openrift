import type { DeckCheckEntrySummaryResponse } from "@openrift/shared/types/api/deck-check";

import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages.js";

export function DeckCheckStateBadge({
  state,
  reviewOutcome,
  audience,
}: {
  state: DeckCheckEntrySummaryResponse["state"];
  reviewOutcome: DeckCheckEntrySummaryResponse["reviewOutcome"];
  audience: "staff" | "player";
}) {
  if (state === "editable") {
    return (
      <Badge variant="outline">
        {audience === "staff"
          ? m.tournaments_deck_check_state_editing()
          : m.tournaments_my_deck_state_not_submitted()}
      </Badge>
    );
  }
  if (state === "approved") {
    return <Badge>{m.tournaments_deck_check_state_approved()}</Badge>;
  }
  if (state === "checked") {
    return reviewOutcome === "issue" ? (
      <Badge variant="destructive">{m.tournaments_deck_check_state_checked_issue()}</Badge>
    ) : (
      <Badge>{m.tournaments_deck_check_state_checked()}</Badge>
    );
  }
  if (state === "withdrawn") {
    return <Badge variant="secondary">{m.tournaments_deck_check_state_withdrawn()}</Badge>;
  }
  return reviewOutcome === "issue" ? (
    <Badge variant="destructive">{m.tournaments_deck_check_state_submitted_issue()}</Badge>
  ) : (
    <Badge variant="secondary">{m.tournaments_deck_check_state_submitted()}</Badge>
  );
}

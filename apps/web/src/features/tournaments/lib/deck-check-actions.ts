import type {
  DeckCheckEntryDetailResponse,
  DeckCheckEntryState,
  DeckCheckReviewOutcome,
} from "@openrift/shared/types/api/deck-check";
import { CheckIcon, RotateCcwIcon, ThumbsUpIcon } from "lucide-react";

import { m } from "@/paraglide/messages.js";

interface JudgeActionEntry {
  state: DeckCheckEntryState;
  reviewOutcome: DeckCheckReviewOutcome | null;
  claimedUserId: string | null;
}

/**
 * Requesting changes flips a submitted entry back to `editable` and flags an
 * issue; hidden when the entry is already flagged, since re-flagging is a no-op.
 */
export function canRequestChanges(entry: JudgeActionEntry): boolean {
  return (
    entry.state === "submitted" && entry.claimedUserId !== null && entry.reviewOutcome !== "issue"
  );
}

export function primaryActionFor(state: DeckCheckEntryDetailResponse["entry"]["state"]): {
  label: string;
  icon: typeof CheckIcon;
  state: "editable" | "submitted" | "approved" | "checked" | "withdrawn";
  reviewOutcome?: "ok" | "issue";
} | null {
  switch (state) {
    case "editable": {
      return { label: m.tournaments_lib_deck_action_lock(), icon: CheckIcon, state: "submitted" };
    }
    case "submitted": {
      return {
        label: m.tournaments_lib_deck_action_approve(),
        icon: ThumbsUpIcon,
        state: "approved",
      };
    }
    case "approved": {
      return {
        label: m.tournaments_lib_deck_action_mark_checked(),
        icon: CheckIcon,
        state: "checked",
        reviewOutcome: "ok",
      };
    }
    case "checked": {
      return {
        label: m.tournaments_lib_deck_action_reopen(),
        icon: RotateCcwIcon,
        state: "submitted",
      };
    }
    case "withdrawn": {
      return {
        label: m.tournaments_lib_deck_action_restore(),
        icon: RotateCcwIcon,
        state: "submitted",
      };
    }
    default: {
      return null;
    }
  }
}

/**
 * Adding, removing, and re-identifying cards stay locked to the submitted
 * state; a mis-zoned import is a filing error, so zone corrections stay
 * allowed once the list is approved or checked.
 */
export function zoneFixAllowed(state: DeckCheckEntryDetailResponse["entry"]["state"]): boolean {
  return state === "submitted" || state === "approved" || state === "checked";
}

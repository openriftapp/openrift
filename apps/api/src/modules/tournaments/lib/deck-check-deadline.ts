import { diffCardLines } from "@openrift/shared/deck-check";
import type { DeckCheckCardLine } from "@openrift/shared/deck-check";
import type { DeckCheckChangeSummary } from "@openrift/shared/types/api/deck-check";

import type { Repos } from "../../../deps.js";
import type { DeckCheckEntry } from "../repositories/deck-check-entries.js";
import type { DeckCheckEntryCard } from "../repositories/deck-check-entry-cards.js";

export interface SubmissionWindow {
  status: string;
  submissionsCloseAt: Date | null;
}

/** The deck-check window of a tournament row, which carries the raw tournament status. */
export function tournamentSubmissionWindow(tournament: {
  status: string;
  submissionsCloseAt: Date | null;
}): SubmissionWindow {
  const ended = tournament.status === "completed" || tournament.status === "cancelled";
  return {
    status: ended ? "archived" : "active",
    submissionsCloseAt: tournament.submissionsCloseAt,
  };
}

/**
 * Judges are never bound by this; `allow_self_submission` gates only the
 * creation of new entries, and is checked separately.
 */
export function submissionWindowOpen(event: SubmissionWindow): boolean {
  return (
    event.status === "active" &&
    (event.submissionsCloseAt === null || event.submissionsCloseAt.getTime() > Date.now())
  );
}

export function storedCardLines(cards: DeckCheckEntryCard[]): DeckCheckCardLine[] {
  return cards.map((card) => ({
    name: card.rawName,
    zone: card.zone as DeckCheckCardLine["zone"],
    quantity: card.quantity,
  }));
}

/** Null when there is no baseline or the list matches it. */
export function changeSummaryFor(
  preEditLines: DeckCheckCardLine[] | null,
  cards: DeckCheckEntryCard[],
): DeckCheckChangeSummary | null {
  if (!preEditLines) {
    return null;
  }
  const diff = diffCardLines(preEditLines, storedCardLines(cards));
  const empty = diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0;
  return empty ? null : diff;
}

/** An entry still editable once the window closed is submitted as of the close. */
export function isExpiredEditable(event: SubmissionWindow, entry: { state: string }): boolean {
  return entry.state === "editable" && !submissionWindowOpen(event);
}

/** Without a close time the event closed by ending; the entry's last change stands in. */
export function deadlineSubmittedAt(event: SubmissionWindow, entry: { updatedAt: Date }): Date {
  return event.submissionsCloseAt ?? entry.updatedAt;
}

export function presentedEntryState<T extends string>(
  event: SubmissionWindow,
  entry: { state: T },
): T | "submitted" {
  return isExpiredEditable(event, entry) ? "submitted" : entry.state;
}

/**
 * The deadline auto-submit as readers see it before a write path persists it
 * (`settleExpiredEditableEntries`). Never writes.
 */
export async function presentDeadlineSettled<T extends DeckCheckEntry>(
  repos: Repos,
  event: SubmissionWindow,
  entries: T[],
): Promise<T[]> {
  const expired = entries.filter((entry) => isExpiredEditable(event, entry));
  if (expired.length === 0) {
    return entries;
  }
  const cardsByEntry = await repos.deckCheck.listCardsForEntries(
    expired.filter((entry) => entry.preEditLines).map((entry) => entry.id),
  );
  return entries.map((entry) =>
    isExpiredEditable(event, entry)
      ? {
          ...entry,
          state: "submitted" as const,
          submittedAt: deadlineSubmittedAt(event, entry),
          changeSummary: changeSummaryFor(entry.preEditLines, cardsByEntry.get(entry.id) ?? []),
        }
      : entry,
  );
}

export async function presentDeadlineSettledEntry<T extends DeckCheckEntry>(
  repos: Repos,
  event: SubmissionWindow,
  entry: T,
): Promise<T> {
  const [presented] = await presentDeadlineSettled(repos, event, [entry]);
  return presented ?? entry;
}

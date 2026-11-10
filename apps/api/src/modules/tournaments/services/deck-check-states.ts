import { ERROR_CODES } from "@openrift/shared/error-codes";

import type { Repos } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { SubmissionWindow } from "../lib/deck-check-deadline.js";
import {
  changeSummaryFor,
  deadlineSubmittedAt,
  isExpiredEditable,
  storedCardLines,
  submissionWindowOpen,
} from "../lib/deck-check-deadline.js";
import type { DeckCheckEntry } from "../repositories/deck-check-entries.js";

/**
 * The pre-edit baseline (`preEditLines`) is not cleared here; it persists
 * across unlock/submit cycles until a judge approves or checks the entry.
 */
export async function submitEntryList(
  repos: Repos,
  entry: DeckCheckEntry,
  submittedAt?: Date,
): Promise<DeckCheckEntry> {
  const changeSummary = entry.preEditLines
    ? changeSummaryFor(entry.preEditLines, await repos.deckCheck.listCardsForEntry(entry.id))
    : null;
  const updated = await repos.deckCheck.updateEntry(entry.id, {
    state: "submitted",
    submittedAt: submittedAt ?? new Date(),
    changeSummary,
  });
  return updated ?? entry;
}

/**
 * Keeps the existing `preEditLines` baseline on a self-unlock that already
 * has one; snapshots the current lines as the new baseline otherwise.
 */
export async function unlockEntryToEditable(
  repos: Repos,
  entry: DeckCheckEntry,
  options?: { keepExistingBaseline?: boolean; markIssue?: boolean },
): Promise<DeckCheckEntry> {
  let preEditLines = entry.preEditLines;
  if (!options?.keepExistingBaseline || !preEditLines) {
    const cards = await repos.deckCheck.listCardsForEntry(entry.id);
    preEditLines = storedCardLines(cards);
  }
  const updated = await repos.deckCheck.updateEntry(entry.id, {
    state: "editable",
    preEditLines,
    changeSummary: null,
    unlockRequestedAt: null,
    approvedBy: null,
    approvedAt: null,
    checkedBy: null,
    checkedAt: null,
    ...(options?.markIssue ? { reviewOutcome: "issue" as const } : {}),
  });
  return updated ?? entry;
}

/** For an entry the caller holds `FOR UPDATE`; a no-op while the window is open. */
export function settleExpiredEditable(
  repos: Repos,
  event: SubmissionWindow,
  entry: DeckCheckEntry,
): Promise<DeckCheckEntry> | DeckCheckEntry {
  if (!isExpiredEditable(event, entry)) {
    return entry;
  }
  return submitEntryList(repos, entry, deadlineSubmittedAt(event, entry));
}

/**
 * Persists the deadline auto-submit for every expired editable entry of the
 * event in one update. Write paths call this before they validate an entry's
 * state; reads use `presentDeadlineSettled` and never write.
 * @returns The ids this call settled.
 */
export async function settleExpiredEditableEntries(
  repos: Repos,
  event: SubmissionWindow & { id: string },
): Promise<string[]> {
  if (submissionWindowOpen(event)) {
    return [];
  }
  const editable = await repos.deckCheck.listEditableBaselines(event.id);
  if (editable.length === 0) {
    return [];
  }
  const cardsByEntry = await repos.deckCheck.listCardsForEntries(
    editable.filter((entry) => entry.preEditLines).map((entry) => entry.id),
  );
  return repos.deckCheck.settleEditableEntries(
    event.id,
    editable.map((entry) => ({
      id: entry.id,
      submittedAt: deadlineSubmittedAt(event, entry),
      changeSummary: changeSummaryFor(entry.preEditLines, cardsByEntry.get(entry.id) ?? []),
    })),
  );
}

export interface JudgeTransitionInput {
  state: "editable" | "submitted" | "approved" | "checked" | "withdrawn";
  reviewOutcome?: "ok" | "issue" | null;
  notes?: string | null;
  playerMessage?: string | null;
}

export async function applyJudgeTransition(
  repos: Repos,
  judgeId: string,
  entry: DeckCheckEntry,
  input: JudgeTransitionInput,
): Promise<DeckCheckEntry> {
  if (entry.state === "withdrawn" && input.state !== "submitted") {
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      "Entry is withdrawn. Restore it to submitted before other changes.",
    );
  }

  const annotations = {
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.playerMessage === undefined ? {} : { playerMessage: input.playerMessage }),
  };
  const conflict = (message: string): AppError => new AppError(409, ERROR_CODES.CONFLICT, message);

  switch (input.state) {
    case "approved": {
      if (entry.state !== "submitted") {
        throw conflict("Only a submitted entry can be approved");
      }
      const updated = await repos.deckCheck.updateEntry(entry.id, {
        ...annotations,
        state: "approved",
        reviewOutcome: "ok",
        approvedBy: judgeId,
        approvedAt: new Date(),
        changeSummary: null,
        preEditLines: null,
        unlockRequestedAt: null,
      });
      return updated ?? entry;
    }

    case "checked": {
      if (entry.state !== "approved") {
        throw conflict("Only an approved entry can be checked. Approve the list first.");
      }
      if (input.reviewOutcome !== "ok" && input.reviewOutcome !== "issue") {
        throw new AppError(
          422,
          ERROR_CODES.VALIDATION_ERROR,
          "Checking requires a review outcome (ok or issue)",
        );
      }
      const updated = await repos.deckCheck.updateEntry(entry.id, {
        ...annotations,
        state: "checked",
        reviewOutcome: input.reviewOutcome,
        checkedBy: judgeId,
        checkedAt: new Date(),
        changeSummary: null,
        preEditLines: null,
        unlockRequestedAt: null,
      });
      // A clean check fills all found ticks; a flagged check leaves them as the judge left them.
      if (input.reviewOutcome === "ok") {
        await repos.deckCheck.markAllCopiesFound(entry.id);
      }
      return updated ?? entry;
    }

    case "editable": {
      if (!entry.claimedUserId) {
        throw conflict("No linked player can edit this entry. Link an account first.");
      }
      const unlocked = await unlockEntryToEditable(repos, entry, {
        markIssue: input.reviewOutcome === "issue",
      });
      if (Object.keys(annotations).length === 0) {
        return unlocked;
      }
      const annotated = await repos.deckCheck.updateEntry(entry.id, annotations);
      return annotated ?? unlocked;
    }

    case "withdrawn": {
      // Sets the same fields the provider's ingest sets on a withdrawal.
      const updated = await repos.deckCheck.updateEntry(entry.id, {
        ...annotations,
        state: "withdrawn",
        withdrawnAt: new Date(),
        unlockRequestedAt: null,
      });
      return updated ?? entry;
    }

    case "submitted": {
      if (entry.state === "withdrawn") {
        // Pre-withdrawal state is not restored; the entry needs re-review.
        const updated = await repos.deckCheck.updateEntry(entry.id, {
          ...annotations,
          state: "submitted",
          withdrawnAt: null,
        });
        return updated ?? entry;
      }
      if (entry.state === "editable") {
        const submitted = await submitEntryList(repos, entry);
        if (Object.keys(annotations).length === 0) {
          return submitted;
        }
        const annotated = await repos.deckCheck.updateEntry(entry.id, annotations);
        return annotated ?? submitted;
      }
      if (entry.state === "approved") {
        const updated = await repos.deckCheck.updateEntry(entry.id, {
          ...annotations,
          state: "submitted",
          reviewOutcome: null,
          approvedBy: null,
          approvedAt: null,
          unlockRequestedAt: null,
        });
        return updated ?? entry;
      }
      if (entry.state === "checked") {
        const updated = await repos.deckCheck.updateEntry(entry.id, {
          ...annotations,
          state: "submitted",
          reviewOutcome: null,
          checkedBy: null,
          checkedAt: null,
        });
        await repos.deckCheck.clearAllCopiesFound(entry.id);
        return updated ?? entry;
      }
      if (input.reviewOutcome === undefined || input.reviewOutcome === null) {
        throw conflict("Entry is already submitted");
      }
      const updated = await repos.deckCheck.updateEntry(entry.id, {
        ...annotations,
        reviewOutcome: input.reviewOutcome,
      });
      return updated ?? entry;
    }
  }
}

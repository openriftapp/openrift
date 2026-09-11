import type { AdminAuditEventResponse } from "@openrift/shared/contracts/admin/audit-events";
import { normalizeNameForIdentity } from "@openrift/shared/utils";

import {
  CARD_FIELD_LABELS,
  PRINTING_FIELD_LABELS,
} from "@/features/admin/lib/catalog-field-labels";

export const HISTORY_FILTERS = ["all", "submissions", "edits", "sources"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export const HISTORY_FILTER_LABELS: Record<HistoryFilter, string> = {
  all: "All",
  submissions: "Submissions",
  edits: "Edits",
  sources: "Sources",
};

export type HistoryKind = Exclude<HistoryFilter, "all">;

export type SubmissionOutcome = "accepted" | "not_applied" | "rejected";

export const SUBMISSION_OUTCOME_LABELS: Record<SubmissionOutcome, string> = {
  accepted: "Accepted",
  not_applied: "Not applied",
  rejected: "Rejected",
};

const ACTION_SENTENCES: Record<string, string> = {
  "ban.add": "Added a ban",
  "ban.delete": "Removed a ban",
  "ban.update": "Edited a ban",
  "candidate-card.ignore": "Ignored a source for this card",
  "candidate-card.unignore": "Stopped ignoring a source for this card",
  "candidate-printing.copy": "Copied an incoming row onto a printing",
  "candidate-printing.delete": "Deleted an incoming row",
  "candidate-printing.ignore": "Ignored an incoming row",
  "candidate-printing.link": "Linked an incoming row to a printing",
  "candidate-printing.patch": "Edited an incoming row",
  "candidate-printing.relink": "Relinked incoming rows",
  "candidate-printing.unignore": "Stopped ignoring an incoming row",
  "candidate-printing.unpin": "Removed a pinned link to a printing",
  "candidates.upload": "Uploaded fresh data from a source",
  "card-submission.accept": "Accepted a contributor submission",
  "card-submission.create-card": "Created the card from a contributor submission",
  "card-submission.reject": "Rejected a contributor submission",
  "card-submission.resolution": "Wrote back to the contributor",
  "card.accept-favorites": "Created the card from trusted sources",
  "card.accept-new": "Created the card from a source",
  "card.create": "Created the card",
  "card.delete": "Deleted the card",
  "card.link-unmatched": "Pointed an incoming name at this card",
  "card.rename": "Changed the card ID",
  "card.update": "Edited the card",
  "citation.create": "Added a citation",
  "citation.delete": "Removed a citation",
  "citation.update": "Edited a citation",
  "errata.delete": "Removed the errata",
  "errata.upload": "Uploaded errata in bulk",
  "errata.upsert": "Saved the errata",
  "image.activate": "Made an image the one shown",
  "image.add-url": "Added an image by link",
  "image.credit": "Changed an image credit",
  "image.delete": "Deleted an image",
  "image.face": "Changed which face an image shows",
  "image.quad": "Straightened an image",
  "image.rehost": "Took a copy of an image",
  "image.rotate": "Rotated an image",
  "image.set-from-candidate": "Took the image from a source",
  "image.set-needs-trim": "Flagged an image for trimming",
  "image.unrehost": "Dropped the local copy of an image",
  "image.upload": "Uploaded an image",
  "printing.accept": "Added a printing",
  "printing.accept-favorites": "Added printings from trusted sources",
  "printing.create": "Added a printing",
  "printing.delete": "Deleted a printing",
  "printing.fallback-art": "Changed the stand-in art",
  "printing.update": "Edited a printing",
  "provider.delete-candidates": "Removed a source's data",
};

const FIELD_LABELS: Record<string, string> = {
  ...CARD_FIELD_LABELS,
  ...PRINTING_FIELD_LABELS,
  comment: "Comment",
  maxCopiesOverride: "Max copies override",
};

function changedFields(event: AdminAuditEventResponse): string[] {
  const keys = [
    ...new Set([...Object.keys(event.oldValues ?? {}), ...Object.keys(event.newValues ?? {})]),
  ];
  return keys.map((key) => FIELD_LABELS[key] ?? key);
}

export function historyKind(action: string): HistoryKind {
  if (action.startsWith("card-submission.")) {
    return "submissions";
  }
  if (
    action.startsWith("candidate-card.") ||
    action.startsWith("candidate-printing.") ||
    action.startsWith("candidates.") ||
    action.startsWith("provider.")
  ) {
    return "sources";
  }
  return "edits";
}

const FIELD_LISTING_ACTIONS = new Set([
  "candidate-printing.patch",
  "card.update",
  "image.credit",
  "printing.update",
]);

const CARD_LABELLED_TYPES = new Set(["ban", "card", "errata"]);

const IMAGE_SLOT_LABELS: Record<string, string> = {
  main: "as the main art",
  additional: "beside the main art",
};

export interface HistoryContext {
  printingLabels?: Record<string, string>;
}

export type HistoryTarget =
  | { kind: "printing"; printingId: string }
  | { kind: "bans" }
  | { kind: "fields" }
  | { kind: "sources" }
  | { kind: "submissions" };

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function skippedCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  return count(value) ?? 0;
}

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

function eventPrintingId(event: AdminAuditEventResponse): string | null {
  if (event.entityType === "printing") {
    return text(event.entityId);
  }
  return (
    text(event.newValues?.printingId) ??
    text(event.oldValues?.printingId) ??
    text(event.newValues?.targetPrintingId)
  );
}

function printingLabel(event: AdminAuditEventResponse, context: HistoryContext): string | null {
  const id = eventPrintingId(event);
  return id === null ? null : (context.printingLabels?.[id] ?? null);
}

function namedPrintings(ids: string[], context: HistoryContext): string[] | null {
  const labels = ids.flatMap((id) => {
    const label = context.printingLabels?.[id];
    return label === undefined ? [] : [label];
  });
  return labels.length === ids.length ? labels : null;
}

/** `made` is null on an event recorded before either key was written. */
function createdPrintingNames(
  event: AdminAuditEventResponse,
  context: HistoryContext,
): { made: number | null; names: string | null } {
  const listed = Array.isArray(event.newValues?.createdPrintingIds);
  const ids = strings(event.newValues?.createdPrintingIds);
  const made = count(event.newValues?.printingsCreated) ?? (listed ? ids.length : null);
  const labels = made !== null && ids.length === made ? namedPrintings(ids, context) : null;
  return { made, names: labels === null ? null : labels.join(", ") };
}

function createdPrintings(event: AdminAuditEventResponse, context: HistoryContext): string | null {
  const { made, names } = createdPrintingNames(event, context);
  if (made === null || made === 0) {
    return null;
  }
  return names === null
    ? plural(made, "new printing")
    : `${made === 1 ? "new printing" : "new printings"} ${names}`;
}

function acceptedPrintingFields(event: AdminAuditEventResponse, context: HistoryContext): string[] {
  const picks = strings(event.newValues?.printingFields).flatMap((entry) => {
    const cut = entry.indexOf(":");
    return cut === -1 ? [] : [{ printingId: entry.slice(0, cut), field: entry.slice(cut + 1) }];
  });
  return [...Map.groupBy(picks, (pick) => pick.printingId)].map(([printingId, group]) => {
    const fields = group.map((pick) => FIELD_LABELS[pick.field] ?? pick.field);
    return `${fields.join(", ")} on ${context.printingLabels?.[printingId] ?? "a printing"}`;
  });
}

function subject(event: AdminAuditEventResponse, context: HistoryContext): string | null {
  if (CARD_LABELLED_TYPES.has(event.entityType) || event.entityLabel === event.cardSlug) {
    return null;
  }
  if (event.entityType === "printing") {
    return printingLabel(event, context) ?? text(event.entityLabel);
  }
  return text(event.entityLabel);
}

function printingName(
  event: AdminAuditEventResponse,
  context: HistoryContext,
  key = "printingId",
): string | null {
  const id = text(event.newValues?.[key]) ?? text(event.oldValues?.[key]);
  if (id === null) {
    return null;
  }
  return context.printingLabels?.[id] ?? null;
}

function joined(parts: (string | null)[]): string {
  return parts.filter((part): part is string => part !== null && part.length > 0).join(" ");
}

function uploadSummary(event: AdminAuditEventResponse): string | null {
  const labels: [string, string][] = [
    ["newCards", "new cards"],
    ["newPrintings", "new printings"],
    ["updates", "card updates"],
    ["printingUpdates", "printing updates"],
    ["removedCards", "removed cards"],
    ["removedPrintings", "removed printings"],
    ["errors", "errors"],
  ];
  const parts = labels.flatMap(([key, label]) => {
    const value = count(event.newValues?.[key]);
    return value !== null && value > 0 ? [`${value} ${label}`] : [];
  });
  if (parts.length > 0) {
    return `(${parts.join(", ")})`;
  }
  const unchanged = count(event.newValues?.unchanged);
  return unchanged === null ? null : `(nothing new, ${unchanged} unchanged)`;
}

export function historySentence(
  event: AdminAuditEventResponse,
  context: HistoryContext = {},
): string {
  const printing = printingName(event, context);

  switch (event.action) {
    case "card.link-unmatched": {
      const name = text(event.newValues?.name);
      return name === null
        ? "Pointed an incoming name at this card"
        : `Pointed the incoming name ${name} at this card`;
    }
    case "card.rename": {
      const from = text(event.oldValues?.slug);
      const to = text(event.newValues?.slug);
      return from === null || to === null
        ? "Changed the card ID"
        : `Changed the card ID from ${from} to ${to}`;
    }
    case "ban.add":
    case "ban.update": {
      const format = text(event.newValues?.formatId) ?? text(event.oldValues?.formatId);
      const on = text(event.newValues?.bannedAt) ?? text(event.oldValues?.bannedAt);
      const verb = event.action === "ban.add" ? "Added" : "Edited";
      return joined([verb, format === null ? "a ban" : `the ${format} ban`, on && `(${on})`]);
    }
    case "candidate-card.ignore":
    case "candidate-card.unignore":
    case "candidate-printing.ignore":
    case "candidate-printing.unignore": {
      const provider = text(event.newValues?.provider);
      const externalId = text(event.newValues?.externalId);
      const stopped = event.action.endsWith(".unignore") ? "Stopped ignoring" : "Ignored";
      const what = event.action.startsWith("candidate-card.") ? "a source" : "an incoming row";
      return joined([
        stopped,
        provider === null ? what : `${provider}'s ${externalId ?? what}`,
        "for this card",
      ]);
    }
    case "candidate-printing.link": {
      const ids = event.newValues?.candidatePrintingIds;
      const rows = Array.isArray(ids) ? ids.length : null;
      const target = printingName(event, context);
      return joined([
        "Linked",
        rows === null ? "an incoming row" : `${rows} incoming row${rows === 1 ? "" : "s"}`,
        target === null ? "to a printing" : `to ${target}`,
      ]);
    }
    case "candidate-printing.copy": {
      const target = printingName(event, context, "targetPrintingId");
      return joined([
        "Copied",
        text(event.entityLabel) ?? "an incoming row",
        target === null ? "onto a printing" : `onto ${target}`,
      ]);
    }
    case "candidates.upload": {
      const provider = text(event.entityLabel);
      return joined([
        "Uploaded fresh data",
        provider === null ? null : `from ${provider}`,
        uploadSummary(event),
      ]);
    }
    case "provider.delete-candidates": {
      const provider = text(event.entityLabel);
      const deleted = count(event.newValues?.deleted);
      return joined([
        "Removed",
        provider === null ? "a source's data" : `${provider}'s data`,
        deleted === null ? null : `(${deleted} row${deleted === 1 ? "" : "s"})`,
      ]);
    }
    case "image.activate": {
      const shown = event.newValues?.active !== false;
      return joined([
        shown ? "Made an image the one shown" : "Took an image out of use",
        printing && `on ${printing}`,
      ]);
    }
    case "image.set-needs-trim": {
      const on = event.newValues?.needsTrim !== false;
      return joined([
        on ? "Turned auto-trim on" : "Turned auto-trim off",
        printing && `for ${printing}`,
      ]);
    }
    case "image.rotate": {
      const rotation = count(event.newValues?.rotation);
      return joined([
        rotation === null ? "Rotated an image" : `Rotated an image to ${rotation}°`,
        printing && `on ${printing}`,
      ]);
    }
    case "image.add-url":
    case "image.set-from-candidate":
    case "image.upload": {
      const verb =
        event.action === "image.upload"
          ? "Uploaded an image"
          : event.action === "image.add-url"
            ? "Added an image by link"
            : "Took the image from a source";
      const slot = text(event.newValues?.mode);
      return joined([
        verb,
        slot === null ? null : (IMAGE_SLOT_LABELS[slot] ?? null),
        printing && `on ${printing}`,
      ]);
    }
    case "card.accept-field":
    case "printing.accept-field": {
      const fields = changedFields(event);
      const suffix =
        event.action === "printing.accept-field"
          ? ` on ${subject(event, context) ?? "a printing"}`
          : "";
      return fields.length === 0
        ? `Changed a field${suffix}`
        : `Changed ${fields.join(", ")}${suffix}`;
    }
    case "card-submission.accept": {
      const cardFields = strings(event.newValues?.cardFields).map(
        (field) => FIELD_LABELS[field] ?? field,
      );
      const images = count(event.newValues?.images) ?? 0;
      const skipped = skippedCount(event.newValues?.skipped);
      const parts = [
        cardFields.length === 0 ? null : cardFields.join(", "),
        ...acceptedPrintingFields(event, context),
        createdPrintings(event, context),
        images === 0 ? null : plural(images, "image"),
        skipped === 0 ? null : `${skipped} skipped`,
      ].filter((part): part is string => part !== null);
      return parts.length === 0
        ? "Accepted a contributor submission"
        : `Accepted a contributor submission (${parts.join("; ")})`;
    }
    case "card-submission.create-card":
    case "card.accept-favorites": {
      const head =
        event.action === "card.accept-favorites"
          ? "Created the card from trusted sources"
          : "Created the card from a contributor submission";
      const images = count(event.newValues?.images) ?? 0;
      const skipped = skippedCount(event.newValues?.skipped);
      const parts = [
        createdPrintings(event, context),
        images === 0 ? null : plural(images, "image"),
        skipped === 0 ? null : `${skipped} skipped`,
      ].filter((part): part is string => part !== null);
      return parts.length === 0 ? head : `${head} (${parts.join(", ")})`;
    }
    case "printing.accept-favorites": {
      const { made, names } = createdPrintingNames(event, context);
      const skipped = skippedCount(event.newValues?.skipped);
      const what =
        made === null
          ? "printings"
          : made === 0
            ? "no printings"
            : (names ?? plural(made, "printing"));
      return joined([
        `Added ${what} from trusted sources`,
        skipped === 0 ? null : `(${skipped} skipped)`,
      ]);
    }
    default: {
      break;
    }
  }

  const sentence = ACTION_SENTENCES[event.action] ?? event.action;
  const on = subject(event, context) ?? printing;
  const named = on === null ? sentence : `${sentence}: ${on}`;

  if (!FIELD_LISTING_ACTIONS.has(event.action)) {
    return named;
  }
  const fields = changedFields(event);
  return fields.length === 0 ? named : `${named} (${fields.join(", ")})`;
}

export function historyTarget(event: AdminAuditEventResponse): HistoryTarget | null {
  const printingId = eventPrintingId(event);
  if (printingId !== null) {
    return { kind: "printing", printingId };
  }
  if (event.action.startsWith("ban.") || event.action.startsWith("errata.")) {
    return { kind: "bans" };
  }
  if (event.action.startsWith("card-submission.")) {
    return { kind: "submissions" };
  }
  if (
    event.action.startsWith("candidate-card.") ||
    event.action.startsWith("candidate-printing.") ||
    event.action.startsWith("candidates.") ||
    event.action.startsWith("provider.")
  ) {
    return { kind: "sources" };
  }
  if (event.action === "card.accept-field" || event.action === "card.update") {
    return { kind: "fields" };
  }
  return null;
}

export function submissionOutcome(event: AdminAuditEventResponse): SubmissionOutcome | null {
  if (event.action === "card-submission.reject") {
    return "rejected";
  }
  if (event.action !== "card-submission.accept") {
    return null;
  }
  return event.newValues?.status === "not_applied" ? "not_applied" : "accepted";
}

export function filterHistoryEvents(
  events: readonly AdminAuditEventResponse[],
  card: { slug: string; name: string },
  filter: HistoryFilter,
): AdminAuditEventResponse[] {
  const normName = normalizeNameForIdentity(card.name);

  // A rejection is recorded against the incoming row, which carries no card slug,
  // only the submitted name. The feed is a substring search, so without the name
  // check a longer card's rejection lands here too.
  function belongsToCard(event: AdminAuditEventResponse): boolean {
    if (event.cardSlug !== null) {
      return event.cardSlug === card.slug;
    }
    return (
      historyKind(event.action) === "submissions" &&
      normalizeNameForIdentity(event.entityLabel ?? "") === normName
    );
  }

  return events.filter(
    (event) => belongsToCard(event) && (filter === "all" || historyKind(event.action) === filter),
  );
}

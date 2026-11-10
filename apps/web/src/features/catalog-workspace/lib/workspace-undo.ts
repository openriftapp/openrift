import { pluralize } from "@openrift/shared/strings";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";

export type QueryScope = readonly (readonly unknown[])[];

export interface WorkspaceUndoText {
  label: string;
  undoneLabel: string;
}

export interface WorkspaceUndoEntry extends WorkspaceUndoText {
  invalidates: QueryScope;
  undo: () => Promise<void>;
}

export function undoScope(...scopes: QueryScope[]): QueryScope {
  return [adminKeys.workspace, ...scopes.flat()];
}

function counted(count: number, noun: string): string {
  return `${count} ${pluralize(count, noun)}`;
}

function restored(count: number, noun: string): string {
  return count === 1 ? noun : counted(count, noun);
}

export function discardUndoText({
  suggestions,
  images,
  sources,
  record,
}: {
  suggestions: number;
  images: number;
  sources: number;
  record: string;
}): WorkspaceUndoText {
  const parts: [number, string][] = [
    [suggestions, "suggestion"],
    [images, "image"],
  ];
  const shown = parts.filter(([count]) => count > 0);
  if (shown.length === 0) {
    return {
      label: `Discarded ${counted(sources, "source")} on ${record}`,
      undoneLabel: `Undone: ${restored(sources, "source")} restored on ${record}`,
    };
  }
  return {
    label: `Discarded ${shown.map(([count, noun]) => counted(count, noun)).join(" and ")} on ${record}`,
    undoneLabel: `Undone: ${shown.map(([count, noun]) => (shown.length === 1 ? restored(count, noun) : counted(count, noun))).join(" and ")} restored on ${record}`,
  };
}

export function usedUndoText({
  field,
  source,
  record,
}: {
  field: string;
  source: string;
  record: string;
}): WorkspaceUndoText {
  return {
    label: `Used ${field} from ${source} on ${record}`,
    undoneLabel: `Undone: ${field} restored on ${record}`,
  };
}

export function ignoredUndoText({
  what,
  record,
  plural = false,
}: {
  what: string;
  record: string;
  plural?: boolean;
}): WorkspaceUndoText {
  const subject = what === record ? record : `${what} on ${record}`;
  return {
    label: `Ignored ${subject}`,
    undoneLabel: `Undone: ${subject} ${plural ? "are" : "is"} back in the queue`,
  };
}

export function mappedUndoText({
  listing,
  record,
}: {
  listing: string;
  record: string;
}): WorkspaceUndoText {
  return {
    label: `Assigned ${listing} to ${record}`,
    undoneLabel: `Undone: ${listing} unassigned from ${record}`,
  };
}

export function goneNotice(entry: WorkspaceUndoEntry): string {
  return `Can't undo "${entry.label}": it was deleted since`;
}

export function combinedUndo(
  text: WorkspaceUndoText,
  entries: readonly WorkspaceUndoEntry[],
): WorkspaceUndoEntry {
  return {
    ...text,
    invalidates: entries.flatMap((entry) => entry.invalidates),
    undo: async () => {
      await Promise.all(entries.map((entry) => entry.undo()));
    },
  };
}

import type { SetReleases } from "@openrift/shared/set-release";
import type { AdminSetResponse } from "@openrift/shared/types/api/admin";

import { parseIntegerInput } from "@/features/admin/lib/integer-input";

export interface SetDraftFields {
  name: string;
  printedTotal: string;
}

export interface ParsedSetDraft {
  name: string;
  printedTotal: number | null;
}

export function parseSetDraft(draft: SetDraftFields): ParsedSetDraft | { error: string } {
  const name = draft.name.trim();
  if (!name) {
    return { error: "Name is required" };
  }
  const printedTotal = parseIntegerInput(draft.printedTotal, 0);
  if (printedTotal === undefined) {
    return { error: "Printed total must be a non-negative whole number" };
  }
  return { name, printedTotal };
}

export function requireSetDraft(draft: SetDraftFields): ParsedSetDraft {
  const parsed = parseSetDraft(draft);
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }
  return parsed;
}

export function setReleasesUpdate(set: AdminSetResponse, releases: SetReleases) {
  return {
    id: set.id,
    name: set.name,
    printedTotal: set.printedTotal,
    releases,
    setType: set.setType,
  };
}

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
  const total = draft.printedTotal.trim();
  if (!total) {
    return { name, printedTotal: null };
  }
  if (!/^\d+$/u.test(total)) {
    return { error: "Printed total must be a non-negative whole number" };
  }
  return { name, printedTotal: Number(total) };
}

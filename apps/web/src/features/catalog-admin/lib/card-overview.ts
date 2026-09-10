import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";

export function firstPrintingSetLabel(printings: readonly AdminPrintingResponse[]): string | null {
  const first = printings.toSorted((a, b) => a.canonicalRank - b.canonicalRank).at(0);
  if (first === undefined) {
    return null;
  }
  return first.setName ?? first.setSlug;
}

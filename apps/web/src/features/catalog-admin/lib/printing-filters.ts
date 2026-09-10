import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";

export type PrintingMarkerFilter = "any" | "with" | "without";

export interface PrintingFilterState {
  language: string | null;
  setSlug: string | null;
  markers: PrintingMarkerFilter;
}

export const DEFAULT_PRINTING_FILTERS: PrintingFilterState = {
  language: null,
  setSlug: null,
  markers: "any",
};

export function printingLanguages(printings: readonly AdminPrintingResponse[]): string[] {
  return [...new Set(printings.map((printing) => printing.language))].toSorted();
}

export interface PrintingSetOption {
  slug: string;
  name: string;
}

export function printingSets(printings: readonly AdminPrintingResponse[]): PrintingSetOption[] {
  const bySlug = new Map<string, string>();
  for (const printing of printings) {
    if (!bySlug.has(printing.setSlug)) {
      bySlug.set(printing.setSlug, printing.setName ?? printing.setSlug);
    }
  }
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export function filterPrintings(
  printings: readonly AdminPrintingResponse[],
  filters: PrintingFilterState,
): AdminPrintingResponse[] {
  return printings.filter((printing) => {
    if (filters.language !== null && printing.language !== filters.language) {
      return false;
    }
    if (filters.setSlug !== null && printing.setSlug !== filters.setSlug) {
      return false;
    }
    if (filters.markers === "with" && printing.markerSlugs.length === 0) {
      return false;
    }
    if (filters.markers === "without" && printing.markerSlugs.length > 0) {
      return false;
    }
    return true;
  });
}

import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import { useState } from "react";

import { LanguageChip } from "@/components/language-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type PrintingMarkerFilter = "all" | "with" | "without";

const ALL = "all";

const MARKER_VALUES: PrintingMarkerFilter[] = ["all", "with", "without"];

const MARKER_LABELS: Record<PrintingMarkerFilter, string> = {
  all: "All",
  with: "With markers",
  without: "No markers",
};

export interface PrintingFilterBarProps {
  availableLanguages: string[];
  availableSets: [string, string][];
  showMarkerFilter: boolean;
  languageFilter: string | null;
  setFilter: string | null;
  markerFilter: PrintingMarkerFilter;
  onLanguageFilterChange: (language: string | null) => void;
  onSetFilterChange: (setSlug: string | null) => void;
  onMarkerFilterChange: (filter: PrintingMarkerFilter) => void;
}

export function filterPrintings(
  printings: readonly AdminPrintingResponse[],
  filters: { language: string | null; setSlug: string | null; marker: PrintingMarkerFilter },
): AdminPrintingResponse[] {
  return printings.filter((p) => {
    if (filters.setSlug && p.setSlug !== filters.setSlug) {
      return false;
    }
    if (filters.language && p.language !== filters.language) {
      return false;
    }
    if (filters.marker === "with" && p.markerSlugs.length === 0) {
      return false;
    }
    if (filters.marker === "without" && p.markerSlugs.length > 0) {
      return false;
    }
    return true;
  });
}

export function usePrintingFilters(printings: readonly AdminPrintingResponse[]): {
  filteredPrintings: AdminPrintingResponse[];
  filters: PrintingFilterBarProps;
} {
  const [setFilter, setSetFilter] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [markerFilter, setMarkerFilter] = useState<PrintingMarkerFilter>("all");

  const availableSets = [
    ...new Map(printings.map((p) => [p.setSlug, p.setName ?? p.setSlug])).entries(),
  ];
  const availableLanguages = [...new Set(printings.map((p) => p.language))].toSorted();
  const hasMarkered = printings.some((p) => p.markerSlugs.length > 0);
  const hasMarkerless = printings.some((p) => p.markerSlugs.length === 0);

  return {
    filteredPrintings: filterPrintings(printings, {
      language: languageFilter,
      setSlug: setFilter,
      marker: markerFilter,
    }),
    filters: {
      availableLanguages,
      availableSets,
      showMarkerFilter: hasMarkered && hasMarkerless,
      languageFilter,
      setFilter,
      markerFilter,
      onLanguageFilterChange: setLanguageFilter,
      onSetFilterChange: setSetFilter,
      onMarkerFilterChange: setMarkerFilter,
    },
  };
}

export function PrintingFilterBar({
  availableLanguages,
  availableSets,
  showMarkerFilter,
  languageFilter,
  setFilter,
  markerFilter,
  onLanguageFilterChange,
  onSetFilterChange,
  onMarkerFilterChange,
  agreedFieldsFolded,
  onAgreedFieldsFoldedChange,
}: PrintingFilterBarProps & {
  agreedFieldsFolded: boolean;
  onAgreedFieldsFoldedChange: (folded: boolean) => void;
}) {
  const setItems = [
    { value: ALL, label: "Every set" },
    ...availableSets.map(([slug, name]) => ({ value: slug, label: name })),
  ];

  return (
    <>
      <ToggleGroup
        variant="outline"
        spacing={0}
        aria-label="Source fields shown"
        value={[agreedFieldsFolded ? "differences" : "all-fields"]}
        onValueChange={([next]) => {
          if (next === "differences" || next === "all-fields") {
            onAgreedFieldsFoldedChange(next === "differences");
          }
        }}
      >
        <ToggleGroupItem value="differences">Differences</ToggleGroupItem>
        <ToggleGroupItem value="all-fields">All fields</ToggleGroupItem>
      </ToggleGroup>

      {availableLanguages.length > 1 && (
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="Language"
          value={[languageFilter ?? ALL]}
          onValueChange={([next]) => {
            if (next !== undefined) {
              onLanguageFilterChange(next === ALL ? null : next);
            }
          }}
        >
          <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
          {availableLanguages.map((language) => (
            <ToggleGroupItem key={language} value={language}>
              <LanguageChip code={language} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {availableSets.length > 1 && (
        <Select
          items={setItems}
          value={setFilter ?? ALL}
          onValueChange={(value: string | null) => {
            onSetFilterChange(value === null || value === ALL ? null : value);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Set">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {setItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showMarkerFilter && (
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="Markers"
          value={[markerFilter]}
          onValueChange={([next]) => {
            const match = MARKER_VALUES.find((value) => value === next);
            if (match !== undefined) {
              onMarkerFilterChange(match);
            }
          }}
        >
          {MARKER_VALUES.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {MARKER_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </>
  );
}

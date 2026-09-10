import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { LanguageChip } from "@/components/language-chip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  PrintingFilterState,
  PrintingMarkerFilter,
} from "@/features/catalog-admin/lib/printing-filters";
import { printingLanguages, printingSets } from "@/features/catalog-admin/lib/printing-filters";

const ALL = "all";

const MARKER_VALUES: PrintingMarkerFilter[] = ["any", "with", "without"];

const MARKER_LABELS: Record<PrintingMarkerFilter, string> = {
  any: "Any",
  with: "With",
  without: "Without",
};

export function PrintingToolbar({
  printings,
  filters,
  onFiltersChange,
  cardSlug,
  isAdmin,
}: {
  printings: readonly AdminPrintingResponse[];
  filters: PrintingFilterState;
  onFiltersChange: (next: PrintingFilterState) => void;
  cardSlug: string;
  isAdmin: boolean;
}) {
  const languages = printingLanguages(printings);
  const sets = printingSets(printings);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {languages.length > 1 && (
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="Language"
          value={[filters.language ?? ALL]}
          onValueChange={([next]) => {
            if (next !== undefined) {
              onFiltersChange({ ...filters, language: next === ALL ? null : next });
            }
          }}
        >
          <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
          {languages.map((language) => (
            <ToggleGroupItem key={language} value={language}>
              <LanguageChip code={language} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {sets.length > 1 && (
        <Select
          items={[
            { value: ALL, label: "Every set" },
            ...sets.map((s) => ({ value: s.slug, label: s.name })),
          ]}
          value={filters.setSlug ?? ALL}
          onValueChange={(value: string | null) => {
            if (value !== null) {
              onFiltersChange({ ...filters, setSlug: value === ALL ? null : value });
            }
          }}
        >
          <SelectTrigger className="w-48" aria-label="Set">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Every set</SelectItem>
            {sets.map((set) => (
              <SelectItem key={set.slug} value={set.slug}>
                {set.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <ToggleGroup
        variant="outline"
        spacing={0}
        aria-label="Markers"
        value={[filters.markers]}
        onValueChange={([next]) => {
          const marker = MARKER_VALUES.find((value) => value === next);
          if (marker !== undefined) {
            onFiltersChange({ ...filters, markers: marker });
          }
        }}
      >
        {MARKER_VALUES.map((value) => (
          <ToggleGroupItem key={value} value={value}>
            {MARKER_LABELS[value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {isAdmin && (
        <Button
          variant="ghost"
          className="ml-auto"
          render={
            <Link to="/admin/cards/$cardSlug/printings/create" params={{ cardSlug }} search={{}} />
          }
        >
          <PlusIcon />
          Add printing
        </Button>
      )}
    </div>
  );
}

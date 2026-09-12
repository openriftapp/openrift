import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { useCards } from "@/features/cards/hooks/use-cards";
import type { ExportPayload } from "@/features/collections/components/export-dialog";
import { ExportDialog } from "@/features/collections/components/export-dialog";
import { copiesQueryOptions } from "@/features/collections/lib/copies-query";
import { useFilteredListEntries } from "@/features/lists/hooks/use-filtered-list-entries";
import {
  hasReservedCopies,
  stacksFromListEntries,
  withoutReservedCopies,
} from "@/features/lists/lib/list-export";
import { useRequiredUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

interface ListExportDialogProps {
  listName: string;
  kind: ListKind;
  entries: readonly ListEntryDetailResponse[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ListExportDialog({
  listName,
  kind,
  entries,
  open,
  onOpenChange,
}: ListExportDialogProps) {
  const userId = useRequiredUserId();
  const { printingsById, sets } = useCards();
  const [applyFilters, setApplyFilters] = useState(true);
  const [excludeReserved, setExcludeReserved] = useState(true);

  const { hasActiveFilters, filteredEntries } = useFilteredListEntries(entries);
  const scopedEntries = hasActiveFilters && applyFilters ? filteredEntries : entries;

  const hasReserved = hasReservedCopies(scopedEntries);
  const exportEntries =
    hasReserved && excludeReserved ? withoutReservedCopies(scopedEntries) : scopedEntries;

  const { data: copies, isLoading } = useQuery({
    ...copiesQueryOptions(userId),
    enabled: kind === "copy",
  });

  const payload: ExportPayload =
    kind === "card"
      ? {
          mode: "cards",
          lines: exportEntries.map((entry) => ({
            name: entry.cardName,
            quantity: entry.quantity,
          })),
        }
      : {
          mode: "printings",
          stacks: stacksFromListEntries(exportEntries, printingsById, sets),
          ...(kind === "copy"
            ? { copiesById: new Map((copies ?? []).map((copy) => [copy.id, copy])) }
            : {}),
        };

  const scopeControls = (
    <>
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="list-export-apply-filters"
            checked={applyFilters}
            onCheckedChange={(checked) => setApplyFilters(checked === true)}
          />
          <label htmlFor="list-export-apply-filters" className="cursor-pointer text-sm">
            {m.lists_export_apply_filters({
              shown: filteredEntries.length,
              total: entries.length,
            })}
          </label>
        </div>
      )}
      {hasReserved && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="list-export-exclude-reserved"
            checked={excludeReserved}
            onCheckedChange={(checked) => setExcludeReserved(checked === true)}
          />
          <label htmlFor="list-export-exclude-reserved" className="cursor-pointer text-sm">
            {m.lists_export_exclude_reserved()}
          </label>
        </div>
      )}
    </>
  );

  return (
    <ExportDialog
      title={m.lists_export_title()}
      filenameBase={listName}
      payload={payload}
      unit="card"
      successMessage={m.lists_export_success()}
      scopeControls={scopeControls}
      isLoading={kind === "copy" && isLoading}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

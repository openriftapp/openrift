import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { ExportDialog } from "@/features/collections/components/export-dialog";
import { copiesQueryOptions } from "@/features/collections/lib/copies-query";
import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { useRequiredUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

interface CollectionExportDialogProps {
  collectionId?: string;
  collectionName: string;
  stacks: readonly StackedEntry[];
  /** The grid's filtered copies, pre-dedupe, so cards view exports every printing too. */
  selectableCopyIds: readonly string[];
  hasActiveFilters: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function narrowToCopyIds(
  stacks: readonly StackedEntry[],
  copyIds: readonly string[],
): StackedEntry[] {
  const kept = new Set(copyIds);
  const narrowed: StackedEntry[] = [];
  for (const stack of stacks) {
    const ids = stack.copyIds.filter((id) => kept.has(id));
    if (ids.length > 0) {
      narrowed.push({ ...stack, copyIds: ids });
    }
  }
  return narrowed;
}

export function CollectionExportDialog({
  collectionId,
  collectionName,
  stacks,
  selectableCopyIds,
  hasActiveFilters,
  open,
  onOpenChange,
}: CollectionExportDialogProps) {
  const userId = useRequiredUserId();
  const [applyFilters, setApplyFilters] = useState(true);

  const { data: copies, isLoading } = useQuery(copiesQueryOptions(userId, collectionId));

  const totalCopies = stacks.reduce((sum, stack) => sum + stack.copyIds.length, 0);
  const exportStacks =
    hasActiveFilters && applyFilters ? narrowToCopyIds(stacks, selectableCopyIds) : stacks;

  const copiesById = new Map((copies ?? []).map((copy) => [copy.id, copy]));

  const scopeControls = hasActiveFilters && (
    <div className="flex items-center gap-2">
      <Checkbox
        id="collection-export-apply-filters"
        checked={applyFilters}
        onCheckedChange={(checked) => setApplyFilters(checked === true)}
      />
      <label htmlFor="collection-export-apply-filters" className="cursor-pointer text-sm">
        {m.collections_export_collection_filters({
          selected: selectableCopyIds.length,
          total: totalCopies,
        })}
      </label>
    </div>
  );

  return (
    <ExportDialog
      title={m.collections_export_collection_title()}
      filenameBase={collectionName}
      payload={{ mode: "printings", stacks: exportStacks, copiesById }}
      unit="copy"
      successMessage={m.collections_export_collection_success()}
      scopeControls={scopeControls}
      isLoading={isLoading}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

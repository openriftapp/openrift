import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { CompareTable } from "@/features/catalog-admin/components/compare-table";
import { CompareToolbar } from "@/features/catalog-admin/components/compare-toolbar";
import { useCompareActions } from "@/features/catalog-admin/hooks/use-compare-actions";
import { useCompareOptionSets } from "@/features/catalog-admin/hooks/use-compare-options";
import type { CompareContext } from "@/features/catalog-admin/lib/compare-actions";
import { buildCompareColumns } from "@/features/catalog-admin/lib/compare-columns";
import { buildCompareModel, printingBlockTitle } from "@/features/catalog-admin/lib/compare-rows";

function toggle(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(value)) {
    next.add(value);
  }
  return next;
}

export function CompareTab({
  detail,
  cardSlug,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
}) {
  const [differencesOnly, setDifferencesOnly] = useState(true);
  const [uncheckedOnly, setUncheckedOnly] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const { data: providerSettingsData } = useProviderSettings();
  const optionSets = useCompareOptionSets();

  const columns = buildCompareColumns(detail, providerSettingsData.providerSettings, {
    hidden,
    uncheckedOnly,
  });
  const model = buildCompareModel(detail, columns, optionSets);
  const actions = useCompareActions({ detail, cardSlug, columns, model });

  const printingTargets = detail.printings.map((printing) => ({
    id: printing.id,
    label: printingBlockTitle(printing),
  }));
  const context: CompareContext = {
    columns,
    printingTargets,
    differencesOnly,
    expandedPrintingIds: expanded,
    toggleExpanded: (printingId) => setExpanded((prev) => toggle(prev, printingId)),
    hideColumn: (columnId) => setHidden((prev) => new Set(prev).add(columnId)),
  };

  if (detail.sources.length === 0 || detail.card === null) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>
            {detail.sources.length === 0
              ? "No sources carry this card yet."
              : "This card is not live yet."}
          </EmptyTitle>
          <EmptyDescription>
            {detail.sources.length === 0
              ? "There is nothing to compare until an import or a contributor sends this card in."
              : "Compare needs a live card to compare the sources against. Create it first."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      <CompareToolbar
        differencesOnly={differencesOnly}
        onDifferencesOnlyChange={setDifferencesOnly}
        uncheckedOnly={uncheckedOnly}
        onUncheckedOnlyChange={setUncheckedOnly}
        differences={model.differences}
      />

      {columns.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {hidden.size > 0
            ? "Every source is hidden. Show them again below."
            : "Every source on this card is checked. Switch to all sources to see them."}
        </p>
      ) : (
        <CompareTable model={model} context={context} actions={actions} />
      )}

      {model.printingsWithoutSources.length > 0 && (
        <p className="text-muted-foreground text-sm">
          No source carries {model.printingsWithoutSources.join(", ")}.
        </p>
      )}

      {hidden.size > 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          {hidden.size} column{hidden.size === 1 ? "" : "s"} hidden.
          <Button variant="link" size="sm" onClick={() => setHidden(new Set())}>
            Show all
          </Button>
        </p>
      )}
    </div>
  );
}

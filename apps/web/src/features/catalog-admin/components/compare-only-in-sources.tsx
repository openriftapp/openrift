import type { CandidatePrintingResponse } from "@openrift/shared/types/api/admin";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CompareConfirmDialog } from "@/features/catalog-admin/components/compare-dialogs";
import { CompareMissingFieldsDialog } from "@/features/catalog-admin/components/compare-missing-fields-dialog";
import { PrintingTargetMenu } from "@/features/catalog-admin/components/printing-target-menu";
import type { CompareActions, CompareContext } from "@/features/catalog-admin/lib/compare-actions";
import type { CompareGroupBlock } from "@/features/catalog-admin/lib/compare-rows";
import type { RequiredPrintingField } from "@/features/catalog-admin/lib/printing-fields";
import {
  buildPrintingFieldsFromCandidate,
  missingPrintingFields,
} from "@/features/catalog-admin/lib/printing-fields";
import { cn } from "@/lib/utils";

interface PendingAdd {
  candidate: CandidatePrintingResponse;
  sourceLabel: string;
  missing: RequiredPrintingField[];
}

export function CompareOnlyInSourcesBlock({
  group,
  context,
  actions,
}: {
  group: CompareGroupBlock;
  context: CompareContext;
  actions: CompareActions;
}) {
  const { columns } = context;
  const [ignoring, setIgnoring] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);

  const candidatesById = new Map(
    group.candidates.map((candidate) => [candidate.id, candidate] as const),
  );

  function startAdd(candidate: CandidatePrintingResponse, sourceLabel: string) {
    const missing = missingPrintingFields(buildPrintingFieldsFromCandidate(candidate));
    if (missing.length === 0) {
      actions.addPrinting(candidate, group.candidates);
      return;
    }
    setPendingAdd({ candidate, sourceLabel, missing });
  }

  return (
    <tbody>
      <tr className="border-b">
        <th
          scope="colgroup"
          colSpan={2}
          className="bg-violet-soft sticky left-0 z-10 px-3 py-2 text-left font-medium"
        >
          {group.title}
        </th>
        {columns.map((column) => {
          const cell = group.cells.find((entry) => entry.columnId === column.id);
          return (
            <td key={column.id} className="bg-violet-soft border-l px-3 py-2">
              {cell === undefined ? (
                <span className="text-muted-foreground text-xs">no row</span>
              ) : (
                <span>
                  {cell.summary}
                  {cell.rowCount > 1 && (
                    <span className="text-muted-foreground"> · {cell.rowCount} rows</span>
                  )}
                </span>
              )}
            </td>
          );
        })}
      </tr>
      <tr className="border-b">
        <td className="bg-background sticky left-0 z-10 space-x-2 px-3 py-2" colSpan={2}>
          <PrintingTargetMenu
            label="Link to existing…"
            size="sm"
            targets={context.printingTargets}
            onPick={(printingId) => actions.linkGroup(group.candidates, printingId)}
          />
          <Button variant="ghost" size="sm" onClick={() => setIgnoring(true)}>
            Ignore in all sources
          </Button>
        </td>
        {columns.map((column) => {
          const cell = group.cells.find((entry) => entry.columnId === column.id);
          const candidate =
            cell === undefined ? undefined : candidatesById.get(cell.candidatePrintingId);
          return (
            <td
              key={column.id}
              className={cn("border-l px-3 py-2", column.isTrusted && "bg-info-soft")}
            >
              {candidate !== undefined && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startAdd(candidate, column.label)}
                >
                  Add printing from {column.label}
                </Button>
              )}
            </td>
          );
        })}
      </tr>

      <CompareConfirmDialog
        open={ignoring}
        onOpenChange={setIgnoring}
        copy={{
          title: "Ignore these rows?",
          description: `Every source row under ${group.title} disappears from this card and stops counting toward review.`,
          confirmLabel: "Ignore rows",
        }}
        onConfirm={() => actions.ignoreRows(group.candidates)}
      />
      <CompareMissingFieldsDialog
        open={pendingAdd !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAdd(null);
          }
        }}
        sourceLabel={pendingAdd?.sourceLabel ?? ""}
        missing={pendingAdd?.missing ?? []}
        onConfirm={(overrides) => {
          const candidate = pendingAdd?.candidate;
          setPendingAdd(null);
          if (candidate !== undefined) {
            actions.addPrinting(candidate, group.candidates, overrides);
          }
        }}
      />
    </tbody>
  );
}

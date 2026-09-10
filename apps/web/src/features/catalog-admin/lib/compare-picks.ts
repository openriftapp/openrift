import type {
  AcceptCardField,
  AcceptPrintingField,
} from "@openrift/shared/contracts/admin/card-mutations";

import type {
  ComparableCardField,
  ComparablePrintingField,
} from "@/features/catalog-admin/lib/catalog-field-labels";
import type {
  CompareFieldRow,
  CompareModel,
  ComparePrintingBlock,
} from "@/features/catalog-admin/lib/compare-rows";

export interface CardFieldPick {
  field: AcceptCardField;
  value: unknown;
}

export interface PrintingFieldPick {
  printingId: string;
  field: AcceptPrintingField;
  value: unknown;
}

export interface ColumnPicks {
  cardFields: CardFieldPick[];
  printingFields: PrintingFieldPick[];
}

function differingCells<TField extends string>(
  rows: readonly CompareFieldRow<TField>[],
  columnId: string,
): { field: TField; value: unknown }[] {
  return rows.flatMap((row) => {
    const cell = row.cells.find((entry) => entry.columnId === columnId);
    if (cell === undefined || cell.state !== "different") {
      return [];
    }
    return [{ field: row.field, value: cell.value }];
  });
}

export function blockPrintingPicks(
  block: ComparePrintingBlock,
  columnId: string,
): PrintingFieldPick[] {
  return differingCells<ComparablePrintingField>(block.rows, columnId).map((pick) => ({
    printingId: block.printingId,
    ...pick,
  }));
}

export function columnPicks(model: CompareModel, columnId: string): ColumnPicks {
  return {
    cardFields: differingCells<ComparableCardField>(model.cardRows, columnId),
    printingFields: model.printingBlocks.flatMap((block) => blockPrintingPicks(block, columnId)),
  };
}

export function pickCount(picks: ColumnPicks): number {
  return picks.cardFields.length + picks.printingFields.length;
}

export type CompareAcceptTarget =
  | { kind: "card"; cardId: string; field: AcceptCardField }
  | { kind: "printing"; printingId: string; field: AcceptPrintingField };

export interface CompareUndo {
  target: CompareAcceptTarget;
  value: unknown;
  message: string;
}

export function buildUndo(
  target: CompareAcceptTarget,
  previousValue: unknown,
  fieldLabel: string,
  sourceLabel: string,
): CompareUndo {
  return {
    target,
    value: previousValue ?? null,
    message: `Used ${fieldLabel} from ${sourceLabel}`,
  };
}

import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";

import type { ComparableCardField } from "@/features/catalog-admin/lib/catalog-field-labels";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import type { CompareFieldRow, CompareOptionSets } from "@/features/catalog-admin/lib/compare-rows";
import { buildCompareModel } from "@/features/catalog-admin/lib/compare-rows";

export interface SourceDiffModel {
  columns: CompareColumn[];
  rows: CompareFieldRow<ComparableCardField>[];
}

export function buildSourceDiff(
  detail: AdminCardDetailResponse,
  columns: readonly CompareColumn[],
  optionSets: CompareOptionSets = {},
): SourceDiffModel {
  const rows = buildCompareModel(detail, columns, optionSets).cardRows.filter(
    (row) => row.differences > 0,
  );

  const differing = new Set(
    rows.flatMap((row) =>
      row.cells.filter((cell) => cell.state === "different").map((cell) => cell.columnId),
    ),
  );
  const keptColumns = columns.filter((column) => differing.has(column.id));
  const keptIds = new Set(keptColumns.map((column) => column.id));

  return {
    columns: keptColumns,
    rows: rows.map((row) => ({
      ...row,
      cells: row.cells.filter((cell) => keptIds.has(cell.columnId)),
    })),
  };
}

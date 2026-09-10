import {
  CompareSiteCell,
  CompareValueCell,
} from "@/features/catalog-admin/components/compare-cell";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import type { CompareCell, CompareFieldRow } from "@/features/catalog-admin/lib/compare-rows";

const MISSING_CELL: CompareCell = { columnId: "", value: null, state: "empty" };

export function CompareFieldRows<TField extends string>({
  rows,
  columns,
  onUse,
}: {
  rows: readonly CompareFieldRow<TField>[];
  columns: readonly CompareColumn[];
  onUse: (row: CompareFieldRow<TField>, column: CompareColumn) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.key} className="border-b">
          <th
            scope="row"
            className="bg-background sticky left-0 z-10 px-3 py-1.5 text-left align-top font-medium"
          >
            {row.label}
          </th>
          <CompareSiteCell row={row} />
          {columns.map((column) => (
            <CompareValueCell
              key={column.id}
              row={row}
              cell={row.cells.find((cell) => cell.columnId === column.id) ?? MISSING_CELL}
              isTrusted={column.isTrusted}
              isChecked={column.isChecked}
              onUse={() => onUse(row, column)}
            />
          ))}
        </tr>
      ))}
    </>
  );
}

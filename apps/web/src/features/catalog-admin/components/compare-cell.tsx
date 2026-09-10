import { Pressable } from "@/components/ui/pressable";
import { DiffText } from "@/features/admin/components/candidate-cell-display";
import { formatFieldValue } from "@/features/catalog-admin/lib/catalog-field-labels";
import type { CompareCell, CompareFieldRow } from "@/features/catalog-admin/lib/compare-rows";
import { textDiff } from "@/lib/text-diff";
import { cn } from "@/lib/utils";

function CellBody({ row, cell }: { row: CompareFieldRow; cell: CompareCell }) {
  if (
    row.isText &&
    cell.state === "different" &&
    typeof cell.value === "string" &&
    typeof row.siteValue === "string"
  ) {
    return <DiffText segments={textDiff(row.siteValue, cell.value)} />;
  }
  return <>{formatFieldValue(cell.value)}</>;
}

export function CompareSiteCell({ row }: { row: CompareFieldRow }) {
  return (
    <td className="bg-background sticky left-40 z-10 border-l px-3 py-1.5 align-top break-words">
      {formatFieldValue(row.siteValue)}
    </td>
  );
}

export function CompareValueCell({
  row,
  cell,
  isTrusted,
  isChecked,
  onUse,
}: {
  row: CompareFieldRow;
  cell: CompareCell;
  isTrusted: boolean;
  isChecked: boolean;
  onUse: () => void;
}) {
  const className = cn(
    "border-l align-top break-words",
    isTrusted && "bg-info-soft",
    isChecked && "opacity-50",
    cell.state === "invalid" && "bg-destructive-soft line-through",
    cell.state === "different" && "bg-warning-soft",
    cell.state !== "different" && "text-muted-foreground",
  );

  if (cell.state !== "different") {
    return (
      <td
        className={cn(className, "px-3 py-1.5")}
        title={
          cell.state === "invalid"
            ? `${formatFieldValue(cell.value)} is not an allowed ${row.label.toLowerCase()}`
            : undefined
        }
      >
        {cell.state === "empty" ? "—" : formatFieldValue(cell.value)}
      </td>
    );
  }

  return (
    <td className={cn(className, "p-0")}>
      <Pressable
        aria-label={`Use ${row.label} from this source`}
        className="hover:bg-warning/20 block w-full px-3 py-1.5"
        onClick={onUse}
      >
        <CellBody row={row} cell={cell} />
      </Pressable>
    </td>
  );
}

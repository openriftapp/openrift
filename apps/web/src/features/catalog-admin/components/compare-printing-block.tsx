import { Button } from "@/components/ui/button";
import { CompareFieldRows } from "@/features/catalog-admin/components/compare-field-rows";
import { CompareImageRow } from "@/features/catalog-admin/components/compare-image-row";
import { ComparePrintingSourceMenu } from "@/features/catalog-admin/components/compare-printing-source-menu";
import type { CompareActions, CompareContext } from "@/features/catalog-admin/lib/compare-actions";
import type { ComparePrintingBlock as ComparePrintingBlockModel } from "@/features/catalog-admin/lib/compare-rows";
import { visibleRows } from "@/features/catalog-admin/lib/compare-rows";
import { cn } from "@/lib/utils";

export function ComparePrintingBlock({
  block,
  context,
  actions,
}: {
  block: ComparePrintingBlockModel;
  context: CompareContext;
  actions: CompareActions;
}) {
  const { columns } = context;
  const expanded = context.expandedPrintingIds.has(block.printingId);

  if (block.differences === 0 && context.differencesOnly && !expanded) {
    return (
      <tbody>
        <tr className="border-b">
          <td className="text-muted-foreground px-3 py-1.5" colSpan={2 + columns.length}>
            <span className="bg-background sticky left-0 inline-flex items-center gap-1">
              {block.codeLabel} agrees with every source
              <Button
                variant="link"
                size="sm"
                onClick={() => context.toggleExpanded(block.printingId)}
              >
                show
              </Button>
            </span>
          </td>
        </tr>
      </tbody>
    );
  }

  const rows = visibleRows(block.rows, context.differencesOnly && !expanded);

  return (
    <tbody>
      <tr className="border-b">
        <th
          scope="colgroup"
          colSpan={2}
          className="bg-muted/30 sticky left-0 z-10 px-3 py-2 text-left font-medium"
        >
          <span className="flex items-center justify-between gap-2">
            {block.title}
            {block.differences === 0 && (
              <Button
                variant="link"
                size="sm"
                onClick={() => context.toggleExpanded(block.printingId)}
              >
                hide
              </Button>
            )}
          </span>
        </th>
        {columns.map((column) => {
          const candidateId = block.candidateByColumn[column.id];
          return (
            <td
              key={column.id}
              className={cn("bg-muted/30 border-l px-3 py-2", column.isTrusted && "bg-info-soft")}
            >
              {candidateId === undefined ? (
                <span className="text-muted-foreground text-xs">no row</span>
              ) : (
                <ComparePrintingSourceMenu
                  column={column}
                  block={block}
                  candidatePrintingId={candidateId}
                  targets={context.printingTargets}
                  actions={actions}
                />
              )}
            </td>
          );
        })}
      </tr>

      <CompareFieldRows
        rows={rows}
        columns={columns}
        onUse={(row, column) => actions.applyPrintingValue(block, row.key, column.id, column.label)}
      />

      <CompareImageRow
        imageRow={block.imageRow}
        columns={columns}
        onUseImage={(candidatePrintingId) =>
          actions.applySourceImage(candidatePrintingId, block.imageRow.activeImageId)
        }
      />
    </tbody>
  );
}

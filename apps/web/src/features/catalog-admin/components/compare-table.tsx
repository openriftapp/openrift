import { CompareColumnHeader } from "@/features/catalog-admin/components/compare-column-header";
import { CompareFieldRows } from "@/features/catalog-admin/components/compare-field-rows";
import { CompareOnlyInSourcesBlock } from "@/features/catalog-admin/components/compare-only-in-sources";
import { ComparePrintingBlock } from "@/features/catalog-admin/components/compare-printing-block";
import type { CompareActions, CompareContext } from "@/features/catalog-admin/lib/compare-actions";
import type { CompareModel } from "@/features/catalog-admin/lib/compare-rows";
import { visibleRows } from "@/features/catalog-admin/lib/compare-rows";

const SOURCE_COLUMN_WIDTH = 256;
const STICKY_COLUMNS_WIDTH = 160 + 224;

function BlockHeadingRow({ span, children }: { span: number; children: string }) {
  return (
    <tr className="border-b">
      <th scope="colgroup" colSpan={span} className="bg-muted/30 px-3 py-2 text-left font-medium">
        <span className="bg-muted/30 sticky left-0 inline-block">{children}</span>
      </th>
    </tr>
  );
}

export function CompareTable({
  model,
  context,
  actions,
}: {
  model: CompareModel;
  context: CompareContext;
  actions: CompareActions;
}) {
  const { columns } = context;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table
        className="table-fixed text-sm"
        style={{ width: STICKY_COLUMNS_WIDTH + SOURCE_COLUMN_WIDTH * columns.length }}
      >
        <thead>
          <tr className="border-b">
            <th scope="col" className="bg-muted sticky left-0 z-20 w-40 px-3 py-2 text-left">
              Field
            </th>
            <th
              scope="col"
              className="bg-muted sticky left-40 z-20 w-56 border-l px-3 py-2 text-left"
            >
              On the site
            </th>
            {columns.map((column) => (
              <CompareColumnHeader
                key={column.id}
                column={column}
                onUseAll={() => actions.applyAllFromColumn(column.id)}
                onMarkChecked={() => actions.markColumnChecked(column)}
                onHide={() => context.hideColumn(column.id)}
                onIgnore={() => actions.ignoreColumn(column)}
              />
            ))}
          </tr>
        </thead>

        <tbody>
          <BlockHeadingRow span={2 + columns.length}>Card fields</BlockHeadingRow>
          <CompareFieldRows
            rows={visibleRows(model.cardRows, context.differencesOnly)}
            columns={columns}
            onUse={(row, column) => actions.applyCardValue(row, column.id, column.label)}
          />
        </tbody>

        {model.printingBlocks.map((block) => (
          <ComparePrintingBlock
            key={block.printingId}
            block={block}
            context={context}
            actions={actions}
          />
        ))}

        {model.groupBlocks.length > 0 && (
          <tbody>
            <BlockHeadingRow span={2 + columns.length}>Only in sources</BlockHeadingRow>
          </tbody>
        )}
        {model.groupBlocks.map((group) => (
          <CompareOnlyInSourcesBlock
            key={group.key}
            group={group}
            context={context}
            actions={actions}
          />
        ))}
      </table>
    </div>
  );
}

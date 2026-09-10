import { Button } from "@/components/ui/button";
import type { CompareColumn } from "@/features/catalog-admin/lib/compare-columns";
import type { CompareImageRow as CompareImageRowModel } from "@/features/catalog-admin/lib/compare-rows";
import { cn } from "@/lib/utils";

function Thumbnail({ url, ringed }: { url: string; ringed?: boolean }) {
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn("h-20 w-auto rounded-md object-contain", ringed && "ring-primary ring-2")}
    />
  );
}

export function CompareImageRow({
  imageRow,
  columns,
  onUseImage,
}: {
  imageRow: CompareImageRowModel;
  columns: readonly CompareColumn[];
  onUseImage: (candidatePrintingId: string) => void;
}) {
  return (
    <tr className="border-b">
      <th
        scope="row"
        className="bg-background sticky left-0 z-10 px-3 py-1.5 text-left align-top font-medium"
      >
        Image
      </th>
      <td className="bg-background sticky left-40 z-10 border-l px-3 py-1.5 align-top">
        {imageRow.siteImageUrl === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Thumbnail url={imageRow.siteImageUrl} ringed />
        )}
      </td>
      {columns.map((column) => {
        const cell = imageRow.cells.find((entry) => entry.columnId === column.id);
        return (
          <td
            key={column.id}
            className={cn(
              "border-l px-3 py-1.5 align-top",
              column.isTrusted && "bg-info-soft",
              column.isChecked && "opacity-50",
            )}
          >
            {cell === undefined ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <div className="flex flex-col items-start gap-1">
                <Thumbnail url={cell.imageUrl} />
                {cell.isSameFile ? (
                  <span className="text-muted-foreground text-xs">same file</span>
                ) : (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => onUseImage(cell.candidatePrintingId)}
                  >
                    Use
                  </Button>
                )}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

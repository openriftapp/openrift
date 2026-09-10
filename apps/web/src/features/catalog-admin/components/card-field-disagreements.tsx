import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EditableCardField } from "@/features/catalog-admin/lib/card-field-form";
import { formatFieldValue } from "@/features/catalog-admin/lib/catalog-field-labels";
import type { SourceDiffModel } from "@/features/catalog-admin/lib/field-source-diff";
import { cn } from "@/lib/utils";

export function CardFieldDisagreements({
  diff,
  cardSlug,
  onUse,
}: {
  diff: SourceDiffModel;
  cardSlug: string;
  onUse: (field: EditableCardField, value: unknown) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Where sources disagree</h2>

      {diff.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Every source that has a value for these fields agrees with the site.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Field</TableHead>
                <TableHead className="w-52">On the site</TableHead>
                {diff.columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn("w-52", column.isTrusted && "bg-info-soft")}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      {column.label}
                      {column.isTrusted && <Badge variant="info">Trusted</Badge>}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {diff.rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="align-top font-medium">{row.label}</TableCell>
                  <TableCell className="align-top">{formatFieldValue(row.siteValue)}</TableCell>
                  {row.cells.map((cell) => (
                    <TableCell key={cell.columnId} className="align-top">
                      {cell.state === "different" ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="break-words">{formatFieldValue(cell.value)}</span>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => onUse(row.field, cell.value)}
                          >
                            Use
                          </Button>
                        </span>
                      ) : (
                        <span className="text-muted-foreground flex flex-wrap items-center gap-1.5">
                          {formatFieldValue(cell.value)}
                          {cell.state === "invalid" && <Badge variant="warning">Unknown</Badge>}
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-muted-foreground text-sm">
        A value taken here lands in the form above and is written when you save.{" "}
        <Link
          to="/admin/catalog/cards/$cardSlug"
          params={{ cardSlug }}
          search={{ tab: "compare" }}
          className="text-primary hover:underline"
        >
          Compare has the full grid
        </Link>
        , printings included.
      </p>
    </section>
  );
}

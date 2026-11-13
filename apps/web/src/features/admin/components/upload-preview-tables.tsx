import type { ReactNode } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_TABLE_CLASS } from "@/features/admin/lib/admin-table-styles";
import { EMPTY_VALUE_TEXT, formatRawValue } from "@/features/admin/lib/field-value-text";

interface UploadPreviewEntry {
  key: string;
  name: string;
  detail: string | null;
}

interface UploadPreviewChange {
  key: string;
  name: string;
  detail?: string | null;
  field: string;
  from: unknown;
  to: unknown;
}

function PreviewFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading as="h3" size="sm">
        {label}
      </SectionHeading>
      <div className="max-h-64 overflow-y-auto rounded-md border">
        <Table className={ADMIN_TABLE_CLASS}>{children}</Table>
      </div>
    </div>
  );
}

export function UploadEntryTable({
  label,
  detailHeader,
  entries,
}: {
  label: string;
  detailHeader: string;
  entries: readonly UploadPreviewEntry[];
}) {
  return (
    <PreviewFrame label={label}>
      <TableHeader className="bg-muted sticky top-0">
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>{detailHeader}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.key}>
            <TableCell className="font-medium">{entry.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {entry.detail ?? EMPTY_VALUE_TEXT}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </PreviewFrame>
  );
}

export function UploadDiffTable({
  label,
  detailHeader,
  changes,
}: {
  label: string;
  detailHeader?: string;
  changes: readonly UploadPreviewChange[];
}) {
  return (
    <PreviewFrame label={label}>
      <TableHeader className="bg-muted sticky top-0">
        <TableRow>
          <TableHead>Card</TableHead>
          {detailHeader !== undefined && <TableHead>{detailHeader}</TableHead>}
          <TableHead>Field</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {changes.map((change) => {
          const from = formatRawValue(change.from);
          const to = formatRawValue(change.to);
          return (
            <TableRow key={change.key}>
              <TableCell className="font-medium">{change.name}</TableCell>
              {detailHeader !== undefined && (
                <TableCell className="text-muted-foreground">
                  {change.detail ?? EMPTY_VALUE_TEXT}
                </TableCell>
              )}
              <TableCell>{change.field}</TableCell>
              <TableCell className="text-destructive max-w-48 truncate" title={from}>
                {from}
              </TableCell>
              <TableCell className="text-success max-w-48 truncate" title={to}>
                {to}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </PreviewFrame>
  );
}

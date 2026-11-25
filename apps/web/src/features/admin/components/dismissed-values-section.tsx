import type { DismissedValueRow } from "@openrift/shared/contracts/admin/card-mutations";
import { useQuery } from "@tanstack/react-query";
import { Undo2Icon } from "lucide-react";

import { Heading } from "@/components/heading";
import { PageDescription } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import {
  dismissedValuesQueryOptions,
  useRestoreCandidateValue,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  CARD_FIELD_LABELS,
  PRINTING_FIELD_LABELS,
} from "@/features/admin/lib/catalog-field-labels";

const FIELD_LABELS: Record<string, string> = {
  ...CARD_FIELD_LABELS,
  ...PRINTING_FIELD_LABELS,
  imageUrl: "Image",
};

function rowKey(row: DismissedValueRow): string {
  return `${row.kind}:${row.candidateId}:${row.field}`;
}

function ValueCell({ row }: AdminCellSlotProps<DismissedValueRow>) {
  if (!row) {
    return null;
  }
  if (row.field === "imageUrl" && typeof row.value === "string") {
    return (
      <TextLink href={row.value} target="_blank" rel="noreferrer" className="break-all">
        {row.value}
      </TextLink>
    );
  }
  return (
    <span className="break-words">
      {Array.isArray(row.value) ? row.value.join(", ") : String(row.value)}
    </span>
  );
}

function RestoreAction({ row }: AdminCellSlotProps<DismissedValueRow>) {
  const restore = useRestoreCandidateValue([adminKeys.dismissedValues, adminKeys.workspace]);
  if (!row) {
    return null;
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      pending={restore.isPending}
      onClick={() =>
        restore.mutate({ kind: row.kind, candidateId: row.candidateId, field: row.field })
      }
    >
      <Undo2Icon />
      Restore
    </Button>
  );
}

function TextCell({
  row,
  text,
}: AdminCellSlotProps<DismissedValueRow> & { text: (row: DismissedValueRow) => string }) {
  return row ? text(row) : null;
}

const fieldLabel = (row: DismissedValueRow) => FIELD_LABELS[row.field] ?? row.field;

const columns: AdminColumnDef<DismissedValueRow>[] = [
  {
    header: "Card",
    width: "w-56",
    sortValue: (row) => row.cardName,
    cell: <TextCell text={(row) => row.cardName} />,
  },
  {
    header: "Entry",
    width: "w-32",
    sortValue: (row) => row.shortCode ?? "",
    cell: <TextCell text={(row) => row.shortCode ?? "Card"} />,
  },
  {
    header: "Source",
    width: "w-40",
    sortValue: (row) => row.provider,
    cell: <TextCell text={(row) => row.provider} />,
  },
  { header: "Field", width: "w-40", sortValue: fieldLabel, cell: <TextCell text={fieldLabel} /> },
  { header: "Dismissed value", wrap: true, cell: <ValueCell /> },
];

export function DismissedValuesSection() {
  const { data } = useQuery(dismissedValuesQueryOptions);
  return (
    <section className="space-y-3">
      <Heading level={2}>Dismissed Suggestions</Heading>
      <PageDescription>
        A dismissed value stays hidden until its source reports a different one.
      </PageDescription>
      <AdminTable
        columns={columns}
        data={data?.items ?? []}
        getRowKey={rowKey}
        emptyText="No dismissed suggestions."
        actions={<RestoreAction />}
      />
    </section>
  );
}

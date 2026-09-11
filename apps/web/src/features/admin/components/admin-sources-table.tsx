import type { CatalogSource } from "@openrift/shared/contracts/admin/catalog-review";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { ListChecksIcon, LoaderIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import {
  useCheckProvider,
  useDeleteProvider,
} from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useReorderProviderSettings,
  useUpdateProviderSetting,
} from "@/features/admin/hooks/use-provider-settings";
import { flatReorder } from "@/features/admin/lib/admin-reorder";

function isContributors(source: CatalogSource): boolean {
  return source.kind === "contributors";
}

function SourceNameCell({ row }: AdminCellSlotProps<CatalogSource>) {
  if (!row) {
    return null;
  }
  if (isContributors(row)) {
    return (
      <div>
        <p className="font-medium">Contributors</p>
        <p className="text-muted-foreground text-xs">everyone who uses /contribute</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-medium">{row.provider}</p>
      <p className="text-muted-foreground text-xs">
        {row.lastUploadedAt === null
          ? "never uploaded"
          : `uploaded ${formatRelativeTime(row.lastUploadedAt)}`}
        {row.ignoredCount > 0 && ` · ${row.ignoredCount} ignored`}
      </p>
    </div>
  );
}

function CardRowsCell({ row }: AdminCellSlotProps<CatalogSource>) {
  return <span className="text-muted-foreground text-sm">{row?.rows ?? 0}</span>;
}

function PrintingRowsCell({ row }: AdminCellSlotProps<CatalogSource>) {
  return <span className="text-muted-foreground text-sm">{row?.printingRows ?? 0}</span>;
}

function ToReviewCell({ row }: AdminCellSlotProps<CatalogSource>) {
  const inReview = row?.inReview ?? 0;
  if (row === undefined || inReview === 0) {
    return <span className="text-muted-foreground text-sm">0</span>;
  }
  return (
    <Link
      to="/admin/review"
      search={isContributors(row) ? { filter: "contributors" } : { q: row.provider }}
      className="text-primary text-sm hover:underline"
    >
      {inReview}
    </Link>
  );
}

function SourceSwitch({
  source,
  field,
  checked,
  label,
}: {
  source: CatalogSource;
  field: "isHidden" | "isFavorite" | "helperReviewable";
  checked: boolean;
  label: string;
}) {
  const updateSetting = useUpdateProviderSetting();

  return (
    <Switch
      checked={checked}
      aria-label={label}
      onCheckedChange={(next) => {
        updateSetting.mutate({
          provider: source.provider,
          [field]: field === "isHidden" ? !next : next,
        });
      }}
    />
  );
}

function ShowInReviewCell({ row }: AdminCellSlotProps<CatalogSource>) {
  if (!row) {
    return null;
  }
  return (
    <SourceSwitch
      source={row}
      field="isHidden"
      checked={!row.isHidden}
      label={`Show ${row.provider} in review`}
    />
  );
}

function TrustedCell({ row }: AdminCellSlotProps<CatalogSource>) {
  if (!row) {
    return null;
  }
  return (
    <SourceSwitch
      source={row}
      field="isFavorite"
      checked={row.isFavorite}
      label={`Trust ${row.provider}`}
    />
  );
}

function HelpersCanReviewCell({ row }: AdminCellSlotProps<CatalogSource>) {
  if (!row) {
    return null;
  }
  return (
    <SourceSwitch
      source={row}
      field="helperReviewable"
      checked={row.helperReviewable}
      label={`Let helpers review ${row.provider}`}
    />
  );
}

function CheckAllAction({ row }: AdminCellSlotProps<CatalogSource>) {
  const checkProvider = useCheckProvider();

  if (!row || isContributors(row) || row.uncheckedRows === 0) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={checkProvider.isPending}
      onClick={() =>
        checkProvider.mutate(row.provider, {
          onSuccess: (result) => {
            toast.success(
              `Checked ${result.cardsChecked} cards and ${result.printingsChecked} printings`,
            );
          },
        })
      }
    >
      {checkProvider.isPending ? <LoaderIcon className="animate-spin" /> : <ListChecksIcon />}
      Mark all checked
    </Button>
  );
}

const sourceColumns: AdminColumnDef<CatalogSource>[] = [
  { header: "Source", cell: <SourceNameCell /> },
  { header: "Cards", width: "w-20", align: "right", cell: <CardRowsCell /> },
  { header: "Printings", width: "w-24", align: "right", cell: <PrintingRowsCell /> },
  { header: "To review", width: "w-24", cell: <ToReviewCell /> },
  { header: "Show in review", width: "w-32", cell: <ShowInReviewCell /> },
  { header: "Trusted", width: "w-24", cell: <TrustedCell /> },
  { header: "Helpers can review", width: "w-40", cell: <HelpersCanReviewCell /> },
];

export function AdminSourcesTable({ sources }: { sources: readonly CatalogSource[] }) {
  const reorderSettings = useReorderProviderSettings();
  const deleteProvider = useDeleteProvider();

  const uploads = sources
    .filter((source) => !isContributors(source))
    .toSorted((a, b) => a.sortOrder - b.sortOrder || a.provider.localeCompare(b.provider, "en"));
  const rows = [...sources.filter((source) => isContributors(source)), ...uploads];

  return (
    <AdminTable
      columns={sourceColumns}
      data={rows}
      getRowKey={(row) => row.provider}
      emptyText="No sources yet."
      pinned={isContributors}
      reorderSteppers={false}
      reorder={{
        moves: flatReorder(uploads, (source) => source.provider),
        onReorder: (keys) => reorderSettings.mutateAsync(keys),
        isPending: reorderSettings.isPending,
      }}
      delete={{
        canDelete: (row) => !isContributors(row),
        onDelete: (row) => deleteProvider.mutateAsync(row.provider),
        confirm: (row) => ({
          title: `Delete every row from “${row.provider}”?`,
          description: `This permanently removes the ${row.rows} cards and ${row.printingRows} printings stored for “${row.provider}”. This cannot be undone.`,
        }),
      }}
      actions={<CheckAllAction />}
    />
  );
}

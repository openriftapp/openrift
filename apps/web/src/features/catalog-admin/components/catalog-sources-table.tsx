import type { CatalogSource } from "@openrift/shared/contracts/admin/catalog-review";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { ListChecksIcon, LoaderIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/features/admin/components/admin-table-delete-button";
import {
  ReorderProvider,
  ReorderableRow,
} from "@/features/admin/components/admin-table-reorder-row";
import {
  useCheckProvider,
  useDeleteProvider,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminReorder } from "@/features/admin/hooks/use-admin-reorder";
import {
  useReorderProviderSettings,
  useUpdateProviderSetting,
} from "@/features/admin/hooks/use-provider-settings";
import { flatReorder } from "@/features/admin/lib/admin-reorder";

export interface SourceSwitchChange {
  provider: string;
  isHidden?: boolean;
  isFavorite?: boolean;
  helperReviewable?: boolean;
}

function SourceSwitch({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(next) => onChange(next)}
    />
  );
}

function SourceName({ source }: { source: CatalogSource }) {
  if (source.kind === "contributors") {
    return (
      <div>
        <p className="font-medium">Contributors</p>
        <p className="text-muted-foreground text-xs">everyone who uses /contribute</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-medium">{source.provider}</p>
      <p className="text-muted-foreground text-xs">
        {source.lastUploadedAt === null
          ? "never uploaded"
          : `uploaded ${formatRelativeTime(source.lastUploadedAt)}`}
        {source.ignoredCount > 0 && ` · ${source.ignoredCount} ignored`}
      </p>
    </div>
  );
}

function InReviewCell({ source }: { source: CatalogSource }) {
  if (source.inReview === 0) {
    return <span className="text-muted-foreground text-sm">0</span>;
  }
  return (
    <Link
      to="/admin/catalog/review"
      search={
        source.kind === "contributors"
          ? { filter: "contributors" as const }
          : { q: source.provider }
      }
      className="text-primary text-sm hover:underline"
    >
      {source.inReview}
    </Link>
  );
}

function SourceActions({
  source,
  canEdit,
  onUploadAgain,
}: {
  source: CatalogSource;
  canEdit: boolean;
  onUploadAgain: (provider: string) => void;
}) {
  const checkProvider = useCheckProvider();
  const deleteProvider = useDeleteProvider();
  const [deleteError, setDeleteError] = useState("");

  if (!canEdit || source.kind === "contributors") {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => onUploadAgain(source.provider)}>
        <UploadIcon />
        Upload again
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={checkProvider.isPending}
        onClick={() =>
          checkProvider.mutate(source.provider, {
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
      <DeleteButton
        row={source}
        deleteError={deleteError}
        setDeleteError={setDeleteError}
        config={{
          onDelete: (row) => deleteProvider.mutateAsync(row.provider),
          confirm: (row) => ({
            title: `Delete every row from “${row.provider}”?`,
            description: `This permanently removes the ${row.rows} cards and ${row.printingRows} printings stored for “${row.provider}”. This cannot be undone.`,
          }),
        }}
      />
    </div>
  );
}

function SourceCells({
  source,
  canEdit,
  onSwitch,
  onUploadAgain,
}: {
  source: CatalogSource;
  canEdit: boolean;
  onSwitch: (change: SourceSwitchChange) => void;
  onUploadAgain: (provider: string) => void;
}) {
  return (
    <>
      <TableCell>
        <SourceName source={source} />
      </TableCell>
      <TableCell className="text-muted-foreground text-right text-sm">{source.rows}</TableCell>
      <TableCell className="text-muted-foreground text-right text-sm">
        {source.printingRows}
      </TableCell>
      <TableCell>
        <InReviewCell source={source} />
      </TableCell>
      <TableCell>
        <SourceSwitch
          checked={!source.isHidden}
          disabled={!canEdit}
          label={`Show ${source.provider} in review`}
          onChange={(next) => onSwitch({ provider: source.provider, isHidden: !next })}
        />
      </TableCell>
      <TableCell>
        <SourceSwitch
          checked={source.isFavorite}
          disabled={!canEdit}
          label={`Trust ${source.provider}`}
          onChange={(next) => onSwitch({ provider: source.provider, isFavorite: next })}
        />
      </TableCell>
      <TableCell>
        <SourceSwitch
          checked={source.helperReviewable}
          disabled={!canEdit}
          label={`Let helpers review ${source.provider}`}
          onChange={(next) => onSwitch({ provider: source.provider, helperReviewable: next })}
        />
      </TableCell>
      <TableCell>
        <SourceActions source={source} canEdit={canEdit} onUploadAgain={onUploadAgain} />
      </TableCell>
    </>
  );
}

export function CatalogSourcesTable({
  sources,
  canEdit,
  onUploadAgain,
}: {
  sources: readonly CatalogSource[];
  canEdit: boolean;
  onUploadAgain: (provider: string) => void;
}) {
  const updateSetting = useUpdateProviderSetting();
  const reorderSettings = useReorderProviderSettings();

  const contributors = sources.find((source) => source.kind === "contributors");
  const uploads = sources
    .filter((source) => source.kind !== "contributors")
    .toSorted((a, b) => a.sortOrder - b.sortOrder || a.provider.localeCompare(b.provider, "en"));
  const byProvider = new Map(uploads.map((source) => [source.provider, source]));
  const rowKeys = uploads.map((source) => source.provider);
  const moves = flatReorder(uploads, (source) => source.provider);

  const {
    sensors,
    orderedKeys,
    locked,
    commitReorder,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useAdminReorder({
    reorder: {
      moves,
      onReorder: (keys) => reorderSettings.mutateAsync(keys),
      isPending: reorderSettings.isPending,
    },
    rowKeys,
  });

  const ordered = orderedKeys
    .map((key) => byProvider.get(key))
    .filter((source): source is CatalogSource => source !== undefined);

  function handleSwitch(change: SourceSwitchChange) {
    updateSetting.mutate(change);
  }

  return (
    <div className="bg-card ring-border overflow-hidden rounded-lg ring-1">
      <Table className="min-w-[960px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-28" />
            <TableHead>Source</TableHead>
            <TableHead className="w-20 text-right">Cards</TableHead>
            <TableHead className="w-24 text-right">Printings</TableHead>
            <TableHead className="w-24">In review</TableHead>
            <TableHead className="w-32">Show in review</TableHead>
            <TableHead className="w-24">Trusted</TableHead>
            <TableHead className="w-40">Helpers can review</TableHead>
            <TableHead className="w-72" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contributors && (
            <TableRow>
              <TableCell />
              <SourceCells
                source={contributors}
                canEdit={canEdit}
                onSwitch={handleSwitch}
                onUploadAgain={onUploadAgain}
              />
            </TableRow>
          )}
          <ReorderProvider
            enabled={canEdit && ordered.length > 1}
            sensors={sensors}
            items={orderedKeys}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {ordered.map((source, index) => (
              <ReorderableRow
                key={source.provider}
                id={source.provider}
                locked={locked || !canEdit}
                droppable
                canMoveUp={index > 0}
                canMoveDown={index < ordered.length - 1}
                onMove={(direction) => {
                  void commitReorder(moves.step(source.provider, direction));
                }}
              >
                <SourceCells
                  source={source}
                  canEdit={canEdit}
                  onSwitch={handleSwitch}
                  onUploadAgain={onUploadAgain}
                />
              </ReorderableRow>
            ))}
          </ReorderProvider>
          {ordered.length === 0 && !contributors && (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground py-6 text-center">
                No sources yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

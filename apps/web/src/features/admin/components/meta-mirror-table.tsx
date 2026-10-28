import type { MetaSource } from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDay, formatDayTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { ArchiveXIcon, CheckIcon, DownloadIcon, LayersIcon, UndoIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { ConfirmActionButton, ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextLink } from "@/components/ui/text-link";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { announceSyncTrigger } from "@/features/admin/components/meta-catalog-shared";
import {
  useBulkPublishMirror,
  useBulkRejectMirror,
  useBulkRestoreMirror,
  useBulkUnpublishMirror,
  useCollectMirrorRow,
  usePublishMirrorRow,
  useRejectMirrorRow,
  useRestoreMirrorRow,
} from "@/features/admin/hooks/use-admin-meta-mirror";
import type { MetaMirrorRow } from "@/features/admin/lib/meta-mirror-rows";
import { RESULTS_DISPLAY } from "@/features/admin/lib/meta-mirror-view";
import {
  isMirrorRowSelected,
  selectedMirrorKeys,
  useMetaMirrorSelectionStore,
} from "@/features/admin/stores/meta-mirror-selection-store";
import { catalogTriageDisplay } from "@/features/meta/lib/meta-catalog-display";

function SelectCell({ row, scope }: AdminCellSlotProps<MetaMirrorRow> & { scope: string }) {
  const key = row?.key ?? "";
  const selected = useMetaMirrorSelectionStore((state) => isMirrorRowSelected(state, scope, key));
  const toggle = useMetaMirrorSelectionStore((state) => state.toggle);
  if (!row) {
    return null;
  }
  return (
    <Checkbox
      checked={selected}
      onCheckedChange={() => toggle(scope, row.key)}
      aria-label={`Select ${row.name}`}
    />
  );
}

function DateCell({ row }: AdminCellSlotProps<MetaMirrorRow>) {
  if (!row || row.startAt === null) {
    return null;
  }
  return (
    <span className="tabular-nums">
      {row.startIsDay ? formatDay(row.startAt) : formatDayTime(row.startAt)}
    </span>
  );
}

function EventCell({ row }: AdminCellSlotProps<MetaMirrorRow>) {
  if (!row) {
    return null;
  }
  return (
    <div className="min-w-40">
      <TextLink
        variant="inherit"
        className="font-medium"
        href={row.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        {row.name}
      </TextLink>
      {row.venue !== null && (
        <div className="text-muted-foreground line-clamp-1 text-xs" title={row.venue}>
          {row.venue}
        </div>
      )}
    </div>
  );
}

function PlayersCell({ row }: AdminCellSlotProps<MetaMirrorRow>) {
  if (!row) {
    return null;
  }
  if (row.players === null) {
    return <span className="text-muted-foreground">Not given</span>;
  }
  return (
    <span className="tabular-nums">
      {row.players.toLocaleString()}
      {row.capacity !== null && (
        <span className="text-muted-foreground block text-xs">of {row.capacity} places</span>
      )}
    </span>
  );
}

function AtSourceCell({ row }: AdminCellSlotProps<MetaMirrorRow>) {
  if (!row) {
    return null;
  }
  return (
    <div className="flex max-w-72 flex-wrap items-center gap-1.5">
      {row.atSource !== null && <Badge variant={row.atSource.variant}>{row.atSource.label}</Badge>}
      {row.badges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant} title={badge.title}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

function ArchiveCell({ row }: AdminCellSlotProps<MetaMirrorRow>) {
  if (!row) {
    return null;
  }
  const triage = catalogTriageDisplay(row.triage);
  return <Badge variant={triage.variant}>{triage.label}</Badge>;
}

function ResultsCell({ row }: AdminCellSlotProps<MetaMirrorRow>) {
  if (!row || row.results === null) {
    return null;
  }
  const results = RESULTS_DISPLAY[row.results];
  const detail = [
    ...row.resultsDetail,
    ...(row.nextCheckAt === null ? [] : [`next check ${formatDayTime(row.nextCheckAt)}`]),
  ].join(", ");
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={results.variant}>{results.label}</Badge>
      {detail !== "" && <span className="text-muted-foreground text-xs">{detail}</span>}
    </div>
  );
}

export function mirrorColumns(scope: string | null): AdminColumnDef<MetaMirrorRow>[] {
  return [
    ...(scope === null
      ? []
      : [{ header: "Select", width: "w-10", cell: <SelectCell scope={scope} /> }]),
    {
      header: "Date (UTC)",
      width: "w-36",
      sortKey: "startAt",
      sortFirst: "desc",
      cell: <DateCell />,
    },
    { header: "Event", sortKey: "name", wrap: true, cell: <EventCell /> },
    {
      header: "Players",
      align: "right",
      width: "w-24",
      sortKey: "playerCount",
      sortFirst: "desc",
      cell: <PlayersCell />,
    },
    { header: "At the source", wrap: true, cell: <AtSourceCell /> },
    { header: "Archive", width: "w-28", cell: <ArchiveCell /> },
    { header: "Results", wrap: true, cell: <ResultsCell /> },
  ];
}

function RowActionsFor({
  row,
  onPickFormat,
}: {
  row: MetaMirrorRow;
  onPickFormat: (row: MetaMirrorRow) => void;
}) {
  const publish = usePublishMirrorRow();
  const reject = useRejectMirrorRow();
  const restore = useRestoreMirrorRow();
  const collect = useCollectMirrorRow();
  const target = { source: row.source, key: row.key };

  if (row.triage === "dismissed") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={restore.isPending}
        onClick={() => restore.mutate(target)}
      >
        <UndoIcon />
        Restore
      </Button>
    );
  }

  if (row.triage === "accepted") {
    return (
      <>
        {row.collects && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Collect results"
            title="Collect results"
            disabled={collect.isPending}
            onClick={() =>
              collect.mutate(target, {
                onSuccess: (result) => announceSyncTrigger("Collect results", result),
              })
            }
          >
            <DownloadIcon />
          </Button>
        )}
        {row.metaEventId !== null && (
          <Link
            to="/admin/meta/$eventId"
            params={{ eventId: row.metaEventId }}
            aria-label="Open event"
            title="Open event"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <LayersIcon />
          </Link>
        )}
      </>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={publish.isPending}
        onClick={() => {
          if (row.unmappedFormat !== null) {
            onPickFormat(row);
            return;
          }
          publish.mutate(target, { onSuccess: () => toast.success(`Published "${row.name}"`) });
        }}
      >
        <CheckIcon />
        Publish
      </Button>
      <ConfirmActionButton
        title={`Reject "${row.name}"?`}
        description="Refresh mirror will not offer it again. You can restore it under Rejected."
        confirmLabel="Reject"
        onConfirm={() => reject.mutateAsync(target)}
      >
        <ArchiveXIcon />
        Reject
      </ConfirmActionButton>
    </>
  );
}

// The React Compiler bails on a function declared after a return, so the row-null guard sits in a wrapper.
export function MirrorRowActions({
  row,
  onPickFormat,
}: AdminCellSlotProps<MetaMirrorRow> & { onPickFormat: (row: MetaMirrorRow) => void }) {
  if (!row) {
    return null;
  }
  return <RowActionsFor row={row} onPickFormat={onPickFormat} />;
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

export function MirrorSelectionBar({
  source,
  scope,
  mode,
  pageKeys,
}: {
  source: MetaSource;
  scope: string;
  mode: "decide" | "restore";
  pageKeys: string[];
}) {
  const keys = useMetaMirrorSelectionStore(useShallow((state) => selectedMirrorKeys(state, scope)));
  const setAll = useMetaMirrorSelectionStore((state) => state.setAll);
  const clear = useMetaMirrorSelectionStore((state) => state.clear);
  const publish = useBulkPublishMirror();
  const reject = useBulkRejectMirror();
  const restore = useBulkRestoreMirror();
  const unpublish = useBulkUnpublishMirror();
  const [confirm, setConfirm] = useState<"publish" | "reject" | null>(null);

  const count = keys.length;
  const allPicked = count === pageKeys.length && count > 0;

  function runPublish() {
    publish.mutate(
      { source, keys },
      {
        onSuccess: ({ published, skipped }) => {
          setConfirm(null);
          clear();
          toast.success(`Published ${plural(published.length, "event")}`, {
            description:
              skipped > 0
                ? `${plural(skipped, "event")} skipped: no longer undecided, or the format needs a pick.`
                : undefined,
            action:
              published.length > 0
                ? {
                    label: "Undo",
                    onClick: () =>
                      unpublish.mutate(
                        { source, keys: published },
                        {
                          onSuccess: ({ unpublished, kept }) =>
                            toast.success(`Unpublished ${plural(unpublished, "event")}`, {
                              description:
                                kept > 0
                                  ? `${plural(kept, "event")} already has standings. Remove those on their event page.`
                                  : undefined,
                            }),
                        },
                      ),
                  }
                : undefined,
          });
        },
      },
    );
  }

  function runReject() {
    reject.mutate(
      { source, keys },
      {
        onSuccess: ({ rejected }) => {
          setConfirm(null);
          clear();
          toast.success(`Rejected ${plural(rejected.length, "event")}`, {
            action:
              rejected.length > 0
                ? {
                    label: "Undo",
                    onClick: () => restore.mutate({ source, keys: rejected }),
                  }
                : undefined,
          });
        },
      },
    );
  }

  return (
    <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg px-3 py-2">
      <Checkbox
        checked={allPicked}
        indeterminate={count > 0 && !allPicked}
        onCheckedChange={(checked) => (checked ? setAll(scope, pageKeys) : clear())}
        aria-label="Select every event on this page"
      />
      <span className="text-sm font-medium">
        {count === 0 ? "Select events on this page" : `${count.toLocaleString()} selected`}
      </span>
      {count > 0 && mode === "decide" && (
        <>
          <Button size="sm" onClick={() => setConfirm("publish")}>
            Publish {count}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm("reject")}>
            Reject {count}
          </Button>
        </>
      )}
      {count > 0 && mode === "restore" && (
        <Button
          size="sm"
          pending={restore.isPending}
          onClick={() =>
            restore.mutate(
              { source, keys },
              {
                onSuccess: ({ restored }) => {
                  clear();
                  toast.success(`Restored ${plural(restored, "event")}`);
                },
              },
            )
          }
        >
          Restore {count}
        </Button>
      )}
      {count > 0 && (
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
      )}
      <ConfirmActionDialog
        open={confirm === "publish"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Publish ${plural(count, "event")}?`}
        description="Each one gets a page on the public archive and its results are collected. You can undo right after."
        confirmLabel={`Publish ${count}`}
        isPending={publish.isPending}
        onConfirm={runPublish}
      />
      <ConfirmActionDialog
        open={confirm === "reject"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Reject ${plural(count, "event")}?`}
        description="Refresh mirror will not offer them again. You can restore them under Rejected, or undo right after."
        confirmLabel={`Reject ${count}`}
        destructive
        isPending={reject.isPending}
        onConfirm={runReject}
      />
    </div>
  );
}

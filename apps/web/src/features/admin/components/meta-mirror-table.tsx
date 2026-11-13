import type { MetaSource } from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDay, formatDayTime } from "@openrift/shared/format-date";
import { countNoun } from "@openrift/shared/strings";
import { Link } from "@tanstack/react-router";
import { ArchiveXIcon, CheckIcon, DownloadIcon, LayersIcon, UndoIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { ConfirmActionButton, ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { SelectAllCheckbox, selectColumn } from "@/features/admin/components/admin-row-select";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
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
import {
  announceSyncTrigger,
  catalogTriageDisplay,
} from "@/features/admin/lib/meta-catalog-display";
import type { MetaMirrorRow } from "@/features/admin/lib/meta-mirror-rows";
import { RESULTS_DISPLAY } from "@/features/admin/lib/meta-mirror-view";
import { selectionSummary } from "@/features/admin/lib/selection-summary";
import { selectedRowKeys, mirrorSelectionStore } from "@/features/admin/stores/row-selection-store";
import { formatCount } from "@/lib/format";
import { runReportedMutation } from "@/lib/run-reported-mutation";

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
      {formatCount(row.players)}
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
      : [
          selectColumn<MetaMirrorRow>(mirrorSelectionStore, {
            scope,
            rowKey: (row) => row.key,
            rowLabel: (row) => row.name,
          }),
        ]),
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
  const [publishing, setPublishing] = useState(false);
  const target = { source: row.source, key: row.key };

  async function publishRow() {
    setPublishing(true);
    const published = await runReportedMutation(() => publish.mutateAsync(target));
    setPublishing(false);
    if (published) {
      toast.success(`Published "${row.name}"`);
    }
  }

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
        disabled={publishing}
        onClick={() => {
          if (row.unmappedFormat !== null) {
            onPickFormat(row);
            return;
          }
          void publishRow();
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
  const keys = useStore(
    mirrorSelectionStore,
    useShallow((state) => selectedRowKeys(state, scope)),
  );
  const clear = useStore(mirrorSelectionStore, (state) => state.clear);
  const publish = useBulkPublishMirror();
  const reject = useBulkRejectMirror();
  const restore = useBulkRestoreMirror();
  const unpublish = useBulkUnpublishMirror();
  const [confirm, setConfirm] = useState<"publish" | "reject" | null>(null);

  const count = keys.length;

  function runPublish() {
    publish.mutate(
      { source, keys },
      {
        onSuccess: ({ published, skipped }) => {
          setConfirm(null);
          clear();
          toast.success(`Published ${countNoun(published.length, "event")}`, {
            description:
              skipped > 0
                ? `${countNoun(skipped, "event")} skipped: no longer undecided, or the format needs a pick.`
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
                            toast.success(`Unpublished ${countNoun(unpublished, "event")}`, {
                              description:
                                kept > 0
                                  ? `${countNoun(kept, "event")} already has standings. Remove those on their event page.`
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
        onSuccess: ({ rejected, skipped }) => {
          setConfirm(null);
          clear();
          toast.success(`Rejected ${countNoun(rejected.length, "event")}`, {
            description:
              skipped > 0
                ? `${countNoun(skipped, "event")} skipped: no longer undecided.`
                : undefined,
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
      <SelectAllCheckbox
        store={mirrorSelectionStore}
        scope={scope}
        keys={pageKeys}
        label="Select every event on this page"
      />
      <span className="text-sm font-medium">
        {count === 0 ? "Select events on this page" : selectionSummary(count, 0)}
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
                  toast.success(`Restored ${countNoun(restored, "event")}`);
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
        title={`Publish ${countNoun(count, "event")}?`}
        description="Each one gets a page on the public archive and its results are collected. You can undo right after."
        confirmLabel={`Publish ${count}`}
        isPending={publish.isPending}
        onConfirm={runPublish}
      />
      <ConfirmActionDialog
        open={confirm === "reject"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Reject ${countNoun(count, "event")}?`}
        description="Refresh mirror will not offer them again. You can restore them under Rejected, or undo right after."
        confirmLabel={`Reject ${count}`}
        destructive
        isPending={reject.isPending}
        onConfirm={runReject}
      />
    </div>
  );
}

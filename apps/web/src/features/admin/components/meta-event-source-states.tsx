import type { AdminMetaSourceState } from "@openrift/shared/contracts/admin/meta";
import { formatDayTime } from "@openrift/shared/format-date";
import type { AdminMetaEvent } from "@openrift/shared/types/api/meta";
import { useNavigate } from "@tanstack/react-router";
import { DownloadIcon, Trash2Icon } from "lucide-react";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";
import {
  useMetaEventSourceStates,
  useRemoveMetaEvent,
} from "@/features/admin/hooks/use-admin-meta";
import { useCollectMirrorRow } from "@/features/admin/hooks/use-admin-meta-mirror";
import { announceSyncTrigger, META_SOURCE_LABELS } from "@/features/admin/lib/meta-catalog-display";
import {
  cancelledAtSourceText,
  sourceStateLifecycle,
} from "@/features/admin/lib/meta-event-source-state";
import { RESULTS_DISPLAY } from "@/features/admin/lib/meta-mirror-view";

function SourceCell({ row: state }: AdminCellSlotProps<AdminMetaSourceState>) {
  if (!state) {
    return null;
  }
  return <span className="font-medium">{META_SOURCE_LABELS[state.provider]}</span>;
}

function AtSourceCell({ row: state }: AdminCellSlotProps<AdminMetaSourceState>) {
  if (!state) {
    return null;
  }
  const lifecycle = sourceStateLifecycle(state);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lifecycle !== null && <Badge variant={lifecycle.variant}>{lifecycle.label}</Badge>}
      {state.missingSince !== null && (
        <Badge variant="destructive" title={`${formatDayTime(state.missingSince)} UTC`}>
          Gone from the source
        </Badge>
      )}
    </div>
  );
}

function ResultsCell({ row: state }: AdminCellSlotProps<AdminMetaSourceState>) {
  if (!state) {
    return null;
  }
  const results = RESULTS_DISPLAY[state.results];
  return (
    <>
      <Badge variant={results.variant}>{results.label}</Badge>
      {state.nextCheckAt !== null && (
        <span className="text-muted-foreground block text-xs">
          Next check {formatDayTime(state.nextCheckAt)}
        </span>
      )}
    </>
  );
}

function CollectAction({ row: state }: AdminCellSlotProps<AdminMetaSourceState>) {
  const collect = useCollectMirrorRow();
  if (!state || !state.collects) {
    return null;
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={collect.isPending}
      onClick={() =>
        collect.mutate(
          { source: state.provider, key: state.externalId },
          { onSuccess: (result) => announceSyncTrigger("Collect results", result) },
        )
      }
    >
      <DownloadIcon />
      Collect results
    </Button>
  );
}

export function MetaEventSourceStates({ eventId }: { eventId: string }) {
  const { data } = useMetaEventSourceStates(eventId);
  if (data === undefined || data.sources.length === 0) {
    return null;
  }
  return (
    <div className="overflow-x-auto">
      <AdminTable
        bare
        columns={[
          { header: "Source", cell: <SourceCell /> },
          { header: "At the source", cell: <AtSourceCell /> },
          { header: "Results (UTC)", cell: <ResultsCell /> },
        ]}
        data={data.sources}
        getRowKey={(state) => `${state.provider}:${state.externalId}`}
        actions={<CollectAction />}
      />
    </div>
  );
}

export function MetaEventCancelledBanner({ event }: { event: AdminMetaEvent }) {
  const { data } = useMetaEventSourceStates(event.id);
  const removeEvent = useRemoveMetaEvent();
  const navigate = useNavigate();
  const cancelled = data?.sources.find((state) => state.cancelled);
  if (cancelled === undefined) {
    return null;
  }
  const others = event.sources.filter(
    (source) => source.provider !== null && source.provider !== cancelled.provider,
  ).length;
  return (
    <Alert variant="warning">
      <AlertTitle>{META_SOURCE_LABELS[cancelled.provider]} cancelled this event</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{cancelledAtSourceText(cancelled, event.playerRowCount, others)}</span>
        <ConfirmActionButton
          title={`Remove "${event.name}" from the archive?`}
          description="Its source rows move to Rejected, so no refresh publishes it again."
          confirmLabel="Remove"
          destructive
          onConfirm={async () => {
            await removeEvent.mutateAsync(event.id);
            await navigate({ to: "/admin/meta", search: { tab: "public" } });
          }}
          trigger={<Button variant="destructive" size="sm" />}
        >
          <Trash2Icon />
          Remove from archive
        </ConfirmActionButton>
      </AlertDescription>
    </Alert>
  );
}

import type { PlayriftboundCatalogRow } from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDay, formatRelativeTime } from "@openrift/shared/format-date";
import { playriftboundFormatLabel } from "@openrift/shared/playriftbound-links";
import { META_CATALOG_SORTS } from "@openrift/shared/types/enums";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArchiveXIcon,
  CheckIcon,
  DownloadIcon,
  LayersIcon,
  SlidersHorizontalIcon,
  UndoIcon,
} from "lucide-react";
import { useState } from "react";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { PageTopBarButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { TextLink } from "@/components/ui/text-link";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { MetaAutoAcceptDialog } from "@/features/admin/components/meta-auto-accept-dialog";
import { announceSyncTrigger } from "@/features/admin/components/meta-catalog-shared";
import { urlTriage } from "@/features/admin/components/meta-triage-filter";
import { PlayriftboundCatalogFilters } from "@/features/admin/components/playriftbound-catalog-filters";
import type { PlayriftboundCatalogParams } from "@/features/admin/hooks/use-admin-playriftbound-catalog";
import {
  PLAYRIFTBOUND_CATALOG_PAGE_SIZE,
  useAcceptPlayriftboundEvent,
  useAdminPlayriftboundCatalog,
  useDismissPlayriftboundEvent,
  useFetchPlayriftboundEvent,
  useUndismissPlayriftboundEvent,
} from "@/features/admin/hooks/use-admin-playriftbound-catalog";
import { urlTableSort, useUrlTableFilters } from "@/features/admin/hooks/use-url-table-filters";
import {
  catalogTriageDisplay,
  playriftboundRoundsText,
  playriftboundTypeLabel,
} from "@/features/meta/lib/meta-catalog-display";
import { useMountedAt } from "@/hooks/use-mounted-at";

const routeApi = getRouteApi("/_app/_authenticated/admin/meta");

function DateCell({ row }: AdminCellSlotProps<PlayriftboundCatalogRow>) {
  return <span className="tabular-nums">{row ? formatDay(row.startAt) : "—"}</span>;
}

function NameCell({ row }: AdminCellSlotProps<PlayriftboundCatalogRow>) {
  if (!row) {
    return null;
  }
  return (
    <TextLink
      variant="inherit"
      className="font-medium"
      href={row.sourceUrl}
      target="_blank"
      rel="noreferrer"
      title="Open the source's page for this event"
    >
      {row.name}
    </TextLink>
  );
}

function TypeCell({ row }: AdminCellSlotProps<PlayriftboundCatalogRow>) {
  if (!row) {
    return null;
  }
  const type = playriftboundTypeLabel(row.tournamentType);
  const format = playriftboundFormatLabel(row.format);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {type !== null && <Badge variant="outline">{type}</Badge>}
      {format !== null && <Badge variant="subtle">{format}</Badge>}
      {row.playerFormat !== null && row.playerFormat !== "ONE_V_ONE" && (
        <Badge variant="warning" title="Team events are never auto-published">
          Team
        </Badge>
      )}
      {row.missingSince !== null && (
        <Badge variant="destructive" title="Gone from the listing">
          Missing
        </Badge>
      )}
    </div>
  );
}

function PlayersCell({ row }: AdminCellSlotProps<PlayriftboundCatalogRow>) {
  if (!row || row.registeredCount === null) {
    return <span className="tabular-nums">—</span>;
  }
  const capacity = row.participantCapacity === null ? "" : ` / ${row.participantCapacity}`;
  return <span className="tabular-nums">{`${row.registeredCount}${capacity}`}</span>;
}

function VenueCell({ row }: AdminCellSlotProps<PlayriftboundCatalogRow>) {
  const parts = [row?.organizerName, row?.city].filter((part): part is string => Boolean(part));
  return (
    <span className="text-muted-foreground block max-w-56 truncate">
      {parts.length === 0 ? "—" : parts.join(", ")}
    </span>
  );
}

function recheckHint(row: PlayriftboundCatalogRow, now: Date): string {
  if (row.nextCheckAt === null) {
    return "ladder done";
  }
  if (new Date(row.startAt).getTime() > now.getTime()) {
    return `starts ${formatRelativeTime(row.startAt, { now })}`;
  }
  return `next check ${formatRelativeTime(row.nextCheckAt, { now })}`;
}

function CoverageCell({ row }: AdminCellSlotProps<PlayriftboundCatalogRow>) {
  const now = useMountedAt();
  if (!row) {
    return null;
  }
  const triage = catalogTriageDisplay(row.triage);
  const rounds = playriftboundRoundsText(row);
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={triage.variant}>{triage.label}</Badge>
      {row.triage === "accepted" && (
        <div className="flex flex-wrap items-center gap-1">
          {row.stagedPlayerCount > 0 ? (
            <Badge variant="success">
              <CheckIcon />
              {`${row.stagedPlayerCount} standings`}
            </Badge>
          ) : (
            <Badge variant="warning">Standings pending</Badge>
          )}
          {row.stagedMatchCount > 0 && (
            <Badge variant="success">
              <CheckIcon />
              {`${row.stagedMatchCount} pairings`}
            </Badge>
          )}
          {rounds !== null && <span className="text-muted-foreground">{rounds}</span>}
          <span className="text-muted-foreground">{recheckHint(row, now)}</span>
        </div>
      )}
    </div>
  );
}

const columns: AdminColumnDef<PlayriftboundCatalogRow>[] = [
  { header: "Date", width: "w-28", sortKey: "startAt", sortFirst: "desc", cell: <DateCell /> },
  { header: "Event", sortKey: "name", cell: <NameCell /> },
  { header: "Type", cell: <TypeCell /> },
  {
    header: "Players",
    align: "right",
    width: "w-24",
    sortKey: "playerCount",
    sortFirst: "desc",
    cell: <PlayersCell />,
  },
  { header: "Store", cell: <VenueCell /> },
  { header: "Coverage", width: "w-64", cell: <CoverageCell /> },
];

const SORT_FALLBACK = { sort: "startAt", direction: "desc" } as const;

interface PlayriftboundRowHandlers {
  busy: boolean;
  onAccept: (tournamentId: string) => void;
  onDismiss: (tournamentId: string) => Promise<unknown>;
  onUndismiss: (tournamentId: string) => void;
  onFetch: (tournamentId: string) => void;
}

function PlayriftboundRowActions({
  row,
  busy,
  onAccept,
  onDismiss,
  onUndismiss,
  onFetch,
}: AdminCellSlotProps<PlayriftboundCatalogRow> & PlayriftboundRowHandlers) {
  if (!row) {
    return null;
  }

  if (row.triage === "dismissed") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => onUndismiss(row.tournamentId)}
      >
        <UndoIcon />
        Restore
      </Button>
    );
  }

  if (row.triage === "accepted") {
    return (
      <>
        {row.metaEventId !== null && (
          <Link
            to="/admin/meta/$eventId"
            params={{ eventId: row.metaEventId }}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <LayersIcon />
            Standings
          </Link>
        )}
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onFetch(row.tournamentId)}>
          <DownloadIcon />
          Fetch now
        </Button>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => onAccept(row.tournamentId)}>
        <CheckIcon />
        Publish
      </Button>
      <ConfirmActionButton
        title={`Reject "${row.name}"?`}
        description="Refresh mirror never offers it again. You can restore it later."
        confirmLabel="Reject"
        onConfirm={() => onDismiss(row.tournamentId)}
      >
        <ArchiveXIcon />
        Reject
      </ConfirmActionButton>
    </>
  );
}

export function PlayriftboundCatalogPage() {
  const filters = routeApi.useSearch();
  const { page, applyFilter, goToPage } = useUrlTableFilters(filters);
  const [rulesOpen, setRulesOpen] = useState(false);
  const accept = useAcceptPlayriftboundEvent();
  const dismiss = useDismissPlayriftboundEvent();
  const undismiss = useUndismissPlayriftboundEvent();
  const fetchEvent = useFetchPlayriftboundEvent();

  async function handleFetch(tournamentId: string) {
    let result;
    try {
      result = await fetchEvent.mutateAsync({ tournamentId });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    announceSyncTrigger("Fetch", result);
  }

  const triage = urlTriage(filters.triage);
  const { sort, direction, serverSort } = urlTableSort({
    key: filters.eventSort,
    direction: filters.eventDir,
    fallback: SORT_FALLBACK,
    keys: META_CATALOG_SORTS,
    onChange: (next) => applyFilter({ eventSort: next.sort, eventDir: next.direction }),
  });

  const params: PlayriftboundCatalogParams = {
    page,
    search: filters.q,
    triage: triage.query,
    tournamentType: filters.prType,
    format: filters.prFormat,
    minPlayers: filters.minPlayers,
    missing: filters.missing,
    bucket: filters.bucket,
    awaitingResults: filters.awaitingResults,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    sort,
    direction,
  };
  const { data } = useAdminPlayriftboundCatalog(params);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PLAYRIFTBOUND_CATALOG_PAGE_SIZE));

  return (
    <>
      <AdminPageTopBar
        title="Meta Archive"
        actions={
          <PageTopBarButton onClick={() => setRulesOpen(true)}>
            <SlidersHorizontalIcon />
            Auto-publish rule
          </PageTopBarButton>
        }
      />
      <AdminTable
        columns={columns}
        data={data?.rows ?? []}
        getRowKey={(row) => row.tournamentId}
        serverSort={serverSort}
        emptyText={data === undefined ? "Loading the mirror…" : "No events match these filters."}
        toolbar={
          <PlayriftboundCatalogFilters
            filters={filters}
            triage={triage.selected}
            counts={data?.counts}
            total={total}
            applyFilter={applyFilter}
          />
        }
        actions={
          <PlayriftboundRowActions
            busy={
              accept.isPending || dismiss.isPending || undismiss.isPending || fetchEvent.isPending
            }
            onAccept={(tournamentId) => accept.mutate({ tournamentId })}
            onDismiss={(tournamentId) => dismiss.mutateAsync({ tournamentId })}
            onUndismiss={(tournamentId) => undismiss.mutate({ tournamentId })}
            onFetch={(tournamentId) => void handleFetch(tournamentId)}
          />
        }
      />
      <Pager page={page} totalPages={totalPages} onPageChange={goToPage} label="Mirror pages" />

      {rulesOpen && (
        <MetaAutoAcceptDialog source="playriftbound" onClose={() => setRulesOpen(false)} />
      )}
    </>
  );
}

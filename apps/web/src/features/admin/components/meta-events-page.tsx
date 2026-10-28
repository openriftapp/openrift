import { formatDay } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";
import type { AdminMetaEvent } from "@openrift/shared/types/api/meta";
import { META_EVENT_SORTS } from "@openrift/shared/types/enums";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ExternalLinkIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

import { PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { TextLink } from "@/components/ui/text-link";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { MetaEventDialog } from "@/features/admin/components/meta-event-dialog";
import { EventFilters, EventsRail } from "@/features/admin/components/meta-events-filters";
import { useAdminMetaEvents, useRemoveMetaEvent } from "@/features/admin/hooks/use-admin-meta";
import { urlTableSort, useUrlTableFilters } from "@/features/admin/hooks/use-url-table-filters";
import {
  ADMIN_META_EVENT_PAGE_SIZE,
  META_EVENT_SORT_FALLBACK,
  metaEventsParamsFromSearch,
} from "@/features/admin/lib/admin-meta-queries";
import { RESULTS_DISPLAY } from "@/features/admin/lib/meta-mirror-view";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { sourceProviderDisplay } from "@/features/meta/lib/meta-source-review";
import { useDeckFormatList } from "@/hooks/use-enums";

const routeApi = getRouteApi("/_app/_authenticated/admin/meta");

function EventCell({
  row,
  formatLabels,
}: AdminCellSlotProps<AdminMetaEvent> & { formatLabels: Record<string, string> }) {
  if (!row) {
    return null;
  }
  const detail = [row.organizer, formatLabels[row.format] ?? row.format]
    .filter((part) => part !== null)
    .join(" · ");
  return (
    <div className="min-w-48">
      <TextLink
        variant="inherit"
        className="font-medium"
        render={<Link to="/admin/meta/$eventId" params={{ eventId: row.id }} />}
      >
        {row.name}
      </TextLink>
      <div className="text-muted-foreground text-xs">{detail}</div>
    </div>
  );
}

function DateCell({ row }: AdminCellSlotProps<AdminMetaEvent>) {
  if (!row) {
    return null;
  }
  return <span className="tabular-nums">{formatDay(row.eventDate)}</span>;
}

function TierCell({ row }: AdminCellSlotProps<AdminMetaEvent>) {
  if (!row) {
    return null;
  }
  return <MetaTierBadge tier={row.tier} />;
}

function ResultsCell({ row }: AdminCellSlotProps<AdminMetaEvent>) {
  if (!row) {
    return null;
  }
  const results = RESULTS_DISPLAY[row.results];
  return <Badge variant={results.variant}>{results.label}</Badge>;
}

function StandingsCell({ row }: AdminCellSlotProps<AdminMetaEvent>) {
  if (!row) {
    return null;
  }
  const short = row.playerCount !== null && row.playerRowCount < row.playerCount;
  return (
    <span className="tabular-nums">
      <span className={short ? "text-warning" : undefined}>{row.playerRowCount}</span>
      {row.playerCount !== null && (
        <span className="text-muted-foreground"> of {row.playerCount}</span>
      )}
      {row.deckCount > 0 && (
        <span className="text-muted-foreground block text-xs">
          {row.deckCount} {pluralize(row.deckCount, "deck")}
        </span>
      )}
    </span>
  );
}

function SourcesCell({ row }: AdminCellSlotProps<AdminMetaEvent>) {
  if (!row) {
    return null;
  }
  const providers = row.sources.filter((source) => source.provider !== null);
  if (providers.length === 0) {
    return <span className="text-muted-foreground">Entered by hand</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {providers.map((source) => {
        const provider = sourceProviderDisplay(source.provider ?? "manual");
        return (
          <Badge key={source.id} variant={provider.variant}>
            {provider.label}
          </Badge>
        );
      })}
    </div>
  );
}

function eventColumns(formatLabels: Record<string, string>): AdminColumnDef<AdminMetaEvent>[] {
  return [
    {
      header: "Date",
      width: "w-28",
      sortKey: "eventDate",
      sortFirst: "desc",
      cell: <DateCell />,
    },
    {
      header: "Event",
      sortKey: "name",
      wrap: true,
      cell: <EventCell formatLabels={formatLabels} />,
    },
    { header: "Tier", cell: <TierCell /> },
    { header: "Results", cell: <ResultsCell /> },
    {
      header: "Standings",
      align: "right",
      sortKey: "playerRowCount",
      sortFirst: "desc",
      cell: <StandingsCell />,
    },
    { header: "Sources", cell: <SourcesCell /> },
  ];
}

function EventRowActions({
  row,
  onEdit,
}: AdminCellSlotProps<AdminMetaEvent> & { onEdit: (event: AdminMetaEvent) => void }) {
  if (!row) {
    return null;
  }
  return (
    <>
      <a
        href={`/meta/${row.slug}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${row.name} on the public archive`}
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <ExternalLinkIcon />
      </a>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit details of ${row.name}`}
        onClick={() => onEdit(row)}
      >
        <PencilIcon />
      </Button>
    </>
  );
}

function removeDescription(event: AdminMetaEvent): string {
  const held =
    event.playerRowCount > 0
      ? `Deletes its ${event.playerRowCount} ${pluralize(event.playerRowCount, "standing")} and ${event.deckCount} ${pluralize(event.deckCount, "deck")}, permalinks included.`
      : "Deletes the event page.";
  const mirrored = event.sources.some((source) => source.provider !== null);
  return mirrored
    ? `${held} Its source rows move to Rejected, so no refresh publishes it again.`
    : `${held} This cannot be undone.`;
}

type DialogState = { mode: "create" } | { mode: "edit"; event: AdminMetaEvent } | null;

export function MetaEventsPage() {
  const filters = routeApi.useSearch();
  const { page, applyFilter, goToPage } = useUrlTableFilters(filters);
  const { formats, labels: formatLabels } = useDeckFormatList();
  const removeEvent = useRemoveMetaEvent();
  const [dialog, setDialog] = useState<DialogState>(null);

  const { serverSort } = urlTableSort({
    key: filters.liveSort,
    direction: filters.liveDir,
    fallback: META_EVENT_SORT_FALLBACK,
    keys: META_EVENT_SORTS,
    onChange: (next) => applyFilter({ liveSort: next.sort, liveDir: next.direction }),
  });

  const { data } = useAdminMetaEvents(metaEventsParamsFromSearch(filters));
  const totalPages = Math.max(1, Math.ceil(data.total / ADMIN_META_EVENT_PAGE_SIZE));

  return (
    <>
      <AdminPageTopBar
        title="Published events"
        actions={
          <PageTopBarPrimaryButton onClick={() => setDialog({ mode: "create" })}>
            Add event
          </PageTopBarPrimaryButton>
        }
      />

      <div className="space-y-4 pt-3">
        <EventsRail filters={filters} counts={data.counts} />
        <div className="min-w-0 space-y-4">
          <EventFilters filters={filters} formats={formats} applyFilter={applyFilter} />
          <AdminTable
            columns={eventColumns(formatLabels)}
            data={data.events}
            getRowKey={(event) => event.id}
            serverSort={serverSort}
            emptyText="No events in this view."
            actions={<EventRowActions onEdit={(event) => setDialog({ mode: "edit", event })} />}
            delete={{
              onDelete: (event) => removeEvent.mutateAsync(event.id),
              confirm: (event) => ({
                title: `Remove "${event.name}" from the archive?`,
                description: removeDescription(event),
                confirmLabel: "Remove",
              }),
            }}
          />
          <Pager
            page={page}
            totalPages={totalPages}
            onPageChange={goToPage}
            label="Published pages"
          />
        </div>
      </div>

      {dialog && (
        <MetaEventDialog
          event={dialog.mode === "edit" ? dialog.event : undefined}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

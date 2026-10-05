import { formatDayTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { Disclosure } from "@/components/disclosure";
import { PageDescription, PageTopBarButton } from "@/components/layout/page-top-bar";
import { ShowMoreButton } from "@/components/show-more-button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextLink } from "@/components/ui/text-link";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import {
  useAuditActions,
  useAuditActors,
  useAuditEvents,
} from "@/features/admin/hooks/use-admin-audit";
import { formatAuditChanges } from "@/features/admin/lib/audit-changes";
import type { AdminAuditEventResponse } from "@/lib/server-fns/api-types";
import { cn } from "@/lib/utils";

const ALL_ACTORS = "__all__";
const ALL_ACTIONS = "__all_actions__";

// Values longer than this collapse behind a disclosure so a pasted rules text
// doesn't blow up the table row.
const LONG_VALUE = 80;

function ChangeValue({ value }: { value: string | null }) {
  if (value === null) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  if (value.length <= LONG_VALUE) {
    return <span className="break-all">{value}</span>;
  }
  return (
    <Disclosure
      variant="plain"
      title={<span className="break-all">{value.slice(0, LONG_VALUE)}…</span>}
    >
      <span className="break-all">{value}</span>
    </Disclosure>
  );
}

function WhenCell({ row: event }: AdminCellSlotProps<AdminAuditEventResponse>) {
  if (!event) {
    return null;
  }
  return (
    <span className="font-mono text-sm" title={event.createdAt}>
      {formatDayTime(event.createdAt)}
    </span>
  );
}

function ActorCell({ row: event }: AdminCellSlotProps<AdminAuditEventResponse>) {
  return event ? <span>{event.actorName ?? event.actorEmail ?? event.actorUserId}</span> : null;
}

function ActionCell({ row: event }: AdminCellSlotProps<AdminAuditEventResponse>) {
  if (!event) {
    return null;
  }
  return (
    <Badge variant="secondary" className="font-mono">
      {event.action}
    </Badge>
  );
}

function EntityCell({ row: event }: AdminCellSlotProps<AdminAuditEventResponse>) {
  if (!event) {
    return null;
  }
  if (event.cardSlug) {
    return (
      <TextLink
        variant="inherit"
        render={<Link to="/admin/cards/$cardSlug" params={{ cardSlug: event.cardSlug }} />}
      >
        {event.entityLabel ?? event.cardSlug}
      </TextLink>
    );
  }
  return (
    <span className="text-muted-foreground">{event.entityLabel ?? event.entityId ?? "—"}</span>
  );
}

function ChangesCell({ row: event }: AdminCellSlotProps<AdminAuditEventResponse>) {
  if (!event) {
    return null;
  }
  const changes = formatAuditChanges(event.oldValues, event.newValues);
  if (changes.length === 0) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  return (
    <ul className="space-y-1">
      {changes.map((change) => (
        <li key={change.field} className="text-sm">
          <span className="text-muted-foreground font-mono">{change.field}:</span>{" "}
          {change.from !== null && (
            <>
              <ChangeValue value={change.from} />
              <span className="text-muted-foreground"> &rarr; </span>
            </>
          )}
          <ChangeValue value={change.to} />
        </li>
      ))}
    </ul>
  );
}

export function AuditLogPage() {
  const [actorUserId, setActorUserId] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");

  const { data: actorsData } = useAuditActors();
  const { data: actionsData } = useAuditActions();
  const events = useAuditEvents({
    actorUserId: actorUserId || undefined,
    action: action || undefined,
    search: search || undefined,
  });

  const actorOptions = [
    { value: ALL_ACTORS, label: "All actors" },
    ...(actorsData?.actors ?? []).map((actor) => ({
      value: actor.userId,
      label: actor.name ?? actor.email ?? actor.userId,
    })),
  ];

  const actionOptions = [
    { value: ALL_ACTIONS, label: "All actions" },
    ...(actionsData?.actions ?? []).map((value) => ({ value, label: value })),
  ];

  const rows = events.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <AdminPageTopBar
        title="Audit Log"
        actions={
          <PageTopBarButton onClick={() => void events.refetch()} disabled={events.isFetching}>
            <RefreshCwIcon className={events.isFetching ? "animate-spin" : ""} />
            Refresh
          </PageTopBarButton>
        }
      />
      <PageDescription>
        Catalog changes by admins and card-review helpers. Check/uncheck bookkeeping isn&apos;t
        logged. Times are UTC.
      </PageDescription>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={actorOptions}
          value={actorUserId || ALL_ACTORS}
          onValueChange={(value) => setActorUserId(value && value !== ALL_ACTORS ? value : "")}
        >
          <SelectTrigger aria-label="Filter by actor" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actorOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={actionOptions}
          value={action || ALL_ACTIONS}
          onValueChange={(value) => setAction(value && value !== ALL_ACTIONS ? value : "")}
        >
          <SelectTrigger aria-label="Filter by action" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className={cn(option.value !== ALL_ACTIONS && "font-mono")}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DebouncedSearchInput
          urlValue={search}
          onCommit={setSearch}
          placeholder="Search by card, code, or id…"
          className="w-64"
        />
      </div>

      <AdminTable
        layout="fixed"
        columns={[
          { header: "When", width: "w-40", cell: <WhenCell /> },
          { header: "Actor", width: "w-40", cell: <ActorCell /> },
          { header: "Action", width: "w-52", cell: <ActionCell /> },
          { header: "Entity", width: "w-56", cell: <EntityCell /> },
          { header: "Changes", wrap: true, cell: <ChangesCell /> },
        ]}
        data={rows}
        getRowKey={(event) => event.id}
        rowClassName={() => "[&>td]:align-top"}
        emptyText={events.isPending ? "Loading…" : "No audit events match the filters."}
        footer={
          events.hasNextPage && (
            <ShowMoreButton
              className="mt-0"
              pending={events.isFetchingNextPage}
              onClick={() => void events.fetchNextPage()}
            >
              Load more
            </ShowMoreButton>
          )
        }
      />
    </div>
  );
}

import type { WorkspaceOwner } from "@openrift/shared/contracts/admin/catalog-workspace";
import { Link, Outlet, useChildMatches, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeftIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon } from "lucide-react";

import {
  PageDescription,
  PageTopBarIconButton,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { Spinner } from "@/components/ui/spinner";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { EmptyQueue } from "@/features/catalog-workspace/components/empty-queue";
import { QueueHeader } from "@/features/catalog-workspace/components/queue-header";
import { QueueList } from "@/features/catalog-workspace/components/queue-list";
import { RecordsTable } from "@/features/catalog-workspace/components/records-table";
import { WorkspaceSplitLayout } from "@/features/catalog-workspace/components/workspace-split-layout";
import { useWorkspaceKeyboard } from "@/features/catalog-workspace/hooks/use-workspace-keyboard";
import type { WorkspaceSearchState } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import {
  useWorkspaceQueue,
  useWorkspaceRecords,
} from "@/features/catalog-workspace/hooks/use-workspace-queue";
import type { WorkspaceRouteParams } from "@/features/catalog-workspace/lib/owner-items";
import {
  OWNER_LABELS,
  ownersForRole,
  selectedKeyFromParams,
} from "@/features/catalog-workspace/lib/owner-items";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { cn } from "@/lib/utils";

function BackToList({ owner }: { owner: WorkspaceOwner }) {
  const className = "text-muted-foreground mb-3 inline-flex items-center gap-1 text-sm md:hidden";
  const label = `Back to ${OWNER_LABELS[owner].toLowerCase()}`;
  if (owner === "card") {
    return (
      <Link to="/admin/workspace/cards" search className={className}>
        <ArrowLeftIcon className="size-4" />
        {label}
      </Link>
    );
  }
  if (owner === "face") {
    return (
      <Link to="/admin/workspace/faces" search className={className}>
        <ArrowLeftIcon className="size-4" />
        {label}
      </Link>
    );
  }
  return (
    <Link to="/admin/workspace/printings" search className={className}>
      <ArrowLeftIcon className="size-4" />
      {label}
    </Link>
  );
}

function LoadState({ error, pending }: { error: Error | null; pending: boolean }) {
  if (error !== null) {
    return (
      <p role="alert" className="text-muted-foreground px-3 py-6 text-sm">
        This list could not be loaded. {error.message}
      </p>
    );
  }
  if (pending) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  return null;
}

function NewButton({ owner, canCreate }: { owner: WorkspaceOwner; canCreate: boolean }) {
  if (!canCreate || owner === "face") {
    return null;
  }
  return owner === "card" ? (
    <PageTopBarPrimaryButton render={<Link to="/admin/workspace/cards/create" />}>
      <PlusIcon />
      New card
    </PageTopBarPrimaryButton>
  ) : (
    <PageTopBarPrimaryButton render={<Link to="/admin/workspace/printings/create" search />}>
      <PlusIcon />
      New printing
    </PageTopBarPrimaryButton>
  );
}

const TABLE_DESCRIPTIONS: Record<WorkspaceOwner, string> = {
  card: "Gameplay identity: name, types, domains, stats and rules text. Printed details sit on faces, physical cards on printings.",
  printing:
    "Physical cards: one or two faces, a size, a channel and release dates. Owned, priced and traded as one unit.",
  face: "Every printed face. Images and printed details are edited here.",
};

function RecordPlaceholder({ owner }: { owner: WorkspaceOwner }) {
  return (
    <p className="text-muted-foreground py-10">
      Pick a {owner === "card" ? "card" : owner} from the list, or press J to open the first one.
    </p>
  );
}

export function WorkspaceOwnerPage({ owner }: { owner: WorkspaceOwner }) {
  useWorkspaceKeyboard(owner);
  const navigate = useNavigate();
  const params: WorkspaceRouteParams = useParams({ strict: false });
  const hasRecord = useChildMatches().length > 0;
  const collapsed = useWorkspaceSelectionStore((state) => state.listCollapsed);
  const toggleCollapsed = useWorkspaceSelectionStore((state) => state.toggleListCollapsed);

  const queue = useWorkspaceQueue(owner);
  const { role, view, search } = queue;
  const listAllowed = ownersForRole(role).includes(owner);
  const records = useWorkspaceRecords(owner, view === "all" && listAllowed);
  const isDesk = role === "desk";
  const canCreate = owner === "card" ? role === "admin" : role === "admin" || isDesk;

  function changeSearch(patch: Partial<WorkspaceSearchState>) {
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
      resetScroll: false,
    });
  }

  const topBar = (
    <AdminPageTopBar
      title={OWNER_LABELS[owner]}
      actions={
        <>
          <NewButton owner={owner} canCreate={canCreate} />
          {hasRecord && (
            <PageTopBarIconButton
              className="hidden md:inline-flex"
              aria-label={collapsed ? "Show list" : "Collapse list"}
              title={collapsed ? "Show list" : "Collapse list"}
              onClick={toggleCollapsed}
            >
              {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
            </PageTopBarIconButton>
          )}
        </>
      }
    />
  );

  const header = (
    <QueueHeader
      owner={owner}
      view={view}
      desk={isDesk && owner === "printing"}
      isAdmin={role === "admin"}
      hint={
        view === "all" && hasRecord
          ? `${records.entries.length.toLocaleString()} ${OWNER_LABELS[owner].toLowerCase()} · the table returns when you close the record`
          : undefined
      }
      counts={queue.counts}
      allCount={records.total}
      search={search}
      providers={queue.providers}
      stats={queue.stats}
      doneToday={queue.doneToday}
      onSearchChange={changeSearch}
    />
  );

  if (!listAllowed) {
    return (
      <>
        {topBar}
        <Outlet />
      </>
    );
  }

  if (view === "all" && !hasRecord) {
    const loading = records.error !== null || records.isPending;
    return (
      <>
        {topBar}
        <div className="space-y-3">
          <PageDescription>{TABLE_DESCRIPTIONS[owner]}</PageDescription>
          <div className="max-w-xl">{header}</div>
          {loading ? (
            <LoadState error={records.error} pending={records.isPending} />
          ) : (
            <RecordsTable records={records} deskMode={search.desk ?? "mine"} role={role} />
          )}
        </div>
      </>
    );
  }

  const source =
    view === "all"
      ? { entries: records.entries, error: records.error, pending: records.isPending }
      : { entries: queue.entries, error: queue.error, pending: queue.isPending };
  const segmentTotal = view === "new" ? queue.counts.new : queue.counts.open;
  const queueEmpty =
    view !== "all" && !hasRecord && source.error === null && !source.pending && segmentTotal === 0;
  const noun = OWNER_LABELS[owner].toLowerCase();

  const list =
    source.error !== null || source.pending ? (
      <LoadState error={source.error} pending={source.pending} />
    ) : (
      <QueueList
        entries={source.entries}
        selectedKey={selectedKeyFromParams(params)}
        emptyText={segmentTotal === 0 ? "Nothing open." : `No ${noun} match these filters.`}
        label={OWNER_LABELS[owner]}
      />
    );

  let record = <RecordPlaceholder owner={owner} />;
  if (hasRecord) {
    record = (
      <>
        <BackToList owner={owner} />
        <Outlet />
      </>
    );
  } else if (queueEmpty) {
    record = (
      <EmptyQueue
        owner={owner}
        segment={view === "new" ? "new" : "open"}
        role={role}
        items={queue.items}
        newCount={owner === "face" ? 0 : queue.counts.new}
        doneToday={queue.doneToday}
      />
    );
  }

  return (
    <>
      {topBar}
      <WorkspaceSplitLayout
        header={header}
        list={list}
        recordFirst={hasRecord || queueEmpty}
        collapsed={collapsed && hasRecord}
      >
        <div className={cn(hasRecord && "md:pr-1")}>{record}</div>
      </WorkspaceSplitLayout>
    </>
  );
}

import type {
  WorkspaceOwner,
  WorkspaceRecordFilter,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { WORKSPACE_RECORD_SORTS } from "@openrift/shared/workspace-kinds";
import { Link, Outlet, useChildMatches, useLocation, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useEffect, useEffectEvent } from "react";

import { PageDescription } from "@/components/layout/page-top-bar";
import { buttonVariants } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/simple-select";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { CardsBody } from "@/features/catalog-workspace/components/cards-body";
import { ListState } from "@/features/catalog-workspace/components/list-state";
import { WorkspaceBack } from "@/features/catalog-workspace/components/pass/pass-parts";
import { RecordsTable, summaryText } from "@/features/catalog-workspace/components/records-table";
import { SetFilterSelect } from "@/features/catalog-workspace/components/set-filter-select";
import { WorkspaceUndoButton } from "@/features/catalog-workspace/components/workspace-undo-button";
import { useClearUndoOnLeave } from "@/features/catalog-workspace/hooks/use-clear-undo-on-leave";
import {
  useWorkspaceKeyboard,
  workspaceKeyAction,
} from "@/features/catalog-workspace/hooks/use-workspace-keyboard";
import {
  RECORD_FILTERS,
  useWorkspaceRecords,
  useWorkspaceRole,
  useWorkspaceSearch,
} from "@/features/catalog-workspace/hooks/use-workspace-records";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { DeskMode } from "@/features/catalog-workspace/lib/owner-items";
import { OWNER_LABELS, ownersForRole } from "@/features/catalog-workspace/lib/owner-items";
import type { WorkspaceSearch } from "@/features/catalog-workspace/lib/workspace-search";
import { DESK_SORTS, DESK_STATUSES } from "@/features/catalog-workspace/lib/workspace-search";
import { formatCount } from "@/lib/format";
import { openOverlayPresent } from "@/lib/open-overlay";

const RECORD_NOUNS = {
  card: "cards",
  desk: "printings",
  printing: "printings",
  face: "faces",
} as const;

const PASS_ROUTES: ReadonlySet<string> = new Set([
  "/_app/_authenticated/admin/workspace/cards/$cardSlug",
  "/_app/_authenticated/admin/workspace/cards/new/$name",
]);

const KEYBOARD_ROUTES: ReadonlySet<string> = new Set([
  "/_app/_authenticated/admin/workspace/printings/new/$candidatePrintingId",
]);

const STOP_BAR_ROUTE = "/_app/_authenticated/admin/workspace/printings/$printingId";

const RECORD_KEY_ROUTES: ReadonlySet<string> = new Set([
  STOP_BAR_ROUTE,
  "/_app/_authenticated/admin/workspace/faces/$cardSlug/$faceId",
]);

const FILTER_LABELS: Record<WorkspaceRecordFilter, string> = {
  promo: "Promos",
  "no-image": "No image",
  mine: "Added by me",
  substitute: "Substitute image",
  shared: "Shared",
  "needs-review": "Needs review",
};

const DESK_MODES: { value: DeskMode; label: string }[] = [
  { value: "mine", label: "Added by me" },
  { value: "promos", label: "All promos" },
];

const ANY_STATUS = "__any__";

const DESK_STATUS_ITEMS = [
  { value: ANY_STATUS, label: "Any status" },
  ...DESK_STATUSES.map((value) => ({
    value,
    label: value === "announced" ? "Announced" : "Released",
  })),
];

const DESK_SORT_LABELS: Record<(typeof DESK_SORTS)[number], string> = {
  code: "By code",
  card: "By card name",
  updated: "Last updated",
  release: "Available from",
};

const DESK_SORT_ITEMS = DESK_SORTS.map((value) => ({
  value,
  label: `Sort: ${DESK_SORT_LABELS[value]}`,
}));

export function WorkspaceOwnerPage({ owner }: { owner: WorkspaceOwner }) {
  useClearUndoOnLeave();
  const childRouteId = useChildMatches({ select: (matches) => matches.at(0)?.routeId });
  const reviewing = useLocation({
    select: (location) => location.state.workspaceReview !== undefined,
  });
  if (childRouteId === undefined) {
    return (
      <>
        <UndoKey />
        <RecordsPage owner={owner} />
      </>
    );
  }
  if (PASS_ROUTES.has(childRouteId)) {
    return <Outlet />;
  }
  const keyboardRoute = KEYBOARD_ROUTES.has(childRouteId);
  const recordKeyRoute = RECORD_KEY_ROUTES.has(childRouteId);
  const stopBarKeys = reviewing && childRouteId === STOP_BAR_ROUTE;
  return (
    <>
      <AdminPageTopBar
        back={<WorkspaceBack owner={owner} history={!keyboardRoute} />}
        title={keyboardRoute || reviewing ? "Review" : OWNER_LABELS[owner]}
        actions={<WorkspaceUndoButton />}
      />
      {keyboardRoute || (recordKeyRoute && !stopBarKeys) ? <RecordKeyboard /> : null}
      {!keyboardRoute && !recordKeyRoute && <UndoKey />}
      <Outlet />
    </>
  );
}

function RecordKeyboard() {
  useWorkspaceKeyboard();
  return null;
}

function UndoKey() {
  const { undoLatest } = useWorkspaceUndo();
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      !event.repeat &&
      workspaceKeyAction(event)?.action === "undo" &&
      !openOverlayPresent() &&
      undoLatest()
    ) {
      event.preventDefault();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    globalThis.addEventListener("keydown", listener);
    return () => globalThis.removeEventListener("keydown", listener);
  }, []);
  return null;
}

function NewButton({ owner }: { owner: WorkspaceOwner }) {
  if (owner === "card") {
    return (
      <Link to="/admin/workspace/cards/create" className={buttonVariants()}>
        <PlusIcon />
        New card
      </Link>
    );
  }
  return (
    <Link to="/admin/workspace/printings/create" search className={buttonVariants()}>
      <PlusIcon />
      New printing
    </Link>
  );
}

function RecordsPage({ owner }: { owner: WorkspaceOwner }) {
  const navigate = useNavigate();
  const role = useWorkspaceRole();
  const search = useWorkspaceSearch();
  const listAllowed = ownersForRole(role).includes(owner);
  const records = useWorkspaceRecords(owner, listAllowed);
  const isDesk = role === "desk";
  const canCreate =
    owner !== "face" && (owner === "card" ? role === "admin" : role === "admin" || isDesk);

  function changeSearch(patch: Partial<WorkspaceSearch>) {
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
          <WorkspaceUndoButton />
          {canCreate && <NewButton owner={owner} />}
        </>
      }
    />
  );

  const count = records.error === null && !records.isPending && (
    <span className="text-muted-foreground text-sm">
      {summaryText(records.rows.length, records.total, RECORD_NOUNS[records.kind], records.hasMore)}
    </span>
  );
  const table = (
    <RecordsBody
      records={records}
      sort={{
        key: search.recordSort ?? "",
        direction: search.recordSort === undefined ? "asc" : (search.recordDir ?? "asc"),
        onChange: ({ key, direction }) => {
          const recordSort = WORKSPACE_RECORD_SORTS.find((value) => value === key);
          changeSearch({
            recordSort,
            recordDir: recordSort === undefined ? undefined : direction,
          });
        },
      }}
    />
  );

  const setFilter = (
    <SetFilterSelect value={search.set} onChange={(set) => changeSearch({ set })} />
  );

  if (owner === "card") {
    return (
      <>
        {topBar}
        <CardsBody
          listAllowed={listAllowed}
          query={search.q ?? ""}
          onQuery={(next) => changeSearch({ q: next === "" ? undefined : next })}
          onView={(view) =>
            void navigate({
              to: ".",
              search: (prev) => ({ ...prev, queue: view }),
              replace: true,
              resetScroll: false,
            })
          }
          allCount={count}
          allFilter={setFilter}
          allTable={table}
        />
      </>
    );
  }

  if (!listAllowed) {
    return (
      <>
        {topBar}
        <PageDescription>
          Your printings and their faces are under{" "}
          <TextLink render={<Link to="/admin/workspace/printings" />}>Printings</TextLink>.
        </PageDescription>
      </>
    );
  }

  const deskTable = isDesk && owner === "printing";
  const filterKind = deskTable ? "desk" : owner;
  const filters = RECORD_FILTERS[filterKind];
  const activeFilter = filters.find((filter) => filter === search.filter);

  return (
    <>
      {topBar}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <DebouncedSearchInput
            urlValue={search.q ?? ""}
            onCommit={(next) => changeSearch({ q: next === "" ? undefined : next })}
            placeholder="Name or code…"
            className="w-full sm:w-72"
          />
          {setFilter}
          {deskTable && (
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={[search.desk ?? "mine"]}
              aria-label="Printings"
              onValueChange={([next]) => {
                const mode = DESK_MODES.find((option) => option.value === next)?.value;
                if (mode !== undefined) {
                  changeSearch({ desk: mode === "mine" ? undefined : mode });
                }
              }}
            >
              {DESK_MODES.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {filters.length > 0 && (
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={activeFilter === undefined ? [] : [activeFilter]}
              aria-label="Show only"
              onValueChange={([next]) => {
                changeSearch({ filter: filters.find((filter) => filter === next) });
              }}
            >
              {filters.map((filter) => (
                <ToggleGroupItem key={filter} value={filter}>
                  {filter === activeFilter && records.total !== null
                    ? `${FILTER_LABELS[filter]} ${formatCount(records.total)}`
                    : FILTER_LABELS[filter]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {deskTable && (
            <>
              <SimpleSelect
                items={DESK_STATUS_ITEMS}
                value={search.status ?? ANY_STATUS}
                onChange={(next) =>
                  changeSearch({ status: DESK_STATUSES.find((value) => value === next) })
                }
                label="Status"
                className="min-w-0"
              />
              <SimpleSelect
                items={DESK_SORT_ITEMS}
                value={search.deskSort ?? "updated"}
                onChange={(next) => {
                  const deskSort = DESK_SORTS.find((value) => value === next);
                  changeSearch({ deskSort: deskSort === "updated" ? undefined : deskSort });
                }}
                label="Sort"
                className="min-w-0"
              />
            </>
          )}
          {count}
        </div>
        {table}
      </div>
    </>
  );
}

function RecordsBody(props: Parameters<typeof RecordsTable>[0]) {
  const { records } = props;
  return (
    <ListState isPending={records.isPending} error={records.error}>
      <RecordsTable {...props} />
    </ListState>
  );
}

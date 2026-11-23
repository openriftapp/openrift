import type {
  WorkspaceOwner,
  WorkspaceRecordFilter,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { WORKSPACE_RECORD_SORTS } from "@openrift/shared/workspace-kinds";
import {
  Link,
  Outlet,
  useCanGoBack,
  useChildMatches,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { useEffect, useEffectEvent } from "react";

import {
  PageDescription,
  PageTopBarBack,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { RecordsTable, summaryText } from "@/features/catalog-workspace/components/records-table";
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
} from "@/features/catalog-workspace/hooks/use-workspace-queue";
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

const FILTER_LABELS: Record<WorkspaceRecordFilter, string> = {
  promo: "Promos",
  "double-sided": "Double-sided",
  "no-image": "No image",
  mine: "Added by me",
  substitute: "Substitute image",
  shared: "Shared",
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
  return (
    <>
      {KEYBOARD_ROUTES.has(childRouteId) ? (
        <AdminPageTopBar
          back={<PageTopBarBack to="/admin/workspace/review" aria-label="Back to review" />}
          title="Review"
          actions={<WorkspaceUndoButton />}
        />
      ) : (
        <AdminPageTopBar
          back={<BackToTable owner={owner} />}
          title={OWNER_LABELS[owner]}
          actions={<WorkspaceUndoButton />}
        />
      )}
      {KEYBOARD_ROUTES.has(childRouteId) ? <RecordKeyboard /> : <UndoKey />}
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

function BackToTable({ owner }: { owner: WorkspaceOwner }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const label = canGoBack ? "Back" : `Back to ${OWNER_LABELS[owner].toLowerCase()}`;
  const onClick = (event: MouseEvent) => {
    if (canGoBack) {
      event.preventDefault();
      router.history.back();
    }
  };
  if (owner === "card") {
    return (
      <PageTopBarBack to="/admin/workspace/cards" search aria-label={label} onClick={onClick} />
    );
  }
  if (owner === "face") {
    return (
      <PageTopBarBack to="/admin/workspace/faces" search aria-label={label} onClick={onClick} />
    );
  }
  return (
    <PageTopBarBack to="/admin/workspace/printings" search aria-label={label} onClick={onClick} />
  );
}

function NewButton({ owner }: { owner: WorkspaceOwner }) {
  if (owner === "card") {
    return (
      <PageTopBarPrimaryButton render={<Link to="/admin/workspace/cards/create" />}>
        <PlusIcon />
        New card
      </PageTopBarPrimaryButton>
    );
  }
  return (
    <PageTopBarPrimaryButton render={<Link to="/admin/workspace/printings/create" search />}>
      <PlusIcon />
      New printing
    </PageTopBarPrimaryButton>
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
  const filters = filterKind === "card" ? [] : RECORD_FILTERS[filterKind];
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
          {records.error === null && !records.isPending && (
            <span className="text-muted-foreground text-sm">
              {summaryText(
                records.rows.length,
                records.total,
                RECORD_NOUNS[records.kind],
                records.hasMore,
              )}
            </span>
          )}
        </div>
        <RecordsBody
          records={records}
          sort={{
            key: search.recordSort ?? "updated",
            direction: search.recordSort === undefined ? "desc" : (search.recordDir ?? "asc"),
            onChange: ({ key, direction }) => {
              const recordSort = WORKSPACE_RECORD_SORTS.find((value) => value === key);
              changeSearch({
                recordSort,
                recordDir: recordSort === undefined ? undefined : direction,
              });
            },
          }}
        />
      </div>
    </>
  );
}

function RecordsBody(props: Parameters<typeof RecordsTable>[0]) {
  const { records } = props;
  if (records.error !== null) {
    return (
      <p role="alert" className="text-muted-foreground py-6">
        This list could not be loaded. {records.error.message}
      </p>
    );
  }
  if (records.isPending) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  return <RecordsTable {...props} />;
}

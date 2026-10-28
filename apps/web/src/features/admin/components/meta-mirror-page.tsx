import type { MetaSource } from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDayTime } from "@openrift/shared/format-date";
import { META_CATALOG_PROVIDERS, META_CATALOG_SORTS } from "@openrift/shared/types/enums";
import { getRouteApi } from "@tanstack/react-router";
import { SlidersHorizontalIcon, TagsIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageTopBarButton } from "@/components/layout/page-top-bar";
import { Pager } from "@/components/ui/pager";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminFilterSelect } from "@/features/admin/components/admin-filters";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import { MetaAutoAcceptDialog } from "@/features/admin/components/meta-auto-accept-dialog";
import { MetaMirrorFormatDialog } from "@/features/admin/components/meta-catalog-shared";
import {
  MirrorFilters,
  MirrorRail,
  MirrorStateSelect,
} from "@/features/admin/components/meta-mirror-filters";
import {
  MirrorRowActions,
  MirrorSelectionBar,
  mirrorColumns,
} from "@/features/admin/components/meta-mirror-table";
import { MetaRunMenu } from "@/features/admin/components/meta-run-menu";
import { MetaSourceVocabularyDialog } from "@/features/admin/components/meta-source-vocabulary-dialog";
import {
  useMetaSyncSettings,
  useMetaSyncStatus,
} from "@/features/admin/hooks/use-admin-meta-catalog";
import type { MetaMirrorResponse } from "@/features/admin/hooks/use-admin-meta-mirror";
import {
  META_MIRROR_PAGE_SIZE,
  useMetaMirror,
  usePublishMirrorRow,
} from "@/features/admin/hooks/use-admin-meta-mirror";
import { urlTableSort, useUrlTableFilters } from "@/features/admin/hooks/use-url-table-filters";
import type { MetaMirrorRow } from "@/features/admin/lib/meta-mirror-rows";
import {
  playloltcgMirrorRow,
  playriftboundMirrorRow,
  topdeckMirrorRow,
  uvsgamesMirrorRow,
} from "@/features/admin/lib/meta-mirror-rows";
import type { MirrorCounts } from "@/features/admin/lib/meta-mirror-view";
import {
  autoPublishRuleSentence,
  findRailItem,
  mirrorCountsFromStatus,
  mirrorRail,
  mirrorViewFromSearch,
  mirrorViewId,
  mirrorViewSearch,
} from "@/features/admin/lib/meta-mirror-view";
import { META_SOURCE_LABELS } from "@/features/meta/lib/meta-catalog-display";
import { useDeckFormatList } from "@/hooks/use-enums";
import { useMountedAt } from "@/hooks/use-mounted-at";

const routeApi = getRouteApi("/_app/_authenticated/admin/meta");

const SORT_FALLBACK = { sort: "startAt", direction: "desc" } as const;

const SOURCE_ONLY_FILTERS = {
  eventStatus: undefined,
  decklists: undefined,
  plStatus: undefined,
  tdFormat: undefined,
  prType: undefined,
  prFormat: undefined,
} as const;

function mirrorRows(
  response: MetaMirrorResponse | undefined,
  formatLabels: Record<string, string>,
  now: Date,
): MetaMirrorRow[] {
  if (response === undefined) {
    return [];
  }
  switch (response.source) {
    case "uvsgames": {
      return response.data.rows.map((row) => uvsgamesMirrorRow(row, formatLabels, now));
    }
    case "playloltcg": {
      return response.data.rows.map((row) => playloltcgMirrorRow(row, now));
    }
    case "topdeck": {
      return response.data.rows.map((row) => topdeckMirrorRow(row, now));
    }
    case "playriftbound": {
      return response.data.rows.map((row) => playriftboundMirrorRow(row, now));
    }
  }
}

export function MetaMirrorPage() {
  const filters = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { page, applyFilter, goToPage } = useUrlTableFilters(filters);
  const source: MetaSource = filters.source ?? "uvsgames";
  const view = mirrorViewFromSearch(filters);
  const now = useMountedAt();
  const { labels: formatLabels } = useDeckFormatList();
  const status = useMetaSyncStatus(source);
  const settings = useMetaSyncSettings();
  const publish = usePublishMirrorRow();
  const [formatTarget, setFormatTarget] = useState<MetaMirrorRow | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [vocabularyOpen, setVocabularyOpen] = useState(false);

  const { sort, direction, serverSort } = urlTableSort({
    key: filters.eventSort,
    direction: filters.eventDir,
    fallback: SORT_FALLBACK,
    keys: META_CATALOG_SORTS,
    onChange: (next) => applyFilter({ eventSort: next.sort, eventDir: next.direction }),
  });

  const { data } = useMetaMirror({
    source,
    page,
    search: filters.q,
    triage: view.triage === "any" ? undefined : view.triage,
    bucket: view.bucket,
    minPlayers: filters.minPlayers,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    missing: filters.missing,
    sort,
    direction,
    displayStatus: filters.eventStatus,
    decklistPublished: filters.decklists,
    plStatus: filters.plStatus,
    tdFormat: filters.tdFormat,
    prType: filters.prType,
    prFormat: filters.prFormat,
  });

  const current = data?.source === source ? data : undefined;
  const rows = mirrorRows(current, formatLabels, now);
  const total = current?.data.total ?? 0;
  const counts: MirrorCounts | null =
    current?.data.buckets ??
    (status.data === undefined ? null : mirrorCountsFromStatus(status.data));
  const collects = source !== "topdeck";
  const rail = counts === null ? null : mirrorRail(counts, collects);
  const active = rail === null ? undefined : findRailItem(rail, view);
  const selectionMode =
    view.triage === "new" ? "decide" : view.triage === "dismissed" ? "restore" : null;
  const scope = `${source}:${mirrorViewId(view)}:${page}:${JSON.stringify(filters)}`;

  function pickSource(next: string | undefined) {
    const picked = META_CATALOG_PROVIDERS.find((provider) => provider === next);
    if (picked !== undefined) {
      applyFilter({ ...SOURCE_ONLY_FILTERS, source: picked === "uvsgames" ? undefined : picked });
    }
  }

  function confirmFormat(format: string) {
    const row = formatTarget;
    if (row === null) {
      return;
    }
    publish.mutate(
      { source: row.source, key: row.key, format },
      {
        onSuccess: () => {
          setFormatTarget(null);
          toast.success(`Published "${row.name}"`);
        },
      },
    );
  }

  return (
    <>
      <AdminPageTopBar
        title="Mirror"
        actions={
          <>
            {source === "uvsgames" && (
              <PageTopBarButton
                aria-label="Event types and formats"
                onClick={() => setVocabularyOpen(true)}
              >
                <TagsIcon />
                <span className="hidden sm:inline">Event types and formats</span>
              </PageTopBarButton>
            )}
            <PageTopBarButton aria-label="Auto-publish rule" onClick={() => setRulesOpen(true)}>
              <SlidersHorizontalIcon />
              <span className="hidden sm:inline">Auto-publish rule</span>
            </PageTopBarButton>
            {status.data !== undefined && (
              <MetaRunMenu
                source={source}
                runs={status.data.runs}
                pendingTriage={status.data.counts.new}
              />
            )}
          </>
        }
      />

      <div className="space-y-6 pt-3">
        <div className="space-y-2">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[source]}
            onValueChange={([next]) => pickSource(next)}
            aria-label="Source"
            className="hidden sm:flex"
          >
            {META_CATALOG_PROVIDERS.map((provider) => (
              <ToggleGroupItem key={provider} value={provider}>
                {META_SOURCE_LABELS[provider]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="sm:hidden">
            <AdminFilterSelect
              value={source}
              onChange={pickSource}
              options={META_CATALOG_PROVIDERS.map((provider) => ({
                value: provider,
                label: META_SOURCE_LABELS[provider],
              }))}
              label="Source"
              className="w-full"
            />
          </div>
          <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {settings.data !== undefined && (
              <span>{autoPublishRuleSentence(source, settings.data)}</span>
            )}
            {status.data !== undefined && status.data.catalog.lastSeenAt !== null && (
              <span>Refreshed {formatDayTime(status.data.catalog.lastSeenAt)} UTC</span>
            )}
          </p>
        </div>

        <div className="space-y-4">
          {rail !== null && (
            <>
              <div className="hidden sm:block">
                <MirrorRail groups={rail} view={view} />
              </div>
              <div className="sm:hidden">
                <MirrorStateSelect
                  groups={rail}
                  view={view}
                  onChange={(next) =>
                    void navigate({
                      search: (prev) => ({ ...prev, ...mirrorViewSearch(next), page: undefined }),
                      replace: true,
                    })
                  }
                />
              </div>
            </>
          )}

          <div className="min-w-0 space-y-4">
            <MirrorFilters source={source} filters={filters} applyFilter={applyFilter} />
            {active !== undefined && (
              <div>
                <h2 className="font-medium">{active.label}</h2>
                <p className="text-muted-foreground text-sm">{active.description}</p>
              </div>
            )}
            {selectionMode !== null && rows.length > 0 && (
              <MirrorSelectionBar
                source={source}
                scope={scope}
                mode={selectionMode}
                pageKeys={rows.map((row) => row.key)}
              />
            )}
            <AdminTable
              columns={mirrorColumns(selectionMode === null ? null : scope)}
              data={rows}
              getRowKey={(row) => row.key}
              serverSort={serverSort}
              emptyText={data === undefined ? "Loading the mirror…" : "No events in this view."}
              actions={<MirrorRowActions onPickFormat={setFormatTarget} />}
            />
            <Pager
              page={page}
              totalPages={Math.max(1, Math.ceil(total / META_MIRROR_PAGE_SIZE))}
              onPageChange={goToPage}
              label="Mirror pages"
            />
          </div>
        </div>
      </div>

      <MetaMirrorFormatDialog
        row={formatTarget}
        pending={publish.isPending}
        onCancel={() => setFormatTarget(null)}
        onConfirm={confirmFormat}
      />
      {rulesOpen && <MetaAutoAcceptDialog source={source} onClose={() => setRulesOpen(false)} />}
      {vocabularyOpen && <MetaSourceVocabularyDialog onClose={() => setVocabularyOpen(false)} />}
    </>
  );
}

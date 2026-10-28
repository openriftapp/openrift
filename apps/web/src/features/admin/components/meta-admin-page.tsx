import { getRouteApi } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetaAdminOverviewPage } from "@/features/admin/components/meta-admin-overview-page";
import { MetaEventsPage } from "@/features/admin/components/meta-events-page";
import { MetaMirrorPage } from "@/features/admin/components/meta-mirror-page";
import { MetaOverlaysPage } from "@/features/admin/components/meta-overlays-page";
import { useAdminMetaOverlays } from "@/features/admin/hooks/use-admin-meta-overlays";
import { useMetaEventCorrections } from "@/features/admin/hooks/use-admin-meta-submissions";

const routeApi = getRouteApi("/_app/_authenticated/admin/meta");

const OPT_IN_TABS = ["catalogue", "review", "public"] as const;

const CLEARED_TABLE_FILTERS = {
  source: undefined,
  detail: undefined,
  page: undefined,
  q: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  triage: undefined,
  eventStatus: undefined,
  eventSort: undefined,
  eventDir: undefined,
  minPlayers: undefined,
  decklists: undefined,
  missing: undefined,
  bucket: undefined,
  plStatus: undefined,
  tdFormat: undefined,
  prType: undefined,
  prFormat: undefined,
  liveFormat: undefined,
  liveSource: undefined,
  liveTier: undefined,
  liveResults: undefined,
  liveSort: undefined,
  liveDir: undefined,
  incompleteStandings: undefined,
  hasDecks: undefined,
} as const;

function tabParam(value: string): (typeof OPT_IN_TABS)[number] | undefined {
  return OPT_IN_TABS.find((tab) => tab === value);
}

// Each tab renders its own page top bar: BaseUI unmounts the hidden panel, so
// only the active tab's bar is ever portalled into the layout slot.
export function MetaAdminPage() {
  const { data } = useAdminMetaOverlays();
  const corrections = useMetaEventCorrections();
  const tab = routeApi.useSearch({ select: (search) => search.tab ?? "sync" });
  const navigate = routeApi.useNavigate();

  const pendingCount = data.overlays.length + (corrections.data?.items.length ?? 0);
  const pendingLabel = `${pendingCount}${corrections.data?.hasMore === true ? "+" : ""}`;

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        void navigate({
          search: (prev) => ({ ...prev, ...CLEARED_TABLE_FILTERS, tab: tabParam(value) }),
          replace: true,
        });
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList variant="line">
        <TabsTrigger value="sync">Overview</TabsTrigger>
        <TabsTrigger value="catalogue">Mirror</TabsTrigger>
        <TabsTrigger value="review">
          Review
          {pendingCount > 0 && <Badge variant="count">{pendingLabel}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="public">Published</TabsTrigger>
      </TabsList>
      <TabsContent value="sync" className="flex min-h-0 flex-1 flex-col">
        <MetaAdminOverviewPage />
      </TabsContent>
      <TabsContent value="catalogue" className="flex min-h-0 flex-1 flex-col">
        <MetaMirrorPage />
      </TabsContent>
      <TabsContent value="review" className="flex min-h-0 flex-1 flex-col">
        <MetaOverlaysPage />
      </TabsContent>
      <TabsContent value="public" className="flex min-h-0 flex-1 flex-col">
        <MetaEventsPage />
      </TabsContent>
    </Tabs>
  );
}

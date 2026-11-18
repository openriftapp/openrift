import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { PlayIcon } from "lucide-react";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";

import { BuilderWorkbench } from "@/components/layout/builder-workbench";
import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarPrimaryButton,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { PresentCardBrowser } from "@/features/stage/components/present-card-browser";
import { PresentQueuePanel } from "@/features/stage/components/present-queue-panel";
import type { QueueSource } from "@/features/stage/components/queue-source-picker";
import { StageDndContext } from "@/features/stage/components/stage-dnd-context";
import { StageIntroBanner } from "@/features/stage/components/stage-intro-banner";
import { StageOutputBlock } from "@/features/stage/components/stage-output-block";
import { useApplyStagePreset } from "@/features/stage/hooks/use-apply-stage-preset";
import { MAX_QUEUE_LENGTH } from "@/features/stage/lib/presentation-queue";
import {
  queueDraftSearch,
  startPresentingSearch,
} from "@/features/stage/lib/presentation-queue-search";
import { usePresentQueueStore } from "@/features/stage/stores/present-queue-store";
import { m } from "@/paraglide/messages.js";
import { useOnboardingStore } from "@/stores/onboarding-store";

const routeApi = getRouteApi("/_app/stage");

export function StagePage() {
  const search = routeApi.useSearch();
  useApplyStagePreset(search.preset);

  return (
    <FilterSearchProvider value={search}>
      <StageBuilder initialIds={search.cards ?? []} />
    </FilterSearchProvider>
  );
}

function StageBuilder({ initialIds }: { initialIds: readonly string[] }) {
  const navigate = useNavigate();
  const queued = usePresentQueueStore((state) => state.ids.length);
  const introDismissed = useOnboardingStore((state) => state.dismissedIntros.includes("stage"));
  const dismissIntro = useOnboardingStore((state) => state.dismissIntro);

  // Loads the URL's queue once, then keeps `?cards=` synced to it. Subscribed
  // after the load, and unsubscribed before the reset, to avoid feedback loops.
  useEffect(() => {
    usePresentQueueStore.getState().load(initialIds);
    const unsubscribe = usePresentQueueStore.subscribe((state, previous) => {
      if (state.ids === previous.ids) {
        return;
      }
      // `replace` so building a queue card by card doesn't bury the page the
      // creator came from under one history entry per click.
      void navigate({
        to: "/stage",
        search: (prev) => queueDraftSearch(prev, state.ids),
        replace: true,
      });
    });
    return () => {
      unsubscribe();
      usePresentQueueStore.getState().reset();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- mount only: `initialIds` is the URL's queue at arrival, and re-running on a later search change would stomp the draft mid-edit
  }, []);

  const start = () => {
    // The updater form keeps the browser's filters in the URL, so leaving the
    // show lands back on the same filtered view the queue was built from.
    const ids = usePresentQueueStore.getState().ids;
    void navigate({ to: "/stage/show", search: (prev) => startPresentingSearch(prev, ids) });
  };

  const addSource = (source: QueueSource) => {
    const { added, dropped } = usePresentQueueStore.getState().addMany(source.printingIds);
    if (dropped > 0) {
      toast.warning(
        m.stage_add_source_partial({
          added,
          total: source.printingIds.length,
          source: source.label,
          max: MAX_QUEUE_LENGTH,
        }),
      );
      return;
    }
    if (added === 0) {
      toast.warning(m.stage_add_source_none({ source: source.label }));
      return;
    }
    toast.success(m.stage_add_source_success({ added, source: source.label }));
  };

  return (
    <StageDndContext>
      <BuilderWorkbench
        // Wider than the tier builder's aside: it carries the queue and the OBS
        // output's scene setup, whose placement controls need the room.
        asideClassName="lg:w-[38%] lg:max-w-md"
        aside={
          <Suspense
            fallback={
              <div className="text-muted-foreground text-sm">{m.stage_loading_cards()}</div>
            }
          >
            <div className="flex flex-col gap-6">
              {queued === 0 && !introDismissed && (
                <StageIntroBanner onDismiss={() => dismissIntro("stage")} />
              )}
              <PresentQueuePanel onAdd={addSource} />
              <StageOutputBlock onStart={start} canStart={queued > 0} />
            </div>
          </Suspense>
        }
        topBar={
          <PageTopBar>
            <PageTopBarTitle>{m.nav_stage()}</PageTopBarTitle>
            {queued > 0 && (
              <Badge variant="outline">{m.stage_queued_badge({ count: queued })}</Badge>
            )}
            <PageTopBarActions>
              <PageTopBarPrimaryButton onClick={start} disabled={queued === 0}>
                <PlayIcon />
                {m.stage_output_start()}
              </PageTopBarPrimaryButton>
            </PageTopBarActions>
          </PageTopBar>
        }
      >
        <Suspense
          fallback={<div className="text-muted-foreground text-sm">{m.stage_loading_cards()}</div>}
        >
          <PresentCardBrowser />
        </Suspense>
      </BuilderWorkbench>
    </StageDndContext>
  );
}

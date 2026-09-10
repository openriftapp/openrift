import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { useHotkey } from "@tanstack/react-hotkeys";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { CheckCheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  PageTopBarBack,
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { AttentionTab } from "@/features/catalog-admin/components/attention-tab";
import { BansErrataTab } from "@/features/catalog-admin/components/bans-errata-tab";
import { CardFieldsTab } from "@/features/catalog-admin/components/card-fields-tab";
import { CompareTab } from "@/features/catalog-admin/components/compare-tab";
import { HistoryTab } from "@/features/catalog-admin/components/history-tab";
import { MarketplaceTab } from "@/features/catalog-admin/components/marketplace-tab";
import { OverviewTab } from "@/features/catalog-admin/components/overview-tab";
import { PrintingsTab } from "@/features/catalog-admin/components/printings-tab";
import { useCardsListWalk } from "@/features/catalog-admin/hooks/use-cards-list-walk";
import { useReviewQueueWhen } from "@/features/catalog-admin/hooks/use-catalog-review";
import { useCheckAllSources } from "@/features/catalog-admin/hooks/use-check-all-sources";
import {
  attentionCount,
  buildAttentionSources,
  buildAttentionSubmissions,
} from "@/features/catalog-admin/lib/attention-items";
import type { CatalogTab } from "@/features/catalog-admin/lib/catalog-tabs";
import {
  CATALOG_TAB_LABELS,
  CATALOG_TAB_VALUES,
  DEFAULT_CATALOG_TAB,
} from "@/features/catalog-admin/lib/catalog-tabs";
import type { ReviewFilter } from "@/features/catalog-admin/lib/review-queue";
import {
  reviewItemTarget,
  reviewNeighbours,
  selectReviewItems,
} from "@/features/catalog-admin/lib/review-queue";
import { cn } from "@/lib/utils";

const routeApi = getRouteApi("/_app/_authenticated/admin/catalog/cards/$cardSlug");

function NotBuiltYet({ cardSlug }: { cardSlug: string }) {
  return (
    <Callout>
      <p className="font-medium">Not built yet in the new surface</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Use the old card page while this tab is being ported.{" "}
        <Link
          to="/admin/cards/$cardSlug"
          params={{ cardSlug }}
          className="text-primary hover:underline"
        >
          Open {cardSlug} on /admin/cards
        </Link>
      </p>
    </Callout>
  );
}

function TabBody({
  tab,
  detail,
  cardSlug,
  onSettled,
}: {
  tab: CatalogTab;
  detail: AdminCardDetailResponse;
  cardSlug: string;
  onSettled: () => void;
}) {
  switch (tab) {
    case "overview": {
      return <OverviewTab detail={detail} cardSlug={cardSlug} />;
    }
    case "attention": {
      return <AttentionTab detail={detail} cardSlug={cardSlug} onSettled={onSettled} />;
    }
    case "compare": {
      return <CompareTab detail={detail} cardSlug={cardSlug} />;
    }
    case "fields": {
      return <CardFieldsTab detail={detail} cardSlug={cardSlug} />;
    }
    case "printings": {
      return <PrintingsTab detail={detail} cardSlug={cardSlug} />;
    }
    case "marketplace": {
      return <MarketplaceTab cardSlug={cardSlug} />;
    }
    case "bans": {
      return <BansErrataTab detail={detail} />;
    }
    case "history": {
      return <HistoryTab cardSlug={cardSlug} />;
    }
    default: {
      return <NotBuiltYet cardSlug={cardSlug} />;
    }
  }
}

export function CatalogCardPage({ cardSlug }: { cardSlug: string }) {
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const { data: detail, isLoading } = useAdminCardDetail(cardSlug) as {
    data: AdminCardDetailResponse | undefined;
    isLoading: boolean;
  };
  const { data: providerSettingsData } = useProviderSettings();
  const checkAllSources = useCheckAllSources(cardSlug);

  const tab: CatalogTab = search.tab ?? DEFAULT_CATALOG_TAB;
  const fromReview = search.from === "review";
  const fromCards = search.from === "cards";
  const { data: queue } = useReviewQueueWhen(fromReview);
  const queueFilter: ReviewFilter = search.filter ?? "all";
  const queueItems = selectReviewItems(queue?.items ?? [], queueFilter, search.q ?? "");
  const neighbours = reviewNeighbours(queueItems, cardSlug);

  const listWalk = useCardsListWalk({ enabled: fromCards, key: cardSlug, search, tab });

  const canWalkPrev = fromCards ? listWalk.hasPrev : neighbours.prev !== null;
  const canWalkNext = fromCards ? listWalk.hasNext : neighbours.next !== null;

  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const walkRef = useRef<(direction: "prev" | "next") => void>(() => {});
  useHotkey("Mod+ArrowLeft", () => walkRef.current("prev"), { enabled: fromReview || fromCards });
  useHotkey("Mod+ArrowRight", () => walkRef.current("next"), { enabled: fromReview || fromCards });

  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const checkAllRef = useRef<() => void>(() => {});
  useHotkey("Mod+Shift+Enter", () => checkAllRef.current(), {
    enabled: tab === "compare" && !checkAllSources.isPending,
  });

  function goToQueueItem(item: (typeof queueItems)[number] | null) {
    if (!item) {
      return;
    }
    const queueSearch = { from: "review" as const, filter: search.filter, q: search.q };
    const target = reviewItemTarget(item);
    if (target.kind === "card") {
      void navigate({
        to: "/admin/catalog/cards/$cardSlug",
        params: { cardSlug: target.cardSlug },
        search: { ...queueSearch, tab: tab === DEFAULT_CATALOG_TAB ? undefined : tab },
      });
      return;
    }
    void navigate({
      to: "/admin/catalog/drafts/$name",
      params: { name: target.name },
      search: queueSearch,
    });
  }

  // `next` is snapshotted by the caller before the checks invalidate the queue,
  // so the walk cannot skip an item on a refetch that lands first.
  async function checkAllAndWalk(next: (typeof queueItems)[number] | null) {
    if (!detail || checkAllSources.isPending) {
      return;
    }
    const settled = await checkAllSources.run(detail);
    if (!settled) {
      return;
    }
    if (fromReview) {
      goToQueueItem(next);
      return;
    }
    toast.success("All sources checked");
  }

  useEffect(() => {
    walkRef.current = (direction) => {
      if (fromCards) {
        listWalk.go(direction);
        return;
      }
      goToQueueItem(direction === "prev" ? neighbours.prev : neighbours.next);
    };
    checkAllRef.current = () => {
      void checkAllAndWalk(neighbours.next);
    };
  });

  const attentionTotal = detail
    ? attentionCount(
        buildAttentionSubmissions(detail),
        buildAttentionSources(detail, providerSettingsData.providerSettings),
      )
    : 0;

  const printing = detail?.printings.at(0);
  const meta = [printing?.shortCode, printing?.setName ?? printing?.setSlug]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <>
      <AdminPageTopBar
        title={detail?.card?.name ?? cardSlug}
        back={
          fromCards ? (
            <PageTopBarBack to="/admin/catalog/cards" aria-label="Back to cards" />
          ) : (
            <PageTopBarBack to="/admin/catalog/review" aria-label="Back to review" />
          )
        }
        actions={
          <>
            {tab === "compare" && (
              <PageTopBarPrimaryButton
                className="gap-1.5"
                disabled={checkAllSources.isPending || !detail?.card}
                onClick={() => checkAllRef.current()}
              >
                <CheckCheckIcon />
                Mark all checked &amp; next
                <Kbd className="bg-background/20 pointer-events-none ml-1 leading-none text-inherit opacity-60">
                  Ctrl &#8679; &#8629;
                </Kbd>
              </PageTopBarPrimaryButton>
            )}
            {(fromReview || fromCards) && (
              <>
                <PageTopBarIconButton
                  aria-label={fromCards ? "Previous card" : "Previous in queue"}
                  disabled={!canWalkPrev}
                  onClick={() => walkRef.current("prev")}
                >
                  <ChevronLeftIcon />
                </PageTopBarIconButton>
                <PageTopBarIconButton
                  aria-label={fromCards ? "Next card" : "Next in queue"}
                  disabled={!canWalkNext}
                  onClick={() => walkRef.current("next")}
                >
                  <ChevronRightIcon />
                </PageTopBarIconButton>
              </>
            )}
            <PageTopBarButton
              render={<Link to="/cards/$cardSlug/{-$printingSlug}" params={{ cardSlug }} />}
            >
              View public page
            </PageTopBarButton>
          </>
        }
      />

      <div className="pt-3">
        {meta && <p className="text-muted-foreground mb-4 text-sm">{meta}</p>}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
          <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
            {CATALOG_TAB_VALUES.map((value) => (
              <Link
                key={value}
                to="/admin/catalog/cards/$cardSlug"
                params={{ cardSlug }}
                search={{ ...search, tab: value === DEFAULT_CATALOG_TAB ? undefined : value }}
                className={cn(
                  "hover:bg-muted/50 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm",
                  value === tab && "bg-muted",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{CATALOG_TAB_LABELS[value]}</span>
                {value === "attention" && attentionTotal > 0 && (
                  <Badge variant="count">{attentionTotal}</Badge>
                )}
              </Link>
            ))}
          </nav>

          <div className="min-w-0">
            {isLoading || !detail ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <TabBody
                tab={tab}
                detail={detail}
                cardSlug={cardSlug}
                onSettled={() => {
                  if (!fromReview) {
                    return;
                  }
                  // Snapshotted before the settle invalidates the queue, so the
                  // walk cannot skip an item on a refetch that lands first.
                  goToQueueItem(neighbours.next);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

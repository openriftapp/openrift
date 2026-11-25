import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { RecordBanner } from "@/features/catalog-workspace/components/record/record-pane";
import { buildCardPass, reviewNeighbor } from "@/features/catalog-workspace/lib/card-pass";
import {
  reviewCardsQueryOptions,
  selectReviewQueue,
} from "@/features/catalog-workspace/lib/review-cards";
import type { ReviewStop, ReviewTrail } from "@/features/catalog-workspace/lib/review-stops";
import {
  nextPendingStop,
  reviewStops,
  stopPosition,
} from "@/features/catalog-workspace/lib/review-stops";
import { useCostKeywords } from "@/hooks/use-keyword-styles";

declare module "@tanstack/react-router" {
  interface HistoryState {
    workspaceReview?: ReviewTrail;
  }
}

export function stopNavigation(stop: ReviewStop, trail: ReviewTrail): NavigateOptions {
  if (stop.kind === "face") {
    return {
      to: "/admin/workspace/faces/$cardSlug/$faceId",
      params: { cardSlug: trail.cardSlug, faceId: stop.faceId },
      state: { workspaceReview: trail },
    };
  }
  if (stop.kind === "printing") {
    return {
      to: "/admin/workspace/printings/$printingId",
      params: { printingId: stop.printingId },
      state: { workspaceReview: trail },
    };
  }
  return {
    to: "/admin/workspace/cards/$cardSlug",
    params: { cardSlug: trail.cardSlug },
    search: { queue: trail.queue },
  };
}

export function ReviewStopBar({ current }: { current: ReviewStop }) {
  const trail = useLocation({ select: (location) => location.state.workspaceReview });
  return trail === undefined ? null : <StopBar trail={trail} current={current} />;
}

function StopBar({ trail, current }: { trail: ReviewTrail; current: ReviewStop }) {
  const navigate = useNavigate();
  const { data: detail } = useAdminCardDetail(trail.cardSlug);
  const { data: providerData } = useProviderSettings();
  const { data: access } = useAdminAccess();
  const { data: review } = useQuery(reviewCardsQueryOptions());
  const costKeywords = useCostKeywords();
  if (detail === undefined) {
    return null;
  }
  const pass = buildCardPass(detail, {
    providerSettings: providerData.providerSettings,
    submissions: buildAttentionSubmissions(detail, costKeywords),
    costKeywords,
    isAdmin: access?.isAdmin === true,
  });
  const stops = reviewStops(pass);
  const next = nextPendingStop(stops, current);
  const position = stopPosition(stops, current);

  function goNext() {
    if (next !== null) {
      void navigate(stopNavigation(next, trail));
      return;
    }
    const cards = selectReviewQueue(review?.cards ?? [], trail.queue);
    const card = reviewNeighbor(cards, trail.cardSlug, 1, trail.cardIndex);
    if (card === null || card.cardSlug === null) {
      void navigate({ to: "/admin/workspace/cards", search: { queue: trail.queue } });
      return;
    }
    void navigate({
      to: "/admin/workspace/cards/$cardSlug",
      params: { cardSlug: card.cardSlug },
      search: { queue: trail.queue },
    });
  }

  return (
    <RecordBanner>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1">
          Reviewing{" "}
          <TextLink render={<Link {...stopNavigation({ kind: "card" }, trail)} />}>
            {detail.displayName}
          </TextLink>
          <span className="text-muted-foreground">
            {" "}
            · stop {position.index + 1} of {position.total}
          </span>
        </span>
        <Button size="sm" onClick={goNext}>
          {next === null ? "Next card" : "Next"}
        </Button>
      </span>
    </RecordBanner>
  );
}

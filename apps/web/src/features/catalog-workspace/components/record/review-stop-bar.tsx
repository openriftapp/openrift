import { Link, useLocation } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import { RecordBanner } from "@/features/catalog-workspace/components/record/record-pane";
import { useReviewNavigation } from "@/features/catalog-workspace/hooks/use-card-pass";
import { useWorkspaceKeyboard } from "@/features/catalog-workspace/hooks/use-workspace-keyboard";
import { buildCardPass } from "@/features/catalog-workspace/lib/card-pass";
import type { ReviewStop, ReviewTrail } from "@/features/catalog-workspace/lib/review-stops";
import {
  nextPendingStop,
  reviewStops,
  stopNavigation,
  stopPosition,
} from "@/features/catalog-workspace/lib/review-stops";
import { useCostKeywords } from "@/hooks/use-keyword-styles";

export function ReviewStopBar({ current }: { current: ReviewStop }) {
  const trail = useLocation({ select: (location) => location.state.workspaceReview });
  return trail === undefined ? null : <StopBar trail={trail} current={current} />;
}

function StopBar({ trail, current }: { trail: ReviewTrail; current: ReviewStop }) {
  const { data: detail } = useAdminCardDetail(trail.cardSlug);
  const { data: providerData } = useProviderSettings();
  const { data: access } = useAdminAccess();
  const costKeywords = useCostKeywords();
  const review = useReviewNavigation(trail.cardSlug, trail);
  const pass =
    detail === undefined
      ? null
      : buildCardPass(detail, {
          providerSettings: providerData.providerSettings,
          submissions: buildAttentionSubmissions(detail, costKeywords),
          costKeywords,
          isAdmin: access?.isAdmin === true,
        });
  const stops = pass === null ? [] : reviewStops(pass);
  const next = nextPendingStop(stops, current);
  const navigation = {
    goNext: () => {
      if (pass !== null) {
        review.advance(next, trail);
      }
    },
    goPrev: review.goPrev,
  };
  useWorkspaceKeyboard(navigation);
  if (detail === undefined) {
    return null;
  }
  const position = stopPosition(stops, current);

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
        <Button size="sm" onClick={() => navigation.goNext()}>
          {next === null ? "Next card" : "Next"}
          <Kbd>↵</Kbd>
        </Button>
      </span>
    </RecordBanner>
  );
}

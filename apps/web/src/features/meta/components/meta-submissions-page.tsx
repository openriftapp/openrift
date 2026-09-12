import { formatDay } from "@openrift/shared/format-date";
import type { MetaSubmission } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { ScrollTextIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import {
  PageDescription,
  PageTopBar,
  PageTopBarActions,
  PageTopBarBack,
  PageTopBarPrimaryButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { Skeleton } from "@/components/ui/skeleton";
import { MetaShowMore } from "@/features/meta/components/meta-show-more";
import { useMetaSubmissions } from "@/features/meta/hooks/use-meta-submissions";
import {
  metaSubmissionExplanation,
  metaSubmissionKindLabels,
  metaSubmissionStatusBadgeVariant,
  metaSubmissionStatusHints,
  metaSubmissionStatusLabels,
} from "@/features/meta/lib/meta-submission-copy";
import { cn, PAGE_WIDTH } from "@/lib/utils";

function SubmissionRow({
  submission,
  shareToken,
}: {
  submission: MetaSubmission;
  shareToken: string | null;
}) {
  const explanation = metaSubmissionExplanation(
    submission.resolutionReason,
    submission.resolutionNote,
  );
  const hint = metaSubmissionStatusHints[submission.status];

  return (
    <RowListItem className="flex-col items-stretch gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-medium">{submission.eventName}</span>
          {submission.playerName !== null && (
            <span className="text-muted-foreground text-sm">{submission.playerName}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="muted">{metaSubmissionKindLabels[submission.kind]}</Badge>
          <Badge variant={metaSubmissionStatusBadgeVariant[submission.status]}>
            {metaSubmissionStatusLabels[submission.status]}
          </Badge>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Sent {formatDay(submission.createdAt)}
        {submission.resolvedAt ? ` · Reviewed ${formatDay(submission.resolvedAt)}` : ""}
      </p>

      {explanation ? <p>{explanation}</p> : null}
      {!explanation && hint ? <p className="text-muted-foreground">{hint}</p> : null}

      {submission.note ? (
        <Callout variant="inset" className="text-muted-foreground text-sm italic">
          {submission.note}
        </Callout>
      ) : null}

      {shareToken ? (
        <Link
          to="/meta/decks/$token"
          params={{ token: shareToken }}
          className="text-sm underline underline-offset-4"
        >
          See the deck on the archive
        </Link>
      ) : null}
    </RowListItem>
  );
}

export function MetaSubmissionsPage() {
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useMetaSubmissions();
  const submissions = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarBack to="/meta" />
          <PageTopBarTitle>Your contributions</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarPrimaryButton render={<Link to="/meta/submit" />}>
              Send a decklist
            </PageTopBarPrimaryButton>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-6 pt-3 pb-12")}>
        <PageDescription>
          Everything you&apos;ve sent to the archive, and what happened to each one.
        </PageDescription>

        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : null}

        {!isPending && submissions.length === 0 ? (
          <EmptyState
            icon={ScrollTextIcon}
            title="Nothing sent in yet"
            description="Watched a tournament and know what people played? Send in a decklist and track its review here. Help us fill in the gaps."
          >
            <Button render={<Link to="/meta/submit" />}>Send a decklist</Button>
          </EmptyState>
        ) : null}

        {submissions.length > 0 ? (
          <div>
            <RowList variant="divided" className="[&>li]:py-4">
              {submissions.map((submission) => (
                <SubmissionRow
                  key={submission.id}
                  submission={submission}
                  shareToken={submission.acceptedDeckToken}
                />
              ))}
            </RowList>
            {hasNextPage ? (
              <MetaShowMore disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                {isFetchingNextPage ? "Loading…" : "Show older contributions"}
              </MetaShowMore>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

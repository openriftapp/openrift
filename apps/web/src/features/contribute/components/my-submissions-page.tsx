import type { CardSubmissionStatusResponse } from "@openrift/shared/contracts/card-submissions";
import { formatDay } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";

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
import { TextLink } from "@/components/ui/text-link";
import { useCardSubmissions } from "@/features/contribute/hooks/use-card-submissions";
import {
  submissionExplanation,
  submissionKindLabels,
  submissionStatusBadgeVariant,
  submissionStatusHints,
  submissionStatusLabels,
} from "@/features/contribute/lib/card-submission-copy";
import { cn, PAGE_WIDTH } from "@/lib/utils";

function SubmissionRow({ submission }: { submission: CardSubmissionStatusResponse }) {
  const explanation = submissionExplanation(submission.reason, submission.resolutionNote);
  const hint = submissionStatusHints[submission.status];
  const cardLink = submission.cardSlug;

  return (
    <RowListItem className="flex-col items-stretch gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {cardLink ? (
            <TextLink
              variant="inherit"
              className="font-medium"
              render={
                <Link to="/cards/$cardSlug/{-$printingSlug}" params={{ cardSlug: cardLink }} />
              }
            >
              {submission.cardName}
            </TextLink>
          ) : (
            <span className="font-medium">{submission.cardName}</span>
          )}
          <span className="text-muted-foreground text-sm">
            {submissionKindLabels[submission.kind]}
          </span>
        </div>
        <Badge variant={submissionStatusBadgeVariant[submission.status]}>
          {submissionStatusLabels[submission.status]}
        </Badge>
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
    </RowListItem>
  );
}

export function MySubmissionsPage() {
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useCardSubmissions();
  const submissions = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarBack to="/contribute" />
          <PageTopBarTitle>My submissions</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarPrimaryButton render={<Link to="/contribute/card" />}>
              Submit a card
            </PageTopBarPrimaryButton>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-8 pt-3 pb-12")}>
        <PageDescription>Every card and correction you&apos;ve sent in.</PageDescription>

        {isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : null}

        {!isPending && submissions.length === 0 ? (
          <EmptyState
            icon={FileTextIcon}
            title="Nothing sent in yet"
            description="Spotted a card we're missing, or something that looks wrong? Send it in and it shows up here with its review status. Help us fill in the gaps."
          >
            <Button render={<Link to="/contribute/card" />}>Submit a card</Button>
          </EmptyState>
        ) : null}

        {submissions.length > 0 ? (
          <RowList variant="divided" className="[&>li]:py-4">
            {submissions.map((submission) => (
              <SubmissionRow key={submission.id} submission={submission} />
            ))}
          </RowList>
        ) : null}

        {hasNextPage ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Loading…" : "Show older submissions"}
          </Button>
        ) : null}
      </div>
    </>
  );
}

import { formatDayTimeLocal } from "@openrift/shared/format-date";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Building2Icon, CalendarIcon, LinkIcon, UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageTopBar, PageTopBarSticky, PageTopBarTitle } from "@/components/layout/page-top-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckCheckInfoCardSkeleton } from "@/features/tournaments/components/deck-check-skeletons";
import {
  useClaimLanding,
  useClaimTournamentDeck,
} from "@/features/tournaments/hooks/use-deck-check-player";
import { useUserId } from "@/lib/auth-session";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function PlayerClaimPage({ token }: { token: string }) {
  const { data, isPending, isError } = useClaimLanding(token);
  const claim = useClaimTournamentDeck();
  const userId = useUserId();
  const navigate = useNavigate();
  const location = useLocation();

  if (isPending) {
    return (
      <div>
        <PageTopBarSticky width="capped">
          <PageTopBar>
            <PageTopBarTitle>{m.tournaments_claim_page_title_loading()}</PageTopBarTitle>
          </PageTopBar>
        </PageTopBarSticky>
        <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-4", PAGE_PADDING)}>
          <DeckCheckInfoCardSkeleton />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        className="py-12"
        icon={LinkIcon}
        title={m.tournaments_claim_invalid_title()}
        description={m.tournaments_claim_invalid_description()}
      />
    );
  }

  const onConfirm = async () => {
    if (!userId) {
      void navigate({ to: "/login", search: { redirect: location.href, email: undefined } });
      return;
    }
    const result = await claim.mutateAsync(token);
    // Only route on a successful (or idempotent) claim; refusals — conflict,
    // blocked, duplicate — stay on the page and render their explanation.
    if (
      (result.status === "claimed" || result.status === "already") &&
      result.tournamentId !== null
    ) {
      void navigate({
        to: result.entryId ? "/tournaments/$id/my-deck" : "/tournaments/$id",
        params: { id: result.tournamentId },
      });
    }
  };

  const outcome = claim.data?.status;

  return (
    <div>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.tournaments_claim_page_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-4", PAGE_PADDING)}>
        <Card>
          <CardHeader>
            <CardTitle>{data.tournamentName}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="size-4 shrink-0" />
                {formatDayTimeLocal(data.startsAt)}
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <Building2Icon className="size-4 shrink-0" />
                <span className="truncate">{data.hostName}</span>
              </span>
              {data.groupName ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <UsersIcon className="size-4 shrink-0" />
                  <span className="truncate">{data.groupName}</span>
                </span>
              ) : null}
            </div>
            <p className="text-sm">
              {m.tournaments_claim_your_spot_label()}{" "}
              <span className="font-medium">{data.participantName}</span>
            </p>
          </CardContent>
        </Card>

        {outcome === "conflict" ? (
          <p className="text-muted-foreground">{m.tournaments_claim_conflict()}</p>
        ) : outcome === "blocked" ? (
          <p className="text-muted-foreground">{m.tournaments_claim_blocked()}</p>
        ) : outcome === "duplicate" ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground">{m.tournaments_claim_duplicate()}</p>
            {claim.data?.tournamentId ? (
              <div>
                <Button
                  render={
                    <Link
                      to={claim.data.entryId ? "/tournaments/$id/my-deck" : "/tournaments/$id"}
                      params={{ id: claim.data.tournamentId }}
                    />
                  }
                >
                  {claim.data.entryId
                    ? m.tournaments_claim_go_to_deck()
                    : m.tournaments_claim_go_to_tournament()}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              {data.deckSubmission === "none"
                ? m.tournaments_claim_link_no_deck()
                : m.tournaments_claim_link_with_deck()}
              {userId ? "" : m.tournaments_claim_sign_in_note()}
            </p>
            <div>
              <Button onClick={() => void onConfirm()} disabled={claim.isPending}>
                {claim.isPending
                  ? m.tournaments_claim_claiming()
                  : userId
                    ? m.tournaments_claim_claim_spot()
                    : m.tournaments_claim_sign_in_to_claim()}
              </Button>
            </div>
            {claim.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{m.tournaments_claim_error()}</AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

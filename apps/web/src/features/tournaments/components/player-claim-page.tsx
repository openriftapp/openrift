import { formatDayTimeLocal } from "@openrift/shared/format-date";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2Icon, CalendarIcon, UsersIcon } from "lucide-react";

import { SignedOutAuthButtons } from "@/components/signed-out-cta";
import { Button, buttonVariants } from "@/components/ui/button";
import { SaveError } from "@/features/tournaments/components/save-error";
import {
  TokenLandingCard,
  TokenLandingPage,
} from "@/features/tournaments/components/token-landing-card";
import {
  useClaimLanding,
  useClaimTournamentDeck,
} from "@/features/tournaments/hooks/use-deck-check-player";
import { useUserId } from "@/hooks/use-session";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function PlayerClaimPage({ token }: { token: string }) {
  const { data } = useClaimLanding(token);
  const claim = useClaimTournamentDeck();
  const userId = useUserId();
  const navigate = useNavigate();

  const onConfirm = async () => {
    let result: Awaited<ReturnType<typeof claim.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await claim.mutateAsync(token);
    });
    if (!ok || !result) {
      return;
    }
    // Only route on a successful (or idempotent) claim; refusals (conflict,
    // blocked, duplicate) stay on the page and render their explanation.
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
    <TokenLandingPage
      pageTitle={
        data.deckSubmission === "none"
          ? m.tournaments_claim_page_title_spot()
          : m.tournaments_claim_page_title()
      }
    >
      <TokenLandingCard
        title={data.tournamentName}
        meta={
          <div className="flex flex-col gap-2">
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
          </div>
        }
      >
        {outcome === "conflict" ? (
          <p className="text-muted-foreground">{m.tournaments_claim_conflict()}</p>
        ) : outcome === "blocked" ? (
          <p className="text-muted-foreground">{m.tournaments_claim_blocked()}</p>
        ) : outcome === "duplicate" ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground">{m.tournaments_claim_duplicate()}</p>
            {claim.data?.tournamentId ? (
              <div>
                <Link
                  to={claim.data.entryId ? "/tournaments/$id/my-deck" : "/tournaments/$id"}
                  params={{ id: claim.data.tournamentId }}
                  className={buttonVariants()}
                >
                  {claim.data.entryId
                    ? m.tournaments_claim_go_to_deck()
                    : m.tournaments_claim_go_to_tournament()}
                </Link>
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
            {userId ? (
              <Button className="w-fit" onClick={() => void onConfirm()} pending={claim.isPending}>
                {m.tournaments_claim_claim_spot()}
              </Button>
            ) : (
              <SignedOutAuthButtons
                source="tournament-claim"
                signInLabel={m.tournaments_claim_sign_in_to_claim()}
              />
            )}
            <SaveError error={claim.error} />
          </>
        )}
      </TokenLandingCard>
    </TokenLandingPage>
  );
}

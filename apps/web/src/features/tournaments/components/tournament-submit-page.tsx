import type { PublicTournamentLandingResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SignedOutAuthButtons } from "@/components/signed-out-cta";
import { Button, buttonVariants } from "@/components/ui/button";
import { PlayerSubmitDeckSection } from "@/features/tournaments/components/player-submit-page";
import { SaveError } from "@/features/tournaments/components/save-error";
import {
  TokenLandingCard,
  TokenLandingPage,
} from "@/features/tournaments/components/token-landing-card";
import { useRequestJoinTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useTournamentSubmitLanding } from "@/features/tournaments/hooks/use-tournaments";
import { useUserId } from "@/hooks/use-session";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

function SignedOutJoinState({ data }: { data: PublicTournamentLandingResponse }) {
  if (!data.selfRegistrationOpen) {
    return (
      <p className="text-muted-foreground text-sm">{m.tournaments_submit_claim_link_hint()}</p>
    );
  }
  return (
    <>
      <p className="text-muted-foreground text-sm">
        {data.deckExpected
          ? m.tournaments_submit_signin_deck()
          : m.tournaments_submit_signin_spot()}
      </p>
      <SignedOutAuthButtons
        source="tournament-submit"
        signInLabel={m.tournaments_submit_signin_label()}
      />
    </>
  );
}

function SignedInJoinState({
  data,
  joined,
  pending,
  onJoin,
}: {
  data: PublicTournamentLandingResponse;
  joined: boolean;
  pending: boolean;
  onJoin: () => void;
}) {
  if (joined) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckIcon className="size-4" /> {m.tournaments_submit_request_sent_inline()}
      </div>
    );
  }
  const status = data.viewerParticipantStatus;
  if (status === "active" || status === "invited") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckIcon className="size-4" /> {m.tournaments_submit_have_spot()}
      </div>
    );
  }
  if (status === "requested") {
    return (
      <p className="text-muted-foreground text-sm">{m.tournaments_submit_request_sent_inline()}</p>
    );
  }
  if (status === "dropped" || status === "no_show") {
    return <p className="text-muted-foreground text-sm">{m.tournaments_submit_left_event()}</p>;
  }
  if (data.selfRegistrationOpen) {
    return (
      <Button onClick={onJoin} pending={pending}>
        {m.tournaments_submit_request_to_join()}
      </Button>
    );
  }
  return <p className="text-muted-foreground text-sm">{m.tournaments_submit_claim_link_hint()}</p>;
}

export function TournamentSubmitPage({ token }: { token: string }) {
  const { data } = useTournamentSubmitLanding(token);
  const requestJoin = useRequestJoinTournament();
  const userId = useUserId();
  const [joined, setJoined] = useState(false);

  async function handleJoin() {
    let result: Awaited<ReturnType<typeof requestJoin.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      result = await requestJoin.mutateAsync({ token });
    });
    if (!ok || !result) {
      return;
    }
    setJoined(true);
    toast.success(
      result.alreadyJoined
        ? m.tournaments_submit_already_registered_toast()
        : m.tournaments_submit_request_sent_toast(),
    );
  }

  const canSubmitDeck =
    Boolean(userId) && data.deckExpected && (data.selfRegistrationOpen || data.viewerIsParticipant);

  return (
    <TokenLandingPage pageTitle={m.tournaments_submit_title()}>
      <TokenLandingCard
        title={data.name}
        meta={
          <p className="text-muted-foreground">
            {m.tournaments_submit_hosted_by({ host: data.hostDisplayName })}
          </p>
        }
      >
        {data.deckExpected && canSubmitDeck ? (
          <p className="text-muted-foreground text-sm">
            {data.selfRegistrationOpen
              ? m.tournaments_submit_deck_expected_register()
              : m.tournaments_submit_deck_below()}
          </p>
        ) : null}
        {userId ? (
          <>
            <SignedInJoinState
              data={data}
              joined={joined}
              pending={requestJoin.isPending}
              onJoin={() => void handleJoin()}
            />
            <SaveError error={requestJoin.error} />
            <Link
              to="/tournaments"
              className={buttonVariants({ variant: "ghost", className: "w-fit" })}
            >
              {m.tournaments_staff_invite_go_to_tournaments()}
            </Link>
          </>
        ) : (
          <SignedOutJoinState data={data} />
        )}
      </TokenLandingCard>

      {canSubmitDeck ? <PlayerSubmitDeckSection token={token} /> : null}
    </TokenLandingPage>
  );
}

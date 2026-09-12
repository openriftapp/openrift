import type { PublicTournamentLandingResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageTopBar, PageTopBarSticky, PageTopBarTitle } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignedOutAuthButtons } from "@/features/account/components/signed-out-cta";
import { PlayerSubmitDeckSection } from "@/features/tournaments/components/player-submit-page";
import { useRequestJoinTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useTournamentSubmitLanding } from "@/features/tournaments/hooks/use-tournaments";
import { useUserId } from "@/lib/auth-session";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
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
      <SignedOutAuthButtons signInLabel={m.tournaments_submit_signin_label()} />
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
  if (data.selfRegistrationOpen) {
    return (
      <Button onClick={onJoin} disabled={pending}>
        {m.tournaments_submit_request_to_join()}
      </Button>
    );
  }
  if (data.viewerIsParticipant) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckIcon className="size-4" /> {m.tournaments_submit_have_spot()}
      </div>
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
    let result;
    try {
      result = await requestJoin.mutateAsync({ token });
    } catch {
      // Reported by the global mutation error toast.
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
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.tournaments_submit_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn("flex flex-col gap-6 pt-3", PAGE_WIDTH.capped, PAGE_PADDING_NO_TOP)}>
        <Card>
          <CardHeader>
            <CardTitle>{data.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              {m.tournaments_submit_hosted_by({ host: data.hostDisplayName })}
            </p>
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
                <Button variant="ghost" render={<Link to="/tournaments" />} className="w-fit">
                  {m.tournaments_staff_invite_go_to_tournaments()}
                </Button>
              </>
            ) : (
              <SignedOutJoinState data={data} />
            )}
          </CardContent>
        </Card>

        {canSubmitDeck ? <PlayerSubmitDeckSection token={token} /> : null}
      </div>
    </>
  );
}

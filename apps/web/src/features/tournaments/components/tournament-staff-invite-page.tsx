import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { TournamentStaffRole } from "@openrift/shared/types/api/tournament";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { PROSE_MARKUP } from "@/components/message-markup";
import { SignedOutAuthButtons } from "@/components/signed-out-cta";
import { Button, buttonVariants } from "@/components/ui/button";
import { SaveError } from "@/features/tournaments/components/save-error";
import {
  TokenLandingCard,
  TokenLandingPage,
} from "@/features/tournaments/components/token-landing-card";
import { useClaimStaffInvite } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useTournamentStaffInviteLanding } from "@/features/tournaments/hooks/use-tournaments";
import { staffRoleLabels } from "@/features/tournaments/lib/tournament-display";
import { useUserId } from "@/hooks/use-session";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

function StaffInviteAction({
  alreadyStaff,
  role,
  signedIn,
  pending,
  onConfirm,
}: {
  alreadyStaff: boolean;
  role: TournamentStaffRole;
  signedIn: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  if (!signedIn) {
    return (
      <>
        <p className="text-muted-foreground text-sm">{m.tournaments_staff_invite_signin_hint()}</p>
        <SignedOutAuthButtons
          source="tournament-staff-invite"
          signInLabel={m.tournaments_staff_invite_signin_label()}
        />
      </>
    );
  }
  if (alreadyStaff) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckIcon className="size-4" />{" "}
        {role === "judge"
          ? m.tournaments_staff_invite_already_judge()
          : m.tournaments_staff_invite_already_organizer()}
      </div>
    );
  }
  return (
    <Button onClick={onConfirm} pending={pending}>
      {role === "judge"
        ? m.tournaments_staff_invite_accept_judge()
        : m.tournaments_staff_invite_accept_organizer()}
    </Button>
  );
}

// The grant only happens on explicit confirm (a POST), never on opening the page.
export function TournamentStaffInvitePage({ token }: { token: string }) {
  const { data } = useTournamentStaffInviteLanding(token);
  const claim = useClaimStaffInvite();
  const navigate = useNavigate();
  const userId = useUserId();
  const roleLabel = staffRoleLabels()[data.role];

  async function handleConfirm() {
    const successMessage =
      data.role === "judge"
        ? m.tournaments_staff_invite_success_judge()
        : m.tournaments_staff_invite_success_organizer();
    let claimed: Awaited<ReturnType<typeof claim.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      claimed = await claim.mutateAsync(token);
    });
    if (ok && claimed) {
      toast.success(successMessage);
      void navigate({ to: "/tournaments/$id", params: { id: claimed.tournamentId } });
    }
  }

  return (
    <TokenLandingPage pageTitle={m.tournaments_staff_invite_title()}>
      <TokenLandingCard
        title={data.name}
        meta={
          <p className="text-muted-foreground">
            <ParaglideMessage
              message={m.tournaments_staff_invite_hosted}
              inputs={{ host: data.hostDisplayName, role: roleLabel }}
              markup={{ strong: PROSE_MARKUP.strong }}
            />
          </p>
        }
      >
        <StaffInviteAction
          alreadyStaff={data.alreadyStaff}
          role={data.role}
          signedIn={Boolean(userId)}
          pending={claim.isPending}
          onConfirm={() => void handleConfirm()}
        />
        <SaveError error={claim.error} />
        {userId ? (
          <Link
            to="/tournaments"
            className={buttonVariants({ variant: "ghost", className: "w-fit" })}
          >
            {m.tournaments_staff_invite_go_to_tournaments()}
          </Link>
        ) : null}
      </TokenLandingCard>
    </TokenLandingPage>
  );
}

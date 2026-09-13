import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { TournamentStaffRole } from "@openrift/shared/types/api/tournament";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { PageTopBar, PageTopBarSticky, PageTopBarTitle } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignedOutAuthButtons } from "@/features/account/components/signed-out-cta";
import { useClaimStaffInvite } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useTournamentStaffInviteLanding } from "@/features/tournaments/hooks/use-tournaments";
import { staffRoleLabels } from "@/features/tournaments/lib/tournament-display";
import { useUserId } from "@/lib/auth-session";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
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
        <SignedOutAuthButtons signInLabel={m.tournaments_staff_invite_signin_label()} />
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
    <Button onClick={onConfirm} disabled={pending}>
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
    try {
      const result = await claim.mutateAsync(token);
      toast.success(successMessage);
      void navigate({ to: "/tournaments/$id", params: { id: result.tournamentId } });
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.tournaments_staff_invite_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        <Card>
          <CardHeader>
            <CardTitle>{data.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              <ParaglideMessage
                message={m.tournaments_staff_invite_hosted}
                inputs={{ host: data.hostDisplayName, role: roleLabel }}
                markup={{
                  strong: ({ children }) => (
                    <span className="text-foreground font-medium">{children}</span>
                  ),
                }}
              />
            </p>
            <StaffInviteAction
              alreadyStaff={data.alreadyStaff}
              role={data.role}
              signedIn={Boolean(userId)}
              pending={claim.isPending}
              onConfirm={() => void handleConfirm()}
            />
            {userId ? (
              <Button variant="ghost" render={<Link to="/tournaments" />} className="w-fit">
                {m.tournaments_staff_invite_go_to_tournaments()}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

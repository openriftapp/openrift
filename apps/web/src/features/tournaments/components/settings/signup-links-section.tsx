import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { useState } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ShareLinkRow } from "@/features/groups/components/share-link-row";
import {
  useSetTournamentSubmissionToken,
  useUpdateTournament,
} from "@/features/tournaments/hooks/use-tournament-mutations";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

/**
 * Self-registration toggle plus the shareable sign-up / deck submission link.
 * Disabling it is confirmed because the old link dies immediately.
 */
export function SignupLinksSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const setSubmissionToken = useSetTournamentSubmissionToken();
  const [confirmDisable, setConfirmDisable] = useState(false);

  const registrationUrl = detail.submissionToken
    ? `${getSiteUrl()}/tournaments/submit/${detail.submissionToken}`
    : null;
  const deckExpected = detail.deckSubmission !== "none";
  const showLink = detail.selfRegistration || deckExpected;
  const linkLabel = detail.selfRegistration
    ? m.tournaments_settings_registration_link()
    : m.tournaments_settings_deck_submission_link();

  async function handleDisable() {
    await runReportedMutation(() =>
      setSubmissionToken.mutateAsync({ id: detail.id, enabled: false }),
    );
    setConfirmDisable(false);
  }

  return (
    <>
      <SettingsSection
        id="signup-links"
        title={m.tournaments_settings_signup_title()}
        description={
          m.tournaments_settings_signup_description() +
          (deckExpected ? m.tournaments_settings_signup_deck_note() : "")
        }
        contentClassName="gap-3"
      >
        <div className="flex items-center gap-3">
          <Switch
            id="t-self-reg"
            checked={detail.selfRegistration}
            disabled={locked || updateTournament.isPending}
            onCheckedChange={(checked) =>
              void runReportedMutation(() =>
                updateTournament.mutateAsync({ id: detail.id, selfRegistration: checked }),
              )
            }
          />
          <Label htmlFor="t-self-reg">{m.tournaments_settings_self_registration()}</Label>
        </div>
        {showLink ? (
          <div className="flex flex-col gap-2">
            <Label>{linkLabel}</Label>
            {registrationUrl ? (
              <ShareLinkRow
                url={registrationUrl}
                label={linkLabel}
                defaultQrOpen
                actions={
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    disabled={locked || setSubmissionToken.isPending}
                    onClick={() => setConfirmDisable(true)}
                  >
                    {m.tournaments_settings_disable()}
                  </Button>
                }
              />
            ) : (
              <Button
                className="w-fit"
                disabled={locked || setSubmissionToken.isPending}
                onClick={() =>
                  void runReportedMutation(() =>
                    setSubmissionToken.mutateAsync({ id: detail.id, enabled: true }),
                  )
                }
              >
                {detail.selfRegistration
                  ? m.tournaments_settings_enable_registration_link()
                  : m.tournaments_settings_enable_deck_submission_link()}
              </Button>
            )}
          </div>
        ) : null}
      </SettingsSection>

      <Dialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <DialogContent>
          <DialogForm onSubmit={() => void handleDisable()}>
            <DialogHeader>
              <DialogTitle>
                {detail.selfRegistration
                  ? m.tournaments_settings_disable_registration_link_title()
                  : m.tournaments_settings_disable_deck_link_title()}
              </DialogTitle>
              <DialogDescription>
                {m.tournaments_settings_disable_link_description()}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDisable(false)}>
                {m.tournaments_settings_keep_it()}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={locked || setSubmissionToken.isPending}
              >
                {m.tournaments_settings_disable_link()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

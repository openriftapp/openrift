import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { SettingsSection } from "@/components/layout/settings-section";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SwitchField } from "@/features/tournaments/components/settings/switch-field";
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

  const registrationUrl = detail.submissionToken
    ? `${getSiteUrl()}/tournaments/submit/${detail.submissionToken}`
    : null;
  const deckExpected = detail.deckSubmission !== "none";
  const showLink = detail.selfRegistration || deckExpected;
  const linkLabel = detail.selfRegistration
    ? m.tournaments_settings_registration_link()
    : m.tournaments_settings_deck_submission_link();

  return (
    <SettingsSection
      id="signup-links"
      title={m.tournaments_settings_signup_title()}
      description={
        m.tournaments_settings_signup_description() +
        (deckExpected ? m.tournaments_settings_signup_deck_note() : "")
      }
      contentClassName="gap-3"
    >
      <SwitchField
        id="t-self-reg"
        label={m.tournaments_settings_self_registration()}
        checked={detail.selfRegistration}
        disabled={locked || updateTournament.isPending}
        onCheckedChange={(checked) =>
          void runReportedMutation(() =>
            updateTournament.mutateAsync({ id: detail.id, selfRegistration: checked }),
          )
        }
      />
      {showLink ? (
        <div className="flex flex-col gap-2">
          <Label>{linkLabel}</Label>
          {registrationUrl ? (
            <ShareLinkRow
              url={registrationUrl}
              label={linkLabel}
              defaultQrOpen
              actions={
                <ConfirmActionButton
                  trigger={<Button variant="ghost" className="text-destructive" />}
                  disabled={locked || setSubmissionToken.isPending}
                  title={
                    detail.selfRegistration
                      ? m.tournaments_settings_disable_registration_link_title()
                      : m.tournaments_settings_disable_deck_link_title()
                  }
                  description={m.tournaments_settings_disable_link_description()}
                  confirmLabel={m.tournaments_settings_disable_link()}
                  onConfirm={() =>
                    setSubmissionToken.mutateAsync({ id: detail.id, enabled: false })
                  }
                >
                  {m.tournaments_settings_disable()}
                </ConfirmActionButton>
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
  );
}

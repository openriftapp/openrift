import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Label } from "@/components/ui/label";
import { SaveError } from "@/features/tournaments/components/save-error";
import { SwitchField } from "@/features/tournaments/components/settings/switch-field";
import { TokenLinkControl } from "@/features/tournaments/components/settings/token-link-control";
import {
  useSetTournamentSubmissionToken,
  useUpdateTournament,
} from "@/features/tournaments/hooks/use-tournament-mutations";
import { tournamentTokenUrl } from "@/features/tournaments/lib/tournament-display";
import { runReportedMutation } from "@/lib/run-reported-mutation";
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
    ? tournamentTokenUrl("submit", detail.submissionToken)
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
      <SaveError error={updateTournament.error} />
      {showLink ? (
        <div className="flex flex-col gap-2">
          <Label>{linkLabel}</Label>
          <TokenLinkControl
            url={registrationUrl}
            label={linkLabel}
            enableLabel={
              detail.selfRegistration
                ? m.tournaments_settings_enable_registration_link()
                : m.tournaments_settings_enable_deck_submission_link()
            }
            disableLabel={m.tournaments_settings_disable()}
            disableTitle={
              detail.selfRegistration
                ? m.tournaments_settings_disable_registration_link_title()
                : m.tournaments_settings_disable_deck_link_title()
            }
            disableDescription={m.tournaments_settings_disable_link_description()}
            disableConfirmLabel={m.tournaments_settings_disable_link()}
            locked={locked}
            disableLocked={locked}
            pending={setSubmissionToken.isPending}
            defaultQrOpen
            onSet={(enabled) => setSubmissionToken.mutateAsync({ id: detail.id, enabled })}
          />
        </div>
      ) : null}
    </SettingsSection>
  );
}

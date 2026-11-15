import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Label } from "@/components/ui/label";
import { TokenLinkControl } from "@/features/tournaments/components/settings/token-link-control";
import {
  useSetTournamentFollowToken,
  useSetTournamentReportToken,
} from "@/features/tournaments/hooks/use-tournament-run";
import { tournamentTokenUrl } from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

export function FollowAlongSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const setReportToken = useSetTournamentReportToken();
  const setFollowToken = useSetTournamentFollowToken();

  return (
    <SettingsSection
      id="follow-along"
      title={m.tournaments_settings_follow_title()}
      description={m.tournaments_settings_follow_description()}
      contentClassName="gap-6"
    >
      <div className="flex flex-col gap-2">
        <Label>{m.tournaments_settings_report_link_label()}</Label>
        <p className="text-muted-foreground text-sm">
          {detail.pairingStyle === "swiss"
            ? m.tournaments_settings_report_link_hint_match()
            : m.tournaments_settings_report_link_hint()}
        </p>
        <TokenLinkControl
          url={detail.reportToken ? tournamentTokenUrl("report", detail.reportToken) : null}
          label={m.tournaments_settings_report_link_label()}
          enableLabel={m.tournaments_settings_enable_report_link()}
          disableLabel={m.tournaments_settings_disable()}
          disableTitle={m.tournaments_settings_disable_report_title()}
          disableDescription={m.tournaments_settings_disable_link_description()}
          disableConfirmLabel={m.tournaments_settings_disable_link()}
          locked={locked}
          pending={setReportToken.isPending}
          defaultQrOpen
          onSet={(enabled) => setReportToken.mutateAsync({ id: detail.id, enabled })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{m.tournaments_settings_follow_link_label()}</Label>
        <p className="text-muted-foreground text-sm">{m.tournaments_settings_follow_link_hint()}</p>
        <TokenLinkControl
          url={detail.followToken ? tournamentTokenUrl("report", detail.followToken) : null}
          label={m.tournaments_settings_follow_link_label()}
          enableLabel={m.tournaments_settings_enable_follow_link()}
          disableLabel={m.tournaments_settings_disable()}
          disableTitle={m.tournaments_settings_disable_follow_title()}
          disableDescription={m.tournaments_settings_disable_link_description()}
          disableConfirmLabel={m.tournaments_settings_disable_link()}
          locked={locked}
          pending={setFollowToken.isPending}
          defaultQrOpen
          onSet={(enabled) => setFollowToken.mutateAsync({ id: detail.id, enabled })}
        />
      </div>
    </SettingsSection>
  );
}

import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { SettingsSection } from "@/components/layout/settings-section";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  useSetTournamentFollowToken,
  useSetTournamentReportToken,
} from "@/features/tournaments/hooks/use-tournament-run";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { getSiteUrl } from "@/lib/site-config";
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

  const reportUrl = detail.reportToken
    ? `${getSiteUrl()}/tournaments/report/${detail.reportToken}`
    : null;
  const followUrl = detail.followToken
    ? `${getSiteUrl()}/tournaments/report/${detail.followToken}`
    : null;

  return (
    <SettingsSection
      id="follow-along"
      title={m.tournaments_settings_follow_title()}
      description={m.tournaments_settings_follow_description()}
      contentClassName="gap-6"
    >
      <div className="flex flex-col gap-2">
        <Label>{m.tournaments_settings_report_link_label()}</Label>
        <p className="text-muted-foreground text-sm">{m.tournaments_settings_report_link_hint()}</p>
        {reportUrl ? (
          <ShareLinkRow
            url={reportUrl}
            label={m.tournaments_settings_report_link_label()}
            defaultQrOpen
            actions={
              <ConfirmActionButton
                trigger={<Button variant="ghost" className="text-destructive" />}
                disabled={setReportToken.isPending}
                title={m.tournaments_settings_disable_report_title()}
                description={m.tournaments_settings_disable_link_description()}
                confirmLabel={m.tournaments_settings_disable_link()}
                onConfirm={() => setReportToken.mutateAsync({ id: detail.id, enabled: false })}
              >
                {m.tournaments_settings_disable()}
              </ConfirmActionButton>
            }
          />
        ) : (
          <Button
            className="w-fit"
            disabled={locked || setReportToken.isPending}
            onClick={() =>
              void runReportedMutation(() =>
                setReportToken.mutateAsync({ id: detail.id, enabled: true }),
              )
            }
          >
            {m.tournaments_settings_enable_report_link()}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{m.tournaments_settings_follow_link_label()}</Label>
        <p className="text-muted-foreground text-sm">{m.tournaments_settings_follow_link_hint()}</p>
        {followUrl ? (
          <ShareLinkRow
            url={followUrl}
            label={m.tournaments_settings_follow_link_label()}
            defaultQrOpen
            actions={
              <ConfirmActionButton
                trigger={<Button variant="ghost" className="text-destructive" />}
                disabled={setFollowToken.isPending}
                title={m.tournaments_settings_disable_follow_title()}
                description={m.tournaments_settings_disable_link_description()}
                confirmLabel={m.tournaments_settings_disable_link()}
                onConfirm={() => setFollowToken.mutateAsync({ id: detail.id, enabled: false })}
              >
                {m.tournaments_settings_disable()}
              </ConfirmActionButton>
            }
          />
        ) : (
          <Button
            className="w-fit"
            disabled={locked || setFollowToken.isPending}
            onClick={() =>
              void runReportedMutation(() =>
                setFollowToken.mutateAsync({ id: detail.id, enabled: true }),
              )
            }
          >
            {m.tournaments_settings_enable_follow_link()}
          </Button>
        )}
      </div>
    </SettingsSection>
  );
}

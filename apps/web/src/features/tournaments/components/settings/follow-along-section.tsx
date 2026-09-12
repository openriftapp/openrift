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
import { ShareLinkRow } from "@/features/groups/components/share-link-row";
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
  const [confirmDisableReport, setConfirmDisableReport] = useState(false);
  const [confirmDisableFollow, setConfirmDisableFollow] = useState(false);

  const reportUrl = detail.reportToken
    ? `${getSiteUrl()}/tournaments/report/${detail.reportToken}`
    : null;
  const followUrl = detail.followToken
    ? `${getSiteUrl()}/tournaments/report/${detail.followToken}`
    : null;

  async function handleDisableReport() {
    await runReportedMutation(() => setReportToken.mutateAsync({ id: detail.id, enabled: false }));
    setConfirmDisableReport(false);
  }

  async function handleDisableFollow() {
    await runReportedMutation(() => setFollowToken.mutateAsync({ id: detail.id, enabled: false }));
    setConfirmDisableFollow(false);
  }

  return (
    <>
      <SettingsSection
        id="follow-along"
        title={m.tournaments_settings_follow_title()}
        description={m.tournaments_settings_follow_description()}
        contentClassName="gap-6"
      >
        <div className="flex flex-col gap-2">
          <Label>{m.tournaments_settings_report_link_label()}</Label>
          <p className="text-muted-foreground text-sm">
            {m.tournaments_settings_report_link_hint()}
          </p>
          {reportUrl ? (
            <ShareLinkRow
              url={reportUrl}
              label={m.tournaments_settings_report_link_label()}
              defaultQrOpen
              actions={
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={setReportToken.isPending}
                  onClick={() => setConfirmDisableReport(true)}
                >
                  {m.tournaments_settings_disable()}
                </Button>
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
          <p className="text-muted-foreground text-sm">
            {m.tournaments_settings_follow_link_hint()}
          </p>
          {followUrl ? (
            <ShareLinkRow
              url={followUrl}
              label={m.tournaments_settings_follow_link_label()}
              defaultQrOpen
              actions={
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={setFollowToken.isPending}
                  onClick={() => setConfirmDisableFollow(true)}
                >
                  {m.tournaments_settings_disable()}
                </Button>
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

      <Dialog open={confirmDisableReport} onOpenChange={setConfirmDisableReport}>
        <DialogContent>
          <DialogForm onSubmit={() => void handleDisableReport()}>
            <DialogHeader>
              <DialogTitle>{m.tournaments_settings_disable_report_title()}</DialogTitle>
              <DialogDescription>
                {m.tournaments_settings_disable_link_description()}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDisableReport(false)}>
                {m.tournaments_settings_keep_it()}
              </Button>
              <Button type="submit" variant="destructive" disabled={setReportToken.isPending}>
                {m.tournaments_settings_disable_link()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDisableFollow} onOpenChange={setConfirmDisableFollow}>
        <DialogContent>
          <DialogForm onSubmit={() => void handleDisableFollow()}>
            <DialogHeader>
              <DialogTitle>{m.tournaments_settings_disable_follow_title()}</DialogTitle>
              <DialogDescription>
                {m.tournaments_settings_disable_link_description()}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDisableFollow(false)}>
                {m.tournaments_settings_keep_it()}
              </Button>
              <Button type="submit" variant="destructive" disabled={setFollowToken.isPending}>
                {m.tournaments_settings_disable_link()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { Label } from "@/components/ui/label";
import { SaveError } from "@/features/tournaments/components/save-error";
import {
  AllowDeckEditsField,
  DeckDeadlineField,
  DeckFormatField,
  DeckSubmissionField,
} from "@/features/tournaments/components/settings/decks-fields";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { deckPhaseLabels, parseDeadlineInput } from "@/features/tournaments/lib/tournament-display";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { sameInstant, splitUtcToLocalDateTime } from "@/lib/date-time-input";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function DecksSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const closeInit = detail.submissionsCloseAt
    ? splitUtcToLocalDateTime(detail.submissionsCloseAt)
    : { date: "", time: "" };
  const [closeDate, setCloseDate] = useServerSeededState(closeInit.date);
  const [closeTime, setCloseTime] = useServerSeededState(closeInit.time);

  const deckExpected = detail.deckSubmission !== "none";
  const {
    closeAt: nextCloseAt,
    incomplete: closeIncomplete,
    afterEnd: closeAfterEnd,
  } = parseDeadlineInput(closeDate, closeTime, detail.endsAt);
  const closeInvalid = closeIncomplete || closeAfterEnd;
  const closeChanged = !sameInstant(nextCloseAt, detail.submissionsCloseAt);

  return (
    <SettingsSection
      id="decks"
      title={m.tournaments_settings_decks_title()}
      description={m.tournaments_settings_decks_description({
        phase: deckPhaseLabels()[detail.deckPhase],
      })}
      contentClassName="gap-3"
    >
      <DeckSubmissionField
        value={detail.deckSubmission}
        disabled={locked || updateTournament.isPending}
        className="max-w-sm"
        onChange={(deckSubmission) =>
          void runReportedMutation(() =>
            updateTournament.mutateAsync({ id: detail.id, deckSubmission }),
          )
        }
      />

      {deckExpected ? (
        <>
          <DeckFormatField
            value={detail.deckFormat}
            disabled={locked || updateTournament.isPending}
            className="max-w-sm"
            onChange={(deckFormat) =>
              void runReportedMutation(() =>
                updateTournament.mutateAsync({ id: detail.id, deckFormat }),
              )
            }
          />

          <DeckDeadlineField
            date={closeDate}
            time={closeTime}
            disabled={locked}
            onDateChange={setCloseDate}
            onTimeChange={setCloseTime}
            error={
              closeIncomplete
                ? m.tournaments_settings_deadline_incomplete()
                : closeAfterEnd
                  ? m.tournaments_settings_deadline_after_end()
                  : undefined
            }
            hint={m.tournaments_settings_deadline_blank_hint()}
            action={
              <Button
                disabled={locked || closeInvalid || !closeChanged || updateTournament.isPending}
                onClick={() =>
                  void runReportedMutation(() =>
                    updateTournament.mutateAsync({
                      id: detail.id,
                      submissionsCloseAt: nextCloseAt,
                    }),
                  )
                }
              >
                {m.common_save()}
              </Button>
            }
          />

          <AllowDeckEditsField
            value={detail.listLockMode}
            disabled={locked || updateTournament.isPending}
            onChange={(listLockMode) =>
              void runReportedMutation(() =>
                updateTournament.mutateAsync({ id: detail.id, listLockMode }),
              )
            }
          />

          <div className="flex flex-col gap-1.5">
            <Label>{m.tournaments_settings_push_label()}</Label>
            <span className="text-muted-foreground text-sm">
              <ParaglideMessage
                message={m.tournaments_settings_push_hint}
                inputs={{ id: detail.id }}
                markup={{
                  code: ({ children }) => <Code className="break-all">{children}</Code>,
                  link: ({ children }) => (
                    <Link
                      to="/tournaments/$id/decks"
                      params={{ id: detail.id }}
                      className="text-foreground font-medium underline"
                    >
                      {children}
                    </Link>
                  ),
                }}
              />
            </span>
          </div>
        </>
      ) : null}
      <SaveError error={updateTournament.error} />
    </SettingsSection>
  );
}

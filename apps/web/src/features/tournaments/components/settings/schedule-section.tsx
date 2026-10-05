import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { ScheduleFields } from "@/features/tournaments/components/settings/schedule-fields";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { parseScheduleInput } from "@/features/tournaments/lib/tournament-display";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { localTimeZoneLabel, splitUtcToLocalDateTime } from "@/lib/date-time-input";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

/**
 * Start and end times, entered in the host's local timezone and stored as UTC.
 * "End now" stamps the current instant so a running tournament can be closed
 * without picking a date.
 */
export function ScheduleSection({
  detail,
  locked,
  canEndEarly,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
  canEndEarly: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const startInit = splitUtcToLocalDateTime(detail.startsAt);
  const endInit = detail.endsAt ? splitUtcToLocalDateTime(detail.endsAt) : { date: "", time: "" };
  const [startDate, setStartDate] = useServerSeededState(startInit.date);
  const [startTime, setStartTime] = useServerSeededState(startInit.time);
  const [endDate, setEndDate] = useServerSeededState(endInit.date);
  const [endTime, setEndTime] = useServerSeededState(endInit.time);

  const tzLabel = localTimeZoneLabel();
  const {
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    scheduleInvalid,
  } = parseScheduleInput(startDate, startTime, endDate, endTime);
  const startChanged =
    nextStartsAt !== null &&
    new Date(nextStartsAt).getTime() !== new Date(detail.startsAt).getTime();
  const endChanged =
    (nextEndsAt === null) !== (detail.endsAt === null) ||
    (nextEndsAt !== null &&
      detail.endsAt !== null &&
      new Date(nextEndsAt).getTime() !== new Date(detail.endsAt).getTime());
  const scheduleChanged = startChanged || endChanged;

  return (
    <SettingsSection
      id="schedule"
      title={m.tournaments_settings_schedule_title()}
      description={m.tournaments_settings_schedule_description({ timezone: tzLabel })}
      contentClassName="gap-3"
    >
      <ScheduleFields
        value={{ startDate, startTime, endDate, endTime }}
        disabled={locked}
        onChange={(patch) => {
          setStartDate(patch.startDate ?? startDate);
          setStartTime(patch.startTime ?? startTime);
          setEndDate(patch.endDate ?? endDate);
          setEndTime(patch.endTime ?? endTime);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={locked || scheduleInvalid || !scheduleChanged || updateTournament.isPending}
          onClick={() => {
            if (nextStartsAt === null) {
              return;
            }
            void runReportedMutation(() =>
              updateTournament.mutateAsync({
                id: detail.id,
                startsAt: nextStartsAt,
                endsAt: nextEndsAt,
              }),
            );
          }}
        >
          {m.tournaments_settings_save_schedule()}
        </Button>
        {canEndEarly ? (
          <Button
            variant="secondary"
            disabled={updateTournament.isPending}
            onClick={() =>
              void runReportedMutation(() =>
                updateTournament.mutateAsync({
                  id: detail.id,
                  endsAt: new Date().toISOString(),
                }),
              )
            }
          >
            {m.tournaments_settings_end_now()}
          </Button>
        ) : null}
      </div>
      {locked ? (
        <p className="text-muted-foreground">{m.tournaments_settings_cancelled_note()}</p>
      ) : null}
    </SettingsSection>
  );
}

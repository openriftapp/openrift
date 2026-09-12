import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import {
  localTimeZoneLabel,
  parseScheduleInput,
  splitUtcToLocalDateTime,
} from "@/features/tournaments/lib/tournament-display";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
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
    endIncomplete,
    endBeforeStart,
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
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Label>{m.tournaments_settings_starts_label()}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              onClear={() => setStartDate("")}
              disabled={locked}
              className="w-44"
            />
            <Input
              value={startTime}
              disabled={locked}
              onChange={(event) => setStartTime(event.target.value)}
              placeholder="HH:mm"
              aria-label={m.tournaments_settings_start_time_aria()}
              className="w-24 tabular-nums"
            />
          </div>
          {nextStartsAt === null ? (
            <FieldError>{m.tournaments_settings_start_invalid()}</FieldError>
          ) : null}
        </div>
        <span className="text-muted-foreground mb-2 text-sm">
          {m.tournaments_settings_schedule_to()}
        </span>
        <div className="flex flex-col gap-1.5">
          <Label>{m.tournaments_settings_ends_label()}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              onClear={() => setEndDate("")}
              disabled={locked}
              className="w-44"
            />
            <Input
              value={endTime}
              disabled={locked}
              onChange={(event) => setEndTime(event.target.value)}
              placeholder="HH:mm"
              aria-label={m.tournaments_settings_end_time_aria()}
              className="w-24 tabular-nums"
            />
          </div>
          {endIncomplete ? (
            <FieldError>{m.tournaments_settings_end_incomplete()}</FieldError>
          ) : endBeforeStart ? (
            <FieldError>{m.tournaments_settings_end_before_start()}</FieldError>
          ) : null}
        </div>
      </div>
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

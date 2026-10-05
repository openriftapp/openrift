import { DateTimeField } from "@/components/ui/date-time-field";
import { parseScheduleInput } from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

export interface ScheduleInput {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

/** Start and optional end on the viewer's clock; gate saving on `parseScheduleInput` of the same value. */
export function ScheduleFields({
  value,
  disabled = false,
  onChange,
}: {
  value: ScheduleInput;
  disabled?: boolean;
  onChange: (patch: Partial<ScheduleInput>) => void;
}) {
  const { startInvalid, endIncomplete, endBeforeStart } = parseScheduleInput(
    value.startDate,
    value.startTime,
    value.endDate,
    value.endTime,
  );

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
      <DateTimeField
        label={m.tournaments_settings_starts_label()}
        date={value.startDate}
        time={value.startTime}
        timeLabel={m.tournaments_settings_start_time_aria()}
        disabled={disabled}
        error={startInvalid ? m.tournaments_settings_start_invalid() : undefined}
        onDateChange={(startDate) => onChange({ startDate })}
        onTimeChange={(startTime) => onChange({ startTime })}
      />
      <span className="text-muted-foreground mb-2 text-sm">
        {m.tournaments_settings_schedule_to()}
      </span>
      <DateTimeField
        label={m.tournaments_settings_ends_label()}
        date={value.endDate}
        time={value.endTime}
        timeLabel={m.tournaments_settings_end_time_aria()}
        disabled={disabled}
        error={
          endIncomplete
            ? m.tournaments_settings_end_incomplete()
            : endBeforeStart
              ? m.tournaments_settings_end_before_start()
              : undefined
        }
        onDateChange={(endDate) => onChange({ endDate })}
        onTimeChange={(endTime) => onChange({ endTime })}
      />
    </div>
  );
}

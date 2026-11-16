import type {
  TournamentDeckSubmission,
  TournamentListLockMode,
} from "@openrift/shared/types/api/tournament";
import type { ReactNode } from "react";

import { DateTimeField } from "@/components/ui/date-time-field";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { SwitchField } from "@/features/tournaments/components/settings/switch-field";
import { deckSubmissionItems } from "@/features/tournaments/lib/tournament-display";
import { useDeckFormatList } from "@/hooks/use-enums";
import { localTimeZoneLabel } from "@/lib/date-time-input";
import { m } from "@/paraglide/messages.js";

export function DeckSubmissionField({
  value,
  disabled = false,
  className,
  onChange,
}: {
  value: TournamentDeckSubmission;
  disabled?: boolean;
  className?: string;
  onChange: (value: TournamentDeckSubmission) => void;
}) {
  const items = deckSubmissionItems();
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{m.tournaments_settings_deck_submission_label()}</Label>
      <SimpleSelect
        items={items}
        value={value}
        disabled={disabled}
        onChange={(next) => {
          if (next === "none" || next === "optional" || next === "required") {
            onChange(next);
          }
        }}
        label={m.tournaments_settings_deck_submission_label()}
        placeholder={m.tournaments_settings_deck_submission_label()}
        className={className ?? "w-full"}
      />
    </div>
  );
}

export function DeckFormatField({
  value,
  disabled = false,
  className,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  const { formats } = useDeckFormatList();
  const items = formats.map((format) => ({ value: format.slug, label: format.label }));
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{m.tournaments_settings_deck_format_label()}</Label>
      <SimpleSelect
        items={items}
        value={value}
        disabled={disabled}
        onChange={onChange}
        label={m.tournaments_settings_deck_format_label()}
        placeholder={m.tournaments_settings_deck_format_label()}
        className={className ?? "w-full"}
      />
      <span className="text-muted-foreground text-sm">
        {m.tournaments_settings_deck_format_hint()}
      </span>
    </div>
  );
}

/** The optional submission deadline on the viewer's clock; `action` sits at the end of the input row. */
export function DeckDeadlineField({
  date,
  time,
  disabled = false,
  error,
  hint,
  action,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  time: string;
  disabled?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <DateTimeField
          label={m.tournaments_settings_deadline_label()}
          date={date}
          time={time}
          timeLabel={m.tournaments_settings_deadline_time_aria()}
          disabled={disabled}
          onDateChange={onDateChange}
          onTimeChange={onTimeChange}
        />
        <span className="text-muted-foreground flex h-8 items-center text-sm">
          {localTimeZoneLabel()}
        </span>
        {action}
      </div>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <span className="text-muted-foreground text-sm">{hint}</span>
      ) : null}
    </div>
  );
}

export function AllowDeckEditsField({
  value,
  disabled = false,
  onChange,
}: {
  value: TournamentListLockMode;
  disabled?: boolean;
  onChange: (value: TournamentListLockMode) => void;
}) {
  return (
    <SwitchField
      id="t-allow-edits"
      label={m.tournaments_settings_allow_edits_label()}
      hint={m.tournaments_settings_allow_edits_hint()}
      checked={value === "at_deadline"}
      disabled={disabled}
      onCheckedChange={(checked) => onChange(checked ? "at_deadline" : "on_submit")}
    />
  );
}

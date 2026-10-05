import type { ReactNode } from "react";
import { useId } from "react";

import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/paraglide/messages.js";

export interface PointsInput {
  win: string;
  draw: string;
  bye: string;
}

export function parsePointsInput(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,2}$/u.test(trimmed) ? Number(trimmed) : null;
}

/** Win and draw only count under Swiss; the bye always does. */
export function pointsInputInvalid(value: PointsInput, swiss: boolean): boolean {
  return (
    parsePointsInput(value.bye) === null ||
    (swiss && (parsePointsInput(value.win) === null || parsePointsInput(value.draw) === null))
  );
}

export function PointsFields({
  value,
  swiss,
  disabled = false,
  action,
  onChange,
}: {
  value: PointsInput;
  swiss: boolean;
  disabled?: boolean;
  action?: ReactNode;
  onChange: (patch: Partial<PointsInput>) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        {swiss ? (
          <>
            <PointsInputField
              id={`${id}-win`}
              label={m.tournaments_settings_points_win()}
              ariaLabel={m.tournaments_settings_points_win_aria()}
              value={value.win}
              disabled={disabled}
              onChange={(win) => onChange({ win })}
            />
            <PointsInputField
              id={`${id}-draw`}
              label={m.tournaments_settings_points_draw()}
              ariaLabel={m.tournaments_settings_points_draw_aria()}
              value={value.draw}
              disabled={disabled}
              onChange={(draw) => onChange({ draw })}
            />
          </>
        ) : null}
        <PointsInputField
          id={`${id}-bye`}
          label={m.tournaments_settings_points_bye()}
          ariaLabel={m.tournaments_settings_points_bye_aria()}
          value={value.bye}
          disabled={disabled}
          onChange={(bye) => onChange({ bye })}
        />
        {action}
      </div>
      {pointsInputInvalid(value, swiss) ? (
        <FieldError>{m.tournaments_settings_points_invalid()}</FieldError>
      ) : null}
    </div>
  );
}

function PointsInputField({
  id,
  label,
  ariaLabel,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  disabled: boolean;
  onChange: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        inputMode="numeric"
        className="w-20 tabular-nums"
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

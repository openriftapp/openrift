import type { ReactNode } from "react";
import { useId } from "react";

import { DatePicker } from "@/components/ui/date-picker";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidTimeInput } from "@/lib/date-time-input";
import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded). A local date plus an HH:mm
// time, kept as two strings; combine them with combineLocalDateTimeToUtc.

interface DateTimeFieldProps {
  label: ReactNode;
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  timeLabel: string;
  disabled?: boolean;
  error?: ReactNode;
  className?: string;
}

export function DateTimeField({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
  timeLabel,
  disabled,
  error,
  className,
}: DateTimeFieldProps) {
  const labelId = useId();
  const timeInvalid = time !== "" && !isValidTimeInput(time);

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-slot="date-time-field"
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label id={labelId}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          value={date}
          onValueChange={onDateChange}
          onClear={() => onDateChange("")}
          disabled={disabled}
          className="w-44"
        />
        <Input
          value={time}
          disabled={disabled}
          onChange={(event) => onTimeChange(event.target.value)}
          placeholder="HH:mm"
          aria-label={timeLabel}
          aria-invalid={timeInvalid || undefined}
          className="w-24 tabular-nums"
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

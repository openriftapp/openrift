import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatLocalDate, parseLocalDate } from "@/lib/date-time-input";
import { m } from "@/paraglide/messages.js";

interface DatePickerProps {
  value?: string | null;
  onValueChange?: (iso: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onValueChange,
  onClear,
  placeholder = "YYYY-MM-DD",
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [month, setMonth] = useState<Date | undefined>(parseLocalDate(value ?? "") ?? undefined);

  // The input renders local text state so partial typing survives, but that
  // means an external value change after mount (e.g. the create wizard's
  // client-only "now" prefill) must be copied in here or it never shows. Skip
  // the copy when the text already matches, so committing a typed date doesn't
  // reset the cursor.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if ((value ?? "") !== text) {
      setText(value ?? "");
      setMonth(parseLocalDate(value ?? "") ?? undefined);
    }
  }

  const selected = parseLocalDate(value ?? "") ?? undefined;

  function handleTextChange(raw: string) {
    setText(raw);
    if (raw === "" && onClear) {
      onClear();
      return;
    }
    const day = parseLocalDate(raw);
    if (day !== null) {
      setMonth(day);
      onValueChange?.(raw);
    }
  }

  function handleCalendarSelect(day: Date | undefined) {
    if (day) {
      const iso = formatLocalDate(day);
      setText(iso);
      onValueChange?.(iso);
      setOpen(false);
    }
  }

  return (
    <InputGroup className={className}>
      <InputGroupInput
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => handleTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <InputGroupButton
                variant="ghost"
                size="icon-xs"
                aria-label={m.ui_date_picker_select()}
                disabled={disabled}
              />
            }
          >
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              captionLayout="dropdown"
              selected={selected}
              month={month}
              onMonthChange={setMonth}
              onSelect={handleCalendarSelect}
              startMonth={new Date(2020, 0)}
              endMonth={new Date(2035, 11)}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}

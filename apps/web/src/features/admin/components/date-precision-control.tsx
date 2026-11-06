import type { ReleasePrecision } from "@openrift/shared/set-release";

import { DeskSegmented } from "@/features/admin/components/printing-desk-shared";

const PRECISION_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
] as const satisfies readonly { value: ReleasePrecision; label: string }[];

export function DatePrecisionControl({
  value,
  onChange,
  includeQuarter = false,
  disabled = false,
  ariaLabel = "How exact the date is",
  className,
}: {
  value: ReleasePrecision;
  onChange: (precision: ReleasePrecision) => void;
  includeQuarter?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const options = includeQuarter
    ? PRECISION_OPTIONS
    : PRECISION_OPTIONS.filter((option) => option.value !== "quarter");
  const shown = !includeQuarter && value === "quarter" ? "month" : value;
  return (
    <DeskSegmented
      ariaLabel={ariaLabel}
      value={shown}
      onChange={onChange}
      options={options}
      className={className}
      disabled={disabled}
    />
  );
}

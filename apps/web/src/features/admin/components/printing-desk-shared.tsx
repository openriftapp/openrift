import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ReleaseFields } from "@/features/admin/lib/printing-desk-status";
import { DESK_STATUS_LABELS, deskPrintingStatus } from "@/features/admin/lib/printing-desk-status";

export function DeskStatusBadge({ row }: { row: ReleaseFields }) {
  const status = deskPrintingStatus(row);
  if (status === null) {
    return null;
  }
  return (
    <Badge variant={status === "released" ? "success" : "warning"}>
      {DESK_STATUS_LABELS[status]}
    </Badge>
  );
}

export interface DeskSegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function DeskSegmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  disabled,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly DeskSegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      variant="outline"
      spacing={0}
      className={className}
      disabled={disabled}
      value={[value]}
      onValueChange={(next) => {
        const picked = next.at(0);
        if (typeof picked === "string") {
          onChange(picked as T);
        }
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

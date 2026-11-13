import { formatDayTime, formatRelativeTime } from "@openrift/shared/format-date";

import { EMPTY_VALUE_TEXT } from "@/features/admin/lib/field-value-text";
import { cn } from "@/lib/utils";

export function AdminInstant({
  at,
  relative = false,
  seconds = false,
  className,
}: {
  at: Date | string | null;
  relative?: boolean;
  seconds?: boolean;
  className?: string;
}) {
  if (at === null) {
    return <span className={cn("text-muted-foreground", className)}>{EMPTY_VALUE_TEXT}</span>;
  }
  const absolute = formatDayTime(at);
  const ago = formatRelativeTime(at, { seconds });
  return (
    <span className={className} title={relative ? `${absolute} UTC` : ago}>
      {relative ? ago : absolute}
    </span>
  );
}

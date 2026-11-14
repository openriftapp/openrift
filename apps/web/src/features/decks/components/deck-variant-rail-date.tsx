import { formatDay } from "@openrift/shared/format-date";

export function RailNodeDate({ updatedAt }: { updatedAt: string | undefined }) {
  if (!updatedAt) {
    return null;
  }
  return (
    <span className="text-muted-foreground text-2xs absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap tabular-nums">
      {formatDay(updatedAt)}
    </span>
  );
}

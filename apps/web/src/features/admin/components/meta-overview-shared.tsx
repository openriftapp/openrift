import { formatDayTime } from "@openrift/shared/format-date";

import type { MetaRunCell, MetaTone } from "@/features/admin/lib/meta-source-overview";
import { cn } from "@/lib/utils";

const DOT_CLASS: Record<MetaTone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  running: "bg-primary",
  off: "bg-muted-foreground/50",
};

const TONE_LABEL: Record<MetaTone, string> = {
  ok: "Healthy",
  warn: "Warning",
  bad: "Failing",
  running: "Running",
  off: "Not scheduled",
};

export function MetaToneDot({ tone }: { tone: MetaTone }) {
  return (
    <span
      role="img"
      aria-label={TONE_LABEL[tone]}
      className={cn("inline-block size-2 shrink-0 rounded-full", DOT_CLASS[tone])}
    />
  );
}

export function MetaRunCellView({ cell, title }: { cell: MetaRunCell; title?: string }) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "flex items-center gap-2",
          cell.tone === "warn" && "text-warning",
          cell.tone === "bad" && "text-destructive",
        )}
      >
        <MetaToneDot tone={cell.tone} />
        <span>{title ?? (cell.at === null ? "never" : formatDayTime(cell.at))}</span>
      </div>
      <div className="text-muted-foreground text-xs">
        {[title === undefined || cell.at === null ? "" : formatDayTime(cell.at), cell.detail]
          .filter((part) => part !== "")
          .join(" · ")}
      </div>
    </div>
  );
}

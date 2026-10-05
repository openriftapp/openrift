import type { AdminMetaEventCorrection } from "@openrift/shared/contracts/admin/meta-submissions";
import { formatDayTime } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MetaSubmissionResolve } from "@/features/admin/components/meta-submission-resolve";
import { useApplyMetaEventCorrection } from "@/features/admin/hooks/use-admin-meta-submissions";
import { metaEventCorrectionRows } from "@/features/meta/lib/meta-event-correction-review";
import { cn } from "@/lib/utils";

export function MetaEventCorrectionCard({ correction }: { correction: AdminMetaEventCorrection }) {
  const rows = metaEventCorrectionRows(correction.fieldEdits, correction.event);
  const { submission, event } = correction;
  const apply = useApplyMetaEventCorrection();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());

  const applicable = event !== null && submission.status === "pending";
  const changed = rows.filter((row) => row.current !== row.proposed);
  const kept = changed.filter((row) => !skipped.has(row.field));

  function toggle(field: string) {
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }

  function handleApply() {
    apply.mutate({
      submissionId: submission.id,
      fields: kept.length === changed.length ? null : kept.map((row) => row.field),
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">correction</Badge>
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatDayTime(submission.createdAt)}
        </span>
        {submission.note !== null && (
          <span className="text-muted-foreground text-sm">&ldquo;{submission.note}&rdquo;</span>
        )}
        {event !== null && (
          <Link
            to="/admin/meta/$eventId"
            params={{ eventId: event.id }}
            className={buttonVariants({ variant: "outline", size: "sm", className: "ml-auto" })}
          >
            Edit the event
          </Link>
        )}
      </div>

      {event === null && (
        <p className="text-muted-foreground text-sm">
          The event this was about is gone, so there is nothing to apply. Close it out.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {rows.map((row) => {
            const differs = row.current !== row.proposed;
            const keep = differs && !skipped.has(row.field);
            return (
              <li key={row.field} className="flex flex-wrap items-center gap-2">
                {applicable && differs && (
                  <Checkbox
                    checked={keep}
                    aria-label={`Apply ${row.label}`}
                    onCheckedChange={() => toggle(row.field)}
                  />
                )}
                <span className="text-muted-foreground">{row.label}</span>
                <span className="tabular-nums">{row.current}</span>
                <span className="text-muted-foreground">→</span>
                <span
                  className={cn(
                    "tabular-nums",
                    keep ? "font-medium" : "text-muted-foreground",
                    applicable && differs && !keep && "line-through",
                  )}
                >
                  {row.proposed}
                </span>
                {!differs && <span className="text-muted-foreground">(already shown)</span>}
              </li>
            );
          })}
        </ul>
      )}

      {rows.length === 0 && event !== null && (
        <p className="text-muted-foreground text-sm">
          No field values were proposed, so the note is the whole of it.
        </p>
      )}

      {applicable && changed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button size="sm" disabled={kept.length === 0 || apply.isPending} onClick={handleApply}>
            Apply {kept.length} {pluralize(kept.length, "change")}
          </Button>
          <span className="text-muted-foreground min-w-0 text-sm">
            Writes the ticked values under the submitter&apos;s name, credits them on the event and
            emails them a thank-you.
          </span>
        </div>
      )}

      <div className="pt-4">
        <MetaSubmissionResolve submission={submission} playerOverlayId={null} />
      </div>
    </div>
  );
}

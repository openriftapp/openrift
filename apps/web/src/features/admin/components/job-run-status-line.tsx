import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { CheckIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type JobRunLineStatus = "running" | "failed" | "succeeded";

export function JobRunStatusMessage({
  status,
  className,
  children,
}: {
  status: JobRunLineStatus;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={cn("text-muted-foreground flex items-center gap-1 text-sm", className)}>
      {status === "running" && <Spinner />}
      {status === "failed" && <XIcon className="text-destructive size-4 shrink-0" />}
      {status === "succeeded" && <CheckIcon className="text-success size-4 shrink-0" />}
      {children}
    </p>
  );
}

export function JobRunStatusLine({
  run,
  runningText,
  failedText = "Failed",
  succeededText = "Completed",
  renderSucceeded,
}: {
  run: JobRunView;
  runningText?: ReactNode;
  failedText?: string;
  succeededText?: ReactNode;
  renderSucceeded?: (run: JobRunView) => ReactNode;
}) {
  if (run.status === "running") {
    return (
      <JobRunStatusMessage status="running">
        {runningText ?? `Started ${formatRelativeTime(run.startedAt)}`}
      </JobRunStatusMessage>
    );
  }
  if (run.status === "failed") {
    return (
      <JobRunStatusMessage status="failed">{run.errorMessage ?? failedText}</JobRunStatusMessage>
    );
  }
  if (renderSucceeded) {
    return renderSucceeded(run);
  }
  return <JobRunStatusMessage status="succeeded">{succeededText}</JobRunStatusMessage>;
}

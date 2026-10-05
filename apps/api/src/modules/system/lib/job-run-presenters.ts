import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";

import { isoOrNull } from "../../../lib/iso-date.js";
import type { JobRun } from "../repositories/job-runs.js";

export function toJobRunView(row: JobRun): JobRunView {
  return {
    id: row.id,
    kind: row.kind,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: isoOrNull(row.finishedAt),
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
    result:
      row.result === null || typeof row.result !== "object"
        ? null
        : (row.result as Record<string, unknown>),
    noop: row.noop,
  };
}

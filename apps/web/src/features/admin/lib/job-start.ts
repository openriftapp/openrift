import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import {
  adminJobSchedulesContract,
  SCHEDULED_JOB_KINDS,
} from "@openrift/shared/contracts/admin/job-schedules";
import type { ScheduledJobKind } from "@openrift/shared/contracts/admin/job-schedules";
import { adminOperationsContract } from "@openrift/shared/contracts/admin/operations";
import { adminScanContract } from "@openrift/shared/contracts/admin/scan";
import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import type { JobRunStartedResponse } from "@openrift/shared/types/api/admin";
import { createServerFn } from "@tanstack/react-start";

import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type StartableJobKind =
  | ScheduledJobKind
  | typeof JOB_KIND.refreshMatviews
  | typeof JOB_KIND.recomputeCardTokens
  | typeof JOB_KIND.backfillSiblingVariants;

function isScheduledJobKind(kind: StartableJobKind): kind is ScheduledJobKind {
  return (SCHEDULED_JOB_KINDS as readonly string[]).includes(kind);
}

function startJob(
  cookie: string,
  kind: StartableJobKind,
  viaSchedule: boolean,
): Promise<JobRunStartedResponse> {
  if (viaSchedule && isScheduledJobKind(kind)) {
    return apiOrpcClient(adminJobSchedulesContract, cookie).runNow({ kind });
  }
  switch (kind) {
    case JOB_KIND.refreshMatviews: {
      return apiOrpcClient(adminOperationsContract, cookie).refreshMatviews();
    }
    case JOB_KIND.recomputeCardTokens: {
      return apiOrpcClient(adminOperationsContract, cookie).recomputeCardTokens();
    }
    case JOB_KIND.backfillSiblingVariants: {
      return apiOrpcClient(adminOperationsContract, cookie).backfillSiblingVariants();
    }
    case JOB_KIND.rebuildScanBank: {
      return apiOrpcClient(adminScanContract, cookie).rebuildBank();
    }
    case JOB_KIND.checkMatching: {
      return apiOrpcClient(adminCardMutationsContract, cookie).checkMatchingCandidates();
    }
    default: {
      return apiOrpcClient(adminJobSchedulesContract, cookie).runNow({ kind });
    }
  }
}

export const startJobFn = createServerFn({ method: "POST" })
  .validator((input: { kind: StartableJobKind; viaSchedule?: boolean }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<JobRunStartedResponse> =>
    startJob(context.cookie, data.kind, data.viaSchedule === true),
  );

export function jobStartMessage(label: string, started: JobRunStartedResponse): string {
  return started.status === "already_running" ? `${label} is already running` : `${label} started`;
}

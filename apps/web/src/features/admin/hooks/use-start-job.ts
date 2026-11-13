import type { JobRunStartedResponse } from "@openrift/shared/types/api/admin";
import { toast } from "sonner";

import { useLatestJobRun } from "@/features/admin/hooks/use-latest-job-run";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { jobStartMessage, startJobFn } from "@/features/admin/lib/job-start";
import type { StartableJobKind } from "@/features/admin/lib/job-start";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { runReportedMutation } from "@/lib/run-reported-mutation";

type QueryKeys = readonly (readonly unknown[])[];

export function useJobStarter(
  kind: StartableJobKind,
  label: string,
  options?: { invalidates?: QueryKeys; viaSchedule?: boolean },
) {
  const extraKeys = options?.invalidates ?? [];
  const viaSchedule = options?.viaSchedule === true;
  const mutation = useMutationWithInvalidation({
    mutationFn: (): Promise<JobRunStartedResponse> => startJobFn({ data: { kind, viaSchedule } }),
    invalidates: [adminKeys.jobRuns, adminKeys.jobSchedules, ...extraKeys],
  });

  async function start() {
    let started: JobRunStartedResponse | undefined;
    const ok = await runReportedMutation(async () => {
      started = await mutation.mutateAsync();
    });
    if (!ok || !started) {
      return;
    }
    if (started.status === "already_running") {
      toast.info(jobStartMessage(label, started));
    } else {
      toast.success(jobStartMessage(label, started));
    }
  }

  return { start, isPending: mutation.isPending };
}

export function useStartJob(
  kind: StartableJobKind,
  label: string,
  options?: { invalidates?: QueryKeys },
) {
  const latestRun = useLatestJobRun(kind);
  const starter = useJobStarter(kind, label, options);

  return {
    start: starter.start,
    running: starter.isPending || latestRun.data?.status === "running",
    latestRun: latestRun.data,
  };
}

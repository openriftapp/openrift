import { JOB_RUN_ACTIVITIES, JOB_STATUSES, JOB_TRIGGERS } from "@openrift/shared/job-run-kinds";
import { z } from "zod/mini";

import { lenient } from "@/lib/lenient-param";

/** Every param carries a `run` prefix: plain `status` already names something else on the admin cards tab. */
export const jobRunsSearchSchema = z.object({
  page: lenient(z.coerce.number().check(z.int(), z.positive())),
  runKind: lenient(z.string()),
  runPrefix: lenient(z.string()),
  runTrigger: lenient(z.enum(JOB_TRIGGERS)),
  runStatus: lenient(z.enum(JOB_STATUSES)),
  runActivity: lenient(z.enum(JOB_RUN_ACTIVITIES)),
});

export type JobRunsSearch = z.infer<typeof jobRunsSearchSchema>;

import { JOB_RUN_ACTIVITIES, JOB_STATUSES, JOB_TRIGGERS } from "@openrift/shared/job-run-kinds";
import { z } from "zod/mini";

/** Every param carries a `run` prefix: plain `status` already names something else on the admin cards tab. */
export const jobRunsSearchSchema = z.object({
  page: z.optional(z.coerce.number().check(z.int(), z.positive())),
  runKind: z.optional(z.string()),
  runPrefix: z.optional(z.string()),
  runTrigger: z.optional(z.enum(JOB_TRIGGERS)),
  runStatus: z.optional(z.enum(JOB_STATUSES)),
  runActivity: z.optional(z.enum(JOB_RUN_ACTIVITIES)),
});

export type JobRunsSearch = z.infer<typeof jobRunsSearchSchema>;

import { listRulesStateSchema } from "@openrift/shared/contracts/lists";
import type { ORPCError } from "@orpc/client";
import { isDefinedError } from "@orpc/client";
import type { z } from "zod";

export type ListRulesState = z.infer<typeof listRulesStateSchema>;

/** The stored rules, when the server refused a save made from an older rules version. */
export function listRulesConflict(error: unknown): ListRulesState | undefined {
  const candidate = error as ORPCError<string, unknown>;
  if (!(isDefinedError(candidate) && candidate.code === "PRECONDITION_FAILED")) {
    return undefined;
  }
  const parsed = listRulesStateSchema.safeParse(candidate.data);
  return parsed.success ? parsed.data : undefined;
}

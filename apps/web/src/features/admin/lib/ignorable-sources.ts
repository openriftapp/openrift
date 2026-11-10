import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";

/** Contributor submissions are settled by accepting or rejecting them, never by an ignore. */
export function ignorableSources<T extends { provider: string }>(sources: readonly T[]): T[] {
  return sources.filter((source) => source.provider !== USER_SUBMISSION_PROVIDER);
}

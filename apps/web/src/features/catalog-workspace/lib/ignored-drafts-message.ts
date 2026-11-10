import { pluralize } from "@openrift/shared/strings";

export function ignoredDraftsMessage(ignored: number, contributorOnly: number): string {
  const done =
    ignored === 0
      ? "No new card ignored."
      : `Ignored ${ignored} ${pluralize(ignored, "new card")}.`;
  if (contributorOnly === 0) {
    return done;
  }
  return `${done} ${contributorOnly} with only contributor submissions ${contributorOnly === 1 ? "stays" : "stay"}.`;
}

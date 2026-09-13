export type ChangelogView = "everything" | "milestones";

/** No zod: this schema runs in a route file, whose imports load on every page. */
export function changelogSearchSchema(search: Record<string, unknown>): { show?: ChangelogView } {
  return search.show === "milestones" ? { show: "milestones" } : {};
}

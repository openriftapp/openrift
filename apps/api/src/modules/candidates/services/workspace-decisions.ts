import type {
  WorkspaceDecisionsInput,
  WorkspaceEventsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";

import { startOfUtcDay, toWorkspaceEvent } from "../lib/workspace-presenters.js";
import type { WorkspaceRepos } from "./workspace-queue.js";

const DECISIONS_LIMIT = 500;

export async function listWorkspaceDecisions(
  repos: Pick<WorkspaceRepos, "workspaceRecords">,
  options: { userId: string; input: WorkspaceDecisionsInput; now: Date },
): Promise<WorkspaceEventsResponse> {
  const since =
    options.input.since === undefined ? startOfUtcDay(options.now) : new Date(options.input.since);
  const rows = await repos.workspaceRecords.eventsByActorSince(
    options.userId,
    since,
    DECISIONS_LIMIT,
  );
  return { events: rows.map((row) => toWorkspaceEvent(row)) };
}

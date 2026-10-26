import { describe, expect, it, vi } from "vitest";

import { listWorkspaceDecisions } from "./workspace-decisions.js";
import type { WorkspaceRepos } from "./workspace-queue.js";

const EVENT = {
  id: "event-1",
  action: "card.accept-field",
  entityType: "card",
  entityId: "card-1",
  entityLabel: null,
  cardSlug: "jinx-loose-cannon",
  createdAt: new Date("2026-10-21T09:00:00.000Z"),
};

function makeRepos() {
  return { workspaceRecords: { eventsByActorSince: vi.fn().mockResolvedValue([EVENT]) } };
}

describe("listWorkspaceDecisions", () => {
  it("reads the caller's events since UTC midnight by default", async () => {
    const repos = makeRepos();
    const response = await listWorkspaceDecisions(repos as unknown as WorkspaceRepos, {
      userId: "user-1",
      input: {},
      now: new Date("2026-10-21T15:30:00.000Z"),
    });
    expect(response.events).toEqual([
      expect.objectContaining({ id: "event-1", label: "jinx-loose-cannon" }),
    ]);
    expect(repos.workspaceRecords.eventsByActorSince).toHaveBeenCalledWith(
      "user-1",
      new Date("2026-10-21T00:00:00.000Z"),
      500,
    );
  });

  it("reads from the given since", async () => {
    const repos = makeRepos();
    await listWorkspaceDecisions(repos as unknown as WorkspaceRepos, {
      userId: "user-1",
      input: { since: "2026-10-19T08:00:00.000Z" },
      now: new Date("2026-10-21T15:30:00.000Z"),
    });
    expect(repos.workspaceRecords.eventsByActorSince).toHaveBeenCalledWith(
      "user-1",
      new Date("2026-10-19T08:00:00.000Z"),
      500,
    );
  });
});

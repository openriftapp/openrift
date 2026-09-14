import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { autoCancelUnfillablePendingTrades } from "./trade-supply.js";

interface Pending {
  id: string;
  groupId: string;
  quantity: number;
  initiator: "giver" | "receiver";
}

/** The supply stands in for what the giver still offers after the drop. */
function sweepRepos(pending: Pending[], supplyByGroup: Record<string, string[]>) {
  const markAutoCancelled = vi.fn(() => Promise.resolve(1));
  const repos = {
    cardTrades: {
      listPendingForGiverPrinting: vi.fn(() => Promise.resolve(pending)),
      markAutoCancelled,
    },
    friendGroupMatches: {
      giverPrintingSupply: vi.fn(({ groupId }: { groupId: string }) =>
        Promise.resolve({
          unreservedCopyIds: supplyByGroup[groupId] ?? [],
          hasAny: (supplyByGroup[groupId] ?? []).length > 0,
        }),
      ),
    },
  } as unknown as Repos;
  return { repos, markAutoCancelled };
}

describe("autoCancelUnfillablePendingTrades", () => {
  it("cancels a pending request once the stack is empty", async () => {
    const { repos, markAutoCancelled } = sweepRepos(
      [{ id: "bob", groupId: "g1", quantity: 1, initiator: "receiver" }],
      { g1: [] },
    );

    const cancelled = await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1");

    expect(cancelled).toEqual(["bob"]);
    expect(markAutoCancelled).toHaveBeenCalledWith("bob");
  });

  it("keeps a request for 1 while one copy remains", async () => {
    const { repos, markAutoCancelled } = sweepRepos(
      [{ id: "bob", groupId: "g1", quantity: 1, initiator: "receiver" }],
      { g1: ["copy-1"] },
    );

    const cancelled = await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1");

    expect(cancelled).toEqual([]);
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it("cancels a request for 2 when only one copy remains, below its own quantity", async () => {
    const { repos } = sweepRepos(
      [{ id: "bob", groupId: "g1", quantity: 2, initiator: "receiver" }],
      { g1: ["copy-1"] },
    );

    expect(await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1")).toEqual([
      "bob",
    ]);
  });

  it("lets competing requests share the same copy, neither consuming it", async () => {
    const { repos, markAutoCancelled } = sweepRepos(
      [
        { id: "anna", groupId: "g1", quantity: 1, initiator: "receiver" },
        { id: "bob", groupId: "g1", quantity: 1, initiator: "receiver" },
      ],
      { g1: ["copy-1"] },
    );

    expect(await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1")).toEqual([]);
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it("keeps the older of two offers competing for one copy", async () => {
    const { repos } = sweepRepos(
      [
        { id: "older", groupId: "g1", quantity: 1, initiator: "giver" },
        { id: "newer", groupId: "g1", quantity: 1, initiator: "giver" },
      ],
      { g1: ["copy-1"] },
    );

    expect(await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1")).toEqual([
      "newer",
    ]);
  });

  it("does not cancel an offer against its own commitment", async () => {
    const { repos, markAutoCancelled } = sweepRepos(
      [{ id: "mine", groupId: "g1", quantity: 2, initiator: "giver" }],
      { g1: ["copy-1", "copy-2"] },
    );

    expect(await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1")).toEqual([]);
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it("cancels a request the giver's surviving offer has already spoken for", async () => {
    // Offers are settled before requests are judged.
    const { repos } = sweepRepos(
      [
        { id: "offer", groupId: "g1", quantity: 1, initiator: "giver" },
        { id: "request", groupId: "g1", quantity: 1, initiator: "receiver" },
      ],
      { g1: ["copy-1"] },
    );

    expect(await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1")).toEqual([
      "request",
    ]);
  });

  it("does not cancel a request whose group still sees a copy an offer elsewhere cannot claim", async () => {
    const { repos, markAutoCancelled } = sweepRepos(
      [
        { id: "offer", groupId: "g1", quantity: 1, initiator: "giver" },
        { id: "request", groupId: "g2", quantity: 1, initiator: "receiver" },
      ],
      { g1: ["copy-1"], g2: ["copy-2"] },
    );

    expect(await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1")).toEqual([]);
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it("cancels nothing and reads no supply when the giver has no pending trades", async () => {
    const { repos, markAutoCancelled } = sweepRepos([], {});

    expect(await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1")).toEqual([]);
    expect(repos.friendGroupMatches.giverPrintingSupply).not.toHaveBeenCalled();
    expect(markAutoCancelled).not.toHaveBeenCalled();
  });

  it("records nothing when a concurrent transition already moved the row", async () => {
    const { repos, markAutoCancelled } = sweepRepos(
      [{ id: "bob", groupId: "g1", quantity: 1, initiator: "receiver" }],
      { g1: [] },
    );
    markAutoCancelled.mockResolvedValueOnce(0);

    expect(await autoCancelUnfillablePendingTrades(repos, "giver-1", "printing-1")).toEqual([]);
    expect(markAutoCancelled).toHaveBeenCalledWith("bob");
  });
});

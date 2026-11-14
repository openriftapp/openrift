import type { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/cards/lib/card-detail-queries", () => ({
  cardDetailQueryOptions: (cardSlug: string) => ({ queryKey: ["card-detail", cardSlug] }),
}));

const { loadContributeCardName } = await import("./contribute-card-head");

const DETAIL = {
  card: { name: "Bounty Hunter", types: ["legend"], tags: ["Miss Fortune"] },
  printings: [{ printingId: "p-1" }],
};

function clientResolving(value: unknown) {
  const query = vi.fn().mockResolvedValue(value);
  return { query, queryClient: { query } as unknown as QueryClient };
}

describe("loadContributeCardName", () => {
  it("loads the card statically and returns its display name", async () => {
    const { query, queryClient } = clientResolving(DETAIL);

    await expect(loadContributeCardName(queryClient, "miss-fortune")).resolves.toEqual({
      cardName: "Miss Fortune, Bounty Hunter",
    });
    expect(query).toHaveBeenCalledWith({
      queryKey: ["card-detail", "miss-fortune"],
      staleTime: "static",
    });
  });

  it("returns the name when the printing belongs to the card", async () => {
    const { queryClient } = clientResolving(DETAIL);

    await expect(loadContributeCardName(queryClient, "miss-fortune", "p-1")).resolves.toEqual({
      cardName: "Miss Fortune, Bounty Hunter",
    });
  });

  it("throws not-found when the printing is not on the card", async () => {
    const { queryClient } = clientResolving(DETAIL);

    await expect(loadContributeCardName(queryClient, "miss-fortune", "p-9")).rejects.toSatisfy(
      isNotFound,
    );
  });

  it("converts the NOT_FOUND sentinel into the router's notFound", async () => {
    const query = vi.fn().mockRejectedValue(new Error("NOT_FOUND"));
    const queryClient = { query } as unknown as QueryClient;

    await expect(loadContributeCardName(queryClient, "gone")).rejects.toSatisfy(isNotFound);
  });
});

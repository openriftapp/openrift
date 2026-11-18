import { describe, expect, it, vi } from "vitest";

import { Route } from "./cards_.$cardSlug";

type LoaderFn = (ctx: {
  context: { queryClient: { query: ReturnType<typeof vi.fn> }; userId: string };
  params: { cardSlug: string };
}) => Promise<unknown>;

describe("/admin/cards/$cardSlug loader", () => {
  it("hands the head only the card's name and leaves the detail in the query cache", async () => {
    const detail = { displayName: "Jinx, Loose Cannon", card: { id: "c-1" }, printings: [] };
    const query = vi.fn((options: { queryKey: readonly unknown[] }) =>
      Promise.resolve(options.queryKey.includes("detail") ? detail : { isAdmin: false }),
    );

    const loaderData = await (Route.options.loader as unknown as LoaderFn)({
      context: { queryClient: { query }, userId: "u-1" },
      params: { cardSlug: "jinx-loose-cannon" },
    });

    expect(loaderData).toEqual({ displayName: "Jinx, Loose Cannon" });
  });
});

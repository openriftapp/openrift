import { describe, expect, it, vi } from "vitest";

import { Route as CardRoute } from "./cards.$cardSlug";
import { Route as NewCardRoute } from "./cards.new.$name";

function pendingClient() {
  return { query: vi.fn(() => new Promise<never>(() => {})) };
}

function clientWithAccess(sections: string[]) {
  return {
    query: vi.fn((options: { queryKey: readonly unknown[] }) =>
      options.queryKey.includes("me")
        ? Promise.resolve({ isAdmin: false, sections })
        : Promise.resolve({}),
    ),
  };
}

type Loader = (args: object) => unknown;

function requestedKeys(client: { query: ReturnType<typeof vi.fn> }): string[] {
  return client.query.mock.calls.map((call: unknown[]) =>
    JSON.stringify((call[0] as { queryKey: unknown }).queryKey),
  );
}

describe("workspace card record loaders", () => {
  it("requests the new card's detail and every reference query before any of them resolves", () => {
    const client = pendingClient();
    void (NewCardRoute.options.loader as Loader)({
      context: { queryClient: client, userId: "user-1" },
      params: { name: "ahri nine tailed fox" },
      preload: false,
    });

    const keys = requestedKeys(client);
    expect(new Set(keys).size).toBe(9);
    expect(keys.some((key) => key.includes("ahri nine tailed fox"))).toBe(true);
  });

  it("requests the card's detail and every reference query before any of them resolves", () => {
    const client = pendingClient();
    void (CardRoute.options.loader as Loader)({
      context: { queryClient: client, userId: "user-1" },
      params: { cardSlug: "jinx-loose-cannon" },
      preload: false,
    });

    const keys = requestedKeys(client);
    expect(new Set(keys).size).toBe(7);
    expect(keys.some((key) => key.includes("jinx-loose-cannon"))).toBe(true);
  });

  it("leaves the record's detail alone on a hover preload", () => {
    const client = pendingClient();
    void (CardRoute.options.loader as Loader)({
      context: { queryClient: client, userId: "user-1" },
      params: { cardSlug: "jinx-loose-cannon" },
      preload: true,
    });

    const keys = requestedKeys(client);
    expect(keys).toHaveLength(6);
    expect(keys.some((key) => key.includes("jinx-loose-cannon"))).toBe(false);
  });

  it.each([
    ["card", CardRoute, { cardSlug: "jinx-loose-cannon" }],
    ["new card", NewCardRoute, { name: "ahri nine tailed fox" }],
  ] as const)(
    "loads provider settings on the %s record for a card-review holder",
    async (_name, route, params) => {
      const client = clientWithAccess(["card-review"]);
      await (route.options.loader as Loader)({
        context: { queryClient: client, userId: "user-1" },
        params,
        preload: false,
      });

      expect(requestedKeys(client).some((key) => key.includes("provider-settings"))).toBe(true);
    },
  );

  it("skips provider settings for a user without the card-review grant", async () => {
    const client = clientWithAccess(["printing-desk"]);
    await expect(
      (CardRoute.options.loader as Loader)({
        context: { queryClient: client, userId: "user-1" },
        params: { cardSlug: "jinx-loose-cannon" },
        preload: false,
      }),
    ).resolves.toBeUndefined();

    expect(requestedKeys(client).some((key) => key.includes("provider-settings"))).toBe(false);
  });
});

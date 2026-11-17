import { describe, expect, it, vi } from "vitest";

import { Route as CardRoute } from "./cards.$cardSlug";
import { Route as NewCardRoute } from "./cards.new.$name";

function pendingClient() {
  return { query: vi.fn(() => new Promise<never>(() => {})) };
}

type Loader = (args: object) => unknown;

function requestedKeys(client: ReturnType<typeof pendingClient>): string[] {
  return client.query.mock.calls.map((call: unknown[]) =>
    JSON.stringify((call[0] as { queryKey: unknown }).queryKey),
  );
}

describe("workspace card record loaders", () => {
  it("requests the new card's detail and every reference query before any of them resolves", () => {
    const client = pendingClient();
    void (NewCardRoute.options.loader as Loader)({
      context: { queryClient: client },
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
      context: { queryClient: client },
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
      context: { queryClient: client },
      params: { cardSlug: "jinx-loose-cannon" },
      preload: true,
    });

    const keys = requestedKeys(client);
    expect(keys).toHaveLength(6);
    expect(keys.some((key) => key.includes("jinx-loose-cannon"))).toBe(false);
  });
});

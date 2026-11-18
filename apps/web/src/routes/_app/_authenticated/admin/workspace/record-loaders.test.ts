import { describe, expect, it, vi } from "vitest";

import { Route as CreateCardRoute } from "./cards.create";
import { Route as FaceRoute } from "./faces.$cardSlug.$faceId";
import { Route as PrintingRoute } from "./printings.$printingId";
import { Route as CreatePrintingRoute } from "./printings.create";
import { Route as NewPrintingRoute } from "./printings.new.$candidatePrintingId";

function pendingClient() {
  return { query: vi.fn(() => new Promise<never>(() => {})) };
}

type Loader = (args: object) => unknown;

function requestedKeys(client: { query: ReturnType<typeof vi.fn> }): string[] {
  return client.query.mock.calls.map((call: unknown[]) =>
    JSON.stringify((call[0] as { queryKey: unknown }).queryKey),
  );
}

describe("workspace record loaders", () => {
  it("requests the face's card and every reference query before any of them resolves", () => {
    const client = pendingClient();
    void (FaceRoute.options.loader as Loader)({
      context: { queryClient: client },
      params: { cardSlug: "ekko-recurrent", faceId: "face-1" },
      preload: false,
    });

    const keys = requestedKeys(client);
    expect(new Set(keys).size).toBe(5);
    expect(keys.some((key) => key.includes("ekko-recurrent"))).toBe(true);
  });

  it("requests the printing and every reference query before any of them resolves", () => {
    const client = pendingClient();
    void (PrintingRoute.options.loader as Loader)({
      context: { queryClient: client },
      params: { printingId: "printing-1" },
      preload: false,
    });

    const keys = requestedKeys(client);
    expect(new Set(keys).size).toBe(5);
    expect(keys.some((key) => key.includes("printing-1"))).toBe(true);
  });

  it("loads a printing record for a desk user whose provider settings request is refused", async () => {
    const client = {
      query: vi.fn((options: { queryKey: readonly unknown[] }) =>
        options.queryKey.includes("provider-settings")
          ? Promise.reject(new Error("Forbidden"))
          : Promise.resolve({}),
      ),
    };

    await expect(
      (PrintingRoute.options.loader as Loader)({
        context: { queryClient: client },
        params: { printingId: "printing-1" },
        preload: false,
      }),
    ).resolves.toBeUndefined();
    expect(requestedKeys(client).some((key) => key.includes("provider-settings"))).toBe(true);
  });

  it("leaves the printing alone on a hover preload", () => {
    const client = pendingClient();
    void (PrintingRoute.options.loader as Loader)({
      context: { queryClient: client },
      params: { printingId: "printing-1" },
      preload: true,
    });

    const keys = requestedKeys(client);
    expect(keys).toHaveLength(4);
    expect(keys.some((key) => key.includes("printing-1"))).toBe(false);
  });

  it("requests the queue, the sets and every reference query for a new printing together", () => {
    const client = pendingClient();
    void (NewPrintingRoute.options.loader as Loader)({
      context: { queryClient: client },
      params: { candidatePrintingId: "candidate-1" },
      preload: false,
    });

    const keys = requestedKeys(client);
    expect(new Set(keys).size).toBe(6);
    expect(keys).toContain(JSON.stringify(["admin", "workspace", "queue", "all"]));
  });

  it("requests the new printing's card once the queue names it", async () => {
    const queue = {
      items: [{ owner: "printing", ownerId: "candidate-1", cardSlug: "ekko-recurrent" }],
    };
    const client = {
      query: vi.fn((options: { queryKey: readonly unknown[] }) =>
        options.queryKey.includes("queue") ? Promise.resolve(queue) : new Promise(() => {}),
      ),
    };
    void (NewPrintingRoute.options.loader as Loader)({
      context: { queryClient: client },
      params: { candidatePrintingId: "candidate-1" },
      preload: false,
    });

    await vi.waitFor(() =>
      expect(requestedKeys(client).some((key) => key.includes("ekko-recurrent"))).toBe(true),
    );
  });

  it("requests the creation reference data together for a new card", () => {
    const client = pendingClient();
    void (CreateCardRoute.options.loader as Loader)({
      context: { queryClient: client },
      preload: false,
    });

    expect(new Set(requestedKeys(client)).size).toBe(4);
  });

  it("also requests the prefilled card's printings for a new printing", () => {
    const client = pendingClient();
    void (CreatePrintingRoute.options.loader as Loader)({
      context: { queryClient: client },
      deps: { card: "ekko-recurrent" },
      preload: false,
    });

    const keys = requestedKeys(client);
    expect(new Set(keys).size).toBe(5);
    expect(keys.some((key) => key.includes("ekko-recurrent"))).toBe(true);
  });
});

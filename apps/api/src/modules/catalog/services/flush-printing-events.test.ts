import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../system/services/discord-webhook.js", () => ({
  flushPrintingEvents: vi.fn(async () => ({ sentIds: [], failedIds: [], failures: [] })),
}));

import { flushPrintingEvents } from "../../system/services/discord-webhook.js";
import { flushPendingPrintingEvents, isPrintingFlushNoop } from "./flush-printing-events.js";

const mockFlush = vi.mocked(flushPrintingEvents);

function mockLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } as any;
}

const APP_BASE_URL = "https://openrift.app";

const WEBHOOKS = {
  newPrintings: "https://discord.com/api/webhooks/new",
};

describe("flushPendingPrintingEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function makeRepos(events: unknown[]) {
    return {
      printingEvents: {
        listPending: vi.fn(async () => events),
        markSent: vi.fn(async () => {}),
        markRetry: vi.fn(async () => {}),
      },
      enums: {
        all: vi.fn(async () => ({
          rarities: [{ slug: "rare", label: "Rare" }],
          finishes: [{ slug: "foil", label: "Foil" }],
          artVariants: [],
          cardSizes: [],
          languages: [{ slug: "FR", label: "French" }],
          markers: [{ slug: "promo", label: "Promo" }],
        })),
      },
    };
  }

  it("returns early when no pending events", async () => {
    const repos = makeRepos([]);

    const result = await flushPendingPrintingEvents(
      repos as any,
      WEBHOOKS,
      APP_BASE_URL,
      mockLog(),
    );

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockFlush).not.toHaveBeenCalled();
  });

  it("passes the events, webhook URL and appBaseUrl through to the sender", async () => {
    const events = [
      {
        id: "evt-1",
        printingId: "p-1",
        cardName: "Card",
        status: "pending" as const,
      },
    ];

    mockFlush.mockResolvedValue({ sentIds: ["evt-1"], failedIds: [], failures: [] });

    const repos = makeRepos(events);

    const result = await flushPendingPrintingEvents(
      repos as any,
      WEBHOOKS,
      APP_BASE_URL,
      mockLog(),
    );

    expect(mockFlush).toHaveBeenCalledWith(
      events,
      expect.objectContaining({
        webhookUrl: WEBHOOKS.newPrintings,
        appBaseUrl: APP_BASE_URL,
        labels: expect.objectContaining({
          rarities: { rare: "Rare" },
          languages: { FR: "French" },
          markers: { promo: "Promo" },
        }),
      }),
    );
    expect(result).toEqual({ sent: 1, failed: 0 });
  });

  it("marks each delivered message's events sent through the sender's callback", async () => {
    const repos = makeRepos([{ id: "evt-1" }, { id: "evt-2" }]);
    mockFlush.mockImplementation(async (_events, { onSent }) => {
      await onSent(["evt-1"]);
      return { sentIds: ["evt-1"], failedIds: ["evt-2"], failures: [] };
    });

    await flushPendingPrintingEvents(repos as any, WEBHOOKS, APP_BASE_URL, mockLog());

    expect(repos.printingEvents.markSent).toHaveBeenCalledExactlyOnceWith(["evt-1"]);
    expect(repos.printingEvents.markRetry).toHaveBeenCalledWith(["evt-2"]);
  });

  it("marks failed events for retry on partial failure and includes failure detail", async () => {
    const events = [
      {
        id: "evt-1",
        printingId: "p-1",
        cardName: "Card A",
        status: "pending" as const,
      },
      {
        id: "evt-2",
        printingId: "p-2",
        cardName: "Card B",
        status: "pending" as const,
      },
    ];

    mockFlush.mockResolvedValue({
      sentIds: ["evt-1"],
      failedIds: ["evt-2"],
      failures: [{ channel: "newPrintings", status: 400, detail: "Bad embed" }],
    });

    const repos = makeRepos(events);

    const result = await flushPendingPrintingEvents(
      repos as any,
      WEBHOOKS,
      APP_BASE_URL,
      mockLog(),
    );

    expect(repos.printingEvents.markRetry).toHaveBeenCalledWith(["evt-2"]);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([
      { channel: "newPrintings", status: 400, detail: "Bad embed" },
    ]);
  });

  it("throws when every event failed so job_runs records a real error", async () => {
    const events = [
      {
        id: "evt-1",
        printingId: "p-1",
        cardName: "Card",
        status: "pending" as const,
      },
    ];

    mockFlush.mockResolvedValue({
      sentIds: [],
      failedIds: ["evt-1"],
      failures: [{ channel: "newPrintings", status: 401, detail: "Unauthorized" }],
    });

    const repos = makeRepos(events);

    await expect(
      flushPendingPrintingEvents(repos as any, WEBHOOKS, APP_BASE_URL, mockLog()),
    ).rejects.toThrow(/HTTP 401.*Unauthorized/u);

    expect(repos.printingEvents.markRetry).toHaveBeenCalledWith(["evt-1"]);
  });
});

describe("isPrintingFlushNoop", () => {
  it("is a no-op when no webhook delivery was attempted", () => {
    expect(isPrintingFlushNoop({ sent: 0, failed: 0 })).toBe(true);
  });

  it("did work when an event was delivered", () => {
    expect(isPrintingFlushNoop({ sent: 5, failed: 0 })).toBe(false);
  });

  it("did work when a delivery failed (failures are not a no-op)", () => {
    expect(isPrintingFlushNoop({ sent: 0, failed: 3 })).toBe(false);
  });
});

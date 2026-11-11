import { createLogger } from "@openrift/shared/logger";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnrichedPrintingEvent } from "../../catalog/repositories/printing-events.js";
import type { PrintingLabels } from "./discord-webhook.js";
import {
  buildNewPrintingMessages,
  flushPrintingEvents,
  printingVariantParts,
} from "./discord-webhook.js";

const APP_BASE_URL = "https://openrift.app";

const LABELS: PrintingLabels = {
  rarities: { common: "Common", rare: "Rare" },
  finishes: { normal: "Normal", foil: "Foil", metal: "Metal" },
  artVariants: { normal: "Normal", altart: "Alt Art" },
  cardSizes: { standard: "Standard", oversized: "Oversized" },
  languages: { EN: "English", FR: "French", ZH: "Traditional Chinese" },
  markers: { promo: "Promo", champion: "Champion" },
};

function makeEvent(overrides: Partial<EnrichedPrintingEvent> = {}): EnrichedPrintingEvent {
  return {
    id: "evt-1",
    printingId: "p-1",
    createdAt: new Date("2026-04-09T12:00:00Z"),
    cardName: "Test Card",
    cardSlug: "test-card",
    printingSlug: "ogn-001",
    setName: "Origins",
    shortCode: "OGN-001",
    rarity: "common",
    finish: "normal",
    finishLabel: "Normal",
    artVariant: "normal",
    size: "standard",
    isSigned: false,
    isOvernumbered: false,
    markerSlugs: [],
    artist: "Artist A",
    language: "EN",
    languageName: "English",
    frontImageId: "OGN-001-uuid",
    ...overrides,
  };
}

function manyEvents(count: number, overrides: (i: number) => Partial<EnrichedPrintingEvent>) {
  return Array.from({ length: count }, (_, i) => makeEvent({ id: `evt-${i}`, ...overrides(i) }));
}

describe("printingVariantParts", () => {
  it("is empty for a plain English printing", () => {
    expect(printingVariantParts(makeEvent(), LABELS)).toEqual([]);
  });

  it("lists language, art variant, overnumbered, markers, finish and size in modal order", () => {
    const event = makeEvent({
      language: "FR",
      artVariant: "altart",
      isOvernumbered: true,
      markerSlugs: ["champion", "promo"],
      finish: "foil",
      size: "oversized",
      isSigned: true,
    });

    expect(printingVariantParts(event, LABELS)).toEqual([
      "French",
      "Alt Art",
      "Overnumbered",
      "Champion + Promo",
      "Foil",
      "Oversized",
      "Signed",
    ]);
  });

  it("falls back to the slug when a label is missing", () => {
    expect(printingVariantParts(makeEvent({ finish: "galaxy" }), LABELS)).toEqual(["galaxy"]);
  });
});

describe("buildNewPrintingMessages", () => {
  it("creates one embed per printing for small batches", () => {
    const events = [makeEvent(), makeEvent({ id: "evt-2", cardName: "Card B" })];

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    expect(payloads).toHaveLength(1);
    expect(payloads[0]!.body.embeds).toHaveLength(2);
    expect(payloads[0]!.body.embeds[0]!.title).toBe("New: Test Card");
    expect(payloads[0]!.body.embeds[1]!.title).toBe("New: Card B");
  });

  it("links the embed title to the printing page", () => {
    const payloads = buildNewPrintingMessages([makeEvent()], APP_BASE_URL, LABELS);

    expect(payloads[0]!.body.embeds[0]!.url).toBe("https://openrift.app/cards/test-card/ogn-001");
  });

  it("uses the site host as the embed author block", () => {
    const payloads = buildNewPrintingMessages(
      [makeEvent()],
      "https://preview.openrift.app",
      LABELS,
    );

    expect(payloads[0]!.body.embeds[0]!.author).toEqual({
      name: "preview.openrift.app",
      url: "https://preview.openrift.app",
    });
  });

  it("builds the absolute 400w image URL from the image id", () => {
    const events = [makeEvent({ frontImageId: "019d6c25-b081-74b3-a901-64da4ae0abcd" })];

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    expect(payloads[0]!.body.embeds[0]!.image?.url).toBe(
      "https://openrift.app/media/cards/019d6c25-b081-74b3-a901-64da4ae0abcd-400w.webp",
    );
  });

  it("omits image when no front image id is available", () => {
    const payloads = buildNewPrintingMessages(
      [makeEvent({ frontImageId: null })],
      APP_BASE_URL,
      LABELS,
    );

    expect(payloads[0]!.body.embeds[0]!.image).toBeUndefined();
  });

  it("puts set, code, variant text and rarity in the footer", () => {
    const events = [
      makeEvent({
        rarity: "rare",
        language: "FR",
        artVariant: "altart",
        markerSlugs: ["promo"],
        finish: "metal",
      }),
    ];

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    expect(payloads[0]!.body.embeds[0]!.footer?.text).toBe(
      "Origins · OGN-001 · French · Alt Art · Promo · Metal · Rare",
    );
  });

  it("leaves default finish and English out of the footer", () => {
    const payloads = buildNewPrintingMessages([makeEvent()], APP_BASE_URL, LABELS);

    expect(payloads[0]!.body.embeds[0]!.footer?.text).toBe("Origins · OGN-001 · Common");
  });

  it("never includes the artist in the embed", () => {
    const payloads = buildNewPrintingMessages(
      [makeEvent({ artist: "Jane Doe" })],
      APP_BASE_URL,
      LABELS,
    );

    expect(payloads[0]!.body.embeds[0]!.footer?.text).not.toContain("Jane Doe");
    expect(payloads[0]!.body.embeds[0]!.description).toBeUndefined();
  });

  it("omits the footer entirely when no metadata is present", () => {
    const events = [makeEvent({ setName: null, shortCode: null, rarity: null })];

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    expect(payloads[0]!.body.embeds[0]!.footer).toBeUndefined();
  });

  it("chunks into multiple payloads when more than 10 embeds", () => {
    const events = manyEvents(15, (i) => ({ cardName: `Card ${i}` }));

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    expect(payloads).toHaveLength(2);
    expect(payloads[0]!.body.embeds).toHaveLength(10);
    expect(payloads[1]!.body.embeds).toHaveLength(5);
  });
});

describe("buildNewPrintingMessages summary", () => {
  it("lists every printing per card, linked to its printing page with its variant text", () => {
    const events = [
      ...manyEvents(22, (i) => ({
        cardName: `Card ${i}`,
        cardSlug: `card-${i}`,
        printingSlug: `ogn-${i}`,
        shortCode: `OGN-${String(i).padStart(3, "0")}`,
      })),
      makeEvent({
        id: "evt-foil",
        cardName: "Card 0",
        cardSlug: "card-0",
        printingSlug: "ogn-0-foil",
        shortCode: "OGN-000",
        finish: "foil",
        isOvernumbered: true,
      }),
    ];

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    expect(payloads).toHaveLength(1);
    const { title, description } = payloads[0]!.body.embeds[0]!;
    expect(title).toBe("23 new printings added");
    expect(description?.split("\n")[0]).toBe("**Origins** (23)");
    expect(description).toContain(
      "Card 0: [OGN-000](https://openrift.app/cards/card-0/ogn-0), " +
        "[OGN-000 · Overnumbered · Foil](https://openrift.app/cards/card-0/ogn-0-foil)",
    );
    expect(description).toContain("Card 21: [OGN-021](https://openrift.app/cards/card-21/ogn-21)");
    expect(description).not.toContain("more");
  });

  it("moves variant text shared by the whole set to the set header", () => {
    const events = manyEvents(21, (i) => ({
      setName: "Spiritforged",
      cardName: `Card ${i}`,
      cardSlug: `card-${i}`,
      shortCode: `SFD-${i}`,
      language: "ZH",
      finish: i === 0 ? "foil" : "normal",
    }));

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    const description = payloads[0]!.body.embeds[0]!.description!;
    expect(description.split("\n")[0]).toBe("**Spiritforged** · Traditional Chinese (21)");
    expect(description).toContain("Card 0: [SFD-0 · Foil](");
    expect(description).toContain("Card 1: [SFD-1](");
  });

  it("separates sets and keeps the first-seen set order", () => {
    const events = manyEvents(21, (i) => ({
      setName: i < 20 ? "Origins" : "Radiance",
      cardName: `Card ${i}`,
      cardSlug: `card-${i}`,
    }));

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    const description = payloads[0]!.body.embeds[0]!.description!;
    expect(description).toMatch(/^\*\*Origins\*\* \(20\)\n/u);
    expect(description).toContain("\n\n**Radiance** (1)\n");
  });

  it("splits long lists across messages under the description limit and repeats the set header", () => {
    const events = manyEvents(120, (i) => ({
      cardName: `A card with a fairly long name number ${i}`,
      cardSlug: `a-card-with-a-fairly-long-name-number-${i}`,
      printingSlug: `ogn-${i}-a-long-printing-slug`,
      shortCode: `OGN-${i}`,
    }));

    const payloads = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    expect(payloads.length).toBeGreaterThan(1);
    for (const payload of payloads) {
      expect(payload.body.embeds[0]!.description!.length).toBeLessThanOrEqual(4000);
    }
    expect(payloads[1]!.body.embeds[0]!.title).toBe("120 new printings added (continued)");
    expect(payloads[1]!.body.embeds[0]!.description).toMatch(
      /^\*\*Origins\*\* \(120\) \(continued\)\n/u,
    );
    const allRows = payloads.flatMap((p) => p.body.embeds[0]!.description!.split("\n"));
    expect(allRows.filter((row) => row.startsWith("A card"))).toHaveLength(120);
  });

  it("assigns every event to exactly the message that lists it", () => {
    const events = manyEvents(120, (i) => ({
      cardName: `A card with a fairly long name number ${i}`,
      cardSlug: `a-card-with-a-fairly-long-name-number-${i}`,
      printingSlug: `ogn-${i}-a-long-printing-slug`,
      shortCode: `OGN-${i}`,
    }));

    const messages = buildNewPrintingMessages(events, APP_BASE_URL, LABELS);

    expect(messages.flatMap((m) => m.eventIds).toSorted()).toEqual(
      events.map((e) => e.id).toSorted(),
    );
    for (const message of messages) {
      const description = message.body.embeds[0]!.description!;
      for (const id of message.eventIds) {
        const index = Number(id.replace("evt-", ""));
        expect(description).toContain(`ogn-${index}-a-long-printing-slug)`);
      }
    }
  });
});

describe("flushPrintingEvents", () => {
  const WEBHOOK_URL = "https://discord.example/webhook";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flush(events: EnrichedPrintingEvent[], webhookUrl: string | null = WEBHOOK_URL) {
    const onSent = vi.fn(async (_ids: string[]) => {});
    const sleep = vi.fn(async (_ms: number) => {});
    const result = flushPrintingEvents(events, {
      webhookUrl,
      appBaseUrl: APP_BASE_URL,
      labels: LABELS,
      log: createLogger("test"),
      onSent,
      sleep,
    });
    return { result, onSent, sleep };
  }

  function stubFetch(...responses: (() => Response)[]) {
    let call = 0;
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      const next = responses[Math.min(call, responses.length - 1)]!;
      call++;
      return next();
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const ok = () => new Response(null, { status: 204 });
  const rateLimited = (retryAfter: number) => () =>
    Response.json(
      { message: "You are being rate limited.", retry_after: retryAfter },
      { status: 429 },
    );

  it("gives every webhook request a timeout", async () => {
    const fetchMock = stubFetch(ok);

    const { result, onSent } = flush([makeEvent()]);

    await expect(result).resolves.toHaveProperty("sentIds", ["evt-1"]);
    expect(onSent).toHaveBeenCalledWith(["evt-1"]);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("marks delivered messages sent and leaves only the failed message's events for retry", async () => {
    const events = manyEvents(25, (i) => ({ cardName: `Card ${i}` }));
    stubFetch(ok, () => new Response("Bad embed", { status: 400 }), ok);

    const { result, onSent } = flush(events.slice(0, 15));
    const { sentIds, failedIds, failures } = await result;

    expect(onSent).toHaveBeenCalledExactlyOnceWith(events.slice(0, 10).map((e) => e.id));
    expect(sentIds).toEqual(events.slice(0, 10).map((e) => e.id));
    expect(failedIds).toEqual(events.slice(10, 15).map((e) => e.id));
    expect(failures).toEqual([{ channel: "newPrintings", status: 400, detail: "Bad embed" }]);
  });

  it("keeps sending later messages after one fails", async () => {
    const events = manyEvents(15, (i) => ({ cardName: `Card ${i}` }));
    stubFetch(() => new Response("Server error", { status: 500 }), ok);

    const { result, onSent } = flush(events);
    const { sentIds, failedIds } = await result;

    expect(failedIds).toEqual(events.slice(0, 10).map((e) => e.id));
    expect(sentIds).toEqual(events.slice(10).map((e) => e.id));
    expect(onSent).toHaveBeenCalledExactlyOnceWith(events.slice(10).map((e) => e.id));
  });

  it("waits out a 429 for the time Discord asks and resends the same message", async () => {
    const fetchMock = stubFetch(rateLimited(2.5), ok);

    const { result, sleep } = flush([makeEvent()]);

    await expect(result).resolves.toHaveProperty("sentIds", ["evt-1"]);
    expect(sleep).toHaveBeenCalledWith(2500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(fetchMock.mock.calls[0]?.[1]?.body);
  });

  it("falls back to the Retry-After header when the 429 body has no retry_after", async () => {
    stubFetch(() => new Response("", { status: 429, headers: { "Retry-After": "3" } }), ok);

    const { result, sleep } = flush([makeEvent()]);

    await expect(result).resolves.toHaveProperty("sentIds", ["evt-1"]);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("gives up on a message after repeated 429s", async () => {
    const fetchMock = stubFetch(rateLimited(1));

    const { result, onSent } = flush([makeEvent()]);
    const { failedIds, failures } = await result;

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(failedIds).toEqual(["evt-1"]);
    expect(failures[0]?.status).toBe(429);
    expect(onSent).not.toHaveBeenCalled();
  });

  it("does not wait out a 429 longer than a minute", async () => {
    const fetchMock = stubFetch(rateLimited(600), ok);

    const { result, sleep } = flush([makeEvent()]);

    await expect(result).resolves.toHaveProperty("failedIds", ["evt-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("marks everything sent without posting when no webhook is configured", async () => {
    const fetchMock = stubFetch(ok);

    const { result, onSent } = flush([makeEvent(), makeEvent({ id: "evt-2" })], null);

    await expect(result).resolves.toHaveProperty("sentIds", ["evt-1", "evt-2"]);
    expect(onSent).toHaveBeenCalledWith(["evt-1", "evt-2"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

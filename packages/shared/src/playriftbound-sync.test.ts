import { describe, expect, it } from "vitest";

import {
  parsePlayriftboundDeckText,
  parsePlayriftboundEventId,
  PLAYRIFTBOUND_HANDOFF,
  playriftboundExternalId,
  playriftboundRiotId,
  readPlayriftboundHandoff,
  summarizePlayriftboundSync,
} from "./playriftbound-sync.js";

const DECK_TEXT = [
  "Legend:",
  "1 Lillia, Bashful Bloom",
  "",
  "Champion:",
  "1 Lillia, Fae Fawn",
  "",
  "MainDeck:",
  "3 Defy",
  "2 Smoke and Mirrors",
  "",
  "Battlefields:",
  "1 Seat of Power",
  "",
  "Runes:",
  "6 Calm Rune",
  "",
  "Sideboard:",
  "1 Charm",
].join("\n");

describe("parsePlayriftboundDeckText", () => {
  it("reads every section the source writes", () => {
    expect(parsePlayriftboundDeckText(DECK_TEXT)).toEqual({
      cards: [
        { name: "Lillia, Bashful Bloom", quantity: 1, section: "Legend" },
        { name: "Lillia, Fae Fawn", quantity: 1, section: "Champion" },
        { name: "Defy", quantity: 3, section: "MainDeck" },
        { name: "Smoke and Mirrors", quantity: 2, section: "MainDeck" },
        { name: "Seat of Power", quantity: 1, section: "Battlefields" },
        { name: "Calm Rune", quantity: 6, section: "Runes" },
        { name: "Charm", quantity: 1, section: "Sideboard" },
      ],
      skipped: [],
    });
  });

  it("skips lines outside a known section and lines without a count", () => {
    const parsed = parsePlayriftboundDeckText(
      "1 Before Any Header\r\nMainDeck:\r\nDefy\r\n0 Zero Copies\r\nCommander:\r\n1 Not A Zone\r\nRunes:\r\n6 Calm Rune",
    );
    expect(parsed.cards).toEqual([{ name: "Calm Rune", quantity: 6, section: "Runes" }]);
    expect(parsed.skipped).toEqual([
      "1 Before Any Header",
      "Defy",
      "0 Zero Copies",
      "Commander:",
      "1 Not A Zone",
    ]);
  });

  it("reads an empty submission as no cards", () => {
    expect(parsePlayriftboundDeckText("")).toEqual({ cards: [], skipped: [] });
  });
});

describe("parsePlayriftboundEventId", () => {
  it("takes a bare id", () => {
    expect(parsePlayriftboundEventId(" 117163142476069250 ")).toBe("117163142476069250");
  });

  it("reads the id from public and organizer event links", () => {
    expect(
      parsePlayriftboundEventId("https://playriftbound.com/en-US/events/117163142476069250"),
    ).toBe("117163142476069250");
    expect(
      parsePlayriftboundEventId(
        "https://rgn.playriftbound.com/de-DE/org/019fce9f-5f7b-7f02-8667-f16080d0f063/events/117163142476069250/edit",
      ),
    ).toBe("117163142476069250");
  });

  it("rejects other hosts and links without an event", () => {
    expect(parsePlayriftboundEventId("https://example.com/events/117163142476069250")).toBeNull();
    expect(
      parsePlayriftboundEventId("https://rgn.playriftbound.com/de-DE/org/x/events"),
    ).toBeNull();
    expect(parsePlayriftboundEventId("not a link")).toBeNull();
  });
});

const PAYLOAD = {
  event: { eventId: "117163142476069250", name: "Nexus Night", startsAt: "2026-11-22T13:00:00Z" },
  registrants: [
    {
      playerId: "p1",
      displayName: "Poro Snax",
      tagLine: "EUW",
      dropped: false,
      deck: { deckText: DECK_TEXT, lastSavedAt: "2026-11-16T08:55:34.591217Z" },
    },
    {
      playerId: "p2",
      displayName: "Teemo Main",
      tagLine: null,
      dropped: true,
      deck: { deckText: "MainDeck:\nDefy", lastSavedAt: "2026-11-16T09:00:00Z" },
    },
    { playerId: "p3", displayName: "Bandle Scout", tagLine: null, dropped: false, deck: null },
  ],
  readAt: "2026-11-17T10:00:00Z",
};

describe("summarizePlayriftboundSync", () => {
  it("counts players, decks, drops and decks with unreadable lines", () => {
    expect(summarizePlayriftboundSync(PAYLOAD)).toEqual({
      registrants: 3,
      decks: 2,
      dropped: 1,
      unreadable: 1,
    });
  });
});

describe("readPlayriftboundHandoff", () => {
  const message = (payload: unknown) => ({ type: PLAYRIFTBOUND_HANDOFF.payload, payload });

  it("reads the JSON text the extension posts", () => {
    expect(readPlayriftboundHandoff(message(JSON.stringify(PAYLOAD)))).toEqual(PAYLOAD);
  });

  it("refuses other messages, broken JSON and payloads of the wrong shape", () => {
    expect(readPlayriftboundHandoff(null)).toBeNull();
    expect(
      readPlayriftboundHandoff({ type: "other", payload: JSON.stringify(PAYLOAD) }),
    ).toBeNull();
    expect(readPlayriftboundHandoff(message(PAYLOAD))).toBeNull();
    expect(readPlayriftboundHandoff(message("{"))).toBeNull();
    expect(
      readPlayriftboundHandoff(message(JSON.stringify({ ...PAYLOAD, event: { eventId: "x" } }))),
    ).toBeNull();
  });
});

describe("playriftbound identities", () => {
  it("prefixes the player id", () => {
    expect(playriftboundExternalId("01a0f1fb")).toBe("playriftbound:01a0f1fb");
  });

  it("joins a Riot ID only when the tag line is known", () => {
    expect(playriftboundRiotId({ displayName: "Poro Snax", tagLine: "EUW" })).toBe("Poro Snax#EUW");
    expect(playriftboundRiotId({ displayName: "Poro Snax", tagLine: null })).toBeNull();
    expect(playriftboundRiotId({ displayName: "Poro Snax", tagLine: "" })).toBeNull();
  });
});

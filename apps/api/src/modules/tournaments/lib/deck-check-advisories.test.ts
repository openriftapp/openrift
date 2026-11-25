import { WellKnown } from "@openrift/shared/well-known";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { buildEntryAdvisories, computeZoneSuggestions } from "./deck-check-advisories.js";
import type { AdvisoryCardLine } from "./deck-check-advisories.js";

function line(overrides: Partial<AdvisoryCardLine> = {}): AdvisoryCardLine {
  return {
    id: "row-1",
    rawName: "Some Card",
    zone: "main",
    quantity: 1,
    resolvedCardId: "card-1",
    matchStatus: "matched",
    ...overrides,
  };
}

const details = new Map([
  ["legend-card", { name: "A Legend", type: "legend", types: ["legend"], superTypes: [] }],
  ["rune-card", { name: "A Rune", type: "rune", types: ["rune"], superTypes: [] }],
  [
    "battlefield-card",
    { name: "A Battlefield", type: "battlefield", types: ["battlefield"], superTypes: [] },
  ],
  ["unit-card", { name: "A Unit", type: "unit", types: ["unit"], superTypes: [] }],
  ["spell-card", { name: "A Spell", type: "spell", types: ["spell"], superTypes: [] }],
]);

describe("computeZoneSuggestions", () => {
  it("suggests the type-locked zone for Legend, Rune, and Battlefield cards dumped in main", () => {
    const suggestions = computeZoneSuggestions(
      [
        line({ id: "a", resolvedCardId: "legend-card" }),
        line({ id: "b", resolvedCardId: "rune-card" }),
        line({ id: "c", resolvedCardId: "battlefield-card" }),
      ],
      details,
    );
    expect(suggestions).toEqual([
      { cardId: "a", cardName: "A Legend", currentZone: "main", suggestedZone: "legend" },
      { cardId: "b", cardName: "A Rune", currentZone: "main", suggestedZone: "runes" },
      {
        cardId: "c",
        cardName: "A Battlefield",
        currentZone: "main",
        suggestedZone: "battlefield",
      },
    ]);
  });

  it("leaves a Legend in legend options alone and moves anything else out of it", () => {
    const suggestions = computeZoneSuggestions(
      [
        line({ id: "a", resolvedCardId: "legend-card", zone: "legend-options" }),
        line({ id: "b", resolvedCardId: "unit-card", zone: "legend-options" }),
      ],
      details,
    );
    expect(suggestions.map((suggestion) => [suggestion.cardId, suggestion.suggestedZone])).toEqual([
      ["b", "main"],
    ]);
  });

  it("catches a type-locked card mis-zoned into any wrong zone, not just main", () => {
    const suggestions = computeZoneSuggestions(
      [line({ id: "a", resolvedCardId: "rune-card", zone: "sideboard" })],
      details,
    );
    expect(suggestions).toEqual([
      { cardId: "a", cardName: "A Rune", currentZone: "sideboard", suggestedZone: "runes" },
    ]);
  });

  it("moves a card wrongly parked in a type-locked zone back to main", () => {
    const suggestions = computeZoneSuggestions(
      [
        line({ id: "a", resolvedCardId: "spell-card", zone: "battlefield" }),
        line({ id: "b", resolvedCardId: "unit-card", zone: "legend" }),
      ],
      details,
    );
    expect(suggestions).toEqual([
      { cardId: "a", cardName: "A Spell", currentZone: "battlefield", suggestedZone: "main" },
      { cardId: "b", cardName: "A Unit", currentZone: "legend", suggestedZone: "main" },
    ]);
  });

  it("never proposes moving an ordinary card among the non-locked zones", () => {
    const suggestions = computeZoneSuggestions(
      [
        line({ id: "a", resolvedCardId: "unit-card", zone: "main" }),
        line({ id: "b", resolvedCardId: "unit-card", zone: "sideboard" }),
        line({ id: "c", resolvedCardId: "unit-card", zone: "champion" }),
        line({ id: "d", resolvedCardId: "unit-card", zone: "overflow" }),
      ],
      details,
    );
    expect(suggestions).toEqual([]);
  });

  it("leaves a type-locked card that is already in the right zone alone", () => {
    const suggestions = computeZoneSuggestions(
      [line({ id: "a", resolvedCardId: "legend-card", zone: "legend" })],
      details,
    );
    expect(suggestions).toEqual([]);
  });

  it("skips unmatched lines, preview lines without an id, and lines with no catalog detail", () => {
    const suggestions = computeZoneSuggestions(
      [
        line({ id: "a", resolvedCardId: "legend-card", matchStatus: "unmatched" }),
        line({ id: undefined, resolvedCardId: "rune-card" }),
        line({ id: "c", resolvedCardId: "missing-card" }),
      ],
      details,
    );
    expect(suggestions).toEqual([]);
  });
});

describe("buildEntryAdvisories", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  interface StubCardDetail {
    id: string;
    name: string;
    types: string[];
    superTypes: string[];
    domains: string[];
    tags: string[];
    keywords: string[];
  }

  /** Everything besides the calls buildEntryAdvisories makes is absent and would throw if touched. */
  interface StubBan {
    cardId: string;
    formatId: string;
    bannedAt: string | null;
    unbannedAt?: string;
    circuit?: string;
  }

  interface StubWindow {
    setSlug: string;
    circuit?: string;
    legalFrom: string | null;
    legalUntil?: string;
  }

  function stubRepos(
    cardDetails: Map<string, StubCardDetail>,
    championTags: string[] | null,
    bans: StubBan[] = [],
    sets: { numbered?: Map<string, string[]>; windows?: StubWindow[] } = {},
  ): Repos {
    return {
      enums: {
        all: () => Promise.resolve({ cardTypes: [], domains: [] }),
      },
      deckCheck: {
        getCardDetails: () => Promise.resolve(cardDetails),
      },
      cardBans: {
        listForCards: (_cardIds: string[], formatIds: string[], circuit?: string) =>
          Promise.resolve(
            bans
              .map((ban) => ({
                cardId: ban.cardId,
                formatId: ban.formatId,
                circuit: ban.circuit ?? null,
                bannedAt: ban.bannedAt,
                unbannedAt: ban.unbannedAt ?? null,
              }))
              .filter(
                (ban) =>
                  formatIds.includes(ban.formatId) &&
                  (ban.circuit === null || ban.circuit === circuit),
              ),
          ),
      },
      formatSets: {
        listAll: () =>
          Promise.resolve(
            (sets.windows ?? []).map((window) => ({
              id: `${window.setSlug}-${window.circuit ?? "global"}`,
              formatId: WellKnown.banFormat.CONSTRUCTED,
              setId: window.setSlug,
              setSlug: window.setSlug,
              circuit: window.circuit ?? null,
              legalFrom: window.legalFrom,
              legalUntil: window.legalUntil ?? null,
            })),
          ),
      },
      catalog: {
        numberedSetSlugsByCardIds: () => Promise.resolve(sets.numbered ?? new Map()),
        championIdentifierTags: () => {
          if (championTags === null) {
            throw new Error("championIdentifierTags must not be queried for this format");
          }
          return Promise.resolve(championTags);
        },
      },
    } as unknown as Repos;
  }

  it("feeds the champion-identifier tags into custom-region validation", async () => {
    const cardDetails = new Map<string, StubCardDetail>([
      [
        "legend-karma",
        {
          id: "legend-karma",
          name: "Karma",
          types: ["legend"],
          superTypes: [],
          domains: [],
          tags: ["Karma"],
          keywords: [],
        },
      ],
      [
        "sig-daisy",
        {
          id: "sig-daisy",
          name: "Daisy!",
          types: ["unit"],
          superTypes: ["signature"],
          domains: [],
          tags: ["Ivern", "Ionia"],
          keywords: [],
        },
      ],
    ]);
    const advisories = await buildEntryAdvisories(
      stubRepos(cardDetails, ["Karma", "Ivern"]),
      {
        format: "custom-region",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [
        line({ id: "a", resolvedCardId: "legend-karma", zone: "legend" }),
        line({ id: "b", resolvedCardId: "sig-daisy", zone: "main" }),
      ],
    );
    const codes = advisories.violations.map((violation) => violation.code);
    expect(codes).toContain("SIGNATURE_CHAMPION_COPIES");
  });

  it("does not query champion tags for non-custom-region formats", async () => {
    const advisories = await buildEntryAdvisories(
      stubRepos(new Map(), null),
      {
        format: "constructed",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [],
    );
    expect(advisories.violations.some((v) => v.code === "SIGNATURE_CHAMPION_COPIES")).toBe(false);
  });

  it("flags a card whose ban is in effect and passes one whose ban starts tomorrow", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T12:00:00.000Z"));
    const constructed = WellKnown.banFormat.CONSTRUCTED;
    const advisories = await buildEntryAdvisories(
      stubRepos(new Map(), null, [
        { cardId: "banned-now", formatId: constructed, bannedAt: "2026-09-17" },
        { cardId: "banned-soon", formatId: constructed, bannedAt: "2026-09-18" },
      ]),
      {
        format: "constructed",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [
        line({ id: "a", resolvedCardId: "banned-now", zone: "main" }),
        line({ id: "b", resolvedCardId: "banned-soon", zone: "main" }),
      ],
    );
    const banned = advisories.violations.filter((violation) => violation.code === "banned-card");
    expect(banned.map((violation) => violation.cardId)).toEqual(["banned-now"]);
  });

  it("judges bans by the event's start day, not by today", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T12:00:00.000Z"));
    const constructed = WellKnown.banFormat.CONSTRUCTED;
    const repos = stubRepos(new Map(), null, [
      { cardId: "banned-before-event", formatId: constructed, bannedAt: "2026-09-19" },
      { cardId: "banned-after-event", formatId: constructed, bannedAt: "2026-09-21" },
    ]);
    const lines = [
      line({ id: "a", resolvedCardId: "banned-before-event", zone: "main" }),
      line({ id: "b", resolvedCardId: "banned-after-event", zone: "main" }),
    ];
    const advisories = await buildEntryAdvisories(
      repos,
      {
        format: "constructed",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: new Date("2026-09-20T09:00:00.000Z"),
        circuit: null,
      },
      lines,
    );
    const banned = advisories.violations.filter((violation) => violation.code === "banned-card");
    expect(banned.map((violation) => violation.cardId)).toEqual(["banned-before-event"]);
  });

  it("flags a card banned at a past event even though it was unbanned since", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    const constructed = WellKnown.banFormat.CONSTRUCTED;
    const repos = stubRepos(new Map(), null, [
      {
        cardId: "unbanned-later",
        formatId: constructed,
        bannedAt: "2026-09-01",
        unbannedAt: "2026-09-25",
      },
      {
        cardId: "unbanned-before",
        formatId: constructed,
        bannedAt: "2026-09-01",
        unbannedAt: "2026-09-20",
      },
    ]);
    const advisories = await buildEntryAdvisories(
      repos,
      {
        format: "constructed",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: new Date("2026-09-20T09:00:00.000Z"),
        circuit: null,
      },
      [
        line({ id: "a", resolvedCardId: "unbanned-later", zone: "main" }),
        line({ id: "b", resolvedCardId: "unbanned-before", zone: "main" }),
      ],
    );
    const banned = advisories.violations.filter((violation) => violation.code === "banned-card");
    expect(banned.map((violation) => violation.cardId)).toEqual(["unbanned-later"]);
  });

  it("judges a circuit event by the circuit's rows, which replace the global ban", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T12:00:00.000Z"));
    const constructed = WellKnown.banFormat.CONSTRUCTED;
    const repos = stubRepos(new Map(), null, [
      { cardId: "global-only", formatId: constructed, bannedAt: "2026-03-31" },
      { cardId: "pending-in-korea", formatId: constructed, bannedAt: "2026-03-31" },
      { cardId: "pending-in-korea", formatId: constructed, bannedAt: null, circuit: "korea" },
    ]);
    const lines = [
      line({ id: "a", resolvedCardId: "global-only", zone: "main" }),
      line({ id: "b", resolvedCardId: "pending-in-korea", zone: "main" }),
    ];
    const event = { format: "constructed", playMode: "1v1" as const, allowedSets: null };
    const banned = async (circuit: string | null) => {
      const result = await buildEntryAdvisories(
        repos,
        { ...event, eventDate: null, circuit },
        lines,
      );
      return result.violations
        .filter((violation) => violation.code === "banned-card")
        .map((violation) => violation.cardId);
    };

    expect(await banned(null)).toEqual(["global-only", "pending-in-korea"]);
    expect(await banned("korea")).toEqual(["global-only"]);
  });

  it("judges a 2v2 event by the 2v2 list alone", async () => {
    const repos = stubRepos(new Map(), null, [
      {
        cardId: "constructed-only",
        formatId: WellKnown.banFormat.CONSTRUCTED,
        bannedAt: "2026-03-31",
      },
      { cardId: "banned-in-2v2", formatId: WellKnown.banFormat.TWO_V_TWO, bannedAt: "2026-07-24" },
    ]);
    const advisories = await buildEntryAdvisories(
      repos,
      {
        format: "constructed",
        playMode: "2v2" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [
        line({ id: "a", resolvedCardId: "constructed-only", zone: "main" }),
        line({ id: "b", resolvedCardId: "banned-in-2v2", zone: "main" }),
      ],
    );
    const banned = advisories.violations.filter((violation) => violation.code === "banned-card");
    expect(banned.map((violation) => [violation.cardId, violation.message])).toEqual([
      ["banned-in-2v2", "Some Card is banned in 2v2"],
    ]);
  });

  it("flags a card whose only set rotated out before the event", async () => {
    const cardDetails = new Map<string, StubCardDetail>([
      [
        "old-unit",
        {
          id: "old-unit",
          name: "Old Unit",
          types: ["unit"],
          superTypes: [],
          domains: [],
          tags: [],
          keywords: [],
        },
      ],
    ]);
    const repos = stubRepos(cardDetails, null, [], {
      numbered: new Map([["old-unit", ["OGN"]]]),
      windows: [{ setSlug: "OGN", legalFrom: "2025-10-31", legalUntil: "2028-01-28" }],
    });
    const event = { format: "constructed", playMode: "1v1" as const, allowedSets: null };
    const lines = [line({ id: "a", resolvedCardId: "old-unit", zone: "main" })];
    const codes = async (day: string) => {
      const result = await buildEntryAdvisories(
        repos,
        { ...event, eventDate: new Date(`${day}T09:00:00.000Z`), circuit: null },
        lines,
      );
      return result.violations.map((violation) => violation.code);
    };

    expect(await codes("2027-06-01")).not.toContain("CARD_ROTATED");
    expect(await codes("2028-02-01")).toContain("CARD_ROTATED");

    const withOwnSets = await buildEntryAdvisories(
      repos,
      {
        ...event,
        allowedSets: ["OGN"],
        eventDate: new Date("2028-02-01T09:00:00.000Z"),
        circuit: null,
      },
      lines,
    );
    expect(withOwnSets.violations.map((violation) => violation.code)).not.toContain("CARD_ROTATED");
  });

  it("flags a constructed deck that breaks the deck rules", async () => {
    const advisories = await buildEntryAdvisories(
      stubRepos(new Map(), null),
      {
        format: "constructed",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [],
    );
    expect(advisories.violations.length).toBeGreaterThan(0);
  });

  it("reports nothing for a freeform event, banned cards included", async () => {
    const advisories = await buildEntryAdvisories(
      stubRepos(new Map(), null, [
        { cardId: "banned", formatId: WellKnown.banFormat.CONSTRUCTED, bannedAt: "2020-01-01" },
      ]),
      {
        format: "freeform",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [line({ id: "a", resolvedCardId: "banned", zone: "main" })],
    );
    expect(advisories.violations).toEqual([]);
  });

  it("flags no banned cards at an infinity event", async () => {
    const advisories = await buildEntryAdvisories(
      stubRepos(new Map(), null, [
        { cardId: "banned", formatId: WellKnown.banFormat.CONSTRUCTED, bannedAt: "2026-01-01" },
      ]),
      {
        format: "infinity",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [line({ id: "a", resolvedCardId: "banned", zone: "main" })],
    );
    expect(advisories.violations.some((v) => v.code === "banned-card")).toBe(false);
  });

  it("flags no banned cards at a custom-region event", async () => {
    const advisories = await buildEntryAdvisories(
      stubRepos(
        new Map(),
        [],
        [{ cardId: "banned", formatId: WellKnown.banFormat.CONSTRUCTED, bannedAt: "2026-01-01" }],
      ),
      {
        format: "custom-region",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [line({ id: "a", resolvedCardId: "banned", zone: "main" })],
    );
    expect(advisories.violations.some((v) => v.code === "banned-card")).toBe(false);
  });

  it("suppresses the region-config rules a checked list can't satisfy", async () => {
    // A checked list carries no region/custom tags, so FORMAT_TAG_REQUIRED
    // would otherwise fire as noise on every custom-region check.
    const cardDetails = new Map<string, StubCardDetail>([
      [
        "legend-karma",
        {
          id: "legend-karma",
          name: "Karma",
          types: ["legend"],
          superTypes: [],
          domains: [],
          tags: ["Karma"],
          keywords: [],
        },
      ],
    ]);
    const advisories = await buildEntryAdvisories(
      stubRepos(cardDetails, []),
      {
        format: "custom-region",
        playMode: "1v1" as const,
        allowedSets: null,
        eventDate: null,
        circuit: null,
      },
      [line({ id: "a", resolvedCardId: "legend-karma", zone: "legend" })],
    );
    const codes = advisories.violations.map((violation) => violation.code);
    expect(codes).not.toContain("FORMAT_TAG_REQUIRED");
    expect(codes).not.toContain("CARD_NOT_IN_FORMAT_TAG");
    expect(codes.length).toBeGreaterThan(0);
  });
});

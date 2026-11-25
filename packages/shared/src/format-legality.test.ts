import { describe, expect, it } from "vitest";

import {
  banFormatsInEffect,
  bansInEffect,
  cardBansFor,
  cardIdsBannedIn,
  cardSetLegality,
  setWindowFormatFor,
  standardSetLegality,
} from "./format-legality";
import type { FormatSetWindow } from "./format-legality";
import type { CardBan, CircuitCardBan } from "./types/catalog";
import { WellKnown } from "./well-known";

const STANDARD = WellKnown.banFormat.CONSTRUCTED;

function ban(bannedAt: string, formatId: string = STANDARD): CardBan {
  return { formatId, formatName: formatId, bannedAt, reason: null };
}

function circuitBan(
  bannedAt: string | null,
  unbannedAt: string | null = null,
  circuit = "korea",
): CircuitCardBan {
  return { formatId: STANDARD, formatName: STANDARD, circuit, bannedAt, unbannedAt, reason: null };
}

function window(
  setSlug: string,
  legalFrom: string | null,
  extra: Partial<FormatSetWindow> = {},
): FormatSetWindow {
  return { formatId: STANDARD, setSlug, legalFrom, ...extra };
}

describe("setWindowFormatFor", () => {
  it("maps Constructed decks to Standard's windows and leaves the rest unrestricted", () => {
    expect(setWindowFormatFor(WellKnown.deckFormat.CONSTRUCTED)).toBe(STANDARD);
    expect(setWindowFormatFor(WellKnown.deckFormat.FREEFORM)).toBeUndefined();
    expect(setWindowFormatFor(WellKnown.deckFormat.INFINITY)).toBeUndefined();
  });
});

describe("cardBansFor", () => {
  const card = { bans: [ban("2026-03-31")], upcomingBans: [ban("2026-12-01", "2v2")] };

  it("keeps the card's own lists without a circuit or circuit rows", () => {
    expect(cardBansFor(card)).toEqual({ bans: card.bans, upcomingBans: card.upcomingBans });
    expect(cardBansFor({ ...card, circuitBans: [circuitBan(null)] }, { circuit: "china" })).toEqual(
      { bans: card.bans, upcomingBans: card.upcomingBans },
    );
  });

  it("lets an undated circuit row lift the global ban there", () => {
    const resolved = cardBansFor(
      { ...card, circuitBans: [circuitBan("2026-03-31", "2026-11-23"), circuitBan(null)] },
      { circuit: "korea", day: "2026-11-25" },
    );
    expect(resolved.bans).toEqual([]);
    expect(resolved.upcomingBans).toEqual(card.upcomingBans);
  });

  it("splits dated circuit rows into in effect and scheduled", () => {
    const before = cardBansFor(
      { ...card, circuitBans: [circuitBan("2026-12-01")] },
      { circuit: "korea", day: "2026-11-25" },
    );
    expect(before.bans).toEqual([]);
    expect(before.upcomingBans.map((entry) => entry.bannedAt)).toEqual([
      "2026-12-01",
      "2026-12-01",
    ]);

    const after = cardBansFor(
      { ...card, circuitBans: [circuitBan("2026-12-01")] },
      { circuit: "korea", day: "2026-12-01" },
    );
    expect(after.bans.map((entry) => entry.formatId).toSorted()).toEqual(["2v2", STANDARD]);
    expect(after.upcomingBans).toEqual([]);
  });

  it("keeps a global ban of a format the circuit has no rows for", () => {
    const resolved = cardBansFor(
      { bans: [ban("2026-07-24", "2v2")], upcomingBans: [], circuitBans: [circuitBan(null)] },
      { circuit: "korea", day: "2026-11-25" },
    );
    expect(resolved.bans.map((entry) => entry.formatId)).toEqual(["2v2"]);
  });
});

describe("bansInEffect", () => {
  it("reads the card's bans without a circuit", () => {
    const card = { bans: [ban("2026-03-31")], upcomingBans: [], circuitBans: [circuitBan(null)] };
    expect(bansInEffect(card)).toBe(card.bans);
    expect(bansInEffect(card, { windows: [] })).toBe(card.bans);
    expect(bansInEffect(card, { circuit: "korea", windows: [] })).toEqual([]);
  });
});

describe("banFormatsInEffect", () => {
  const rows = [
    { formatId: STANDARD, circuit: null, bannedAt: "2026-03-31", unbannedAt: null },
    { formatId: "2v2", circuit: null, bannedAt: "2026-07-24", unbannedAt: "2026-09-01" },
    { formatId: STANDARD, circuit: "korea", bannedAt: "2026-03-31", unbannedAt: "2026-11-23" },
    { formatId: STANDARD, circuit: "korea", bannedAt: null, unbannedAt: null },
  ];

  it("counts a ban from its start day to the day before its lift", () => {
    expect(banFormatsInEffect(rows, { day: "2026-08-01" })).toEqual(new Set([STANDARD, "2v2"]));
    expect(banFormatsInEffect(rows, { day: "2026-09-01" })).toEqual(new Set([STANDARD]));
  });

  it("uses the circuit's history in place of the global rows", () => {
    expect(banFormatsInEffect(rows, { circuit: "korea", day: "2026-10-01" })).toEqual(
      new Set([STANDARD]),
    );
    expect(banFormatsInEffect(rows, { circuit: "korea", day: "2026-11-25" })).toEqual(new Set());
  });
});

describe("cardIdsBannedIn", () => {
  it("groups rows by card", () => {
    const rows = [
      { cardId: "a", formatId: STANDARD, circuit: null, bannedAt: "2026-03-31", unbannedAt: null },
      { cardId: "b", formatId: "2v2", circuit: null, bannedAt: "2026-03-31", unbannedAt: null },
    ];
    expect(cardIdsBannedIn(rows, STANDARD, { day: "2026-04-01" })).toEqual(new Set(["a"]));
  });
});

describe("cardSetLegality", () => {
  const windows = [
    window("OGN", "2025-10-31", { legalUntil: "2028-01-28" }),
    window("SFD", "2026-02-13"),
    window("LGC", "2027-01-29"),
    window("OGN", "2026-09-18", { circuit: "korea" }),
    window("SFD", null, { circuit: "korea" }),
  ];

  it("passes every card in a format with no windows", () => {
    expect(cardSetLegality(["FND"], windows, "freeform")).toEqual({ status: "legal" });
  });

  it("is legal while any numbered set is", () => {
    expect(cardSetLegality(["OGN", "SFD"], windows, STANDARD, { day: "2028-03-01" })).toEqual({
      status: "legal",
    });
  });

  it("reports the rotation day once every set is out", () => {
    expect(cardSetLegality(["OGN"], windows, STANDARD, { day: "2028-01-28" })).toEqual({
      status: "rotated",
      until: "2028-01-28",
    });
    expect(cardSetLegality(["OGN"], windows, STANDARD, { day: "2028-01-27" })).toEqual({
      status: "legal",
    });
  });

  it("reports the first legal day of an upcoming set", () => {
    expect(cardSetLegality(["LGC"], windows, STANDARD, { day: "2026-11-25" })).toEqual({
      status: "upcoming",
      from: "2027-01-29",
    });
  });

  it("is outside the format for a set without a window", () => {
    expect(cardSetLegality(["FND"], windows, STANDARD, { day: "2026-11-25" })).toEqual({
      status: "outside",
    });
  });

  it("uses a circuit's window in place of the global one", () => {
    const korea = { circuit: "korea", day: "2026-11-25" };
    expect(cardSetLegality(["SFD"], windows, STANDARD, korea)).toEqual({ status: "upcoming" });
    expect(cardSetLegality(["OGN"], windows, STANDARD, korea)).toEqual({ status: "legal" });
    expect(cardSetLegality(["OGN"], windows, STANDARD, { ...korea, day: "2026-09-17" })).toEqual({
      status: "upcoming",
      from: "2026-09-18",
    });
  });

  it("prefers a dated upcoming set over an undated one", () => {
    const mixed = [window("A", null), window("B", "2027-05-01"), window("C", "2027-03-01")];
    expect(cardSetLegality(["A", "B", "C"], mixed, STANDARD, { day: "2026-11-25" })).toEqual({
      status: "upcoming",
      from: "2027-03-01",
    });
  });
});

describe("standardSetLegality", () => {
  it("passes every card without a context", () => {
    expect(standardSetLegality({ numberedSetSlugs: [] })).toEqual({ status: "legal" });
  });

  it("judges by Standard's windows", () => {
    expect(
      standardSetLegality(
        { numberedSetSlugs: ["FND"] },
        { windows: [window("OGN", "2025-10-31")] },
      ),
    ).toEqual({ status: "outside" });
  });
});

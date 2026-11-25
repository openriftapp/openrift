import type { CardBan } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import {
  metaDeckBans,
  metaDeckCardBanStates,
  nextBanDate,
  soleModeBanFormat,
} from "@/features/meta/lib/meta-deck-bans";

const CONSTRUCTED = WellKnown.banFormat.CONSTRUCTED;

function ban(
  bannedAt: string,
  formatId: string = CONSTRUCTED,
  formatName = "Constructed",
): CardBan {
  return { formatId, formatName, bannedAt, reason: null };
}

function card(name: string, bans: CardBan[] = [], upcomingBans: CardBan[] = []) {
  return { name, types: ["unit" as const], tags: [], bans, upcomingBans };
}

function deck(main: [string, number][], side: [string, number][] = []) {
  return { main: new Map(main), side: new Map(side) };
}

const cardsById = {
  hourglass: card("Zhonya's Hourglass", [], [ban("2026-11-23")]),
  herder: card("Stellacorn Herder", [], [ban("2026-11-23")]),
  ekko: card("Ekko, Recurrent", [ban("2026-09-18")]),
  duo: card("Twin Strike", [ban("2026-10-01", "2v2", "2v2")]),
  plain: card("Plain Unit"),
};

describe("metaDeckBans", () => {
  it("groups banned and soon-banned cards per deck, bans in effect first", () => {
    const result = metaDeckBans(
      new Map([
        [
          "d1",
          deck(
            [
              ["herder", 3],
              ["hourglass", 2],
              ["ekko", 2],
              ["plain", 3],
            ],
            [["hourglass", 1]],
          ),
        ],
      ]),
      cardsById,
    );

    expect(result.get("d1")).toEqual([
      {
        formatId: CONSTRUCTED,
        formatName: "Constructed",
        bannedAt: "2026-09-18",
        inEffect: true,
        cards: [{ cardId: "ekko", displayName: "Ekko, Recurrent", main: 2, side: 0 }],
      },
      {
        formatId: CONSTRUCTED,
        formatName: "Constructed",
        bannedAt: "2026-11-23",
        inEffect: false,
        cards: [
          { cardId: "herder", displayName: "Stellacorn Herder", main: 3, side: 0 },
          { cardId: "hourglass", displayName: "Zhonya's Hourglass", main: 2, side: 1 },
        ],
      },
    ]);
  });

  it("reads the viewer's circuit, where a pending circuit row lifts the global ban", () => {
    const lifted = {
      ...card("Ekko, Recurrent", [ban("2026-09-18")]),
      circuitBans: [
        {
          formatId: CONSTRUCTED,
          formatName: "Constructed",
          circuit: "korea",
          bannedAt: null,
          unbannedAt: null,
          reason: null,
        },
      ],
    };
    const decks = new Map([["d", deck([["ekko", 2]])]]);
    expect(metaDeckBans(decks, { ekko: lifted }).has("d")).toBe(true);
    expect(metaDeckBans(decks, { ekko: lifted }, { circuit: "korea", windows: [] }).has("d")).toBe(
      false,
    );
  });

  it("counts a card played only in the sideboard", () => {
    const result = metaDeckBans(new Map([["d", deck([["plain", 3]], [["herder", 2]])]]), cardsById);

    expect(result.get("d")?.[0]?.cards).toEqual([
      { cardId: "herder", displayName: "Stellacorn Herder", main: 0, side: 2 },
    ]);
  });

  it("leaves out decks without banned cards and cards missing from the catalog", () => {
    const result = metaDeckBans(
      new Map([
        ["clean", deck([["plain", 3]])],
        ["unknown", deck([["gone", 3]])],
      ]),
      cardsById,
    );

    expect(result.size).toBe(0);
  });
});

describe("soleModeBanFormat", () => {
  it("names the format when every ban in effect is scoped to one mode", () => {
    const groups = metaDeckBans(new Map([["d", deck([["duo", 1]])]]), cardsById).get("d") ?? [];

    expect(soleModeBanFormat(groups, true)).toBe("2v2");
  });

  it("is undefined once a constructed ban is in effect", () => {
    const groups =
      metaDeckBans(
        new Map([
          [
            "d",
            deck([
              ["duo", 1],
              ["ekko", 1],
            ]),
          ],
        ]),
        cardsById,
      ).get("d") ?? [];

    expect(soleModeBanFormat(groups, true)).toBeUndefined();
  });

  it("names the mode of an upcoming ban scoped to one mode", () => {
    const later = card("Later Duo", [], [ban("2026-12-01", "2v2", "2v2")]);
    const groups =
      metaDeckBans(new Map([["d", deck([["later", 1]])]]), { ...cardsById, later }).get("d") ?? [];

    expect(soleModeBanFormat(groups, false)).toBe("2v2");
  });

  it("is undefined when only upcoming bans exist", () => {
    const groups =
      metaDeckBans(new Map([["d", deck([["hourglass", 1]])]]), cardsById).get("d") ?? [];

    expect(soleModeBanFormat(groups, true)).toBeUndefined();
  });
});

describe("nextBanDate", () => {
  it("returns the earliest upcoming date and ignores bans in effect", () => {
    const groups =
      metaDeckBans(
        new Map([
          [
            "d",
            deck([
              ["ekko", 1],
              ["hourglass", 1],
              ["late", 1],
            ]),
          ],
        ]),
        { ...cardsById, late: card("Late Card", [], [ban("2027-01-10")]) },
      ).get("d") ?? [];

    expect(nextBanDate(groups)).toBe("2026-11-23");
  });

  it("is undefined without upcoming bans", () => {
    const groups = metaDeckBans(new Map([["d", deck([["ekko", 1]])]]), cardsById).get("d") ?? [];

    expect(nextBanDate(groups)).toBeUndefined();
  });
});

describe("metaDeckCardBanStates", () => {
  it("marks a card banned now over a later ban on the same card", () => {
    const both = card("Both", [ban("2026-09-18")], [ban("2026-12-01", "2v2", "2v2")]);
    const groups =
      metaDeckBans(
        new Map([
          [
            "d",
            deck([
              ["both", 1],
              ["herder", 3],
            ]),
          ],
        ]),
        { ...cardsById, both },
      ).get("d") ?? [];

    expect(metaDeckCardBanStates(groups)).toEqual(
      new Map([
        ["both", { state: "banned", modeFormat: undefined }],
        ["herder", { state: "upcoming", modeFormat: undefined }],
      ]),
    );
  });

  it("names the mode for a card banned only in that mode", () => {
    const groups = metaDeckBans(new Map([["d", deck([["duo", 1]])]]), cardsById).get("d") ?? [];

    expect(metaDeckCardBanStates(groups).get("duo")).toEqual({
      state: "banned",
      modeFormat: "2v2",
    });
  });
});

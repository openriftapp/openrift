import { describe, expect, it } from "vitest";

import { makePrinting } from "../test-factories.js";
import type { Card, DistributionChannel, Printing } from "../types/catalog.js";
import { boosterChannelSlugs, toBoosterPrintings } from "./input.js";
import {
  boosterRowsByPrinting,
  boosterRowsForPrinting,
  inSlotOverlaps,
  resolveBooster,
  weakestBasis,
} from "./resolve.js";
import type { ResolvedBooster } from "./types.js";

const ORIGINS = "origins-booster-pack";

let nextId = 0;

function side(
  overrides: Omit<Partial<Printing>, "card"> & { card?: Partial<Card> } = {},
): Printing {
  nextId += 1;
  return makePrinting({
    printingId: `p-${nextId}`,
    shortCode: `OGN-${String(nextId).padStart(3, "0")}`,
    setSlug: "OGN",
    language: "EN",
    rarity: "common",
    finish: "normal",
    artVariant: "normal",
    size: "standard",
    isSigned: false,
    isOvernumbered: false,
    ...overrides,
    card: { types: ["unit"], superTypes: [], ...overrides.card },
  });
}

function channel(slug: string): Printing["distributionChannels"][number] {
  const def: DistributionChannel = {
    id: `ch-${slug}`,
    slug,
    label: slug,
    description: null,
    kind: "product",
    parentId: null,
    childrenLabel: null,
  };
  return {
    channel: def,
    distributionNote: null,
    ancestorLabels: slug.startsWith("booster-") ? ["Booster Pack"] : [],
    ancestorSlugs: slug.startsWith("booster-") ? ["booster"] : [],
  };
}

const rune = { card: { types: ["rune" as const] } };

function originsFixture(language = "EN"): Printing[] {
  const base = { language };
  const buffFront = side({ ...base, card: { types: ["other"] } });
  const tokenBack: Printing = {
    ...side({ ...base, card: { types: ["unit"], superTypes: ["token"] } }),
    printingId: buffFront.printingId,
    side: 2,
  };
  return [
    side({ ...base, rarity: "common" }),
    side({ ...base, rarity: "uncommon" }),
    side({ ...base, rarity: "rare", finish: "foil" }),
    side({ ...base, rarity: "common", finish: "foil" }),
    side({ ...base, rarity: "uncommon", finish: "foil" }),
    side({ ...base, rarity: "epic", finish: "foil" }),
    side({ ...base, rarity: "showcase", finish: "foil", artVariant: "altart" }),
    side({ ...base, rarity: "showcase", finish: "foil", isOvernumbered: true }),
    side({ ...base, rarity: "showcase", finish: "foil", isOvernumbered: true, isSigned: true }),
    side({ ...base, rarity: "showcase", finish: "foil", artVariant: "altart", ...rune }),
    side({ ...base, ...rune }),
    side({ ...base, card: { types: ["unit"], superTypes: ["token"] } }),
    buffFront,
    tokenBack,
    side({ ...base, rarity: "uncommon", size: "oversized" }),
    side({ ...base, rarity: "rare", finish: "foil", distributionChannels: [channel("nexus")] }),
    side({
      ...base,
      rarity: "common",
      markers: [{ id: "m", slug: "promo", label: "Promo", description: null }],
    }),
    side({ ...base, setSlug: "ARC", rarity: "showcase", artVariant: "altart" }),
  ];
}

function resolveOrigins(printings: Printing[], language = "EN"): ResolvedBooster {
  const resolved = resolveBooster(ORIGINS, language, toBoosterPrintings(printings));
  if (!resolved) {
    throw new Error("Origins did not resolve");
  }
  return resolved;
}

function poolSizes(booster: ResolvedBooster): Record<string, number> {
  return Object.fromEntries(
    booster.slots.flatMap((slot) =>
      slot.outcomes.map((outcome) => [`${slot.slug}/${outcome.slug}`, outcome.pool.length]),
    ),
  );
}

describe("resolveBooster", () => {
  it("puts each Origins printing in its outcome and leaves out oversized, channel, marker and other-set printings", () => {
    const booster = resolveOrigins(originsFixture());
    expect(poolSizes(booster)).toEqual({
      "common/common": 1,
      "uncommon/uncommon": 1,
      "foil/foil-epic": 1,
      "foil/foil-rare": 1,
      "foil/foil-common-uncommon": 2,
      "rare/signed-overnumbered": 1,
      "rare/overnumbered": 1,
      "rare/alt-art": 1,
      "rare/epic": 1,
      "rare/rare": 1,
      "rune/alt-art-rune": 1,
      "rune/token": 2,
      "rune/rune": 1,
    });
    expect(inSlotOverlaps(booster)).toEqual([]);
    expect(booster.openable).toBe(true);
  });

  it("counts a token whose first face is a buff as a token", () => {
    const booster = resolveOrigins(originsFixture());
    const token = booster.slots.find((slot) => slot.slug === "rune")?.outcomes[1];
    expect(token?.pool.map((p) => p.types.toSorted())).toContainEqual(["other", "unit"]);
  });

  it("gives the fill the slot count minus its siblings and the weakest sibling basis", () => {
    const booster = resolveOrigins(originsFixture());
    const rare = booster.slots.find((slot) => slot.slug === "rare");
    const fill = rare?.outcomes.find((outcome) => outcome.fillsRest);
    expect(fill?.perPack).toBeCloseTo(2 - 1 / 720 - 1 / 80 - 1 / 12 - 0.25);
    expect(fill?.basis).toBe("official");
    const foilFill = booster.slots.find((slot) => slot.slug === "foil")?.outcomes[1];
    expect(foilFill?.basis).toBe("guess");
  });

  it("hands an empty pool's share to the fill", () => {
    const printings = originsFixture().filter(
      (p) => p.artVariant !== "altart" || p.card.types.includes("rune"),
    );
    const rare = resolveOrigins(printings).slots.find((slot) => slot.slug === "rare");
    expect(rare?.outcomes.find((o) => o.slug === "alt-art")?.perPack).toBe(0);
    expect(rare?.outcomes.find((o) => o.fillsRest)?.perPack).toBeCloseTo(
      2 - 1 / 720 - 1 / 80 - 0.25,
    );
  });

  it("caps every basis at estimate in Korean", () => {
    const booster = resolveOrigins(originsFixture("KR"), "KR");
    const bases = booster.slots.flatMap((slot) => slot.outcomes.map((outcome) => outcome.basis));
    expect(bases).not.toContain("official");
  });

  it("cannot open a language with an empty fill pool", () => {
    const withoutRunes = originsFixture().filter((p) => !p.card.types.includes("rune"));
    expect(resolveOrigins(withoutRunes).openable).toBe(false);
  });

  it("puts a printing under a booster channel into the outcome it matches, markers or not", () => {
    const promo = [{ id: "m", slug: "promo", label: "Promo", description: null }];
    const altArtToken = side({
      language: "SC",
      artVariant: "altart",
      finish: "foil",
      card: { types: ["unit"], superTypes: ["token"] },
      markers: promo,
      distributionChannels: [channel("booster-ven")],
    });
    const signedFox = side({
      language: "SC",
      rarity: "showcase",
      finish: "foil",
      isSigned: true,
      isOvernumbered: true,
      distributionChannels: [channel("booster-ogn-kr")],
    });
    const booster = resolveOrigins([...originsFixture("SC"), altArtToken, signedFox], "SC");
    expect(poolSizes(booster)["rune/token"]).toBe(3);
    expect(poolSizes(booster)["rare/signed-overnumbered"]).toBe(2);
    expect(booster.slots.flatMap((slot) => slot.outcomes).map((o) => o.slug)).not.toContain(
      "pack-exclusive",
    );
  });

  it("keeps an alt-art Overnumbered printing out of the alt-art pool", () => {
    const altOvernumbered = side({
      rarity: "showcase",
      artVariant: "altart",
      finish: "foil",
      isOvernumbered: true,
    });
    const booster = resolveOrigins([...originsFixture(), altOvernumbered]);
    expect(poolSizes(booster)["rare/alt-art"]).toBe(1);
    expect(poolSizes(booster)["rare/overnumbered"]).toBe(2);
  });

  it("lets only one Rare card hold the Unleashed Ultimate, so a pack has one at most", () => {
    const rare = resolveBooster("unleashed-booster-pack", "EN", [])?.slots.find(
      (slot) => slot.slug === "rare",
    );
    expect(rare?.outcomes.find((outcome) => outcome.slug === "ultimate")?.cards).toBe(1);
  });

  it("returns null for an unknown booster or language", () => {
    expect(resolveBooster("nope", "EN", [])).toBeNull();
    expect(resolveBooster(ORIGINS, "DE", [])).toBeNull();
  });
});

describe("boosterRowsByPrinting", () => {
  it("gives a foil Rare one row per slot it can come from", () => {
    const printings = originsFixture();
    const rare = printings[2];
    const rows = boosterRowsByPrinting([resolveOrigins(printings)]).get(rare?.printingId ?? "");
    expect(rows?.map((row) => [row.slot, row.outcome])).toEqual([
      ["foil", "foil-rare"],
      ["rare", "rare"],
    ]);
    expect(rows?.[0]).toMatchObject({ packsPerBox: 24, boxesPerCase: 6, poolSize: 1 });
  });
});

describe("weakestBasis", () => {
  it("picks the weakest basis", () => {
    expect(weakestBasis("official", "guess", "estimate")).toBe("guess");
    expect(weakestBasis("official")).toBe("official");
  });
});

describe("boosterRowsForPrinting", () => {
  it("returns a printing's rows, and none once a channel takes it out of the pack", () => {
    const printings = toBoosterPrintings(originsFixture());
    const rare = printings.find((p) => p.rarity === "rare" && p.finish === "foil");
    if (!rare) {
      throw new Error("no rare");
    }
    expect(boosterRowsForPrinting(printings, rare.printingId).map((row) => row.slot)).toEqual([
      "foil",
      "rare",
    ]);
    const changed = printings.map((p) =>
      p.printingId === rare.printingId ? { ...p, hasChannel: true } : p,
    );
    expect(boosterRowsForPrinting(changed, rare.printingId)).toEqual([]);
  });

  it("returns nothing for a printing outside every booster set", () => {
    const arcane = side({ setSlug: "ARC" });
    expect(boosterRowsForPrinting(toBoosterPrintings([arcane]), arcane.printingId)).toEqual([]);
  });
});

describe("boosterChannelSlugs", () => {
  it("collects booster and every channel below it", () => {
    const channels = [
      { id: "1", slug: "booster", parentId: null },
      { id: "2", slug: "booster-ogn-kr", parentId: "1" },
      { id: "3", slug: "nexus-night", parentId: null },
    ];
    expect([...boosterChannelSlugs(channels)].toSorted()).toEqual(["booster", "booster-ogn-kr"]);
  });
});
